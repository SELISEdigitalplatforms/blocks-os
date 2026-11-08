namespace Configuration.DomainService.Webhooks;

/// <summary>A webhook as the API returns it. Never carries the secret, only whether one is set.</summary>
public sealed record WebhookView(
    string Id,
    string Name,
    string Url,
    bool IsActive,
    IReadOnlyList<string> Actions,
    bool SecretSet,
    DateTime? SecretChangedDate,
    DateTime CreatedDate,
    string? CreatedBy,
    int ConsecutiveFailures,
    string? DisabledReason)
{
    public static WebhookView From(WebhookEntry entry)
    {
        ArgumentNullException.ThrowIfNull(entry);
        return new WebhookView(
            entry.Id,
            entry.Name,
            entry.Url,
            entry.IsActive,
            entry.Actions ?? [],
            !string.IsNullOrEmpty(entry.SecretRef),
            entry.SecretChangedDate,
            entry.CreatedDate,
            entry.CreatedBy,
            entry.ConsecutiveFailures,
            entry.DisabledReason);
    }
}

/// <summary>Creates a webhook (no <see cref="Id"/>) or updates one.</summary>
public sealed class SaveWebhookRequest
{
    public string? Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Url { get; set; } = string.Empty;

    /// <summary>Required on create. On update, a new value replaces the old secret at once; empty keeps it.</summary>
    public string? Secret { get; set; }

    public bool IsActive { get; set; } = true;

    public List<string> Actions { get; set; } = [];
}

public sealed class WebhookIdRequest
{
    public string Id { get; set; } = string.Empty;
}

public sealed class ResendWebhookDeliveryRequest
{
    public string DeliveryId { get; set; } = string.Empty;
}

public sealed class WebhookDeliveriesQuery
{
    public string WebhookId { get; set; } = string.Empty;

    public string? Status { get; set; }

    public string? Action { get; set; }

    public int Page { get; set; } = 1;

    public int PageSize { get; set; } = WebhookDeliveryPaging.DefaultPageSize;
}

public static class WebhookDeliveryPaging
{
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 100;
}

public sealed record WebhookDeliveryView(
    string Id,
    string EventId,
    string Action,
    string WebhookId,
    string Status,
    string? StatusReason,
    string Body,
    string? TraceId,
    DateTime CreatedDate,
    DateTime LastUpdatedDate,
    DateTime? NextAttemptAt,
    IReadOnlyList<WebhookAttempt> Attempts)
{
    public static WebhookDeliveryView From(WebhookDelivery delivery)
    {
        ArgumentNullException.ThrowIfNull(delivery);
        return new WebhookDeliveryView(
            delivery.ItemId,
            delivery.EventId,
            delivery.Action,
            delivery.WebhookId,
            delivery.Status,
            delivery.StatusReason,
            delivery.Body,
            delivery.TraceId,
            delivery.CreatedDate,
            delivery.LastUpdatedDate,
            delivery.NextAttemptAt,
            delivery.Attempts ?? []);
    }
}

public sealed record WebhookDeliveryPage(long TotalCount, IReadOnlyList<WebhookDeliveryView> Items);

/// <summary>Result of <c>Webhooks/Test</c>. Not stored.</summary>
public sealed record WebhookTestResult(bool Delivered, int? HttpStatus, long DurationMs, string? ErrorCode);

/// <summary>Error codes the Webhooks API returns.</summary>
public static class WebhookErrorCodes
{
    public const string NameRequired = "NAME_REQUIRED";
    public const string NameTaken = "WEBHOOK_NAME_TAKEN";
    public const string UrlNotAllowed = "URL_NOT_ALLOWED";
    public const string SecretRequired = "SECRET_REQUIRED";
    public const string SecretInvalid = "SECRET_INVALID";
    public const string SecretMissing = "SECRET_MISSING";
    public const string ActionsRequired = "ACTIONS_REQUIRED";
    public const string ActionNotFound = "ACTION_NOT_FOUND";
    public const string WebhookNotFound = "WEBHOOK_NOT_FOUND";
    public const string WebhookIdRequired = "WEBHOOK_ID_REQUIRED";
    public const string WebhookDeleted = "WEBHOOK_DELETED";
    public const string WebhookInactive = "WEBHOOK_INACTIVE";
    public const string DeliveryNotFound = "DELIVERY_NOT_FOUND";
    public const string DeliveryNotResendable = "DELIVERY_NOT_RESENDABLE";
    public const string DeliveryInFlight = "DELIVERY_IN_FLIGHT";
}
