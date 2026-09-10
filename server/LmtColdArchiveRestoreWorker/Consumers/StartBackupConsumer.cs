using Blocks.Genesis;
using Cloud.LmtService.Models.ArchiveAndDelete;
using Cloud.LmtService.Services.ArchiveAndDelete;
using Microsoft.Extensions.Logging;

namespace LmtColdArchiveRestoreWorker.Consumers
{
    /// <summary>
    /// Runs the nightly archive-and-delete pass. Expired-data cleanup and rehydration polling used
    /// to ride along here; they now have their own queues so they can run on their own schedules
    /// and so a failure in one no longer forces the whole backup to be redelivered.
    /// </summary>
    public class StartBackupConsumer : IConsumer<PublishScheduleCommand>
    {
        private readonly IArchiveService _archiveService;
        private readonly ILogger<StartBackupConsumer> _logger;

        public StartBackupConsumer(
            IArchiveService archiveService,
            ILogger<StartBackupConsumer> logger)
        {
            _archiveService = archiveService;
            _logger = logger;
        }

        public async Task Consume(PublishScheduleCommand message)
        {
            try
            {
                await Task.WhenAll(
                    _archiveService.DeleteMiscellaneousLog(),
                    _archiveService.StartBackupAsync());

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
