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
using Microsoft.Extensions.Logging;
using Moq;

namespace XUnitTest.Worker
{
    public class LmtColdArchiveRestoreConsumersTests
    {
        [Fact]
        public async Task StartBackupConsumer_FansOutToAllFourOperations()
        {
            var archiveService = new Mock<IArchiveService>();
            var logTraceRestoreService = new Mock<ILogTraceRestoreService>();
            var archiveRestoreService = new Mock<IArchiveRestoreService>();
            var logger = new Mock<ILogger<StartBackupConsumer>>();

            archiveService.Setup(s => s.DeleteMiscellaneousLog()).Returns(Task.CompletedTask);
            archiveService.Setup(s => s.StartBackupAsync()).Returns(Task.CompletedTask);
            logTraceRestoreService.Setup(s => s.DeleteAllExpiredColdRestoreDataAsync()).Returns(Task.CompletedTask);
            archiveRestoreService.Setup(s => s.CheckPendingHydrationsAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

            var consumer = new StartBackupConsumer(archiveService.Object, logger.Object, logTraceRestoreService.Object, archiveRestoreService.Object);

            await consumer.Consume(new PublishScheduleCommand());

            archiveService.Verify(s => s.DeleteMiscellaneousLog(), Times.Once);
            archiveService.Verify(s => s.StartBackupAsync(), Times.Once);
            logTraceRestoreService.Verify(s => s.DeleteAllExpiredColdRestoreDataAsync(), Times.Once);
            archiveRestoreService.Verify(s => s.CheckPendingHydrationsAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task StartBackupConsumer_WrapsFailureInInvalidOperationException()
        {
            var archiveService = new Mock<IArchiveService>();
            var logTraceRestoreService = new Mock<ILogTraceRestoreService>();
            var archiveRestoreService = new Mock<IArchiveRestoreService>();
            var logger = new Mock<ILogger<StartBackupConsumer>>();

            archiveService.Setup(s => s.DeleteMiscellaneousLog()).ThrowsAsync(new Exception("boom"));
            archiveService.Setup(s => s.StartBackupAsync()).Returns(Task.CompletedTask);
            logTraceRestoreService.Setup(s => s.DeleteAllExpiredColdRestoreDataAsync()).Returns(Task.CompletedTask);
            archiveRestoreService.Setup(s => s.CheckPendingHydrationsAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

            var consumer = new StartBackupConsumer(archiveService.Object, logger.Object, logTraceRestoreService.Object, archiveRestoreService.Object);

            await Assert.ThrowsAsync<InvalidOperationException>(() => consumer.Consume(new PublishScheduleCommand()));
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
