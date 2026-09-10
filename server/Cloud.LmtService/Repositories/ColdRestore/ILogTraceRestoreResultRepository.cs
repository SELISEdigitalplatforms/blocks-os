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
        /// <summary>
        /// Drops both per-request result collections. Used when a restore is cancelled, so partial
        /// rows do not linger until their retention elapses.
        /// </summary>
        Task DropResultCollectionsAsync(string requestId, CancellationToken ct = default);

        Task<long> DeleteExpiredTraceResultsAsync(CancellationToken ct = default);
        Task<long> DeleteExpiredLogResultsAsync(CancellationToken ct = default);
        Task<IQueryable<SingleTraceProjection>> GetRestoredTraceAsync(GetRestoredTraceRequest request, CancellationToken ct = default);
        Task<(IQueryable<LogProjection>, long)> GetRestoredLogsByTraceAsync(GetRestoredLogsByTraceRequest request, CancellationToken ct = default);
        Task<List<RestoreTraceResultRecord>> GetTraceResultsForDownloadAsync(string requestId, string tenantId, CancellationToken ct = default);
        Task<List<RestoreLogResultRecord>> GetLogResultsForDownloadAsync(string requestId, string tenantId, CancellationToken ct = default);
    }
}
