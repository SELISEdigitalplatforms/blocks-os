using Blocks.Genesis;
using Cloud.LmtService.Models.ArchiveAndDelete;
using Cloud.LmtService.Models.ColdRestore;
using Cloud.LmtService.Models.Logs;
using Cloud.LmtService.Models.Trace;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Cloud.LmtService.Services.ColdRestore
{
    public interface ILogTraceRestoreService
    {
        Task<StartColdRestoreResponse> StartRestoreAsync(StartColdRestoreRequest request);
        Task<GetColdRestoreStatusResponse> GetStatusAsync(GetColdRestoreStatusRequest request);

        /// <summary>
        /// Cancels a cold or archive restore that has not finished. Serves both tiers: they share
        /// the request collection, and cancellation is the same operation for either.
        /// </summary>
        Task<CancelRestoreResponse> CancelRestoreAsync(CancelRestoreRequest request, CancellationToken ct = default);
        Task ProcessRestoreAsync(ColdRestoreMessage message, CancellationToken ct = default);
        Task<BaseQueryListResponse<IQueryable<SingleTraceProjection>>> GetRestoredTracesAsync(GetRestoredTracesRequest request);

        Task<GetLogsResponse> GetRestoredLogsAsync(GetRestoredLogsRequest request);
        Task DeleteAllExpiredColdRestoreDataAsync();
        Task<BaseQueryListResponse<IQueryable<SingleTraceProjection>>> GetRestoredTraceAsync(GetRestoredTraceRequest request);
        Task<GetLogsResponse> GetRestoredLogsByTraceAsync(GetRestoredLogsByTraceRequest request);
        Task<ColdRestoreDownloadResult> BuildParquetDownloadAsync(DownloadColdRestoreParquetRequest request, CancellationToken ct = default);
        Task<ColdRestoreDownloadResult> BuildJsonDownloadAsync(DownloadColdRestoreJsonRequest request, CancellationToken ct = default);
        Task<GetLatestColdRestoreRequestIdResponse> GetLatestRequestIdAsync(GetLatestColdRestoreRequestIdRequest request, CancellationToken ct = default);
        Task<int> RestoreTraceFileAsync(LogTraceRestoreFileProgressRecord file, CancellationToken ct = default);
        Task<int> RestoreLogFileAsync(LogTraceRestoreFileProgressRecord file, CancellationToken ct = default);
        Task ExecutePendingFilesAsync(string requestId, CancellationToken ct = default);
        Task UpdateFileRequestStatus(string requestId, CancellationToken ct = default);
        Task<bool> CheckRequestStatus(string requestId, CancellationToken ct = default);
        Task<GetHotDataUploadToBlobInDays> GetHotDataRetentionPeriodInDays(CancellationToken ct = default);
    }
}
