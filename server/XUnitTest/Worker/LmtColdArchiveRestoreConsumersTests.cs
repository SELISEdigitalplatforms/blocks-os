using System;
using System.Threading;
using System.Threading.Tasks;
using Cloud.LmtService.Models.ArchiveAndDelete;
using Cloud.LmtService.Models.ColdRestore;
using Cloud.LmtService.Services.ArchiveAndDelete;
using Cloud.LmtService.Services.ColdRestore;
using LmtColdArchiveRestoreWorker.Consumers;
using LmtColdArchiveRestoreWorker.Consumers.ArchiveRestore;
using LmtColdArchiveRestoreWorker.Consumers.ColdRestore;
using LmtColdArchiveRestoreWorker.Consumers.Maintenance;
using Microsoft.Extensions.Logging;
using Moq;

namespace XUnitTest.Worker
{
    public class LmtColdArchiveRestoreConsumersTests
    {
        /// <summary>
        /// Backup owns backup only. Cleanup and hydration polling moved to their own queues so they
        /// can run on their own schedules, and so a failure in one cannot force the others to retry.
        /// </summary>
        [Fact]
        public async Task StartBackupConsumer_RunsOnlyTheBackupOperations()
        {
            var archiveService = new Mock<IArchiveService>();
            var logTraceRestoreService = new Mock<ILogTraceRestoreService>();
            var archiveRestoreService = new Mock<IArchiveRestoreService>();
            var logger = new Mock<ILogger<StartBackupConsumer>>();

            archiveService.Setup(s => s.DeleteMiscellaneousLog()).Returns(Task.CompletedTask);
            archiveService.Setup(s => s.StartBackupAsync()).Returns(Task.CompletedTask);

            var consumer = new StartBackupConsumer(archiveService.Object, logger.Object);

            await consumer.Consume(new PublishScheduleCommand());

            archiveService.Verify(s => s.DeleteMiscellaneousLog(), Times.Once);
            archiveService.Verify(s => s.StartBackupAsync(), Times.Once);
            logTraceRestoreService.Verify(s => s.DeleteAllExpiredColdRestoreDataAsync(), Times.Never);
            archiveRestoreService.Verify(s => s.CheckPendingHydrationsAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task StartBackupConsumer_WrapsFailureInInvalidOperationException()
        {
            var archiveService = new Mock<IArchiveService>();
            var logger = new Mock<ILogger<StartBackupConsumer>>();

            archiveService.Setup(s => s.DeleteMiscellaneousLog()).ThrowsAsync(new Exception("boom"));
            archiveService.Setup(s => s.StartBackupAsync()).Returns(Task.CompletedTask);

            var consumer = new StartBackupConsumer(archiveService.Object, logger.Object);

            await Assert.ThrowsAsync<InvalidOperationException>(() => consumer.Consume(new PublishScheduleCommand()));
        }

        [Fact]
        public async Task ExpiredDataCleanupConsumer_SweepsExpiredRestoreDataAndHydrationJobs()
        {
            var logTraceRestoreService = new Mock<ILogTraceRestoreService>();
            var archiveRestoreService = new Mock<IArchiveRestoreService>();
            var logger = new Mock<ILogger<ExpiredDataCleanupConsumer>>();

            logTraceRestoreService.Setup(s => s.DeleteAllExpiredColdRestoreDataAsync()).Returns(Task.CompletedTask);
            archiveRestoreService.Setup(s => s.DeleteExpiredHydrationJobsAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

            var consumer = new ExpiredDataCleanupConsumer(logTraceRestoreService.Object, archiveRestoreService.Object, logger.Object);

            await consumer.Consume(new RunCleanupCommand());

            logTraceRestoreService.Verify(s => s.DeleteAllExpiredColdRestoreDataAsync(), Times.Once);
            archiveRestoreService.Verify(s => s.DeleteExpiredHydrationJobsAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task ExpiredDataCleanupConsumer_WrapsFailureInInvalidOperationException()
        {
            var logTraceRestoreService = new Mock<ILogTraceRestoreService>();
            var archiveRestoreService = new Mock<IArchiveRestoreService>();
            var logger = new Mock<ILogger<ExpiredDataCleanupConsumer>>();

            logTraceRestoreService.Setup(s => s.DeleteAllExpiredColdRestoreDataAsync()).ThrowsAsync(new Exception("boom"));

            var consumer = new ExpiredDataCleanupConsumer(logTraceRestoreService.Object, archiveRestoreService.Object, logger.Object);

            await Assert.ThrowsAsync<InvalidOperationException>(() => consumer.Consume(new RunCleanupCommand()));
        }

        [Fact]
        public async Task HydrationCheckConsumer_PollsPendingHydrations()
        {
            var archiveRestoreService = new Mock<IArchiveRestoreService>();
            var logger = new Mock<ILogger<HydrationCheckConsumer>>();

            archiveRestoreService.Setup(s => s.CheckPendingHydrationsAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

            var consumer = new HydrationCheckConsumer(archiveRestoreService.Object, logger.Object);

            await consumer.Consume(new RunHydrationCheckCommand());

            archiveRestoreService.Verify(s => s.CheckPendingHydrationsAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task HydrationCheckConsumer_WrapsFailureInInvalidOperationException()
        {
            var archiveRestoreService = new Mock<IArchiveRestoreService>();
            var logger = new Mock<ILogger<HydrationCheckConsumer>>();

            archiveRestoreService
                .Setup(s => s.CheckPendingHydrationsAsync(It.IsAny<CancellationToken>()))
                .ThrowsAsync(new Exception("boom"));

            var consumer = new HydrationCheckConsumer(archiveRestoreService.Object, logger.Object);

            await Assert.ThrowsAsync<InvalidOperationException>(() => consumer.Consume(new RunHydrationCheckCommand()));
        }

        [Fact]
        public async Task ArchiveRestoreConsumer_DelegatesToService()
        {
            var archiveRestoreService = new Mock<IArchiveRestoreService>();
            var logger = new Mock<ILogger<ArchiveRestoreConsumer>>();
            var consumer = new ArchiveRestoreConsumer(archiveRestoreService.Object, logger.Object);

            var message = new ArchiveRestoreMessage
            {
                RequestId = "req-1",
                TenantId = "tenant-1",
                StartDate = DateTime.UtcNow.AddDays(-1),
                EndDate = DateTime.UtcNow
            };

            await consumer.Consume(message);

            archiveRestoreService.Verify(s => s.ProcessRestoreAsync(message, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task ColdRestoreConsumer_DelegatesToService()
        {
            var logTraceRestoreService = new Mock<ILogTraceRestoreService>();
            var logger = new Mock<ILogger<ColdRestoreConsumer>>();
            var consumer = new ColdRestoreConsumer(logTraceRestoreService.Object, logger.Object);

            var message = new ColdRestoreMessage
            {
                RequestId = "req-2",
                TenantId = "tenant-2",
                StartDate = DateTime.UtcNow.AddDays(-1),
                EndDate = DateTime.UtcNow
            };

            await consumer.Consume(message);

            logTraceRestoreService.Verify(s => s.ProcessRestoreAsync(message, It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}
