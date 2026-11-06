using MongoDB.Bson.Serialization.Attributes;

namespace Configuration.DomainService.Webhooks;

/// <summary>
/// One row of the tenant's <c>WebhookDeliveries</c> history: one event sent to one webhook. Holds the sent body
/// (ids only, so it can be resent) and the attempts; never the response body, headers or the secret.
/// </summary>
[BsonIgnoreExtraElements]
public sealed class WebhookDelivery
{
    [BsonId]
    public string ItemId { get; set; } = string.Empty;

    public string EventId { get; set; } = string.Empty;

    public string Action { get; set; } = string.Empty;

    public string WebhookId { get; set; } = string.Empty;

    public string Status { get; set; } = WebhookDeliveryStatus.Pending;

    /// <summary>Why the row is Skipped or Failed without an HTTP answer (for example "webhook deleted").</summary>
    public string? StatusReason { get; set; }

    /// <summary>The exact JSON sent to the receiver.</summary>
    public string Body { get; set; } = string.Empty;

    public string? TraceId { get; set; }

    public DateTime CreatedDate { get; set; }

    public DateTime LastUpdatedDate { get; set; }

    /// <summary>When the next retry is due while the row is Retrying.</summary>
    public DateTime? NextAttemptAt { get; set; }

    /// <summary>Attempts started in the current run (first send or resend); bounds the retries.</summary>
    public int RunAttempts { get; set; }

    public List<WebhookAttempt> Attempts { get; set; } = [];
}

/// <summary>One HTTP attempt. Only the status code and our own error code are kept.</summary>
public sealed class WebhookAttempt
{
    public int No { get; set; }

    public DateTime At { get; set; }

    public int? HttpStatus { get; set; }

    public long DurationMs { get; set; }

    public string? ErrorCode { get; set; }
}

public static class WebhookDeliveryStatus
{
    public const string Pending = "Pending";
    public const string Retrying = "Retrying";
    public const string Delivered = "Delivered";
    public const string Failed = "Failed";
    public const string Skipped = "Skipped";

    public static readonly IReadOnlyList<string> InFlight = [Pending, Retrying];

    public static readonly IReadOnlyList<string> Resendable = [Delivered, Failed];
}
