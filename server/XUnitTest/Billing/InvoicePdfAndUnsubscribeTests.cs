using System.Text;
using DomainService.Billing.Entities;
using DomainService.Billing.Services;
using Xunit;

namespace XUnitTest.Billing;

/// <summary>
/// The PDF is hand-written, so its structure is worth asserting: a reader rejects the whole file
/// for a wrong byte offset or an unbalanced parenthesis.
/// </summary>
public class InvoicePdfWriterTests
{
    private readonly InvoicePdfWriter _writer = new();

    private static Invoice Invoice() => new()
    {
        ItemId = "inv_1",
        Number = "INV-2026-09-0412",
        TenantGroupId = "grp_1",
        Market = "CHF",
        Subtotal = 300m,
        Vat = 24.3m,
        Total = 324.3m,
        State = InvoiceStates.Paid,
        IssuedAtUtc = new DateTime(2026, 9, 12, 0, 0, 0, DateTimeKind.Utc),
        PaidAtUtc = new DateTime(2026, 9, 12, 0, 0, 0, DateTimeKind.Utc),
        Lines = [new InvoiceLine { Label = "Production", Environment = "prod", Amount = 300m, Billing = "rent" }],
    };

    private static string Text(byte[] pdf) => Encoding.ASCII.GetString(pdf);

    [Fact]
    public void It_is_a_pdf_a_reader_will_open()
    {
        var text = Text(_writer.Write(Invoice(), "Northwind"));

        Assert.StartsWith("%PDF-1.4", text, StringComparison.Ordinal);
        Assert.EndsWith("%%EOF", text, StringComparison.Ordinal);
        Assert.Contains("/Type /Catalog", text, StringComparison.Ordinal);
        Assert.Contains("trailer", text, StringComparison.Ordinal);
    }

    [Fact]
    public void Every_cross_reference_offset_points_at_its_object()
    {
        var pdf = _writer.Write(Invoice(), "Northwind");
        var text = Text(pdf);

        var xrefAt = text.IndexOf("xref\n", StringComparison.Ordinal);
        var lines = text[xrefAt..].Split('\n');

        // Skip "xref", the "0 N" count and the free entry; the rest are object offsets.
        for (var i = 3; i < lines.Length && lines[i].EndsWith(" 00000 n ", StringComparison.Ordinal); i++)
        {
            var offset = int.Parse(lines[i][..10]);
            var objectNumber = i - 2;

            // A wrong offset is the classic hand-rolled-PDF bug, and readers fail the whole file.
            Assert.StartsWith($"{objectNumber} 0 obj", text[offset..], StringComparison.Ordinal);
        }
    }

    [Fact]
    public void A_parenthesis_in_a_name_cannot_break_the_file()
    {
        var text = Text(_writer.Write(Invoice(), "Acme (EU) Ltd"));

        // Unescaped, this would close the string early and produce a file nothing opens.
        Assert.Contains(@"Acme \(EU\) Ltd", text, StringComparison.Ordinal);
    }

    [Fact]
    public void The_invoice_says_what_it_is_for_and_what_it_cost()
    {
        var text = Text(_writer.Write(Invoice(), "Northwind"));

        Assert.Contains("INV-2026-09-0412", text, StringComparison.Ordinal);
        Assert.Contains("Production", text, StringComparison.Ordinal);
        Assert.Contains("CHF 324.30", text, StringComparison.Ordinal);
    }

    [Fact]
    public void An_unpaid_invoice_says_the_amount_carries_rather_than_threatening_anything()
    {
        var invoice = Invoice();
        invoice.State = InvoiceStates.Unpaid;
        invoice.PaidAtUtc = null;
        invoice.CarriedIn = 300m;

        var text = Text(_writer.Write(invoice, "Northwind"));

        Assert.Contains("added to your next invoice", text, StringComparison.Ordinal);
        Assert.Contains("Nothing has been suspended", text, StringComparison.Ordinal);
        Assert.Contains("Brought forward", text, StringComparison.Ordinal);
    }

    [Fact]
    public void A_line_says_whether_it_recurs()
    {
        var invoice = Invoice();
        invoice.Lines =
        [
            new InvoiceLine { Label = "Production", Environment = "prod", Amount = 300m, Billing = "rent" },
            new InvoiceLine { Label = "API calls", Environment = "prod", Units = 100000, Amount = 20m, Billing = "once" },
        ];

        var text = Text(_writer.Write(invoice, "Northwind"));

        // The distinction matters after the fact: rent can be reduced, a one-off is spent.
        Assert.Contains("monthly", text, StringComparison.Ordinal);
        Assert.Contains("one-off", text, StringComparison.Ordinal);
        Assert.Contains("100,000 units", text, StringComparison.Ordinal);
    }
}
