using Microsoft.Extensions.Logging;

namespace Configuration.DomainService.Webhooks;

/// <summary>Runs one <see cref="WebhookDeliveryJob"/>: claim, send, record, retry or end, and count failures.</summary>
public interface IWebhookDeliveryProcessor
{
    Task ProcessAsync(WebhookDeliveryJob job, CancellationToken cancellationToken);
}

/// <inheritdoc cref="IWebhookDeliveryProcessor"/>
public sealed class WebhookDeliveryProcessor : IWebhookDeliveryProcessor
{
    public const int AutoOffThreshold = 20;
    public const string AutoOffReason = "auto-off after 20 failures";
    public const string WebhookDeletedReason = "webhook deleted";
    public const string WebhookOffReason = "webhook off";
    public const string SecretMissingReason = "secret missing";
    public const string SecretInvalidReason = "secret invalid";

    private readonly IWebhookDeliveryRepository _deliveries;
    private readonly IWebhookRepository _webhooks;
    private readonly IWebhookAttemptRunner _runner;
    private readonly IWebhookJobQueue _jobs;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<WebhookDeliveryProcessor> _logger;

    public WebhookDeliveryProcessor(
        IWebhookDeliveryRepository deliveries,
        IWebhookRepository webhooks,
        IWebhookAttemptRunner runner,
        IWebhookJobQueue jobs,
        TimeProvider timeProvider,
        ILogger<WebhookDeliveryProcessor> logger)
    {
        _deliveries = deliveries;
        _webhooks = webhooks;
        _runner = runner;
        _jobs = jobs;
        _timeProvider = timeProvider;
        _logger = logger;
    }

    public Task ProcessAsync(WebhookDeliveryJob job, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(job);
        return ProcessCoreAsync(job, cancellationToken);
    }

    private async Task ProcessCoreAsync(WebhookDeliveryJob job, CancellationToken cancellationToken)
    {
        // A job for a finished row, or a second copy of a job, claims nothing and stops here.
        var delivery = await _deliveries.TryStartAttemptAsync(job.DeliveryId, job.Attempt, cancellationToken);
        if (delivery is null)
        {
            _logger.LogInformation("Webhook delivery {DeliveryId} attempt {Attempt}: nothing to do", job.DeliveryId, job.Attempt);
            return;
        }

        var webhook = await _webhooks.GetAsync(delivery.WebhookId, cancellationToken);
        if (webhook is null || !webhook.IsActive)
        {
            var reason = webhook is null ? WebhookDeletedReason : WebhookOffReason;
            await _deliveries.MarkAsync(delivery.ItemId, WebhookDeliveryStatus.Skipped, reason, cancellationToken);
            _logger.LogInformation("Webhook delivery {DeliveryId} for {WebhookId} skipped: {Reason}", delivery.ItemId, delivery.WebhookId, reason);
            return;
        }

        var outcome = await RunAttemptAsync(delivery, webhook, cancellationToken);
        if (outcome.SendResult is null)
        {
            var reason = outcome.ErrorCode == WebhookAttemptErrors.SecretInvalid ? SecretInvalidReason : SecretMissingReason;
            await _deliveries.MarkAsync(delivery.ItemId, WebhookDeliveryStatus.Failed, reason, cancellationToken);
            await CountFailureAsync(webhook, cancellationToken);
            return;
        }

        await RecordAsync(delivery, webhook, outcome.SendResult, outcome.ErrorCode, cancellationToken);
    }

    // An unexpected error (for example a secret store outage) counts as a failed attempt that is retried, so the row
    // never stays in flight without a next job.
    private async Task<WebhookAttemptOutcome> RunAttemptAsync(WebhookDelivery delivery, WebhookEntry webhook, CancellationToken cancellationToken)
    {
        try
        {
            return await _runner.RunAsync(delivery, webhook, delivery.Attempts.Count + 1, cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning( // NOSONAR S6667 — type only: the exception can quote stored values
                "Webhook delivery {DeliveryId} for {WebhookId}: attempt error ({ErrorType})",
                delivery.ItemId, webhook.Id, ex.GetType().Name);
            var result = new WebhookSendResult(null, 0, WebhookAttemptErrors.InternalError, null);
            return new WebhookAttemptOutcome(result, WebhookAttemptErrors.InternalError);
        }
    }

    private async Task RecordAsync(WebhookDelivery delivery, WebhookEntry webhook, WebhookSendResult result, string? errorCode, CancellationToken cancellationToken)
    {
        var now = _timeProvider.GetUtcNow();
        var attempt = new WebhookAttempt
        {
            No = delivery.Attempts.Count + 1,
            At = now.UtcDateTime,
            HttpStatus = result.HttpStatus,
            DurationMs = result.DurationMs,
            ErrorCode = errorCode
        };

        switch (WebhookRetryPolicy.Decide(result, delivery.RunAttempts))
        {
            case WebhookAttemptDecision.Delivered:
                await _deliveries.RecordAttemptAsync(delivery.ItemId, attempt, WebhookDeliveryStatus.Delivered, null, cancellationToken);
                await _webhooks.ResetFailuresAsync(webhook.Id, cancellationToken);
                break;
            case WebhookAttemptDecision.Retry:
                var next = now.Add(WebhookRetryPolicy.NextWait(delivery.RunAttempts, result));
                await _deliveries.RecordAttemptAsync(delivery.ItemId, attempt, WebhookDeliveryStatus.Retrying, next.UtcDateTime, cancellationToken);
                await QueueRetryAsync(delivery, webhook, next, cancellationToken);
                break;
            default:
                await _deliveries.RecordAttemptAsync(delivery.ItemId, attempt, WebhookDeliveryStatus.Failed, null, cancellationToken);
                await CountFailureAsync(webhook, cancellationToken);
                break;
        }
    }

    private async Task QueueRetryAsync(WebhookDelivery delivery, WebhookEntry webhook, DateTimeOffset notBefore, CancellationToken cancellationToken)
    {
        try
        {
            await _jobs.EnqueueDeliveryAsync(delivery.ItemId, delivery.RunAttempts + 1, notBefore);
        }
        catch (Exception ex)
        {
            _logger.LogError( // NOSONAR S6667 — type only: the exception can quote message content
                "Webhook delivery {DeliveryId} for {WebhookId}: retry not queued, marked failed ({ErrorType})",
                delivery.ItemId, webhook.Id, ex.GetType().Name);
            await _deliveries.MarkAsync(delivery.ItemId, WebhookDeliveryStatus.Failed, WebhookAttemptErrors.RetryNotQueued, cancellationToken);
            await CountFailureAsync(webhook, cancellationToken);
        }
    }

    private async Task CountFailureAsync(WebhookEntry webhook, CancellationToken cancellationToken)
    {
        var count = await _webhooks.RecordFinalFailureAsync(webhook.Id, AutoOffThreshold, AutoOffReason, cancellationToken);
        if (count.TurnedOff)
        {
            _logger.LogWarning("Webhook {WebhookId} turned off after {Failures} failed deliveries in a row", webhook.Id, count.ConsecutiveFailures);
        }
    }
}
