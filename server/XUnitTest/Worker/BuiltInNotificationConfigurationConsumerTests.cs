using System.Text.Json;
using System.Threading.Tasks;
using Blocks.Genesis;
using Blocks.Genesis.Entities.Os;
using Configuration.DomainService.Notification.Propagation;
using Configuration.DomainService.Shared.Utilities;
using DomainService.Shared;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Worker.Consumers.Notification;

namespace XUnitTest.Worker
{
    public class BuiltInNotificationConfigurationConsumerTests
    {
        [Fact]
        public async Task Consume_DelegatesToPropagator()
        {
            var propagator = new Mock<INotificationConfigurationPropagator>();
            propagator.Setup(p => p.PropagateAsync(It.IsAny<BuiltInNotificationConfigurationChangedEvent>()))
                      .ReturnsAsync(new NotificationPropagationSummary());
            var change = new BuiltInNotificationConfigurationChangedEvent { Name = "X", SourceTenantId = "ROOT" };

            await new BuiltInNotificationConfigurationConsumer(propagator.Object).Consume(change);

            propagator.Verify(p => p.PropagateAsync(change), Times.Once);
        }

        [Fact]
        public void RoutingTable_RoutesTheEventTypeName_ToTheConsumer()
        {
            var services = new ServiceCollection();
            services.AddSingleton<IConsumer<BuiltInNotificationConfigurationChangedEvent>, BuiltInNotificationConfigurationConsumer>();

            var routes = new RoutingTable(services).Routes;

            routes.Should().ContainKey(nameof(BuiltInNotificationConfigurationChangedEvent));
            routes[nameof(BuiltInNotificationConfigurationChangedEvent)].ConsumerType
                .Should().Be(typeof(IConsumer<BuiltInNotificationConfigurationChangedEvent>));
        }

        /// <summary>Genesis deserialises the payload with System.Text.Json; the snapshot must survive it.</summary>
        [Fact]
        public void Event_RoundTripsThroughSystemTextJson()
        {
            var change = new BuiltInNotificationConfigurationChangedEvent
            {
                Action = NotificationConfigurationChangeAction.Delete,
                Name = "X",
                SourceTenantId = "ROOT",
                Snapshot = new NotificationConfiguration { ItemId = "i", Name = "X", IsBuiltIn = true, Kind = NotificationKind.Job, Description = "d" }
            };

            var back = JsonSerializer.Deserialize<BuiltInNotificationConfigurationChangedEvent>(JsonSerializer.Serialize(change))!;

            back.Action.Should().Be(NotificationConfigurationChangeAction.Delete);
            back.Snapshot!.IsBuiltIn.Should().BeTrue();
            back.Snapshot.Kind.Should().Be(NotificationKind.Job);
            back.Snapshot.Description.Should().Be("d");
        }

        [Theory]
        [InlineData("amqp://<username>:<password>@localhost:5672")]
        [InlineData("Endpoint=sb://ns.servicebus.windows.net/;SharedAccessKey=y")]
        public void WorkerMessageConfiguration_BindsNotificationQueueOnce_AndKeepsIdentifierQueues(string connection)
        {
            var config = Constants.WithNotificationConfigurationQueue(
                Constants.WithNotificationConfigurationQueue(IdentifierConstants.GetMessageConfiguration(connection)));

            if (config.RabbitMqConfiguration is not null)
            {
                config.RabbitMqConfiguration.ConsumerSubscriptions
                    .Should().ContainSingle(s => s.QueueName == Constants.NotificationConfigurationQueue);
                config.RabbitMqConfiguration.ConsumerSubscriptions
                    .Should().Contain(s => s.QueueName == IdentifierConstants.IdentifierQueueName);
            }
            else
            {
                config.AzureServiceBusConfiguration!.Queues
                    .Should().ContainSingle(q => q == Constants.NotificationConfigurationQueue);
                config.AzureServiceBusConfiguration.Queues.Should().Contain(IdentifierConstants.IdentifierQueueName);
            }
        }
    }
}
