using DomainService.Shared;
using FluentAssertions;

namespace XUnitTest.Helpers
{
    public class IdentifierConstantsTests
    {
        [Theory]
        [InlineData("amqp://<username>:<password>@localhost:5672")]
        [InlineData("amqps://<username>:<password>@host:5671")]
        public void GetMessageConfiguration_Rabbit_BindsIdentifierQueues(string connectionString)
        {
            var config = IdentifierConstants.GetMessageConfiguration(connectionString);

            config.RabbitMqConfiguration.Should().NotBeNull();
            config.RabbitMqConfiguration!.ConsumerSubscriptions.Should().NotBeEmpty();
            config.AzureServiceBusConfiguration.Should().BeNull();
        }

        [Theory]
        [InlineData("Endpoint=sb://ns.servicebus.windows.net/;SharedAccessKey=y")]
        [InlineData("plain-string")]
        public void GetMessageConfiguration_NonRabbit_ConfiguresAzureQueuesAndTopics(string connectionString)
        {
            var config = IdentifierConstants.GetMessageConfiguration(connectionString);

            config.AzureServiceBusConfiguration.Should().NotBeNull();
            config.AzureServiceBusConfiguration!.Queues.Should().Contain(IdentifierConstants.IdentifierQueueName);
            config.AzureServiceBusConfiguration.Topics.Should().Contain(IdentifierConstants.MigrationCompletionTopic);
            config.RabbitMqConfiguration.Should().BeNull();
        }
    }
}
