using Blocks.Genesis;
using Cloud.LmtService.Models.ArchiveAndDelete;
using Cloud.LmtService.Services.ArchiveAndDelete;
using Cloud.LmtService.Services.ColdRestore;
using Microsoft.Extensions.Logging;

namespace LmtColdArchiveRestoreWorker.Consumers
{
    public class StartBackupConsumer : IConsumer<PublishScheduleCommand>
    {
        private readonly IArchiveService _archiveService;
        private readonly ILogger<StartBackupConsumer> _logger;
        private readonly ILogTraceRestoreService _logTraceRestoreService;
        private readonly IArchiveRestoreService _archiveRestoreService;

        public StartBackupConsumer(
            IArchiveService archiveService,
            ILogger<StartBackupConsumer> logger,
            ILogTraceRestoreService logTraceRestoreService,
            IArchiveRestoreService archiveRestoreService)
        {
            _archiveService = archiveService;
            _logger = logger;
            _logTraceRestoreService = logTraceRestoreService;
            _archiveRestoreService = archiveRestoreService;
        }

        public async Task Consume(PublishScheduleCommand message)
        {
            try
            {
                var deleteMiscellaneous = _archiveService.DeleteMiscellaneousLog();
                var deleteExpiredRestoreData = _logTraceRestoreService.DeleteAllExpiredColdRestoreDataAsync();
                var checkPendingHydrations = _archiveRestoreService.CheckPendingHydrationsAsync();
                var startBackup = _archiveService.StartBackupAsync();
                await Task.WhenAll(deleteMiscellaneous, deleteExpiredRestoreData, checkPendingHydrations, startBackup);

                _logger.LogInformation("StartBackupConsumer - Backup process initiated successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "StartBackupConsumer - Error processing backup request");
                throw new InvalidOperationException("StartBackupConsumer failed while processing backup request.", ex);
            }
        }
    }
}
