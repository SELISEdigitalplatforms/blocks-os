using Configuration.DomainService.Shared.Services;
using Microsoft.Extensions.Logging;

namespace Configuration.DomainService.Webhooks;

/// <summary>Delivery history of a webhook and resend of one row.</summary>
public interface IWebhookHistoryService
{
    Task<ServiceOutcome<WebhookDeliveryPage>> GetDeliveriesAsync(WebhookDeliveriesQuery query, CancellationToken cancellationToken);

    Task<ServiceOutcome<bool>> ResendAsync(string deliveryId, CancellationToken cancellationToken);
}

/// <inheritdoc cref="IWebhookHistoryService"/>
public sealed class WebhookHistoryService : IWebhookHistoryService
{
    /// <summary>
    /// A row still in flight but untouched for longer than the longest retry wait was left behind (worker stopped
    /// mid-attempt); it may be resent.
    /// </summary>
    public static readonly TimeSpan StuckAfter = TimeSpan.FromHours(7);

    private readonly IWebhookDeliveryRepository _deliveries;
    private readonly IWebhookRepository _webhooks;
    private readonly IWebhookJobQueue _jobs;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<WebhookHistoryService> _logger;

    public WebhookHistoryService(
        IWebhookDeliveryRepository deliveries,
        IWebhookRepository webhooks,
        IWebhookJobQueue jobs,
        TimeProvider timeProvider,
        ILogger<WebhookHistoryService> logger)
    {
        _deliveries = deliveries;
        _webhooks = webhooks;
        _jobs = jobs;
        _timeProvider = timeProvider;
        _logger = logger;
    }

    public async Task<ServiceOutcome<WebhookDeliveryPage>> GetDeliveriesAsync(WebhookDeliveriesQuery query, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        if (string.IsNullOrWhiteSpace(query.WebhookId))
        {
            return ServiceOutcome<WebhookDeliveryPage>.BadRequest(WebhookErrorCodes.WebhookIdRequired);
        }

        var paged = new WebhookDeliveriesQuery
        {
            WebhookId = query.WebhookId,
            Status = query.Status,
            Action = query.Action,
            Page = Math.Max(1, query.Page),
            PageSize = Math.Clamp(query.PageSize, 1, WebhookDeliveryPaging.MaxPageSize)
        };
        return ServiceOutcome<WebhookDeliveryPage>.Ok(await _deliveries.ListAsync(paged, cancellationToken));
    }

    public async Task<ServiceOutcome<bool>> ResendAsync(string deliveryId, CancellationToken cancellationToken)
    {
        var delivery = string.IsNullOrWhiteSpace(deliveryId) ? null : await _deliveries.GetAsync(deliveryId, cancellationToken);
        if (delivery is null)
        {
            return ServiceOutcome<bool>.NotFound(WebhookErrorCodes.DeliveryNotFound);
        }

        var refusal = await CheckWebhookAsync(delivery, cancellationToken);
        if (refusal is not null)
        {
            return ServiceOutcome<bool>.BadRequest(refusal);
        }

        var before = await _deliveries.TryStartResendAsync(delivery.ItemId, _timeProvider.GetUtcNow().UtcDateTime - StuckAfter, cancellationToken);
        if (before is null)
        {
            // Another send of this row is in flight: one at a time.
            return ServiceOutcome<bool>.Conflict(WebhookErrorCodes.DeliveryInFlight);
        }

        try
        {
            await _jobs.EnqueueDeliveryAsync(delivery.ItemId, 1, null);
        }
        catch
        {
            await _deliveries.RestoreStatusAsync(delivery.ItemId, before.Status, CancellationToken.None);
            throw;
        }

        _logger.LogInformation("Webhook delivery {DeliveryId} for {WebhookId} resent", delivery.ItemId, delivery.WebhookId);
        return ServiceOutcome<bool>.Ok(true);
    }

    private async Task<string?> CheckWebhookAsync(WebhookDelivery delivery, CancellationToken cancellationToken)
    {
        if (delivery.Status == WebhookDeliveryStatus.Skipped)
        {
            return WebhookErrorCodes.DeliveryNotResendable;
        }

        var webhook = await _webhooks.GetAsync(delivery.WebhookId, cancellationToken);
        if (webhook is null)
        {
            return WebhookErrorCodes.WebhookDeleted;
        }

        return webhook.IsActive ? null : WebhookErrorCodes.WebhookInactive;
    }
}
