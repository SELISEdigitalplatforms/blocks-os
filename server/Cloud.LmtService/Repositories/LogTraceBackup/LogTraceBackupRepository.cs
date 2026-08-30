using Blocks.Genesis;
using Cloud.LmtService.Models.LogTraceBackup;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace Cloud.LmtService.Repositories.LogTraceBackup
{
    public class LogTraceBackupRepository : ILogTraceBackupRepository
    {
        private readonly IMongoDatabase _rootDatabase;
        private readonly ILogger<LogTraceBackupRepository> _logger;

        private const string JobsCollection = "LogTraceBackupJobs";
        private const string LogProgressCollection = "LogBackupFileProgressTracker";
        private const string ServiceLogProgressCollection = "ServiceLogBackupFileProgressTracker";
        private const string LogBlobUploadCollection = "LogBlobUploadProgressTracker";
        private const string TraceProgressCollection = "TraceBackupFileProgressTracker";

        public LogTraceBackupRepository(
            IBlocksSecret blocksSecret,
            IDbContextProvider dbContextProvider,
            ILogger<LogTraceBackupRepository> logger)
        {
            _rootDatabase = dbContextProvider.GetDatabase(
                blocksSecret.TraceConnectionString,
               "LogTraceBackupTrack");
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        // ── Job lifecycle ────────────────────────────────────────────────────────

        public async Task<string> CreateJobAsync(DateTime dataDateFrom, DateTime dataDateTo)
        {
            try
            {
                var runId = Guid.NewGuid().ToString();
                var job = new LogTraceBackupJob
                {
                    RunId = runId,
                    Status = LogTraceBackupJobStatus.Running,
                    CurrentPhase = BackupPhase.Archiving,
                    StartTime = DateTime.UtcNow,
                    LastHeartbeatAt = DateTime.UtcNow,
                    DataDateFrom = dataDateFrom,
                    DataDateTo = dataDateTo
                };

                await _rootDatabase.GetCollection<LogTraceBackupJob>(JobsCollection)
                    .InsertOneAsync(job);

                return runId;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create backup job document");
                throw;
            }
        }

        public async Task UpdateJobPhaseAsync(string runId, string phase)
        {
            await TryUpdateJobAsync(runId,
                Builders<LogTraceBackupJob>.Update
                    .Set(x => x.CurrentPhase, phase)
                    .Set(x => x.LastHeartbeatAt, DateTime.UtcNow),
                nameof(UpdateJobPhaseAsync));
        }

        public async Task UpdateJobHeartbeatAsync(string runId)
        {
            await TryUpdateJobAsync(runId,
                Builders<LogTraceBackupJob>.Update.Set(x => x.LastHeartbeatAt, DateTime.UtcNow),
                nameof(UpdateJobHeartbeatAsync));
        }

        public async Task CompleteJobAsync(string runId)
        {
            try
            {
                // Determine final status: CompletedWithErrors if any failures, else Completed
                var job = await _rootDatabase.GetCollection<LogTraceBackupJob>(JobsCollection)
                    .Find(Builders<LogTraceBackupJob>.Filter.Eq(x => x.RunId, runId))
                    .FirstOrDefaultAsync();

                var finalStatus = job != null && job.TotalFailed > 0
                    ? LogTraceBackupJobStatus.CompletedWithErrors
                    : LogTraceBackupJobStatus.Completed;

                await TryUpdateJobAsync(runId,
                    Builders<LogTraceBackupJob>.Update
                        .Set(x => x.Status, finalStatus)
                        .Set(x => x.CurrentPhase, BackupPhase.Finalizing)
                        .Set(x => x.EndTime, DateTime.UtcNow)
                        .Set(x => x.LastHeartbeatAt, DateTime.UtcNow),
                    nameof(CompleteJobAsync));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to complete job {RunId}", runId);
            }
        }

        public async Task FailJobAsync(string runId, string errorReason)
        {
            await TryUpdateJobAsync(runId,
                Builders<LogTraceBackupJob>.Update
                    .Set(x => x.Status, LogTraceBackupJobStatus.Failed)
                    .Set(x => x.EndTime, DateTime.UtcNow)
                    .Set(x => x.ErrorReason, errorReason)
                    .Set(x => x.LastHeartbeatAt, DateTime.UtcNow),
                nameof(FailJobAsync));
        }

        public async Task MarkJobAbandonedAsync(string runId)
        {
            await TryUpdateJobAsync(runId,
                Builders<LogTraceBackupJob>.Update
                    .Set(x => x.Status, LogTraceBackupJobStatus.Abandoned)
                    .Set(x => x.EndTime, DateTime.UtcNow),
                nameof(MarkJobAbandonedAsync));
        }

        public async Task<bool> HasActiveRunAsync()
        {
            try
            {
                var filter = Builders<LogTraceBackupJob>.Filter
                    .Eq(x => x.Status, LogTraceBackupJobStatus.Running);

                return await _rootDatabase.GetCollection<LogTraceBackupJob>(JobsCollection)
                    .Find(filter)
                    .AnyAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to check for active backup run");
                return false;
            }
        }

        public async Task<List<string>> GetStaleRunningJobIdsAsync(TimeSpan staleThreshold)
        {
            try
            {
                var cutoff = DateTime.UtcNow - staleThreshold;
                var filter = Builders<LogTraceBackupJob>.Filter.And(
                    Builders<LogTraceBackupJob>.Filter.Eq(x => x.Status, LogTraceBackupJobStatus.Running),
                    Builders<LogTraceBackupJob>.Filter.Lt(x => x.LastHeartbeatAt, cutoff));

                var jobs = await _rootDatabase.GetCollection<LogTraceBackupJob>(JobsCollection)
                    .Find(filter)
                    .Project(x => x.RunId)
                    .ToListAsync();

                return jobs;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get stale running job IDs");
                return [];
            }
        }

        // ── Blocks service log archiving — Phase 1 ───────────────────────────────

        public async Task CreateLogFileProgressAsync(string runId, string tenantId, string serviceName, string? traceId = null)
        {
            try
            {
                var doc = new LogBackupFileProgress
                {
                    RunId = runId,
                    TenantId = tenantId,
                    ServiceName = serviceName,
                    TraceId = traceId,
                    Status = BackupFileStatus.Archiving,
                    ArchivingStartedAt = DateTime.UtcNow
                };

                await _rootDatabase.GetCollection<LogBackupFileProgress>(LogProgressCollection)
                    .InsertOneAsync(doc);

                await IncrementJobCounterAsync(runId, "LogArchivingStats", "TotalDiscovered", 1);
                await IncrementJobCounterAsync(runId, "LogArchivingStats", "ArchivingCount", 1);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create log file progress for tenant {TenantId}, service {ServiceName}", tenantId, serviceName);
            }
        }

        public async Task MarkLogArchivedAsync(string runId, string tenantId, string serviceName, int recordCount)
        {
            try
            {
                var filter = LogProgressFilter(runId, tenantId, serviceName);
                var update = Builders<LogBackupFileProgress>.Update
                    .Set(x => x.Status, BackupFileStatus.Archived)
                    .Set(x => x.ArchivingEndedAt, DateTime.UtcNow)
                    .Set(x => x.RecordCount, recordCount);

                await _rootDatabase.GetCollection<LogBackupFileProgress>(LogProgressCollection)
                    .UpdateOneAsync(filter, update);

                await IncrementJobCounterAsync(runId, "LogArchivingStats", "ArchivingCount", -1);
                await IncrementJobCounterAsync(runId, "LogArchivingStats", "ArchiveSuccessCount", 1);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to mark log archived for tenant {TenantId}, service {ServiceName}", tenantId, serviceName);
            }
        }

        public async Task MarkLogArchiveFailedAsync(string runId, string tenantId, string serviceName, string error)
        {
            try
            {
                var filter = LogProgressFilter(runId, tenantId, serviceName);
                var update = Builders<LogBackupFileProgress>.Update
                    .Set(x => x.Status, BackupFileStatus.ArchiveFailed)
                    .Set(x => x.FailedAt, DateTime.UtcNow)
                    .Set(x => x.FailureDetail, new LogTraceBackupFailedItem
                    {
                        TenantId = tenantId,
                        ServiceName = serviceName,
                        Type = "Log",
                        Phase = "Archiving",
                        BlobPath = null,
                        Error = error
                    });

                await _rootDatabase.GetCollection<LogBackupFileProgress>(LogProgressCollection)
                    .UpdateOneAsync(filter, update);

                await IncrementJobCounterAsync(runId, "LogArchivingStats", "ArchivingCount", -1);
                await IncrementJobCounterAsync(runId, "LogArchivingStats", "ArchiveFailedCount", 1);
                await IncrementJobCounterAsync(runId, null, "TotalFailed", 1);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to mark log archive failure for tenant {TenantId}, service {ServiceName}", tenantId, serviceName);
            }
        }

        // ── Managed service log archiving — Phase 1 ──────────────────────────────

        public async Task CreateServiceLogFileProgressAsync(string runId, string serviceName, string? traceId = null)
        {
            try
            {
                var doc = new ServiceLogBackupFileProgress
                {
                    RunId = runId,
                    ServiceName = serviceName,
                    TenantId = null,
                    TraceId = traceId,
                    Status = BackupFileStatus.Archiving,
                    ArchivingStartedAt = DateTime.UtcNow
                };

                await _rootDatabase.GetCollection<ServiceLogBackupFileProgress>(ServiceLogProgressCollection)
                    .InsertOneAsync(doc);

                await IncrementJobCounterAsync(runId, "ServiceLogArchivingStats", "TotalDiscovered", 1);
                await IncrementJobCounterAsync(runId, "ServiceLogArchivingStats", "ArchivingCount", 1);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create service log file progress for service {ServiceName}", serviceName);
            }
        }

        public async Task UpdateServiceLogTenantResolvedAsync(string runId, string serviceName, string tenantId)
        {
            try
            {
                var filter = ServiceLogProgressFilter(runId, serviceName);
                var update = Builders<ServiceLogBackupFileProgress>.Update
                    .Set(x => x.TenantId, tenantId);

                await _rootDatabase.GetCollection<ServiceLogBackupFileProgress>(ServiceLogProgressCollection)
                    .UpdateOneAsync(filter, update);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to update TenantId for managed service {ServiceName}", serviceName);
            }
        }

        public async Task MarkServiceLogArchivedAsync(string runId, string serviceName, int recordCount)
        {
            try
            {
                var filter = ServiceLogProgressFilter(runId, serviceName);
                var update = Builders<ServiceLogBackupFileProgress>.Update
                    .Set(x => x.Status, BackupFileStatus.Archived)
                    .Set(x => x.ArchivingEndedAt, DateTime.UtcNow)
                    .Set(x => x.RecordCount, recordCount);

                await _rootDatabase.GetCollection<ServiceLogBackupFileProgress>(ServiceLogProgressCollection)
                    .UpdateOneAsync(filter, update);

                await IncrementJobCounterAsync(runId, "ServiceLogArchivingStats", "ArchivingCount", -1);
                await IncrementJobCounterAsync(runId, "ServiceLogArchivingStats", "ArchiveSuccessCount", 1);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to mark service log archived for service {ServiceName}", serviceName);
            }
        }

        public async Task MarkServiceLogArchiveFailedAsync(string runId, string serviceName, string? tenantId, string error)
        {
            try
            {
                var filter = ServiceLogProgressFilter(runId, serviceName);
                var update = Builders<ServiceLogBackupFileProgress>.Update
                    .Set(x => x.Status, BackupFileStatus.ArchiveFailed)
                    .Set(x => x.FailedAt, DateTime.UtcNow)
                    .Set(x => x.FailureDetail, new LogTraceBackupFailedItem
                    {
                        TenantId = tenantId,
                        ServiceName = serviceName,
                        Type = "ServiceLog",
                        Phase = "Archiving",
                        BlobPath = null,
                        Error = error
                    });

                await _rootDatabase.GetCollection<ServiceLogBackupFileProgress>(ServiceLogProgressCollection)
                    .UpdateOneAsync(filter, update);

                await IncrementJobCounterAsync(runId, "ServiceLogArchivingStats", "ArchivingCount", -1);
                await IncrementJobCounterAsync(runId, "ServiceLogArchivingStats", "ArchiveFailedCount", 1);
                await IncrementJobCounterAsync(runId, null, "TotalFailed", 1);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to mark service log archive failure for service {ServiceName}", serviceName);
            }
        }

        // ── Log blob upload — Phase 2 ─────────────────────────────────────────────

        public async Task CreateLogBlobUploadProgressAsync(string runId, string tenantId, string collectionName, string blobPath, bool isCarryover)
        {
            try
            {
                var doc = new LogBlobUploadProgress
                {
                    RunId = runId,
                    TenantId = tenantId,
                    ArchiveCollectionName = collectionName,
                    BlobPath = blobPath,
                    Status = BackupFileStatus.Uploading,
                    IsCarryover = isCarryover,
                    UploadingStartedAt = DateTime.UtcNow
                };

                await _rootDatabase.GetCollection<LogBlobUploadProgress>(LogBlobUploadCollection)
                    .InsertOneAsync(doc);

                await IncrementJobCounterAsync(runId, "LogBlobUploadStats", "TotalDiscovered", 1);
                await IncrementJobCounterAsync(runId, "LogBlobUploadStats", "UploadingCount", 1);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create log blob upload progress for tenant {TenantId}", tenantId);
            }
        }

        public async Task MarkLogBlobCompletedAsync(string runId, string tenantId, int recordCount)
        {
            try
            {
                var filter = LogBlobUploadFilter(runId, tenantId);
                var update = Builders<LogBlobUploadProgress>.Update
                    .Set(x => x.Status, BackupFileStatus.Completed)
                    .Set(x => x.CompletedAt, DateTime.UtcNow)
                    .Set(x => x.RecordCount, recordCount);

                await _rootDatabase.GetCollection<LogBlobUploadProgress>(LogBlobUploadCollection)
                    .UpdateOneAsync(filter, update);

                await IncrementJobCounterAsync(runId, "LogBlobUploadStats", "UploadingCount", -1);
                await IncrementJobCounterAsync(runId, "LogBlobUploadStats", "UploadSuccessCount", 1);
                await IncrementJobCounterAsync(runId, null, "TotalSuccessful", 1);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to mark log blob completed for tenant {TenantId}", tenantId);
            }
        }

        public async Task MarkLogBlobFailedAsync(string runId, string tenantId, string blobPath, string error)
        {
            try
            {
                var filter = LogBlobUploadFilter(runId, tenantId);
                var update = Builders<LogBlobUploadProgress>.Update
                    .Set(x => x.Status, BackupFileStatus.UploadFailed)
                    .Set(x => x.FailedAt, DateTime.UtcNow)
                    .Set(x => x.FailureDetail, new LogTraceBackupFailedItem
                    {
                        TenantId = tenantId,
                        Type = "Log",
                        Phase = "BlobUpload",
                        BlobPath = blobPath,
                        Error = error
                    });

                await _rootDatabase.GetCollection<LogBlobUploadProgress>(LogBlobUploadCollection)
                    .UpdateOneAsync(filter, update);

                await IncrementJobCounterAsync(runId, "LogBlobUploadStats", "UploadingCount", -1);
                await IncrementJobCounterAsync(runId, "LogBlobUploadStats", "UploadFailedCount", 1);
                await IncrementJobCounterAsync(runId, null, "TotalFailed", 1);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to mark log blob failure for tenant {TenantId}", tenantId);
            }
        }

        // ── Trace archiving + blob upload — Phase 1 + 2 ─────────────────────────

        public async Task CreateTraceFileProgressAsync(string runId, string tenantId)
        {
            try
            {
                var doc = new TraceBackupFileProgress
                {
                    RunId = runId,
                    TenantId = tenantId,
                    Status = BackupFileStatus.Archiving,
                    ArchivingStartedAt = DateTime.UtcNow
                };

                await _rootDatabase.GetCollection<TraceBackupFileProgress>(TraceProgressCollection)
                    .InsertOneAsync(doc);

                await IncrementJobCounterAsync(runId, "TraceStats", "TotalDiscovered", 1);
                await IncrementJobCounterAsync(runId, "TraceStats", "ArchivingCount", 1);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create trace file progress for tenant {TenantId}", tenantId);
            }
        }

        public async Task MarkTraceArchivedAsync(string runId, string tenantId, int recordCount)
        {
            try
            {
                var filter = TraceProgressFilter(runId, tenantId);
                var update = Builders<TraceBackupFileProgress>.Update
                    .Set(x => x.Status, BackupFileStatus.Archived)
                    .Set(x => x.ArchivingEndedAt, DateTime.UtcNow)
                    .Set(x => x.RecordCount, recordCount);

                await _rootDatabase.GetCollection<TraceBackupFileProgress>(TraceProgressCollection)
                    .UpdateOneAsync(filter, update);

                await IncrementJobCounterAsync(runId, "TraceStats", "ArchivingCount", -1);
                await IncrementJobCounterAsync(runId, "TraceStats", "ArchiveSuccessCount", 1);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to mark trace archived for tenant {TenantId}", tenantId);
            }
        }

        public async Task MarkTraceArchiveFailedAsync(string runId, string tenantId, string error)
        {
            try
            {
                var filter = TraceProgressFilter(runId, tenantId);
                var update = Builders<TraceBackupFileProgress>.Update
                    .Set(x => x.Status, BackupFileStatus.ArchiveFailed)
                    .Set(x => x.FailedAt, DateTime.UtcNow)
                    .Set(x => x.FailureDetail, new LogTraceBackupFailedItem
                    {
                        TenantId = tenantId,
                        Type = "Trace",
                        Phase = "Archiving",
                        BlobPath = null,
                        Error = error
                    });

                await _rootDatabase.GetCollection<TraceBackupFileProgress>(TraceProgressCollection)
                    .UpdateOneAsync(filter, update);

                await IncrementJobCounterAsync(runId, "TraceStats", "ArchivingCount", -1);
                await IncrementJobCounterAsync(runId, "TraceStats", "ArchiveFailedCount", 1);
                await IncrementJobCounterAsync(runId, null, "TotalFailed", 1);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to mark trace archive failure for tenant {TenantId}", tenantId);
            }
        }

        public async Task MarkTraceUploadingAsync(string runId, string tenantId, string collectionName, string blobPath, bool isCarryover)
        {
            try
            {
                var filter = TraceProgressFilter(runId, tenantId);
                var update = Builders<TraceBackupFileProgress>.Update
                    .Set(x => x.Status, BackupFileStatus.Uploading)
                    .Set(x => x.ArchiveCollectionName, collectionName)
                    .Set(x => x.BlobPath, blobPath)
                    .Set(x => x.IsCarryover, isCarryover)
                    .Set(x => x.UploadingStartedAt, DateTime.UtcNow);

                // Upsert: handles carryover items that have no Phase 1 doc
                var options = new UpdateOptions { IsUpsert = true };

                await _rootDatabase.GetCollection<TraceBackupFileProgress>(TraceProgressCollection)
                    .UpdateOneAsync(filter, update, options);

                await IncrementJobCounterAsync(runId, "TraceStats", "UploadingCount", 1);

                if (isCarryover)
                    await IncrementJobCounterAsync(runId, "TraceStats", "TotalDiscovered", 1);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to mark trace uploading for tenant {TenantId}", tenantId);
            }
        }

        public async Task MarkTraceCompletedAsync(string runId, string tenantId)
        {
            try
            {
                var filter = TraceProgressFilter(runId, tenantId);
                var update = Builders<TraceBackupFileProgress>.Update
                    .Set(x => x.Status, BackupFileStatus.Completed)
                    .Set(x => x.CompletedAt, DateTime.UtcNow);

                await _rootDatabase.GetCollection<TraceBackupFileProgress>(TraceProgressCollection)
                    .UpdateOneAsync(filter, update);

                await IncrementJobCounterAsync(runId, "TraceStats", "UploadingCount", -1);
                await IncrementJobCounterAsync(runId, "TraceStats", "UploadSuccessCount", 1);
                await IncrementJobCounterAsync(runId, null, "TotalSuccessful", 1);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to mark trace completed for tenant {TenantId}", tenantId);
            }
        }

        public async Task MarkTraceUploadFailedAsync(string runId, string tenantId, string blobPath, string error)
        {
            try
            {
                var filter = TraceProgressFilter(runId, tenantId);
                var update = Builders<TraceBackupFileProgress>.Update
                    .Set(x => x.Status, BackupFileStatus.UploadFailed)
                    .Set(x => x.FailedAt, DateTime.UtcNow)
                    .Set(x => x.FailureDetail, new LogTraceBackupFailedItem
                    {
                        TenantId = tenantId,
                        Type = "Trace",
                        Phase = "BlobUpload",
                        BlobPath = blobPath,
                        Error = error
                    });

                await _rootDatabase.GetCollection<TraceBackupFileProgress>(TraceProgressCollection)
                    .UpdateOneAsync(filter, update);

                await IncrementJobCounterAsync(runId, "TraceStats", "UploadingCount", -1);
                await IncrementJobCounterAsync(runId, "TraceStats", "UploadFailedCount", 1);
                await IncrementJobCounterAsync(runId, null, "TotalFailed", 1);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to mark trace upload failure for tenant {TenantId}", tenantId);
            }
        }

        public async Task<bool> TraceProgressExistsAsync(string runId, string tenantId)
        {
            try
            {
                return await _rootDatabase.GetCollection<TraceBackupFileProgress>(TraceProgressCollection)
                    .Find(TraceProgressFilter(runId, tenantId))
                    .AnyAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to check trace progress existence for tenant {TenantId}", tenantId);
                return false;
            }
        }

        public async Task<bool> LogProgressExistsForTenantAsync(string runId, string tenantId)
        {
            try
            {
                var filter = Builders<LogBackupFileProgress>.Filter.And(
                    Builders<LogBackupFileProgress>.Filter.Eq(x => x.RunId, runId),
                    Builders<LogBackupFileProgress>.Filter.Eq(x => x.TenantId, tenantId));

                return await _rootDatabase.GetCollection<LogBackupFileProgress>(LogProgressCollection)
                    .Find(filter)
                    .AnyAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to check log progress existence for tenant {TenantId}", tenantId);
                return false;
            }
        }

        // ── Private helpers ──────────────────────────────────────────────────────

        private async Task TryUpdateJobAsync(string runId, UpdateDefinition<LogTraceBackupJob> update, string callerName)
        {
            try
            {
                var filter = Builders<LogTraceBackupJob>.Filter.Eq(x => x.RunId, runId);
                await _rootDatabase.GetCollection<LogTraceBackupJob>(JobsCollection)
                    .UpdateOneAsync(filter, update);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "{CallerName} failed to update job {RunId}", callerName, runId);
            }
        }

        /// <summary>
        /// Atomically increments a counter field on the job document.
        /// statsField is the nested stats object name (e.g. "TraceStats"), null for top-level fields.
        /// </summary>
        private async Task IncrementJobCounterAsync(string runId, string? statsField, string counterField, int amount)
        {
            try
            {
                var dotPath = statsField != null ? $"{statsField}.{counterField}" : counterField;
                var filter = Builders<LogTraceBackupJob>.Filter.Eq(x => x.RunId, runId);
                var update = Builders<LogTraceBackupJob>.Update.Inc(dotPath, amount);

                await _rootDatabase.GetCollection<LogTraceBackupJob>(JobsCollection)
                    .UpdateOneAsync(filter, update);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to increment {Field} on job {RunId}", counterField, runId);
            }
        }

        private static FilterDefinition<LogBackupFileProgress> LogProgressFilter(
            string runId, string tenantId, string serviceName) =>
            Builders<LogBackupFileProgress>.Filter.And(
                Builders<LogBackupFileProgress>.Filter.Eq(x => x.RunId, runId),
                Builders<LogBackupFileProgress>.Filter.Eq(x => x.TenantId, tenantId),
                Builders<LogBackupFileProgress>.Filter.Eq(x => x.ServiceName, serviceName));

        private static FilterDefinition<ServiceLogBackupFileProgress> ServiceLogProgressFilter(
            string runId, string serviceName) =>
            Builders<ServiceLogBackupFileProgress>.Filter.And(
                Builders<ServiceLogBackupFileProgress>.Filter.Eq(x => x.RunId, runId),
                Builders<ServiceLogBackupFileProgress>.Filter.Eq(x => x.ServiceName, serviceName));

        private static FilterDefinition<LogBlobUploadProgress> LogBlobUploadFilter(
            string runId, string tenantId) =>
            Builders<LogBlobUploadProgress>.Filter.And(
                Builders<LogBlobUploadProgress>.Filter.Eq(x => x.RunId, runId),
                Builders<LogBlobUploadProgress>.Filter.Eq(x => x.TenantId, tenantId));

        private static FilterDefinition<TraceBackupFileProgress> TraceProgressFilter(
            string runId, string tenantId) =>
            Builders<TraceBackupFileProgress>.Filter.And(
                Builders<TraceBackupFileProgress>.Filter.Eq(x => x.RunId, runId),
                Builders<TraceBackupFileProgress>.Filter.Eq(x => x.TenantId, tenantId));
    }
}
