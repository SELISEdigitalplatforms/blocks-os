namespace Cloud.LmtService.Repositories.LogTraceBackup
{
    public interface ILogTraceBackupRepository
    {
        // ── Job lifecycle ────────────────────────────────────────────────────────

        /// <summary>Creates a new job document and returns its RunId.</summary>
        Task<string> CreateJobAsync(DateTime dataDateFrom, DateTime dataDateTo);

        Task UpdateJobPhaseAsync(string runId, string phase);
        Task UpdateJobHeartbeatAsync(string runId);
        Task CompleteJobAsync(string runId);
        Task FailJobAsync(string runId, string errorReason);
        Task MarkJobAbandonedAsync(string runId);

        /// <summary>Returns true when a job with Status=Running already exists.</summary>
        Task<bool> HasActiveRunAsync();

        /// <summary>Returns RunIds of jobs stuck as Running with LastHeartbeatAt older than the threshold.</summary>
        Task<List<string>> GetStaleRunningJobIdsAsync(TimeSpan staleThreshold);

        // ── Blocks service log archiving — Phase 1 ───────────────────────────────

        Task CreateLogFileProgressAsync(string runId, string tenantId, string serviceName, string? traceId = null);
        Task MarkLogArchivedAsync(string runId, string tenantId, string serviceName, int recordCount);
        Task MarkLogArchiveFailedAsync(string runId, string tenantId, string serviceName, string error);

        // ── Managed service log archiving — Phase 1 ──────────────────────────────

        Task CreateServiceLogFileProgressAsync(string runId, string serviceName, string? traceId = null);

        /// <summary>Called once the managed-service TenantId is resolved from the first document in the collection.</summary>
        Task UpdateServiceLogTenantResolvedAsync(string runId, string serviceName, string tenantId);

        Task MarkServiceLogArchivedAsync(string runId, string serviceName, int recordCount);
        Task MarkServiceLogArchiveFailedAsync(string runId, string serviceName, string? tenantId, string error);

        // ── Log blob upload — Phase 2 (per tenant, blocks+managed merged) ────────

        Task CreateLogBlobUploadProgressAsync(string runId, string tenantId, string collectionName, string blobPath, bool isCarryover);
        Task MarkLogBlobCompletedAsync(string runId, string tenantId, int recordCount);
        Task MarkLogBlobFailedAsync(string runId, string tenantId, string blobPath, string error);

        // ── Trace archiving + blob upload — Phase 1 + 2 (same document) ─────────

        Task CreateTraceFileProgressAsync(string runId, string tenantId);
        Task MarkTraceArchivedAsync(string runId, string tenantId, int recordCount);
        Task MarkTraceArchiveFailedAsync(string runId, string tenantId, string error);
        Task MarkTraceUploadingAsync(string runId, string tenantId, string collectionName, string blobPath, bool isCarryover);
        Task MarkTraceCompletedAsync(string runId, string tenantId);
        Task MarkTraceUploadFailedAsync(string runId, string tenantId, string blobPath, string error);

        /// <summary>Used to determine IsCarryover: returns true if a Phase 1 trace document exists for this run+tenant.</summary>
        Task<bool> TraceProgressExistsAsync(string runId, string tenantId);

        /// <summary>Used to determine IsCarryover for log blob upload: returns true if any log progress doc exists for this run+tenant.</summary>
        Task<bool> LogProgressExistsForTenantAsync(string runId, string tenantId);
    }
}
