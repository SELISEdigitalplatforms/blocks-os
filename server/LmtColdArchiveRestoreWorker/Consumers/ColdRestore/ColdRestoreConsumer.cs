using Blocks.Genesis;
using Cloud.LmtService.Models.ColdRestore;
using Cloud.LmtService.Services.ColdRestore;
using Microsoft.Extensions.Logging;

namespace LmtColdArchiveRestoreWorker.Consumers.ColdRestore
{
    public class ColdRestoreConsumer : IConsumer<ColdRestoreMessage>
    {
        private readonly ILogTraceRestoreService _logTraceRestoreService;
        private readonly ILogger<ColdRestoreConsumer> _logger;

        public ColdRestoreConsumer(ILogTraceRestoreService logTraceRestoreService, ILogger<ColdRestoreConsumer> logger)
        {
            _logTraceRestoreService = logTraceRestoreService;
            _logger = logger;
        }

        public async Task Consume(ColdRestoreMessage message)
        {
            _logger.LogInformation(
                "ColdRestoreConsumer received restore message for RequestId {RequestId}",
                message.RequestId);

            await _logTraceRestoreService.ProcessRestoreAsync(message);
        }
    }
}
