using Blocks.Genesis;
using BlocksOs.Api.Controllers;
using Configuration.DomainService.Shared.Services;
using Configuration.DomainService.Shared.Utilities;
using Configuration.DomainService.Webhooks;
using DomainService.Shared;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Worker.Consumers.Webhooks;

namespace XUnitTest.Webhooks
{
    public class WebhookWiringTests
    {
        [Theory]
        [InlineData("amqp://<username>:<password>@localhost:5672")]
        [InlineData("Endpoint=sb://ns.servicebus.windows.net/;SharedAccessKey=y")]
        public void WorkerMessageConfiguration_BindsBothWebhookQueuesOnce(string connection)
        {
            var config = Constants.WithWebhookQueues(Constants.WithWebhookQueues(IdentifierConstants.GetMessageConfiguration(connection)));

            string[] queues = [ActionConstants.WebhookQueue, WebhookJobQueue.QueueName];
            foreach (var queue in queues)
            {
                if (config.RabbitMqConfiguration is not null)
                {
                    config.RabbitMqConfiguration.ConsumerSubscriptions.Should().ContainSingle(s => s.QueueName == queue);
                }
                else
                {
                    config.AzureServiceBusConfiguration!.Queues.Should().ContainSingle(q => q == queue);
                }
            }
        }

        [Fact]
        public void RoutingTable_RoutesTheThreeWebhookMessages()
        {
            var services = new ServiceCollection();
            services.AddSingleton<IConsumer<BlocksAction>, WebhookActionConsumer>();
            services.AddSingleton<IConsumer<WebhookFanOutRetry>, WebhookFanOutRetryConsumer>();
            services.AddSingleton<IConsumer<WebhookDeliveryJob>, WebhookDeliveryJobConsumer>();

            var routes = new RoutingTable(services).Routes;

            routes.Should().ContainKeys(nameof(BlocksAction), nameof(WebhookFanOutRetry), nameof(WebhookDeliveryJob));
        }

        [Theory]
        [InlineData(OutcomeStatus.BadRequest, 400)]
        [InlineData(OutcomeStatus.NotFound, 404)]
        [InlineData(OutcomeStatus.Conflict, 409)]
        public void RefusedOutcome_MapsToItsStatus_WithTheErrorCode(OutcomeStatus status, int httpStatus)
        {
            var result = new ProbeController().ToActionResult(new ServiceOutcome<bool>(status, false, "SOME_CODE"));

            var objectResult = result.Result.Should().BeOfType<ObjectResult>().Subject;
            objectResult.StatusCode.Should().Be(httpStatus);
            objectResult.Value.Should().BeOfType<BaseResponse>().Which.Errors![ServiceOutcomeResults.ErrorCodeKey].Should().Be("SOME_CODE");
        }

        private sealed class ProbeController : ControllerBase
        {
        }
    }
}
