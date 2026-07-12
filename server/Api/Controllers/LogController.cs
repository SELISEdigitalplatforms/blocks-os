using Blocks.Genesis;
using Cloud.LmtService.Models.Logs;
using Cloud.LmtService.Services.Logs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace BlocksTemplate.Api.Controllers
{
    [ApiController]
    [Route("[controller]/[action]")]
    public class LogController : ControllerBase
    {
        private readonly ILogService _logService;

        public LogController(
            ILogService logService)
        {
            _logService = logService;
        }


        [HttpPost]
        [Authorize]
        public async Task<IActionResult> GetLogs([FromBody] GetLogsRequest request)
        {
            var result = await _logService.GetLogsAsync(request);
            return Ok(result);
        }

        [HttpPost]
        [Authorize]
        public async Task<GetLogsResponse> GetLogsByDate([FromBody] LogsByDateRequest request)
        {
            return await _logService.GetLogsByDateAsync(request);
        }


        [HttpGet]
        [Authorize]
        public async Task<IActionResult> Live([FromQuery] LiveLogRequest request)
        {
            var result = await _logService.GetLiveLogsAsync(request);
            return Ok(result);
        }

    }
}
