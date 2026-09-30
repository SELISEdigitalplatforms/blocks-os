namespace DomainService.Billing.Models;

/// <summary>What the console asks to buy. Priced and validated before any money moves.</summary>
public sealed class StartCheckoutRequest
{
    public string TenantGroupId { get; set; } = string.Empty;

    /// <summary>Environments to add, by key: dev, test, stg, iat, uat, pre-prod, prod.</summary>
    public List<string> Environments { get; set; } = [];

    public List<TopUpSelection> TopUps { get; set; } = [];

    public string Market { get; set; } = "CHF";

    /// <summary>
    /// An order this checkout session already started, to re-price in place.
    /// </summary>
    /// <remarks>
    /// Keeps one order per session however many times the selection changes. Empty starts a new
    /// one; an id that is no longer pending is ignored and a new order is written.
    /// </remarks>
    public string OrderId { get; set; } = string.Empty;
}

public sealed class TopUpSelection
{
    public string Environment { get; set; } = string.Empty;

    /// <summary>Meter id, as the catalogue spells it: <c>api.calls</c>.</summary>
    public string Meter { get; set; } = string.Empty;

    /// <summary>How many purchasable steps, not units.</summary>
    public int Steps { get; set; }
}

/// <summary>
/// The answer to <c>/checkout/start</c>: a priced order and the key that makes paying for it safe
/// to retry.
/// </summary>
public sealed class StartCheckoutResult
{
    public bool IsSuccess { get; set; } = true;
    public string OrderId { get; set; } = string.Empty;
    public string IdempotencyKey { get; set; } = string.Empty;
    public string Market { get; set; } = "CHF";
    public decimal Subtotal { get; set; }
    public decimal Vat { get; set; }
    public decimal Total { get; set; }
    public decimal RecurringMonthly { get; set; }
    public List<CheckoutLine> Lines { get; set; } = [];

    /// <summary>Why it could not be priced. Empty when it could.</summary>
    public string Reason { get; set; } = string.Empty;

    public static StartCheckoutResult Failed(string reason) => new() { IsSuccess = false, Reason = reason };
}

public sealed class CheckoutLine
{
    public string Kind { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string Environment { get; set; } = string.Empty;
    public string Meter { get; set; } = string.Empty;
    public long Units { get; set; }
    public decimal Amount { get; set; }
    public string Billing { get; set; } = "once";
}

public sealed class PayCheckoutRequest
{
    public string TenantGroupId { get; set; } = string.Empty;
    public string OrderId { get; set; } = string.Empty;

    /// <summary>The key from <c>/checkout/start</c>, returned unchanged on every retry.</summary>
    public string IdempotencyKey { get; set; } = string.Empty;

    /// <summary>A card already on file. Empty means the default.</summary>
    public string PaymentMethodId { get; set; } = string.Empty;
}

/// <summary>
/// The state of a purchase. Never "failed" once money has moved — only a state it is passing
/// through.
/// </summary>
public sealed class OrderView
{
    public string OrderId { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public decimal Total { get; set; }
    public string Market { get; set; } = "CHF";

    public int StepsDone { get; set; }
    public int StepsTotal { get; set; }

    /// <summary>Plain words for the step in progress, or empty when there is nothing running.</summary>
    public string CurrentStep { get; set; } = string.Empty;
    public string CurrentEnvironment { get; set; } = string.Empty;

    /// <summary>Set only while a step is being retried, so the UI can say "attempt 3 of 5".</summary>
    public int Attempt { get; set; }
    public int MaxAttempts { get; set; }

    public string DeclineReason { get; set; } = string.Empty;
    public DateTime? ChargedAtUtc { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
    public List<EnvironmentProgressView> Environments { get; set; } = [];
}

public sealed class EnvironmentProgressView
{
    public string TenantId { get; set; } = string.Empty;
    public string Environment { get; set; } = string.Empty;
    public int StepsDone { get; set; }
    public int StepsTotal { get; set; }
    public string Step { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public int Attempt { get; set; }
}

public static class CheckoutFailures
{
    public const string NothingSelected = "checkout_nothing_selected";
    public const string UnknownEnvironment = "checkout_unknown_environment";
    public const string UnknownMeter = "checkout_unknown_meter";
    public const string NotPurchasable = "checkout_meter_not_purchasable";
    public const string CapExceeded = "checkout_cap_exceeded";
    public const string FreeTierCannotTopUp = "checkout_free_tier";
    public const string NoPrice = "checkout_no_price";
    public const string NoCard = "checkout_no_card_on_file";
    public const string OrderNotFound = "checkout_order_not_found";
    public const string OrderExpired = "checkout_order_expired";
    public const string KeyMismatch = "checkout_key_mismatch";
}
