using Cloud.LmtService.Models.ArchiveAndDelete;
using Cloud.LmtService.Models.Logs;
using System;
using System.Collections.Generic;
using System.Text;

namespace Cloud.LmtService.Repositories.Logs
{
    public interface ILogRepository
    {
        Task<IQueryable<LogProjection>> GetLogs(LiveLogRequest query);
        Task<(IQueryable<LogProjection>, long)> GetLogs(GetLogsRequest query);
        Task<(IQueryable<LogProjection>, long)> GetLogs(LogsByDateRequest request);
        Task<List<string>> GetDistinctBlocksServiceNamesAsync(DateTime startDate, DateTime endDate);
        Task<List<string>> GetDistinctManagedServiceNamesAsync(DateTime startDate, DateTime endDate);
        Task<Dictionary<string, List<StoredLog>>> GetLogsByServiceAndTenantBatchAsync(string serviceName, List<string> tenantIds, TenantLogsRequest query);
        Task<Dictionary<string, List<StoredLog>>> GetLogsByServiceGroupedByTenantAsync(string serviceName, TenantLogsRequest query, int pageNumber, int pageSize);
        Task<(List<StoredLog> Logs, string? TenantId)> GetLogsByServiceAsync(string serviceName, TenantLogsRequest query);
        Task<long> DeleteLogsByServiceAndTenantAsync(string serviceName, TenantLogsRequest query, CancellationToken ct = default);
        Task ArchiveLogsAsync(List<StoredLog> logs, TenantLogsRequest query);
        Task<List<string>> GetArchiveCollectionsAsync();
        Task<List<StoredLog>> GetLogsFromArchiveCollectionAsync(string collectionName);
        Task DeleteArchiveCollectionAsync(string collectionName);
        Task DeleteMiscellaneousLogsCollectionAsync(string collectionName);
        Task SaveFailedArchiveLogsAsync(string serviceName, List<StoredLog> logs, string failureReason, DateTime processStartDate, DateTime processEndDate);
    }
}
