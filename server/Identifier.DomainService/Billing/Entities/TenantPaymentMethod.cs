using MongoDB.Bson.Serialization.Attributes;

namespace DomainService.Billing.Entities;

/// <summary>
/// A card a project has on file for its Blocks platform subscription.
/// </summary>
/// <remarks>
/// Lives in the root database only, like everything else about subscriptions. Never in a tenant
/// database.
/// <para>
/// No card number and no security code is stored: neither ever reaches this service. The browser
/// sends the card straight to the payment provider, which returns a token standing for it. That
/// token is the only secret involved, and it is kept in Key Vault, not here — this row holds
/// nothing but the name it is filed under. The remaining fields are what a card statement
/// already shows, and exist so the UI can say "Visa ending 4242" without asking the provider.
/// </para>
/// </remarks>
public sealed class TenantPaymentMethod
{
    [BsonId]
    public string ItemId { get; set; } = string.Empty;

    /// <summary>
    /// The subscribing project group. Every query filters on it.
    /// </summary>
    /// <remarks>
    /// The group, not one of its tenants: a project buys as a whole, and a card attached to an
    /// environment would vanish when that environment was removed. It is also what
    /// <c>ProjectPolicyFilter</c> authorises against, so the row and the access check agree on
    /// one identifier.
    /// </remarks>
    public string TenantGroupId { get; set; } = string.Empty;

    /// <summary>Who attached the card, for the audit trail. Never used to scope a read.</summary>
    public string AddedByUserId { get; set; } = string.Empty;

    public string ProviderName { get; set; } = string.Empty;

    /// <summary>
    /// Where the provider token and customer id are kept in the vault. A name, not a secret:
    /// holding it grants nothing without vault access.
    /// </summary>
    public string SecretId { get; set; } = string.Empty;

    // Display only. Printed on the card and on every receipt; not secret.
    public string Brand { get; set; } = string.Empty;
    public string LastFour { get; set; } = string.Empty;
    public int ExpiryMonth { get; set; }
    public int ExpiryYear { get; set; }

    /// <summary>The card the renewal charge uses. Exactly one per project.</summary>
    public bool IsDefault { get; set; }

    public string Status { get; set; } = PaymentMethodStatuses.Active;

    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public DateTime? LastChargedAtUtc { get; set; }

    /// <summary>True once the expiry month has passed, evaluated against the given instant.</summary>
    public bool IsExpiredAt(DateTime utcNow) =>
        ExpiryYear > 0 &&
        new DateTime(ExpiryYear, ExpiryMonth, 1, 0, 0, 0, DateTimeKind.Utc)
            .AddMonths(1) <= utcNow;
}

public static class PaymentMethodStatuses
{
    public const string Active = "active";

    /// <summary>Detached by the tenant. Kept so past invoices still name the card that paid them.</summary>
    public const string Removed = "removed";
}
