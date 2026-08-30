using Cloud.LmtService.Models.ArchiveAndDelete;
using Cloud.LmtService.Models.Trace;
using System;
using System.Collections.Generic;
using System.Text;

namespace Cloud.LmtService.Repositories.Trace
{
    public interface ITraceRepository
    {
        Task<IQueryable<SingleTraceProjection>> GetTraces(GetTraceRequest query);
        Task<(IQueryable<TraceProjection>, long)> GetTraces(GetTracesRequest query);
        Task<object> GetOperationalAnalytics(DateTime startTime, DateTime endTime, string serviceName, string? operationSearch = null);
        Task<object> GetServiceAnalytics(DateTime startTime, DateTime endTime, string? serviceName = null);

        // Backup methods
        Task<List<string>> GetDistinctTracesCollectionNamesAsync(DateTime startDate, DateTime endDate);
        Task<List<StoredTrace>> GetTracesByCollectionAsync(string collectionName, TenantLogsRequest query, int pageNumber, int pageSize);
        Task<long> DeleteTracesByCollectionAsync(TenantLogsRequest query, CancellationToken ct = default);
        Task ArchiveTracesAsync(List<StoredTrace> traces, TenantLogsRequest query);

        // Archive DB methods
        Task<List<string>> GetArchiveCollectionsAsync();
        Task<List<StoredTrace>> GetTracesFromArchiveCollectionAsync(string collectionName);
        Task DeleteArchiveCollectionAsync(string collectionName);
        Task DeleteMiscellaneousTracesCollectionAsync(string collectionName);
    }
}
