using Blocks.Genesis;
using Cloud.LmtService.Models.ArchiveAndDelete;
using Cloud.LmtService.Services.ColdRestore;
using Microsoft.Extensions.Logging;

namespace LmtColdArchiveRestoreWorker.Consumers.Maintenance
{
    /// <summary>
    /// Sweeps restore data whose retention has elapsed: requests, file progress, per-request result
    /// collections and rehydration jobs. Scheduled daily, independently of the backup.
    /// </summary>
    public class ExpiredDataCleanupConsumer : IConsumer<RunCleanupCommand>
    {
        private readonly ILogTraceRestoreService _logTraceRestoreService;
        private readonly IArchiveRestoreService _archiveRestoreService;
        private readonly ILogger<ExpiredDataCleanupConsumer> _logger;

        public ExpiredDataCleanupConsumer(
            ILogTraceRestoreService logTraceRestoreService,
            IArchiveRestoreService archiveRestoreService,
            ILogger<ExpiredDataCleanupConsumer> logger)
        {
            _logTraceRestoreService = logTraceRestoreService;
            _archiveRestoreService = archiveRestoreService;
            _logger = logger;
        }

        public async Task Consume(RunCleanupCommand message)
        {
            try
            {
                _logger.LogInformation("ExpiredDataCleanupConsumer - Starting expired restore data sweep");

                await _logTraceRestoreService.DeleteAllExpiredColdRestoreDataAsync();
                await _archiveRestoreService.DeleteExpiredHydrationJobsAsync();

                _logger.LogInformation("ExpiredDataCleanupConsumer - Expired restore data sweep completed");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ExpiredDataCleanupConsumer - Error sweeping expired restore data");
                throw new InvalidOperationException("ExpiredDataCleanupConsumer failed while sweeping expired restore data.", ex);
            }
        }
    }
}
