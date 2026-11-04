using Blocks.Genesis;
using Configuration.DomainService.Webhooks;

namespace Worker.Consumers.Webhooks
{
    /// <summary>Actions with the webhook target on (<see cref="ActionConstants.WebhookQueue"/>): one delivery per matching webhook.</summary>
    public class WebhookActionConsumer : IConsumer<BlocksAction>
    {
        private readonly IWebhookFanOutService _fanOut;

        public WebhookActionConsumer(IWebhookFanOutService fanOut)
        {
            _fanOut = fanOut;
        }

        public Task Consume(BlocksAction context) => _fanOut.FanOutAsync(context, 1, CancellationToken.None);
    }

    /// <summary>A fan-out retried after the tenant's lists could not be read.</summary>
    public class WebhookFanOutRetryConsumer : IConsumer<WebhookFanOutRetry>
    {
        private readonly IWebhookFanOutService _fanOut;
        private readonly TimeProvider _timeProvider;

        public WebhookFanOutRetryConsumer(IWebhookFanOutService fanOut, TimeProvider timeProvider)
        {
            _fanOut = fanOut;
            _timeProvider = timeProvider;
        }

        public async Task Consume(WebhookFanOutRetry context)
        {
            ArgumentNullException.ThrowIfNull(context);
            await WebhookJobWait.UntilAsync(context.NotBefore, _timeProvider, CancellationToken.None);
            await _fanOut.FanOutAsync(context.Action, context.Attempt, CancellationToken.None);
        }
    }

    /// <summary>One attempt of one delivery (<see cref="WebhookJobQueue.QueueName"/>).</summary>
    public class WebhookDeliveryJobConsumer : IConsumer<WebhookDeliveryJob>
    {
        private readonly IWebhookDeliveryProcessor _processor;
        private readonly TimeProvider _timeProvider;

        public WebhookDeliveryJobConsumer(IWebhookDeliveryProcessor processor, TimeProvider timeProvider)
        {
            _processor = processor;
            _timeProvider = timeProvider;
        }

        public async Task Consume(WebhookDeliveryJob context)
        {
            ArgumentNullException.ThrowIfNull(context);
            // A retry waits for its time here when the bus delivered it early (RabbitMQ ignores scheduled sends).
            await WebhookJobWait.UntilAsync(context.NotBefore, _timeProvider, CancellationToken.None);
            await _processor.ProcessAsync(context, CancellationToken.None);
        }
    }
}
