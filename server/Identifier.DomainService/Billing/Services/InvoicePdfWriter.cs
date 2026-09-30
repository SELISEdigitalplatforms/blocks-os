using System.Globalization;
using System.Text;
using DomainService.Billing.Entities;

namespace DomainService.Billing.Services;

public interface IInvoicePdfWriter
{
    /// <summary>Renders an invoice as a one-page PDF.</summary>
    byte[] Write(Invoice invoice, string projectName);
}

/// <summary>
/// Writes an invoice as a PDF, by hand.
/// </summary>
/// <remarks>
/// No library. A one-page text document is a small, well-specified corner of PDF, and the
/// alternatives each cost more than they save here: a dependency to review and license, or an
/// HTML-to-PDF converter that pulls in a browser.
/// <para>
/// What that buys is a plain, legible invoice with no logo, no colour and no layout engine. If a
/// designed document is wanted later, this is the seam to replace — every caller takes
/// <see cref="IInvoicePdfWriter"/>, not this class.
/// </para>
/// </remarks>
public sealed class InvoicePdfWriter : IInvoicePdfWriter
{
    private const string Font = "Helvetica";
    private const string BoldFont = "Helvetica-Bold";

    // A4 in points, and the margins the text sits inside.
    private const int PageWidth = 595;
    private const int PageHeight = 842;
    private const int Left = 56;
    private const int Right = PageWidth - 56;
    private const int Top = PageHeight - 64;

    public byte[] Write(Invoice invoice, string projectName)
    {
        ArgumentNullException.ThrowIfNull(invoice);

        var content = BuildContent(invoice, projectName);

        return Assemble(content);
    }

    /// <summary>The page's drawing instructions.</summary>
    private static string BuildContent(Invoice invoice, string projectName)
    {
        var page = new StringBuilder();
        var y = Top;

        void Text(string value, int x, int size, bool bold = false)
        {
            page.Append("BT /")
                .Append(bold ? "F2" : "F1")
                .Append(' ').Append(size).Append(" Tf ")
                .Append(x).Append(' ').Append(y).Append(" Td (")
                .Append(Escape(value))
                .Append(") Tj ET\n");
        }

        /// <summary>Right-aligns by estimating width; Helvetica averages about 0.5em per glyph.</summary>
        void RightText(string value, int size, bool bold = false)
        {
            var width = (int)(value.Length * size * 0.5);
            Text(value, Right - width, size, bold);
        }

        void Rule()
        {
            page.Append("0.8 w ").Append(Left).Append(' ').Append(y)
                .Append(" m ").Append(Right).Append(' ').Append(y).Append(" l S\n");
        }

        Text("INVOICE", Left, 22, bold: true);
        y -= 28;
        Text(invoice.Number, Left, 11);
        y -= 16;
        Text(invoice.IssuedAtUtc.ToString("d MMMM yyyy", CultureInfo.InvariantCulture), Left, 11);
        y -= 16;
        Text(string.IsNullOrWhiteSpace(projectName) ? invoice.TenantGroupId : projectName, Left, 11);

        y -= 28;
        Rule();
        y -= 22;

        Text("Description", Left, 10, bold: true);
        RightText("Amount", 10, bold: true);
        y -= 8;
        Rule();
        y -= 20;

        foreach (var line in invoice.Lines)
        {
            var label = string.IsNullOrWhiteSpace(line.Environment)
                ? line.Label
                : $"{line.Label} ({line.Environment})";

            if (line.Units > 0)
            {
                label += $" — {line.Units.ToString("N0", CultureInfo.InvariantCulture)} units";
            }

            // The word matters on a bill: one is spent money, the other recurs.
            label += line.Billing == "rent" ? " · monthly" : " · one-off";

            Text(label, Left, 10);
            RightText(Money(invoice.Market, line.Amount), 10);
            y -= 18;
        }

        if (invoice.CarriedIn > 0)
        {
            Text("Brought forward from the previous period", Left, 10);
            RightText(Money(invoice.Market, invoice.CarriedIn), 10);
            y -= 18;
        }

        y -= 6;
        Rule();
        y -= 20;

        Text("Subtotal", Left, 10);
        RightText(Money(invoice.Market, invoice.Subtotal), 10);
        y -= 18;

        Text("VAT", Left, 10);
        RightText(Money(invoice.Market, invoice.Vat), 10);
        y -= 22;

        Text("Total", Left, 13, bold: true);
        RightText(Money(invoice.Market, invoice.Total), 13, bold: true);
        y -= 26;

        Text(
            invoice.State == InvoiceStates.Paid
                ? $"Paid {invoice.PaidAtUtc?.ToString("d MMMM yyyy", CultureInfo.InvariantCulture)}"
                : "Unpaid — this amount is added to your next invoice. Nothing has been suspended.",
            Left,
            10);

        return page.ToString();
    }

    private static string Money(string market, decimal amount) =>
        $"{market} {amount.ToString("N2", CultureInfo.InvariantCulture)}";

    /// <summary>
    /// Escapes the three characters that would otherwise end or nest a PDF string literal.
    /// </summary>
    /// <remarks>
    /// A project named <c>Acme (EU)</c> would produce an unbalanced parenthesis and a file no
    /// reader accepts, so this is correctness rather than tidiness.
    /// </remarks>
    private static string Escape(string value) =>
        (value ?? string.Empty)
            .Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace("(", "\\(", StringComparison.Ordinal)
            .Replace(")", "\\)", StringComparison.Ordinal);

    /// <summary>
    /// Wraps the drawing instructions in the five objects a minimal PDF needs, with the
    /// cross-reference table its byte offsets demand.
    /// </summary>
    private static byte[] Assemble(string content)
    {
        var objects = new List<string>
        {
            "<< /Type /Catalog /Pages 2 0 R >>",
            "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            $"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PageWidth} {PageHeight}] "
                + "/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
            $"<< /Length {Encoding.ASCII.GetByteCount(content)} >>\nstream\n{content}endstream",
            $"<< /Type /Font /Subtype /Type1 /BaseFont /{Font} >>",
            $"<< /Type /Font /Subtype /Type1 /BaseFont /{BoldFont} >>",
        };

        var pdf = new StringBuilder("%PDF-1.4\n");
        var offsets = new List<int>();

        for (var i = 0; i < objects.Count; i++)
        {
            offsets.Add(Encoding.ASCII.GetByteCount(pdf.ToString()));
            pdf.Append(i + 1).Append(" 0 obj\n").Append(objects[i]).Append("\nendobj\n");
        }

        var xref = Encoding.ASCII.GetByteCount(pdf.ToString());

        pdf.Append("xref\n0 ").Append(objects.Count + 1).Append('\n')
           .Append("0000000000 65535 f \n");

        foreach (var offset in offsets)
        {
            pdf.Append(offset.ToString("D10", CultureInfo.InvariantCulture)).Append(" 00000 n \n");
        }

        pdf.Append("trailer\n<< /Size ").Append(objects.Count + 1).Append(" /Root 1 0 R >>\n")
           .Append("startxref\n").Append(xref).Append("\n%%EOF");

        return Encoding.ASCII.GetBytes(pdf.ToString());
    }
}
