using Blocks.Genesis;
using Cloud.LmtService.Models.BlocksServices;
using Cloud.LmtService.Models.Logs;
using Cloud.LmtService.Services.BlocksServices;
using Cloud.LmtService.Services.Logs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace BlocksOs.Api.Controllers
{
    [ApiController]
    [Route("[controller]/[action]")]
    public class LogController : ControllerBase
    {
        private readonly ILogService _logService;
        private readonly IBlocksServicesService _blocksServicesService;

        public LogController(
            ILogService logService,
            IBlocksServicesService blocksServicesService)
        {
            _logService = logService;
            _blocksServicesService = blocksServicesService;
        }


        // Log access must use a log-specific scope, not the mail scope it was copy-pasted from.
        // NOTE (multi-tenant deploy): blocks-os::log::gets must be registered in every tenant's
        // permission catalog and granted to the roles currently holding blocks-os::mail::gets
        // (handled by the external IAM seed/grant migration, see #326) so no tenant loses log
        // access when this ships.
        [HttpPost]
        [ProtectedEndPoint("blocks-os::log::gets")]
        public async Task<IActionResult> GetLogs([FromBody] GetLogsRequest request)
        {
            var result = await _logService.GetLogsAsync(request);
            return Ok(result);
        }

        [HttpPost]
        [ProtectedEndPoint("blocks-os::log::gets")]
        public async Task<GetLogsResponse> GetLogsByDate([FromBody] LogsByDateRequest request)
        {
            return await _logService.GetLogsByDateAsync(request);
        }


        [HttpGet]
        [ProtectedEndPoint("blocks-os::log::gets")]
        public async Task<IActionResult> Live([FromQuery] LiveLogRequest request)
        {
            var result = await _logService.GetLiveLogsAsync(request);
            return Ok(result);
        }

        [HttpGet]
        public async Task<List<BlocksServiceItem>> GetBlocksServices()
        {
            return await _blocksServicesService.GetBlocksServicesAsync();
        }

    }
}
