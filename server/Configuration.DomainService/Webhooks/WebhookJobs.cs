using Blocks.Genesis;

namespace Configuration.DomainService.Webhooks;

/// <summary>Internal job: send attempt <see cref="Attempt"/> of one delivery row. Tenant travels in the message context.</summary>
public sealed class WebhookDeliveryJob
{
    public string DeliveryId { get; set; } = string.Empty;

    public int Attempt { get; set; } = 1;

    /// <summary>Earliest send time; the consumer waits for it when the bus delivered early (RabbitMQ).</summary>
    public DateTimeOffset? NotBefore { get; set; }
}

/// <summary>Internal job: fan an action out again after the tenant's lists could not be read.</summary>
public sealed class WebhookFanOutRetry
{
    public BlocksAction Action { get; set; } = new();

    public int Attempt { get; set; }

    /// <inheritdoc cref="WebhookDeliveryJob.NotBefore"/>
    public DateTimeOffset? NotBefore { get; set; }
}

/// <summary>Queues the webhook worker's own jobs on <see cref="QueueName"/>.</summary>
public interface IWebhookJobQueue
{
    Task EnqueueDeliveryAsync(string deliveryId, int attempt, DateTimeOffset? notBefore);

    Task EnqueueFanOutRetryAsync(BlocksAction action, int attempt, DateTimeOffset notBefore);
}

/// <inheritdoc cref="IWebhookJobQueue"/>
public sealed class WebhookJobQueue : IWebhookJobQueue
{
    /// <summary>Bound only by blocks-os-worker; the API sends to it (resend).</summary>
    public const string QueueName = "blocks_os_webhook_delivery_listener";

    private readonly IMessageClient _messageClient;

    public WebhookJobQueue(IMessageClient messageClient)
    {
        _messageClient = messageClient;
    }

    public Task EnqueueDeliveryAsync(string deliveryId, int attempt, DateTimeOffset? notBefore) =>
        _messageClient.SendToConsumerAsync(new ConsumerMessage<WebhookDeliveryJob>
        {
            ConsumerName = QueueName,
            Payload = new WebhookDeliveryJob { DeliveryId = deliveryId, Attempt = attempt, NotBefore = notBefore },
            ScheduledEnqueueTimeUtc = notBefore
        });

    public Task EnqueueFanOutRetryAsync(BlocksAction action, int attempt, DateTimeOffset notBefore) =>
        _messageClient.SendToConsumerAsync(new ConsumerMessage<WebhookFanOutRetry>
        {
            ConsumerName = QueueName,
            Payload = new WebhookFanOutRetry { Action = action, Attempt = attempt, NotBefore = notBefore },
            ScheduledEnqueueTimeUtc = notBefore
        });
}

/// <summary>
/// Waits until a job's <c>NotBefore</c>. Azure Service Bus holds a scheduled message until its time, so the wait is
/// about zero there; Genesis RabbitMQ ignores the schedule and delivers at once, so the consumer waits here instead.
/// </summary>
public static class WebhookJobWait
{
    /// <summary>Upper bound of one wait: the longest retry wait, so a wrong clock or time never holds a consumer long.</summary>
    public static readonly TimeSpan MaxWait = WebhookRetryPolicy.MaxRetryAfter;

    /// <summary>How long to wait at <paramref name="now"/>; zero when there is no time or it has passed.</summary>
    public static TimeSpan DelayFor(DateTimeOffset? notBefore, DateTimeOffset now)
    {
        if (notBefore is not { } at || at <= now)
        {
            return TimeSpan.Zero;
        }

        var delay = at - now;
        return delay > MaxWait ? MaxWait : delay;
    }

    public static Task UntilAsync(DateTimeOffset? notBefore, TimeProvider timeProvider, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(timeProvider);
        var delay = DelayFor(notBefore, timeProvider.GetUtcNow());
        return delay == TimeSpan.Zero ? Task.CompletedTask : Task.Delay(delay, timeProvider, cancellationToken);
    }
}
