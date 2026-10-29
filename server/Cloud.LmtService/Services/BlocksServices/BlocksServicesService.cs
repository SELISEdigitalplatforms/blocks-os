using Blocks.Genesis;
using Cloud.LmtService.Models.BlocksServices;
using Microsoft.Extensions.Logging;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace Cloud.LmtService.Services.BlocksServices
{
    public class BlocksServicesService : IBlocksServicesService
    {
        private const string BlocksServicesKey = "blocks-services";

        private readonly IKeyValueStore _store;
        private readonly ILogger<BlocksServicesService> _logger;

        public BlocksServicesService(
            IKeyValueStore store,
            ILogger<BlocksServicesService> logger)
        {
            _store = store;
            _logger = logger;
        }

        public async Task<List<BlocksServiceItem>> GetBlocksServicesAsync(CancellationToken cancellationToken = default)
        {
            _logger.LogInformation("Start of GetBlocksServicesAsync");

            var result = await _store.GetAsync<List<BlocksServiceItem>>(BlocksServicesKey, impersonated: false, cancellationToken).ConfigureAwait(false);

            return result ?? [];
        }
    }
}
