using Blocks.Genesis;
using Cloud.LmtService.Models.ArchiveAndDelete;
using Cloud.LmtService.Services.ColdRestore;
using Microsoft.Extensions.Logging;

namespace LmtColdArchiveRestoreWorker.Consumers.Maintenance
{
    /// <summary>
    /// Polls blobs that were asked to leave the Archive tier and restores the ones that are ready.
    /// This is the step that turns a finished rehydration into restored rows, so its schedule sets
    /// the tail latency of every archive restore — run it every 15-30 minutes, not daily.
    /// </summary>
    public class HydrationCheckConsumer : IConsumer<RunHydrationCheckCommand>
    {
        private readonly IArchiveRestoreService _archiveRestoreService;
        private readonly ILogger<HydrationCheckConsumer> _logger;

        public HydrationCheckConsumer(
            IArchiveRestoreService archiveRestoreService,
            ILogger<HydrationCheckConsumer> logger)
        {
            _archiveRestoreService = archiveRestoreService;
            _logger = logger;
        }

        public async Task Consume(RunHydrationCheckCommand message)
        {
            try
            {
                await _archiveRestoreService.CheckPendingHydrationsAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "HydrationCheckConsumer - Error checking pending hydrations");
                throw new InvalidOperationException("HydrationCheckConsumer failed while checking pending hydrations.", ex);
            }
        }
    }
}
