using Cloud.LmtService.Models.ColdRestore;
using Cloud.LmtService.Models.Logs;
using Cloud.LmtService.Models.Trace;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Cloud.LmtService.Repositories.ColdRestore
{
    public interface ILogTraceRestoreResultRepository
    {
        Task InsertTraceResultsAsync(List<RestoreTraceResultRecord> rows, CancellationToken ct = default);
        Task InsertLogResultsAsync(List<RestoreLogResultRecord> rows, CancellationToken ct = default);
        Task<(IQueryable<SingleTraceProjection>, long)> GetRestoredTracesAsync(GetRestoredTracesRequest request, CancellationToken ct = default);
        Task<(IQueryable<LogProjection>, long)> GetRestoredLogsAsync(GetRestoredLogsRequest request, CancellationToken ct = default);
        Task DeleteTraceResultsByRequestAndDateAsync(string requestId, DateTime sourceDate, CancellationToken ct = default);
        Task DeleteLogResultsByRequestAndDateAsync(string requestId, DateTime sourceDate, CancellationToken ct = default);
        Task<List<RestoreTraceResultRecord>> GetTraceResultsByBlobPathAsync(string requestId, string tenantId, string blobPath, CancellationToken ct = default);
        Task CloneTraceResultsForRequestAsync(string newRequestId, string tenantId, DateTime sourceDate, string blobPath, List<RestoreTraceResultRecord> existingRows, CancellationToken ct = default);
        Task<List<RestoreLogResultRecord>> GetLogResultsByBlobPathAsync(string requestId, string tenantId, string blobPath, CancellationToken ct = default);
        Task CloneLogResultsForRequestAsync(string newRequestId, string tenantId, DateTime sourceDate, string blobPath, List<RestoreLogResultRecord> existingRows, CancellationToken ct = default);
        Task<long> DeleteExpiredTraceResultsAsync(CancellationToken ct = default);
        Task<long> DeleteExpiredLogResultsAsync(CancellationToken ct = default);
        Task<IQueryable<SingleTraceProjection>> GetRestoredTraceAsync(GetRestoredTraceRequest request, CancellationToken ct = default);
        Task<(IQueryable<LogProjection>, long)> GetRestoredLogsByTraceAsync(GetRestoredLogsByTraceRequest request, CancellationToken ct = default);
        Task<List<RestoreTraceResultRecord>> GetTraceResultsForDownloadAsync(string requestId, string tenantId, CancellationToken ct = default);
        Task<List<RestoreLogResultRecord>> GetLogResultsForDownloadAsync(string requestId, string tenantId, CancellationToken ct = default);
    }
}
