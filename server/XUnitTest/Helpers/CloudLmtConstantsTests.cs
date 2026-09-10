using System.Linq;
using Cloud.LmtService.Utilities;
using DomainService.Shared;
using FluentAssertions;

namespace XUnitTest.Helpers
{
    /// <summary>
    /// The LMT worker is the only host that registers consumers for the restore queues, so it
    /// is the only host that may bind them. These tests pin both halves of that arrangement:
    /// the LMT worker subscribes to every queue it consumes, and the Identifier configuration
    /// (used by the general Worker host, which has no LMT consumers) does not bind them at all.
    /// </summary>
    public class CloudLmtConstantsTests
    {
        [Theory]
        [InlineData("amqp://<username>:<password>@localhost:5672")]
        [InlineData("amqps://<username>:<password>@host:5671")]
        public void GetMessageConfiguration_Rabbit_SubscribesToEveryConsumedQueue(string connectionString)
        {
            var config = Constants.GetMessageConfiguration(connectionString);

            config.RabbitMqConfiguration.Should().NotBeNull();
            config.AzureServiceBusConfiguration.Should().BeNull();

            var queueNames = config.RabbitMqConfiguration!.ConsumerSubscriptions
                .Select(subscription => subscription.QueueName)
                .ToList();

            queueNames.Should().Contain(Constants.StartBackupQueue);
            queueNames.Should().Contain(Constants.ColdRestoreQueue);
            queueNames.Should().Contain(Constants.ArchiveRestoreQueue);
        }

        [Theory]
        [InlineData("Endpoint=sb://ns.servicebus.windows.net/;SharedAccessKey=y")]
        [InlineData("plain-string")]
        public void GetMessageConfiguration_NonRabbit_DeclaresEveryConsumedQueue(string connectionString)
        {
            var config = Constants.GetMessageConfiguration(connectionString);

            config.AzureServiceBusConfiguration.Should().NotBeNull();
            config.RabbitMqConfiguration.Should().BeNull();

            config.AzureServiceBusConfiguration!.Queues.Should().Contain(Constants.StartBackupQueue);
            config.AzureServiceBusConfiguration.Queues.Should().Contain(Constants.ColdRestoreQueue);
            config.AzureServiceBusConfiguration.Queues.Should().Contain(Constants.ArchiveRestoreQueue);
        }

        [Theory]
        [InlineData("amqp://<username>:<password>@localhost:5672")]
        [InlineData("amqps://<username>:<password>@host:5671")]
        public void IdentifierRabbitConfiguration_DoesNotBindLmtQueuesItCannotConsume(string connectionString)
        {
            var config = IdentifierConstants.GetMessageConfiguration(connectionString);

            var queueNames = config.RabbitMqConfiguration!.ConsumerSubscriptions
                .Select(subscription => subscription.QueueName)
                .ToList();

            queueNames.Should().NotContain(IdentifierConstants.StartBackupQueue);
            queueNames.Should().NotContain(IdentifierConstants.ColdRestoreQueue);
            queueNames.Should().NotContain(IdentifierConstants.ArchiveRestoreQueue);
        }
    }
}
