using Blocks.Genesis;
using Cloud.LmtService.Models.BlocksServices;
using Cloud.LmtService.Models.Trace;
using Cloud.LmtService.Services.BlocksServices;
using Cloud.LmtService.Services.Trace;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace BlocksOs.Api.Controllers
{

    [ApiController]
    [Route("[controller]/[action]")]
    public class TraceController : ControllerBase
    {
        private readonly ITraceService _traceService;
  private readonly IBlocksServicesService _blocksServicesService;

  public TraceController (ITraceService traceService, IBlocksServicesService blocksServicesService)
        {
            _traceService = traceService;
            _blocksServicesService = blocksServicesService;
        }


        [HttpPost]
        [ProtectedEndPoint("blocks-os::trace::gets")]
        public async Task<BaseQueryListResponse<IQueryable<TraceProjection>>> GetTraces([FromBody] GetTracesRequest request)
        {
            return await _traceService.GetTracesAsync(request);
        }

        [HttpGet]
        [ProtectedEndPoint("blocks-os::trace::gets")]
        public async Task<BaseQueryListResponse<IQueryable<SingleTraceProjection>>> GetTrace([FromQuery] GetTraceRequest request)
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

        [HttpGet]
        public async Task<List<BlocksServiceItem>> GetBlocksServices ( )
        {
         return await _blocksServicesService.GetBlocksServicesAsync();
        }

     }
}
