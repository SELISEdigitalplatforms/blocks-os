using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;

namespace DomainService.Billing.Services;

/// <param name="Outcome">
/// Authorised, Refused, or Unknown. Unknown is not a failure: the charge may still be in flight at
/// the provider, and only its answer — response or webhook — may close the order.
/// </param>
public readonly record struct ChargeResult(
    ChargeOutcome Outcome,
    string ProviderReference,
    string Reason)
{
    public static ChargeResult Unknown(string reason) => new(ChargeOutcome.Unknown, string.Empty, reason);
    public static ChargeResult Refused(string reason) => new(ChargeOutcome.Refused, string.Empty, reason);
}

public enum ChargeOutcome
{
    /// <summary>The money is ours.</summary>
    Authorised,

    /// <summary>The provider said no. Nothing was created, so there is nothing to undo.</summary>
    Refused,

    /// <summary>
    /// We do not know. A timeout, a transport error, or a provider still deciding. The order stays
    /// pending and is resolved by the webhook or by reconciliation — never by assuming failure.
    /// </summary>
    Unknown,
}

public sealed class ChargeRequest
{
    public string TenantGroupId { get; set; } = string.Empty;
    public string OrderId { get; set; } = string.Empty;
    public string IdempotencyKey { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Market { get; set; } = "CHF";

    /// <summary>The provider's token for the card, out of the vault.</summary>
    public string StoredPaymentMethodId { get; set; } = string.Empty;

    /// <summary>The provider's customer. The project group, as Adyen's shopper reference.</summary>
    public string ShopperReference { get; set; } = string.Empty;
}

/// <summary>What a browser needs to open the provider's card form.</summary>
public sealed class CardSessionResult
{
    public bool IsSuccess { get; set; }
    public string SessionId { get; set; } = string.Empty;

    /// <summary>Opaque to us; handed straight to the provider's component.</summary>
    public string SessionData { get; set; } = string.Empty;

    public string ClientKey { get; set; } = string.Empty;
    public string Environment { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;

    public static CardSessionResult Failed(string reason) => new() { Reason = reason };
}

public interface IPaymentGateway
{
    /// <summary>Charges a card already on file, with nobody present to answer a challenge.</summary>
    Task<ChargeResult> ChargeStoredCardAsync(ChargeRequest request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Opens a session in which the browser can hand the provider a card, to be stored rather than
    /// charged.
    /// </summary>
    /// <remarks>
    /// The card goes from the browser to the provider and never through this service. What comes
    /// back to us is a signed notification carrying a token, which is the only way a card is ever
    /// filed.
    /// </remarks>
    Task<CardSessionResult> CreateCardSessionAsync(
        string tenantGroupId,
        string market,
        string returnUrl,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Adyen, for the platform's own merchant account.
/// </summary>
/// <remarks>
/// Deliberately small. The payment module in blocks-utilities is large because it serves many
/// merchants — every tenant registers its own configuration, with organization scoping and several
/// providers. Platform billing has exactly one merchant, one provider and cards only, so what is
/// left is a charge and a webhook.
/// <para>
/// Our idempotency key is passed to Adyen as its own. That gives two independent layers: if our
/// record is somehow lost between charging and writing, Adyen still refuses the second charge.
/// </para>
/// </remarks>
public sealed class AdyenPaymentGateway : IPaymentGateway
{
    /// <summary>Adyen's contract type for a subscription charge the shopper is not present for.</summary>
    private const string RecurringProcessingModel = "Subscription";

    private const string ShopperInteraction = "ContAuth";

    private readonly HttpClient _http;
    private readonly IAdyenConfiguration _configuration;
    private readonly ILogger<AdyenPaymentGateway> _logger;

    public AdyenPaymentGateway(
        HttpClient http,
        IAdyenConfiguration configuration,
        ILogger<AdyenPaymentGateway> logger)
    {
        _http = http;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<ChargeResult> ChargeStoredCardAsync(ChargeRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var settings = await _configuration.GetAsync(cancellationToken).ConfigureAwait(false);

        if (!settings.IsUsable)
        {
            // No credentials is not a decline. Saying "refused" here would tell a customer their
            // card failed when we never asked it.
            _logger.LogError("Adyen is not configured; no charge was attempted.");
            return ChargeResult.Unknown("gateway_not_configured");
        }

        var payload = new AdyenPaymentRequest
        {
            MerchantAccount = settings.MerchantAccount,
            Reference = request.OrderId,
            Amount = new AdyenAmount
            {
                Currency = request.Market,
                // Adyen counts in minor units. CHF and USD are both two-decimal currencies.
                Value = (long)Math.Round(request.Amount * 100m, MidpointRounding.AwayFromZero),
            },
            PaymentMethod = new AdyenStoredPaymentMethod
            {
                Type = "scheme",
                StoredPaymentMethodId = request.StoredPaymentMethodId,
            },
            ShopperReference = request.ShopperReference,
            ShopperInteraction = ShopperInteraction,
            RecurringProcessingModel = RecurringProcessingModel,
        };

        using var message = new HttpRequestMessage(HttpMethod.Post, $"{settings.ApiBaseUrl.TrimEnd('/')}/payments")
        {
            Content = JsonContent.Create(payload),
        };

        message.Headers.Add("x-API-key", settings.ApiKey);
        message.Headers.Add("Idempotency-Key", request.IdempotencyKey);
        message.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        try
        {
            using var response = await _http.SendAsync(message, cancellationToken).ConfigureAwait(false);
            var body = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError(
                    "Adyen refused the request for order {OrderId} with status {Status}.",
                    request.OrderId,
                    (int)response.StatusCode);

                // A 4xx or 5xx is not the card saying no; it is us not getting an answer.
                return ChargeResult.Unknown("gateway_error");
            }

            var parsed = JsonSerializer.Deserialize<AdyenPaymentResponse>(body);

            if (parsed is null)
            {
                return ChargeResult.Unknown("gateway_unreadable");
            }

            return parsed.ResultCode switch
            {
                "Authorised" => new ChargeResult(ChargeOutcome.Authorised, parsed.PspReference ?? string.Empty, string.Empty),
                "Refused" or "Cancelled" or "Error" => ChargeResult.Refused(parsed.RefusalReason ?? "refused"),
                // Received, Pending and anything Adyen adds later: the webhook decides.
                _ => ChargeResult.Unknown(parsed.ResultCode ?? "pending"),
            };
        }
        catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            // The timeout case from issue 3. The charge may well succeed a second from now, so
            // this must never be read as a decline.
            _logger.LogWarning("Adyen timed out for order {OrderId}; the charge may still be in flight.", request.OrderId);
            return ChargeResult.Unknown("timeout");
        }
        catch (HttpRequestException exception)
        {
            _logger.LogError(exception, "Adyen was unreachable for order {OrderId}.", request.OrderId);
            return ChargeResult.Unknown("unreachable");
        }
    }

    public async Task<CardSessionResult> CreateCardSessionAsync(
        string tenantGroupId,
        string market,
        string returnUrl,
        CancellationToken cancellationToken = default)
    {
        var settings = await _configuration.GetAsync(cancellationToken).ConfigureAwait(false);

        if (!settings.IsUsable)
        {
            _logger.LogError("Adyen is not configured; no card session was created.");
            return CardSessionResult.Failed("gateway_not_configured");
        }

        var payload = new AdyenSessionRequest
        {
            MerchantAccount = settings.MerchantAccount,
            // The project group is the shopper: a card belongs to the project that will be billed,
            // and this is what ties the later notification back to it.
            ShopperReference = tenantGroupId,
            Reference = $"card-{tenantGroupId}",
            ReturnUrl = returnUrl,
            CountryCode = string.Equals(market, "USD", StringComparison.OrdinalIgnoreCase) ? "US" : "CH",
            // Zero: this collects a card, it does not charge one. Adyen still wants the currency,
            // because a card stored for one is not a card stored for another.
            Amount = new AdyenAmount { Currency = market, Value = 0 },
            StorePaymentMethod = true,
            StorePaymentMethodMode = "askForConsent",
            RecurringProcessingModel = RecurringProcessingModel,
            ShopperInteraction = "Ecommerce",
        };

        using var message = new HttpRequestMessage(HttpMethod.Post, $"{settings.ApiBaseUrl.TrimEnd('/')}/sessions")
        {
            Content = JsonContent.Create(payload),
        };

        message.Headers.Add("x-API-key", settings.ApiKey);
        message.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        try
        {
            using var response = await _http.SendAsync(message, cancellationToken).ConfigureAwait(false);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError(
                    "Adyen refused a card session for {TenantGroupId} with status {Status}.",
                    tenantGroupId,
                    (int)response.StatusCode);

                return CardSessionResult.Failed("gateway_error");
            }

            var body = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
            var parsed = JsonSerializer.Deserialize<AdyenSessionResponse>(body);

            if (parsed is null || string.IsNullOrWhiteSpace(parsed.Id))
            {
                return CardSessionResult.Failed("gateway_unreadable");
            }

            return new CardSessionResult
            {
                IsSuccess = true,
                SessionId = parsed.Id,
                SessionData = parsed.SessionData ?? string.Empty,
                ClientKey = settings.ClientKey,
                Environment = settings.IsLive ? "live" : "test",
            };
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            _logger.LogError(exception, "A card session could not be created for {TenantGroupId}.", tenantGroupId);
            return CardSessionResult.Failed("unreachable");
        }
    }

    private sealed class AdyenSessionRequest
    {
        [JsonPropertyName("merchantAccount")] public string MerchantAccount { get; set; } = string.Empty;
        [JsonPropertyName("reference")] public string Reference { get; set; } = string.Empty;
        [JsonPropertyName("amount")] public AdyenAmount Amount { get; set; } = new();
        [JsonPropertyName("returnUrl")] public string ReturnUrl { get; set; } = string.Empty;
        [JsonPropertyName("countryCode")] public string CountryCode { get; set; } = string.Empty;
        [JsonPropertyName("shopperReference")] public string ShopperReference { get; set; } = string.Empty;
        [JsonPropertyName("storePaymentMethod")] public bool StorePaymentMethod { get; set; }
        [JsonPropertyName("storePaymentMethodMode")] public string StorePaymentMethodMode { get; set; } = string.Empty;
        [JsonPropertyName("recurringProcessingModel")] public string RecurringProcessingModel { get; set; } = string.Empty;
        [JsonPropertyName("shopperInteraction")] public string ShopperInteraction { get; set; } = string.Empty;
    }

    private sealed class AdyenSessionResponse
    {
        [JsonPropertyName("id")] public string? Id { get; set; }
        [JsonPropertyName("sessionData")] public string? SessionData { get; set; }
    }

    private sealed class AdyenPaymentRequest
    {
        [JsonPropertyName("merchantAccount")] public string MerchantAccount { get; set; } = string.Empty;
        [JsonPropertyName("reference")] public string Reference { get; set; } = string.Empty;
        [JsonPropertyName("amount")] public AdyenAmount Amount { get; set; } = new();
        [JsonPropertyName("paymentMethod")] public AdyenStoredPaymentMethod PaymentMethod { get; set; } = new();
        [JsonPropertyName("shopperReference")] public string ShopperReference { get; set; } = string.Empty;
        [JsonPropertyName("shopperInteraction")] public string ShopperInteraction { get; set; } = string.Empty;
        [JsonPropertyName("recurringProcessingModel")] public string RecurringProcessingModel { get; set; } = string.Empty;
    }

    private sealed class AdyenAmount
    {
        [JsonPropertyName("currency")] public string Currency { get; set; } = string.Empty;
        [JsonPropertyName("value")] public long Value { get; set; }
    }

    private sealed class AdyenStoredPaymentMethod
    {
        [JsonPropertyName("type")] public string Type { get; set; } = "scheme";
        [JsonPropertyName("storedPaymentMethodId")] public string StoredPaymentMethodId { get; set; } = string.Empty;
    }

    private sealed class AdyenPaymentResponse
    {
        [JsonPropertyName("resultCode")] public string? ResultCode { get; set; }
        [JsonPropertyName("pspReference")] public string? PspReference { get; set; }
        [JsonPropertyName("refusalReason")] public string? RefusalReason { get; set; }
    }
}
