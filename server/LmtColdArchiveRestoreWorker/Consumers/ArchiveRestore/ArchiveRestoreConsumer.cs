using Blocks.Genesis;
using Cloud.LmtService.Models.ColdRestore;
using Cloud.LmtService.Services.ColdRestore;
using Microsoft.Extensions.Logging;

namespace LmtColdArchiveRestoreWorker.Consumers.ArchiveRestore
{
    public class ArchiveRestoreConsumer : IConsumer<ArchiveRestoreMessage>
    {
        private readonly IArchiveRestoreService _archiveRestoreService;
        private readonly ILogger<ArchiveRestoreConsumer> _logger;

        public ArchiveRestoreConsumer(IArchiveRestoreService archiveRestoreService, ILogger<ArchiveRestoreConsumer> logger)
        {
            _archiveRestoreService = archiveRestoreService;
            _logger = logger;
        }

        public async Task Consume(ArchiveRestoreMessage message)
        {
            _logger.LogInformation(
                "ArchiveRestoreConsumer received restore message for RequestId {RequestId}",
                message.RequestId);

            await _archiveRestoreService.ProcessRestoreAsync(message);
        }
    }
}
