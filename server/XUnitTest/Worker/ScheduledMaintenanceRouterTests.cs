using System;
using System.Threading;
using System.Threading.Tasks;
using Cloud.LmtService.Models.ArchiveAndDelete;
using Cloud.LmtService.Services.ArchiveAndDelete;
using Cloud.LmtService.Services.ColdRestore;
using LmtColdArchiveRestoreWorker.Consumers;
using LmtColdArchiveRestoreWorker.Consumers.Maintenance;
using Microsoft.Extensions.Logging;
using Moq;

namespace XUnitTest.Worker
{
    /// <summary>
    /// The scheduler publishes the same PublishScheduleCommand to every queue it drives, and
    /// Blocks.Genesis routes on the message type name alone - never on the queue name - so the
    /// queue a maintenance job arrived on cannot select its behaviour. The schedule's Payload
    /// carries the task name instead, exactly as workflow schedules already do.
    /// </summary>
    public class ScheduledMaintenanceRouterTests
    {
        /// <summary>
        /// Wires the router to the real maintenance consumers over mocked services, so the
        /// assertions land on the work that actually happened rather than on a mocked delegate.
        /// </summary>
        private sealed class Harness
        {
            public Mock<IArchiveService> ArchiveService { get; } = new();
            public Mock<ILogTraceRestoreService> LogTraceRestoreService { get; } = new();
            public Mock<IArchiveRestoreService> ArchiveRestoreService { get; } = new();
            public ScheduledMaintenanceRouter Router { get; }

            public Harness()
            {
                ArchiveService.Setup(s => s.DeleteMiscellaneousLog()).Returns(Task.CompletedTask);
                ArchiveService.Setup(s => s.StartBackupAsync()).Returns(Task.CompletedTask);
                LogTraceRestoreService.Setup(s => s.DeleteAllExpiredColdRestoreDataAsync()).Returns(Task.CompletedTask);
                ArchiveRestoreService.Setup(s => s.DeleteExpiredHydrationJobsAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
                ArchiveRestoreService.Setup(s => s.CheckPendingHydrationsAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

                Router = new ScheduledMaintenanceRouter(
                    new StartBackupConsumer(ArchiveService.Object, Mock.Of<ILogger<StartBackupConsumer>>()),
                    new ExpiredDataCleanupConsumer(LogTraceRestoreService.Object, ArchiveRestoreService.Object, Mock.Of<ILogger<ExpiredDataCleanupConsumer>>()),
                    new HydrationCheckConsumer(ArchiveRestoreService.Object, Mock.Of<ILogger<HydrationCheckConsumer>>()),
                    Mock.Of<ILogger<ScheduledMaintenanceRouter>>());
            }

            public Task RouteAsync(string payload) =>
                Router.Consume(new PublishScheduleCommand { Payload = payload });

            public void VerifyRan(bool backup, bool cleanup, bool hydrationCheck)
            {
                ArchiveService.Verify(s => s.StartBackupAsync(), backup ? Times.Once() : Times.Never());
                LogTraceRestoreService.Verify(s => s.DeleteAllExpiredColdRestoreDataAsync(), cleanup ? Times.Once() : Times.Never());
                ArchiveRestoreService.Verify(s => s.CheckPendingHydrationsAsync(It.IsAny<CancellationToken>()), hydrationCheck ? Times.Once() : Times.Never());
            }
        }

        /// <summary>
        /// The daily backup row carries Payload "" today, and the on-demand endpoint sends an empty
        /// command. Both must keep running the backup, so a half-applied config change can never be
        /// worse than the behaviour it replaces.
        /// </summary>
        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public async Task EmptyPayload_RunsBackup(string? payload)
        {
            var harness = new Harness();

            await harness.RouteAsync(payload!);

            harness.VerifyRan(backup: true, cleanup: false, hydrationCheck: false);
        }

        [Fact]
        public async Task BackupTask_RunsBackupOnly()
        {
            var harness = new Harness();

            await harness.RouteAsync("{\"task\":\"backup\"}");

            harness.VerifyRan(backup: true, cleanup: false, hydrationCheck: false);
        }

        [Fact]
        public async Task CleanupTask_RunsCleanupOnly()
        {
            var harness = new Harness();

            await harness.RouteAsync("{\"task\":\"cleanup\"}");

            harness.VerifyRan(backup: false, cleanup: true, hydrationCheck: false);
        }

        /// <summary>This is the schedule that was silently running a full backup every 2 minutes.</summary>
        [Fact]
        public async Task HydrationCheckTask_RunsHydrationCheckOnly()
        {
            var harness = new Harness();

            await harness.RouteAsync("{\"task\":\"hydration-check\"}");

            harness.VerifyRan(backup: false, cleanup: false, hydrationCheck: true);
        }

        /// <summary>
        /// The task name is hand-written configuration in Mongo, so casing and stray whitespace
        /// must not decide whether a job runs.
        /// </summary>
        [Theory]
        [InlineData("{\"task\":\"Hydration-Check\"}")]
        [InlineData("{\"task\":\"HYDRATION-CHECK\"}")]
        [InlineData("{\"task\":\"  hydration-check  \"}")]
        [InlineData("{\"Task\":\"hydration-check\"}")]
        public async Task TaskNameIsCaseAndWhitespaceInsensitive(string payload)
        {
            var harness = new Harness();

            await harness.RouteAsync(payload);

            harness.VerifyRan(backup: false, cleanup: false, hydrationCheck: true);
        }

        /// <summary>
        /// An unrecognised task is a config mistake. Doing nothing is the safe failure: falling
        /// back to the backup is exactly the bug this router exists to remove.
        /// </summary>
        [Theory]
        [InlineData("{\"task\":\"restore-everything\"}")]
        [InlineData("{\"task\":\"\"}")]
        [InlineData("{\"somethingElse\":\"backup\"}")]
        public async Task UnknownTask_RunsNothing(string payload)
        {
            var harness = new Harness();

            await harness.RouteAsync(payload);

            harness.VerifyRan(backup: false, cleanup: false, hydrationCheck: false);
        }

        /// <summary>
        /// Malformed JSON will not fix itself on redelivery, so the router completes the message
        /// instead of throwing it into an endless retry-then-dead-letter loop.
        /// </summary>
        [Theory]
        [InlineData("{not json")]
        [InlineData("[\"backup\"]")]
        public async Task MalformedPayload_RunsNothingAndDoesNotThrow(string payload)
        {
            var harness = new Harness();

            await harness.RouteAsync(payload);

            harness.VerifyRan(backup: false, cleanup: false, hydrationCheck: false);
        }

        /// <summary>
        /// A failure in the underlying job is operational, not config, so it must surface and let
        /// Service Bus redeliver - the same contract the consumers already honour on their own queues.
        /// </summary>
        [Fact]
        public async Task OperationalFailure_Propagates()
        {
            var harness = new Harness();
            harness.ArchiveRestoreService
                .Setup(s => s.CheckPendingHydrationsAsync(It.IsAny<CancellationToken>()))
                .ThrowsAsync(new Exception("boom"));

            await Assert.ThrowsAsync<InvalidOperationException>(
                () => harness.RouteAsync("{\"task\":\"hydration-check\"}"));
        }
    }
}
