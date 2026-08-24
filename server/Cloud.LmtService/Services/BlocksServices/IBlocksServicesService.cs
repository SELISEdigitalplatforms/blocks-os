using Cloud.LmtService.Models.BlocksServices;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace Cloud.LmtService.Services.BlocksServices
{
    public interface IBlocksServicesService
    {
        Task<List<BlocksServiceItem>> GetBlocksServicesAsync(CancellationToken cancellationToken = default);
    }
}
