using MongoDB.Bson.Serialization.Attributes;

namespace DomainService.Billing.Entities;

/// <summary>
/// One purchase: environments, top-ups, or both, for a single project.
/// </summary>
/// <remarks>
/// Root database only, scoped by project group.
/// <para>
/// The row is written <b>before</b> the provider is called, which is what makes the whole flow
/// recoverable. A crash between charging and provisioning leaves a row in
/// <see cref="OrderStates.Paid"/> with no completion, and that row — not a queued message — is the
/// durable work item a sweeper picks up. Messages are lost and workers restart; this does not.
/// </para>
/// </remarks>
public sealed class SubscriptionOrder
{
    [BsonId]
    public string ItemId { get; set; } = string.Empty;

    /// <summary>The project this was bought for. Every query filters on it.</summary>
    public string TenantGroupId { get; set; } = string.Empty;

    /// <summary>
    /// Minted by <c>/checkout/start</c>, not by the client and not when Pay is pressed.
    /// </summary>
    /// <remarks>
    /// Unique with <see cref="TenantGroupId"/>. The insert carrying it is what makes a duplicate
    /// call safe: two requests race on the index, one wins, and the loser returns this same order
    /// instead of charging again. A key minted on the button press would give a double-click two
    /// keys and defeat itself.
    /// </remarks>
    public string IdempotencyKey { get; set; } = string.Empty;

    public string CreatedByUserId { get; set; } = string.Empty;

    public string State { get; set; } = OrderStates.Pending;

    // What was bought, priced at checkout so a later price change cannot alter a taken payment.
    public string Market { get; set; } = "CHF";
    public decimal Subtotal { get; set; }
    public decimal Vat { get; set; }
    public decimal Total { get; set; }
    public List<OrderLine> Lines { get; set; } = [];

    // Payment, filled once the provider answers.
    public string ProviderName { get; set; } = string.Empty;
    public string PaymentMethodId { get; set; } = string.Empty;

    /// <summary>The provider's own reference, for reconciliation when our call times out.</summary>
    public string ProviderReference { get; set; } = string.Empty;
    /// <summary>
    /// When we first called the provider, whatever came back.
    /// </summary>
    /// <remarks>
    /// The difference between an abandoned checkout and one where money may have moved. An order
    /// with this set is never expired on a timer: only the provider may close it, because only the
    /// provider knows whether it took the money.
    /// </remarks>
    public DateTime? ChargeAttemptedAtUtc { get; set; }

    public DateTime? ChargedAtUtc { get; set; }
    public string DeclineReason { get; set; } = string.Empty;

    /// <summary>One entry per environment being created, each carrying its own step and attempts.</summary>
    public List<OrderEnvironmentProgress> Progress { get; set; } = [];

    /// <summary>Set when every step has run out of attempts. Internal — never shown to a customer.</summary>
    public bool NeedsAttention { get; set; }

    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    /// <summary>
    /// When an unpaid order stops being resumable. The key is kept past it, so a very late
    /// duplicate still cannot charge.
    /// </summary>
    public DateTime ExpiresAtUtc { get; set; }

    public DateTime? CompletedAtUtc { get; set; }

    /// <summary>Steps finished across every environment — what the progress bar counts.</summary>
    public int StepsDone => Progress.Sum(p => p.StepsDone);

    public int StepsTotal => Progress.Count * ProvisioningSteps.All.Count;
}

public sealed class OrderLine
{
    /// <summary>"environment" or "topup".</summary>
    public string Kind { get; set; } = string.Empty;
    public string Environment { get; set; } = string.Empty;

    /// <summary>Meter id for a top-up, empty for an environment.</summary>
    public string Meter { get; set; } = string.Empty;
    public int Steps { get; set; }
    public long Units { get; set; }
    public decimal Amount { get; set; }

    /// <summary>"once" for counter units that carry, "rent" for a ceiling charged while held.</summary>
    public string Billing { get; set; } = "once";
}

/// <summary>How far one environment has got, and how hard it has tried.</summary>
public sealed class OrderEnvironmentProgress
{
    public string TenantId { get; set; } = string.Empty;
    public string Environment { get; set; } = string.Empty;

    /// <summary>Index into <see cref="ProvisioningSteps.All"/>; equals the count when finished.</summary>
    public int StepsDone { get; set; }

    /// <summary>
    /// Attempts spent on the step currently in progress. Counted per environment and step, not per
    /// order: one flaky environment must not burn the budget for the other six.
    /// </summary>
    public int Attempt { get; set; }

    public DateTime? StartedAtUtc { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
    public DateTime? LastAttemptAtUtc { get; set; }

    /// <summary>Kept for operations. The customer is told a step is retrying, never why.</summary>
    public string LastError { get; set; } = string.Empty;

    public bool IsComplete => StepsDone >= ProvisioningSteps.All.Count;
}

public static class OrderStates
{
    /// <summary>Written, nothing charged. Also where a timed-out charge waits for the webhook.</summary>
    public const string Pending = "pending";

    /// <summary>Money taken, provisioning not yet started. The sweeper's work item.</summary>
    public const string Paid = "paid";

    public const string Creating = "creating";
    public const string Created = "created";

    /// <summary>Refused before any money moved. The only failure a customer is ever shown.</summary>
    public const string Declined = "declined";

    /// <summary>Started, never paid, and now past <see cref="SubscriptionOrder.ExpiresAtUtc"/>.</summary>
    public const string Expired = "expired";

    /// <summary>States from which no further work is owed.</summary>
    public static readonly string[] Terminal = [Created, Declined, Expired];

    public static bool IsTerminal(string? state) =>
        state is not null && Array.Exists(Terminal, s => string.Equals(s, state, StringComparison.Ordinal));
}

/// <summary>
/// The six things provisioning does per environment, in order.
/// </summary>
/// <remarks>
/// These mirror the flags on <c>ProjectStatusTracer</c>, which is what actually records them — the
/// names here exist so an order can say which step it stopped at and resume from exactly that one
/// rather than starting the environment again.
/// </remarks>
public static class ProvisioningSteps
{
    public const string CreateTenant = "CreateTenant";
    public const string AddPeople = "InsertedIntoProjectPeople";
    public const string UploadCertificates = "IsCertificatesUploaded";
    public const string CopyConfiguration = "IsDefaultConfigurationCopied";
    public const string ApplySettings = "IsProjectUpdated";
    public const string SeedQuota = "QuotaSeeded";

    public static readonly IReadOnlyList<string> All =
        [CreateTenant, AddPeople, UploadCertificates, CopyConfiguration, ApplySettings, SeedQuota];

    /// <summary>What a customer is shown. The flag names above are for logs and operations.</summary>
    public static readonly IReadOnlyDictionary<string, string> Friendly =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            [CreateTenant] = "Creating the environment",
            [AddPeople] = "Adding your team",
            [UploadCertificates] = "Installing certificates",
            [CopyConfiguration] = "Applying configuration",
            [ApplySettings] = "Applying settings",
            [SeedQuota] = "Setting your limits",
        };

    public static string FriendlyAt(int index) =>
        index >= 0 && index < All.Count && Friendly.TryGetValue(All[index], out var label)
            ? label
            : string.Empty;
}
