using MongoDB.Bson.Serialization.Attributes;

namespace DomainService.Billing.Entities;

/// <summary>
/// A bill, issued for a purchase or a renewal.
/// </summary>
/// <remarks>
/// Root database, one per charge. Written when the money moves, never edited afterwards: an
/// invoice is a record of what happened, and a correction is a new document rather than a change
/// to this one.
/// </remarks>
public sealed class Invoice
{
    [BsonId]
    public string ItemId { get; set; } = string.Empty;

    /// <summary>Human-facing, sequential within a month: <c>INV-2026-09-0412</c>.</summary>
    public string Number { get; set; } = string.Empty;

    public string TenantGroupId { get; set; } = string.Empty;

    /// <summary>The order this bills, when it bills one. Empty for a renewal.</summary>
    public string OrderId { get; set; } = string.Empty;

    public string Market { get; set; } = "CHF";
    public decimal Subtotal { get; set; }
    public decimal Vat { get; set; }
    public decimal Total { get; set; }

    /// <summary>Amount carried in from a period that could not be collected.</summary>
    public decimal CarriedIn { get; set; }

    public List<InvoiceLine> Lines { get; set; } = [];

    public string State { get; set; } = InvoiceStates.Paid;
    public string ProviderReference { get; set; } = string.Empty;

    public DateTime IssuedAtUtc { get; set; }
    public DateTime? PaidAtUtc { get; set; }

    /// <summary>The period this covers, for a renewal.</summary>
    public DateTime? PeriodStartUtc { get; set; }
    public DateTime? PeriodEndUtc { get; set; }
}

public sealed class InvoiceLine
{
    public string Label { get; set; } = string.Empty;
    public string Environment { get; set; } = string.Empty;
    public long Units { get; set; }
    public decimal Amount { get; set; }

    /// <summary>
    /// "once" or "rent". Kept on the line because the two behave differently afterwards: rent can
    /// be reduced at the next boundary, a one-off is spent and its units carry until used.
    /// </summary>
    public string Billing { get; set; } = "once";
}

public static class InvoiceStates
{
    public const string Paid = "paid";

    /// <summary>Issued but not collected. The amount moves to the next invoice.</summary>
    public const string Unpaid = "unpaid";
}
