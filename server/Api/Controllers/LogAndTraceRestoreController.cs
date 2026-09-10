using Blocks.Genesis;
using Cloud.LmtService.Models.ArchiveAndDelete;
using Cloud.LmtService.Models.ColdRestore;
using Cloud.LmtService.Models.Logs;
using Cloud.LmtService.Models.Trace;
using Cloud.LmtService.Services.ColdRestore;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BlocksOs.Api.Controllers
{
    [ApiController]
    [Route("[controller]/[action]")]
    public class LogAndTraceRestoreController : ControllerBase
    {
        private readonly ILogTraceRestoreService _logTraceRestoreService;
        private readonly IArchiveRestoreService _archiveRestoreService;

        public LogAndTraceRestoreController(
            ILogTraceRestoreService logTraceRestoreService,
            IArchiveRestoreService archiveRestoreService)
        {
            _logTraceRestoreService = logTraceRestoreService;
            _archiveRestoreService = archiveRestoreService;
        }

        [HttpPost]
        [Authorize]
        //[ProtectedEndPoint("blocks-os::lmt-restore::start-cold")]
        public async Task<StartColdRestoreResponse> StartColdRestoreProcess([FromBody] StartColdRestoreRequest request)
        {
            return await _logTraceRestoreService.StartRestoreAsync(request);
        }

        [HttpPost]
        [Authorize]
        //[ProtectedEndPoint("blocks-os::lmt-restore::start-archive")]
        public async Task<StartArchiveRestoreResponse> StartArchiveRestoreProcess([FromBody] StartArchiveRestoreRequest request)
        {
            return await _archiveRestoreService.StartArchiveRestoreAsync(request);
        }

        [HttpGet]
        [Authorize]
        //[ProtectedEndPoint("blocks-os::lmt-restore::status")]
        public async Task<GetColdRestoreStatusResponse> Status([FromQuery] GetColdRestoreStatusRequest request)
        {
            return await _logTraceRestoreService.GetStatusAsync(request);
        }

        /// <summary>
        /// Cancels an unfinished cold or archive restore and discards whatever it had restored so
        /// far, freeing the user to request a different range straight away.
        /// </summary>
        [HttpPost]
        [Authorize]
        //[ProtectedEndPoint("blocks-os::lmt-restore::cancel")]
        public async Task<CancelRestoreResponse> CancelRestoreProcess([FromBody] CancelRestoreRequest request)
        {
            return await _logTraceRestoreService.CancelRestoreAsync(request);
        }

        [HttpPost]
        [Authorize]
        //[ProtectedEndPoint("blocks-os::lmt-restore::get-traces")]
        public async Task<BaseQueryListResponse<IQueryable<SingleTraceProjection>>> GetRestoredTraces([FromBody] GetRestoredTracesRequest request)
        {
            return await _logTraceRestoreService.GetRestoredTracesAsync(request);
        }

        [HttpPost]
        [Authorize]
        //[ProtectedEndPoint("blocks-os::lmt-restore::get-logs")]
        public async Task<GetLogsResponse> GetRestoredLogs([FromBody] GetRestoredLogsRequest request)
        {
            return await _logTraceRestoreService.GetRestoredLogsAsync(request);
        }

        [HttpGet]
        [Authorize]
        //[ProtectedEndPoint("blocks-os::lmt-restore::get-trace")]
        public async Task<BaseQueryListResponse<IQueryable<SingleTraceProjection>>> GetRestoredTrace([FromQuery] GetRestoredTraceRequest request)
        {
            return await _logTraceRestoreService.GetRestoredTraceAsync(request);
        }

        [HttpPost]
        [Authorize]
        //[ProtectedEndPoint("blocks-os::lmt-restore::get-logs-by-trace")]
        public async Task<GetLogsResponse> GetRestoredLogsByTrace([FromBody] GetRestoredLogsByTraceRequest request)
        {
            return await _logTraceRestoreService.GetRestoredLogsByTraceAsync(request);
        }

        [HttpPost]
        [Authorize]
        //[ProtectedEndPoint("blocks-os::lmt-restore::download-parquet")]
        public async Task<IActionResult> DownloadParquet([FromBody] DownloadColdRestoreParquetRequest request)
        {
            var result = await _logTraceRestoreService.BuildParquetDownloadAsync(request);
            return File(result.Content, result.ContentType, result.FileName);
        }

        [HttpPost]
        [Authorize]
        //[ProtectedEndPoint("blocks-os::lmt-restore::download-json")]
        public async Task<IActionResult> DownloadJson([FromBody] DownloadColdRestoreJsonRequest request)
        {
            var result = await _logTraceRestoreService.BuildJsonDownloadAsync(request);
            return File(result.Content, result.ContentType, result.FileName);
        }

        [HttpGet]
        [Authorize]
        //[ProtectedEndPoint("blocks-os::lmt-restore::get-request-id")]
        public async Task<GetLatestColdRestoreRequestIdResponse> GetRequestId([FromQuery] GetLatestColdRestoreRequestIdRequest request)
        {
            return await _logTraceRestoreService.GetLatestRequestIdAsync(request);
        }

        [HttpGet]
        [Authorize]
        //[ProtectedEndPoint("blocks-os::lmt-restore::get-hot-data-retention")]
        public async Task<GetHotDataUploadToBlobInDays> GetHotDataBlobUploadInDays()
        {
            return await _logTraceRestoreService.GetHotDataRetentionPeriodInDays();
        }
    }
}
