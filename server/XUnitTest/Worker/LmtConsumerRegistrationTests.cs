using Blocks.Genesis;
using Cloud.LmtService.Models.ArchiveAndDelete;
using Cloud.LmtService.Models.ColdRestore;
using FluentAssertions;
using LmtColdArchiveRestoreWorker.Consumers;
using LmtColdArchiveRestoreWorker.Consumers.ArchiveRestore;
using LmtColdArchiveRestoreWorker.Consumers.ColdRestore;
using LmtColdArchiveRestoreWorker.Consumers.Maintenance;
using Microsoft.Extensions.DependencyInjection;

namespace XUnitTest.Worker
{
    /// <summary>
    /// Genesis picks a consumer from the message type name alone, so the registration list - not
    /// the queue list - decides what actually runs. These tests pin that map: the original defect
    /// was a correct consumer that no message could ever reach, and a startup-crashing duplicate is
    /// only one careless AddSingleton away.
    /// </summary>
    public class LmtConsumerRegistrationTests
    {
        private static RoutingTable BuildRoutingTable()
        {
            var services = new ServiceCollection();
            services.AddLmtConsumers();
            return new RoutingTable(services);
        }

        /// <summary>
        /// Every schedule the scheduler drives arrives as PublishScheduleCommand regardless of its
        /// queue, so the router - not any single job - must own that type.
        /// </summary>
        [Fact]
        public void PublishScheduleCommand_ResolvesToTheRouter()
        {
            var routes = BuildRoutingTable().Routes;

            routes.Should().ContainKey(nameof(PublishScheduleCommand));
            routes[nameof(PublishScheduleCommand)].ConsumerType
                .Should().Be(typeof(IConsumer<PublishScheduleCommand>));
            routes[nameof(PublishScheduleCommand)].ConsumerMethod.DeclaringType
                .Should().Be(typeof(ScheduledMaintenanceRouter));
        }

        /// <summary>
        /// The maintenance jobs keep their own message types so the on-demand API endpoints can
        /// still reach them directly, without going through a schedule payload.
        /// </summary>
        [Theory]
        [InlineData(nameof(RunBackupCommand), typeof(StartBackupConsumer))]
        [InlineData(nameof(RunCleanupCommand), typeof(ExpiredDataCleanupConsumer))]
        [InlineData(nameof(RunHydrationCheckCommand), typeof(HydrationCheckConsumer))]
        [InlineData(nameof(ArchiveRestoreMessage), typeof(ArchiveRestoreConsumer))]
        [InlineData(nameof(ColdRestoreMessage), typeof(ColdRestoreConsumer))]
        public void MessageType_ResolvesToItsOwnConsumer(string messageTypeName, Type expectedConsumer)
        {
            var routes = BuildRoutingTable().Routes;

            routes.Should().ContainKey(messageTypeName);
            routes[messageTypeName].ConsumerMethod.DeclaringType.Should().Be(expectedConsumer);
        }

        /// <summary>
        /// RoutingTable throws on a duplicate message type, which takes the whole worker down at
        /// startup. Catching that here beats catching it in a deployment.
        /// </summary>
        [Fact]
        public void Registrations_ContainNoDuplicateMessageTypes()
        {
            var buildingTheRoutingTable = BuildRoutingTable;

            buildingTheRoutingTable.Should().NotThrow(
                "a message type registered twice crashes the worker on startup");
        }

        /// <summary>
        /// A consumer that is registered but unreachable is the exact shape of the original bug:
        /// HydrationCheckConsumer existed, was wired up, and no message could ever reach it.
        /// </summary>
        [Fact]
        public void EveryRegisteredConsumer_IsReachableByExactlyOneMessageType()
        {
            var routes = BuildRoutingTable().Routes;

            var reachableConsumers = routes.Values
                .Select(route => route.ConsumerMethod.DeclaringType)
                .ToList();

            reachableConsumers.Should().OnlyHaveUniqueItems();
            reachableConsumers.Should().Contain(typeof(ScheduledMaintenanceRouter));
            reachableConsumers.Should().Contain(typeof(HydrationCheckConsumer));
            reachableConsumers.Should().Contain(typeof(ExpiredDataCleanupConsumer));
        }
    }
}
