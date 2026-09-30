using System.Text.Json;
using System.Text.Json.Serialization;
using DomainService.Billing.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BlocksOs.Api.Controllers;

/// <summary>
/// Where Adyen tells us what actually happened.
/// </summary>
/// <remarks>
/// <b>Deliberately anonymous.</b> Adyen calls it with no token of ours, so this endpoint cannot sit
/// behind <c>[ProtectedEndPoint]</c> or <c>[ProjectPolicy]</c> like everything else in this
/// service. Adding either would not secure it — it would simply stop payments being confirmed.
/// <para>
/// What secures it instead is the HMAC signature on every item, checked against the key in the
/// vault. An unsigned or wrongly signed item is discarded without being acted on. It should also
/// be unreachable from outside the cluster; the signature is the last line, not the only one.
/// </para>
/// <para>
/// Adyen retries until it receives <c>[accepted]</c>, so the response says that whatever we made of
/// the batch — refusing would only make it resend something we will never accept — and every item
/// is claimed by its <c>pspReference</c> so a redelivery changes nothing.
/// </para>
/// </remarks>
[ApiController]
[AllowAnonymous]
[Route("api/[controller]")]
public class AdyenWebhookController : ControllerBase
{
    /// <summary>The only body Adyen accepts as an acknowledgement.</summary>
    private const string Accepted = "[accepted]";

    private readonly IAdyenNotificationService _notifications;
    private readonly IAdyenNotificationVerifier _verifier;
    private readonly IAdyenConfiguration _configuration;
    private readonly ILogger<AdyenWebhookController> _logger;

    public AdyenWebhookController(
        IAdyenNotificationService notifications,
        IAdyenNotificationVerifier verifier,
        IAdyenConfiguration configuration,
        ILogger<AdyenWebhookController> logger)
    {
        _notifications = notifications;
        _verifier = verifier;
        _configuration = configuration;
        _logger = logger;
    }

    [HttpPost("notifications")]
    [Consumes("application/json")]
    [Produces("text/plain")]
    public async Task<IActionResult> Notifications(
        [FromBody] AdyenNotificationEnvelope envelope,
        CancellationToken cancellationToken)
    {
        var settings = await _configuration.GetAsync(cancellationToken);

        if (string.IsNullOrWhiteSpace(settings.HmacKey))
        {
            // Without a key nothing can be verified, and acting on unverified payment events is
            // worse than missing them. Acknowledge so Adyen stops retrying, and shout.
            _logger.LogCritical("An Adyen notification arrived but no HMAC key is configured; it was discarded.");
            return Content(Accepted, "text/plain");
        }

        var verified = new List<AdyenNotificationItem>();

        foreach (var wrapper in envelope?.NotificationItems ?? [])
        {
            var item = Map(wrapper?.NotificationRequestItem);

            if (item is null)
            {
                continue;
            }

            if (!_verifier.IsAuthentic(item, settings.HmacKey))
            {
                // Anyone who can reach this URL can post to it, so a bad signature is the expected
                // shape of an attack rather than a surprise. Log it and drop it.
                _logger.LogWarning(
                    "Discarded an Adyen notification with an invalid signature ({EventCode}).",
                    item.EventCode);
                continue;
            }

            verified.Add(item);
        }

        if (verified.Count > 0)
        {
            await _notifications.HandleAsync(verified, cancellationToken);
        }

        return Content(Accepted, "text/plain");
    }

    private static AdyenNotificationItem? Map(AdyenNotificationRequestItem? source)
    {
        if (source is null || string.IsNullOrWhiteSpace(source.PspReference))
        {
            return null;
        }

        return new AdyenNotificationItem
        {
            EventCode = source.EventCode ?? string.Empty,
            PspReference = source.PspReference,
            OriginalReference = source.OriginalReference ?? string.Empty,
            MerchantReference = source.MerchantReference ?? string.Empty,
            MerchantAccountCode = source.MerchantAccountCode ?? string.Empty,
            AmountValue = source.Amount?.Value ?? 0,
            AmountCurrency = source.Amount?.Currency ?? string.Empty,
            // Adyen sends this as the string "true" or "false", not a boolean.
            Success = string.Equals(source.Success, "true", StringComparison.OrdinalIgnoreCase),
            Reason = source.Reason ?? string.Empty,
            HmacSignature = source.AdditionalData is not null
                && source.AdditionalData.TryGetValue("hmacSignature", out var signature)
                    ? signature
                    : string.Empty,
            AdditionalData = source.AdditionalData ?? new Dictionary<string, string>(StringComparer.Ordinal),
        };
    }
}

public sealed class AdyenNotificationEnvelope
{
    [JsonPropertyName("live")] public string? Live { get; set; }
    [JsonPropertyName("notificationItems")] public List<AdyenNotificationWrapper>? NotificationItems { get; set; }
}

public sealed class AdyenNotificationWrapper
{
    [JsonPropertyName("NotificationRequestItem")] public AdyenNotificationRequestItem? NotificationRequestItem { get; set; }
}

public sealed class AdyenNotificationRequestItem
{
    [JsonPropertyName("eventCode")] public string? EventCode { get; set; }
    [JsonPropertyName("pspReference")] public string? PspReference { get; set; }
    [JsonPropertyName("originalReference")] public string? OriginalReference { get; set; }
    [JsonPropertyName("merchantReference")] public string? MerchantReference { get; set; }
    [JsonPropertyName("merchantAccountCode")] public string? MerchantAccountCode { get; set; }
    [JsonPropertyName("amount")] public AdyenNotificationAmount? Amount { get; set; }
    [JsonPropertyName("success")] public string? Success { get; set; }
    [JsonPropertyName("reason")] public string? Reason { get; set; }
    [JsonPropertyName("additionalData")] public Dictionary<string, string>? AdditionalData { get; set; }
}

public sealed class AdyenNotificationAmount
{
    [JsonPropertyName("value")] public long Value { get; set; }
    [JsonPropertyName("currency")] public string? Currency { get; set; }
}
