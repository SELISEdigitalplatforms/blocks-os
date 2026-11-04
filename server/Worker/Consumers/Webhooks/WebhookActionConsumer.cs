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

        public WebhookFanOutRetryConsumer(IWebhookFanOutService fanOut)
        {
            _fanOut = fanOut;
        }

        public Task Consume(WebhookFanOutRetry context)
        {
            ArgumentNullException.ThrowIfNull(context);
            return _fanOut.FanOutAsync(context.Action, context.Attempt, CancellationToken.None);
        }
    }

    /// <summary>One attempt of one delivery (<see cref="WebhookJobQueue.QueueName"/>).</summary>
    public class WebhookDeliveryJobConsumer : IConsumer<WebhookDeliveryJob>
    {
        private readonly IWebhookDeliveryProcessor _processor;

        public WebhookDeliveryJobConsumer(IWebhookDeliveryProcessor processor)
        {
            _processor = processor;
        }

        public Task Consume(WebhookDeliveryJob context) => _processor.ProcessAsync(context, CancellationToken.None);
    }
}
