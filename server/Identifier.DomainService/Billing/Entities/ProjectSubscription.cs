using MongoDB.Bson.Serialization.Attributes;

namespace DomainService.Billing.Entities;

/// <summary>
/// What a project pays every month, and when it is next charged.
/// </summary>
/// <remarks>
/// Root database only, one per project group. Orders are purchases; this is the standing
/// arrangement they add to.
/// <para>
/// Only recurring things are here — environments, and resource ceilings that are rent while held.
/// Counter units bought outright are charged once at the order and never again, so they never
/// reach this record.
/// </para>
/// </remarks>
public sealed class ProjectSubscription
{
    [BsonId]
    public string TenantGroupId { get; set; } = string.Empty;

    public string Market { get; set; } = "CHF";
    public string State { get; set; } = SubscriptionStates.Active;

    /// <summary>Everything charged again each period.</summary>
    public List<RecurringLine> Lines { get; set; } = [];

    public DateTime NextChargeAtUtc { get; set; }
    public DateTime? LastChargedAtUtc { get; set; }

    /// <summary>
    /// Amounts a previous period failed to collect.
    /// </summary>
    /// <remarks>
    /// A decline does not suspend anything and does not retry on its own schedule — the balance
    /// simply joins the next invoice. That keeps a customer's environments running through a
    /// temporary card problem, and keeps the money owed visible in one place.
    /// </remarks>
    public decimal CarriedBalance { get; set; }

    /// <summary>Consecutive failed renewals. Not used to cut access, only to raise a flag.</summary>
    public int FailedAttempts { get; set; }

    public string LastFailureReason { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    /// <summary>What the recurring lines come to before tax, ignoring anything carried.</summary>
    public decimal MonthlyBeforeTax => Lines.Sum(l => l.Amount);
}

public sealed class RecurringLine
{
    /// <summary>"environment" or "topup".</summary>
    public string Kind { get; set; } = string.Empty;
    public string Environment { get; set; } = string.Empty;

    /// <summary>
    /// The tenant this line's environment is, so the period boundary can reset its meters without
    /// looking the project up again. Empty on a line written before the environment existed.
    /// </summary>
    public string TenantId { get; set; } = string.Empty;
    public string Meter { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public long Units { get; set; }
    public decimal Amount { get; set; }
}

public static class SubscriptionStates
{
    public const string Active = "active";

    /// <summary>Owes money from a previous period. Still running — nothing is cut off.</summary>
    public const string PastDue = "pastDue";

    public const string Cancelled = "cancelled";
}
