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
    /// Take the environment that offers a free tier — today only <c>dev</c> — at the free price.
    /// </summary>
    /// <remarks>
    /// Applies to that environment in <see cref="Environments"/> and to nothing else; every other
    /// environment in the same selection is priced as usual. Limited to the catalogue's
    /// <c>maxFreePerProject</c>, and a free environment cannot be topped up.
    /// </remarks>
    public bool FreeTier { get; set; }

    /// <summary>
    /// Move the project's free environment — today only <c>dev</c> — to the paid tier.
    /// </summary>
    /// <remarks>
    /// Nothing is created: the environment keeps its tenant, data and usage, and only its limits
    /// rise. Priced like adding it (prorated the same way), and from then on it may be topped up,
    /// in this same order if wanted. The environment is not named in <see cref="Environments"/>.
    /// </remarks>
    public bool UpgradeFreeTier { get; set; }

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

    /// <summary>The project this order is for. The console filters pushed updates by it.</summary>
    public string TenantGroupId { get; set; } = string.Empty;

    /// <summary>Server-side only: the tenant order pushes are sent under. Never serialized out.</summary>
    [System.Text.Json.Serialization.JsonIgnore]
    public string NotifyTenantId { get; set; } = string.Empty;
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

    /// <summary>The project already holds as many free environments as the catalogue allows.</summary>
    public const string FreeTierTaken = "checkout_free_tier_taken";

    /// <summary>FreeTier was asked for, but nothing in the selection offers a free tier.</summary>
    public const string FreeTierUnavailable = "checkout_free_tier_unavailable";

    /// <summary>The project already has this environment, or an order is already creating it.</summary>
    public const string EnvironmentExists = "checkout_environment_exists";

    /// <summary>A top-up for an environment the project neither has nor is buying in this order.</summary>
    public const string EnvironmentNotHeld = "checkout_environment_not_held";

    /// <summary>UpgradeFreeTier was asked for, but the project holds no free environment.</summary>
    public const string NothingToUpgrade = "checkout_nothing_to_upgrade";

    /// <summary>The order failed at payment: the card was refused.</summary>
    public const string Declined = "checkout_declined";
}

/// <summary>Reasons the billing endpoints refuse. Safe to show; they name no other project's data.</summary>
public static class BillingFailures
{
    public const string EnvironmentNotFound = "billing_environment_not_found";
    public const string NothingOwed = "billing_nothing_owed";
    public const string InvoiceNotFound = "billing_invoice_not_found";
    public const string NoCard = "billing_no_card_on_file";
    public const string PaymentDeclined = "billing_payment_declined";

    /// <summary>The provider gave no answer. Money may have moved; do not assume either way.</summary>
    public const string PaymentPending = "billing_payment_pending";
}
