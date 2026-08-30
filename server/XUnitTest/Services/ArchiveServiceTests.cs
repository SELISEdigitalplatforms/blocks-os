using System.Threading.Tasks;
using Cloud.LmtService.Repositories.ArchiveAndDelete;
using Cloud.LmtService.Repositories.LogTraceBackup;
using Cloud.LmtService.Repositories.Logs;
using Cloud.LmtService.Repositories.Shared;
using Cloud.LmtService.Repositories.Trace;
using Cloud.LmtService.Services.ArchiveAndDelete;
using Cloud.LmtService.Utilities;
using Microsoft.Extensions.Logging;
using Moq;

namespace XUnitTest.Services
{
    public class ArchiveServiceTests
    {
        private readonly Mock<ILogger<ArchiveService>> _logger = new();
        private readonly Mock<ILogRepository> _logRepository = new();
        private readonly Mock<ITraceRepository> _traceRepository = new();
        private readonly Mock<IArchiveRepository> _archiveRepository = new();
        private readonly Mock<ILogTraceBackupRepository> _backupRepository = new();
        private readonly Mock<IBlobStorage> _blobStorage = new();
        private readonly Mock<ILmtArchiveRestoreConfigurationRepository> _configRepository = new();

        private ArchiveService Service() => new(
            _logger.Object,
            _logRepository.Object,
            _traceRepository.Object,
            _archiveRepository.Object,
            _backupRepository.Object,
            _blobStorage.Object,
            _configRepository.Object);

        [Fact]
        public async Task DeleteMiscellaneousLog_DeletesBothTraceAndLogMiscellaneousCollections()
        {
            _traceRepository
                .Setup(r => r.DeleteMiscellaneousTracesCollectionAsync(Constants.MiscellaneousCollectionName))
                .Returns(Task.CompletedTask);
            _logRepository
                .Setup(r => r.DeleteMiscellaneousLogsCollectionAsync(Constants.MiscellaneousCollectionName))
                .Returns(Task.CompletedTask);

            await Service().DeleteMiscellaneousLog();

            _traceRepository.Verify(r => r.DeleteMiscellaneousTracesCollectionAsync(Constants.MiscellaneousCollectionName), Times.Once);
            _logRepository.Verify(r => r.DeleteMiscellaneousLogsCollectionAsync(Constants.MiscellaneousCollectionName), Times.Once);
        }
    }
}
