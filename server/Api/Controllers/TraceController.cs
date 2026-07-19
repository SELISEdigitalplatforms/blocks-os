using Blocks.Genesis;
using Cloud.LmtService.Models.Trace;
using Cloud.LmtService.Services.Trace;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace BlocksTemplate.Api.Controllers
{

    [ApiController]
    [Route("[controller]/[action]")]
    public class TraceController : ControllerBase
    {
        private readonly ITraceService _traceService;

        public TraceController(ITraceService traceService)
        {
            _traceService = traceService;
        }


        [HttpPost]
        [ProtectedEndPoint("blocks-os::trace::gets")]
        public async Task<object> GetTraces([FromBody] GetTracesRequest request)
        {
            return await _traceService.GetTracesAsync(request);
        }

        [HttpGet]
        [ProtectedEndPoint("blocks-os::trace::gets")]
        public async Task<object> GetTrace([FromQuery] GetTraceRequest request)
        {
            return await _traceService.GetTraceAsync(request);
        }

        [HttpPost]
        [ProtectedEndPoint("blocks-os::trace::get-analytics")]
        public async Task<object> GetOperationalAnalytics([FromBody] GetApiAnalyticsRequest request)
        {
            return await _traceService.GetOperationalAnalytics(request);
        }

        [HttpPost]
        [ProtectedEndPoint("blocks-os::trace::get-analytics")]
        public async Task<object> GetServiceAnalytics([FromBody] GetHttpStatusAnalyticsRequest request)
        {
            return await _traceService.GetServiceAnalytics(request);
        }

    }
}
