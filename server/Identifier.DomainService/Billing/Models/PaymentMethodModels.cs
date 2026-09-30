namespace DomainService.Billing.Models;

/// <summary>
/// What the provider hands back once it has collected and tokenised a card.
/// </summary>
/// <remarks>
/// Never bound from an HTTP request body. A caller who could post this could name any provider
/// token, including one belonging to another tenant, and have it filed as their own card. It is
/// built inside the process from a provider callback that has already been verified.
/// </remarks>
public sealed class AttachPaymentMethodRequest
{
    public string ProviderName { get; set; } = string.Empty;
    public string ProviderToken { get; set; } = string.Empty;
    public string ProviderCustomerId { get; set; } = string.Empty;
    public string Brand { get; set; } = string.Empty;
    public string LastFour { get; set; } = string.Empty;
    public int ExpiryMonth { get; set; }
    public int ExpiryYear { get; set; }
}

/// <summary>A card as the UI is allowed to see it. Contains no secret.</summary>
public sealed class PaymentMethodView
{
    public string PaymentMethodId { get; set; } = string.Empty;
    public string ProviderName { get; set; } = string.Empty;
    public string Brand { get; set; } = string.Empty;
    public string LastFour { get; set; } = string.Empty;
    public int ExpiryMonth { get; set; }
    public int ExpiryYear { get; set; }
    public bool IsDefault { get; set; }
    public bool IsExpired { get; set; }
    public string AddedByUserId { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? LastChargedAtUtc { get; set; }
}

/// <param name="Reason">
/// Empty when successful. Otherwise one of a small set of values safe to return to a caller:
/// they say what to do next without saying anything about another tenant's data.
/// </param>
public readonly record struct PaymentMethodResult(
    bool IsSuccess,
    string PaymentMethodId,
    string Reason)
{
    public static PaymentMethodResult Failed(string reason) =>
        new(false, string.Empty, reason);

    public static PaymentMethodResult Success(string paymentMethodId) =>
        new(true, paymentMethodId, string.Empty);
}

public static class PaymentMethodFailures
{
    public const string NotFound = "payment_method_not_found";
    public const string SecretUnavailable = "payment_method_secret_unavailable";
    public const string InvalidCard = "payment_method_invalid";
}
