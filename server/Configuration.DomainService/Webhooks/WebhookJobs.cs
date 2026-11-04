using Blocks.Genesis;

namespace Configuration.DomainService.Webhooks;

/// <summary>Internal job: send attempt <see cref="Attempt"/> of one delivery row. Tenant travels in the message context.</summary>
public sealed class WebhookDeliveryJob
{
    public string DeliveryId { get; set; } = string.Empty;

    public int Attempt { get; set; } = 1;
}

/// <summary>Internal job: fan an action out again after the tenant's lists could not be read.</summary>
public sealed class WebhookFanOutRetry
{
    public BlocksAction Action { get; set; } = new();

    public int Attempt { get; set; }
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
            Payload = new WebhookDeliveryJob { DeliveryId = deliveryId, Attempt = attempt },
            ScheduledEnqueueTimeUtc = notBefore
        });

    public Task EnqueueFanOutRetryAsync(BlocksAction action, int attempt, DateTimeOffset notBefore) =>
        _messageClient.SendToConsumerAsync(new ConsumerMessage<WebhookFanOutRetry>
        {
            ConsumerName = QueueName,
            Payload = new WebhookFanOutRetry { Action = action, Attempt = attempt },
            ScheduledEnqueueTimeUtc = notBefore
        });
}
