using System.Diagnostics;
using Blocks.Genesis;
using Configuration.DomainService.Actions;
using Microsoft.Extensions.Logging;

namespace Configuration.DomainService.Webhooks;

/// <summary>Turns one <see cref="BlocksAction"/> into one delivery row and job per matching active webhook.</summary>
public interface IWebhookFanOutService
{
    /// <param name="action">The action from the bus; the tenant comes only from the message context.</param>
    /// <param name="attempt">1 for the bus message; higher for a retry after the tenant's lists could not be read.</param>
    Task FanOutAsync(BlocksAction action, int attempt, CancellationToken cancellationToken);
}

/// <inheritdoc cref="IWebhookFanOutService"/>
public sealed class WebhookFanOutService : IWebhookFanOutService
{
    /// <summary>
    /// Genesis completes a message even when its consumer throws, so a failed read is retried here instead:
    /// up to this many fan-out attempts in all, waiting the same 30 s, 90 s, 180 s as a delivery.
    /// </summary>
    public const int MaxAttempts = 4;

    private readonly IActionsRepository _actions;
    private readonly IWebhookRepository _webhooks;
    private readonly IWebhookDeliveryRepository _deliveries;
    private readonly IWebhookJobQueue _jobs;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<WebhookFanOutService> _logger;

    public WebhookFanOutService(
        IActionsRepository actions,
        IWebhookRepository webhooks,
        IWebhookDeliveryRepository deliveries,
        IWebhookJobQueue jobs,
        TimeProvider timeProvider,
        ILogger<WebhookFanOutService> logger)
    {
        _actions = actions;
        _webhooks = webhooks;
        _deliveries = deliveries;
        _jobs = jobs;
        _timeProvider = timeProvider;
        _logger = logger;
    }

    public Task FanOutAsync(BlocksAction action, int attempt, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(action);
        return FanOutCoreAsync(action, attempt, cancellationToken);
    }

    private async Task FanOutCoreAsync(BlocksAction action, int attempt, CancellationToken cancellationToken)
    {
        var tenantId = BlocksContext.GetContext()?.TenantId;
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            _logger.LogWarning("Webhook action {Action} ({EventId}) dropped: no tenant in the message context", action.Action, action.Id);
            return;
        }

        IReadOnlyList<WebhookEntry> targets;
        try
        {
            targets = await FindTargetsAsync(action, tenantId, cancellationToken);
        }
        catch (Exception ex)
        {
            await RetryLaterAsync(action, attempt, ex);
            return;
        }

        if (targets.Count == 0)
        {
            return;
        }

        var body = WebhookEventBody.From(action);
        var failed = 0;
        foreach (var webhook in targets)
        {
            if (!await TryCreateDeliveryAsync(action, webhook, body, cancellationToken))
            {
                failed++;
            }
        }

        if (failed > 0)
        {
            // The unique (EventId, WebhookId) index makes the retry skip the rows that were made.
            await RetryLaterAsync(action, attempt, null);
        }
    }

    // Empty when the webhook flag is off, the action is unknown or no active webhook lists it (all logged).
    private async Task<IReadOnlyList<WebhookEntry>> FindTargetsAsync(BlocksAction action, string tenantId, CancellationToken cancellationToken)
    {
        var definition = await _actions.GetAsync(action.Action, cancellationToken);
        if (definition is null || !definition.Webhook || !string.Equals(definition.Name, action.Action, StringComparison.Ordinal))
        {
            _logger.LogInformation("Webhook action {Action} ({EventId}) dropped for tenant {TenantId}: webhook target is off", action.Action, action.Id, tenantId);
            return [];
        }

        var webhooks = await _webhooks.GetAllAsync(cancellationToken);
        var targets = webhooks
            .Where(w => w.IsActive && w.Actions is not null && w.Actions.Contains(action.Action, StringComparer.Ordinal))
            .ToList();
        if (targets.Count == 0)
        {
            _logger.LogInformation("Webhook action {Action} ({EventId}) for tenant {TenantId}: no active webhook lists it", action.Action, action.Id, tenantId);
        }

        return targets;
    }

    private async Task<bool> TryCreateDeliveryAsync(BlocksAction action, WebhookEntry webhook, string body, CancellationToken cancellationToken)
    {
        try
        {
            var now = _timeProvider.GetUtcNow().UtcDateTime;
            var delivery = new WebhookDelivery
            {
                ItemId = Guid.NewGuid().ToString("N"),
                EventId = action.Id,
                Action = action.Action,
                WebhookId = webhook.Id,
                Status = WebhookDeliveryStatus.Pending,
                Body = body,
                TraceId = Activity.Current?.TraceId.ToString(),
                CreatedDate = now,
                LastUpdatedDate = now
            };

            if (!await _deliveries.InsertAsync(delivery, cancellationToken))
            {
                // Redelivered action: the row exists. Re-queue only a row whose first attempt never started.
                var existing = await _deliveries.GetByEventAsync(action.Id, webhook.Id, cancellationToken);
                if (existing is null || existing.Status != WebhookDeliveryStatus.Pending || existing.RunAttempts != 0)
                {
                    return true;
                }

                delivery = existing;
            }

            await _jobs.EnqueueDeliveryAsync(delivery.ItemId, 1, null);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning( // NOSONAR S6667 — type only: the exception can quote stored values
                "Webhook {WebhookId} delivery for {Action} ({EventId}) not created ({ErrorType})",
                webhook.Id, action.Action, action.Id, ex.GetType().Name);
            return false;
        }
    }

    private async Task RetryLaterAsync(BlocksAction action, int attempt, Exception? readError)
    {
        var reason = readError?.GetType().Name ?? "delivery_not_created";
        if (attempt >= MaxAttempts)
        {
            _logger.LogError("Webhook action {Action} ({EventId}) dropped after {Attempts} fan-out attempts ({ErrorType})", action.Action, action.Id, attempt, reason);
            return;
        }

        var wait = WebhookRetryPolicy.Waits[Math.Clamp(attempt - 1, 0, WebhookRetryPolicy.Waits.Length - 1)];
        try
        {
            await _jobs.EnqueueFanOutRetryAsync(action, attempt + 1, _timeProvider.GetUtcNow().Add(wait));
            _logger.LogWarning("Webhook action {Action} ({EventId}) fan-out attempt {Attempt} failed ({ErrorType}); retry queued", action.Action, action.Id, attempt, reason);
        }
        catch (Exception ex)
        {
            _logger.LogError( // NOSONAR S6667 — type only
                "Webhook action {Action} ({EventId}) dropped: fan-out retry not queued ({ErrorType}, {QueueErrorType})",
                action.Action, action.Id, reason, ex.GetType().Name);
        }
    }
}
