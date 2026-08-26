using Blocks.Genesis;
using Cloud.LmtService.Models.ArchiveAndDelete;
using Cloud.LmtService.Models.LogTraceBackup;
using Cloud.LmtService.Repositories.ArchiveAndDelete;
using Cloud.LmtService.Repositories.LogTraceBackup;
using Cloud.LmtService.Repositories.Logs;
using Cloud.LmtService.Repositories.Trace;
using Cloud.LmtService.Utilities;
using Microsoft.Extensions.Logging;
using Cloud.LmtService.Repositories.Shared;
using Cloud.LmtService.Models.Shared;

namespace Cloud.LmtService.Services.ArchiveAndDelete
{
    public class ArchiveService : IArchiveService
    {
        private readonly ILogger<ArchiveService> _logger;
        private readonly ILogRepository _logRepository;
        private readonly ITraceRepository _traceRepository;
        private readonly IArchiveRepository _archiveRepository;
        private readonly ILogTraceBackupRepository _backupRepository;
        private readonly IBlobStorage _blobStorage;
        private readonly ILmtArchiveRestoreConfigurationRepository _lmtArchiveRestoreConfigurationRepository;

        public ArchiveService(
            ILogger<ArchiveService> logger,
            ILogRepository logRepository,
            ITraceRepository traceRepository,
            IArchiveRepository archiveRepository,
            ILogTraceBackupRepository backupRepository,
            IBlobStorage blobStorage,
            ILmtArchiveRestoreConfigurationRepository lmtArchiveRestoreConfigurationRepository)
        {
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _logRepository = logRepository;
            _traceRepository = traceRepository;
            _archiveRepository = archiveRepository;
            _backupRepository = backupRepository;
            _blobStorage = blobStorage;
            _lmtArchiveRestoreConfigurationRepository = lmtArchiveRestoreConfigurationRepository;
        }

        // ── Public entry points ──────────────────────────────────────────────────

        public async Task StartBackupAsync()
        {
            var (startDate, endDate) = await ComputeBackupDateRangeAsync();
            var runId = await _backupRepository.CreateJobAsync(startDate, endDate);

            _logger.LogInformation("StartBackupAsync - Backup job {RunId} started. Date range: {Start:yyyy-MM-dd} → {End:yyyy-MM-dd}",
                runId, startDate, endDate);

            try
            {
                await _backupRepository.UpdateJobPhaseAsync(runId, BackupPhase.Archiving);

                await Task.WhenAll(
                    ProcessAllTracesBackupAsync(runId, startDate, endDate),
                    ProcessAllBlocksServiceLogsBackupAsync(runId, startDate, endDate),
                    ProcessAllManagedServiceLogsBackupAsync(runId, startDate, endDate));
                await _backupRepository.UpdateJobPhaseAsync(runId, BackupPhase.BlobUploading);

                await Task.WhenAll(
                    ProcessArchiveLogsToBlobAsync(runId),
                    ProcessArchiveTracesToBlobAsync(runId));

                await _backupRepository.CompleteJobAsync(runId);

                _logger.LogInformation("StartBackupAsync - Backup job {RunId} completed.", runId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "StartBackupAsync - Unhandled error in backup job {RunId}", runId);
                await TrySilentAsync(() => _backupRepository.FailJobAsync(runId, ex.ToString()));
                throw;
            }
        }
        public async Task<LmtArchiveRestoreConfigurations> GetRestoreConfigurationsAsync()
        {
            return await _lmtArchiveRestoreConfigurationRepository.GetLmtArchiveRestoreConfigurationsAsync();
        }

        public async Task DeleteMiscellaneousLog()
        {
            await Task.WhenAll(
                _traceRepository.DeleteMiscellaneousTracesCollectionAsync(Constants.MiscellaneousCollectionName),
                _logRepository.DeleteMiscellaneousLogsCollectionAsync(Constants.MiscellaneousCollectionName));
        }
        private async Task ProcessAllTracesBackupAsync(string runId, DateTime startDate, DateTime endDate)
        {
            var tenantIds = await _traceRepository.GetDistinctTracesCollectionNamesAsync(startDate, endDate);
            if (tenantIds.Count == 0)
            {
                _logger.LogInformation("ProcessAllTracesBackupAsync - No trace collections found for date range.");
                return;
            }

            _logger.LogInformation("ProcessAllTracesBackupAsync - Processing {Count} tenant(s).", tenantIds.Count);

            using var semaphore = new SemaphoreSlim(Constants.MongoQueryMaxConcurrency);
            var tasks = tenantIds.Select(tenantId => ProcessSingleTenantTracesAsync(runId, tenantId, startDate, endDate, semaphore));
            await Task.WhenAll(tasks);
        }

        private async Task ProcessSingleTenantTracesAsync(
            string runId, string tenantId, DateTime startDate, DateTime endDate, SemaphoreSlim semaphore)
        {
            if (string.IsNullOrWhiteSpace(tenantId)) return;

            await semaphore.WaitAsync();
            try
            {
                await _backupRepository.CreateTraceFileProgressAsync(runId, tenantId);

                var query = new TenantLogsRequest
                {
                    ProjectKey = tenantId,
                    Filter = new TenantLogsRequestByFilter { StartDate = startDate, EndDate = endDate }
                };

                int pageNumber = 0;
                int totalRecords = 0;

                while (true)
                {
                    var traces = await _traceRepository.GetTracesByCollectionAsync(
                        tenantId, query, pageNumber, Constants.TracesBatchSize);

                    if (traces.Count == 0) break;

                    await _traceRepository.ArchiveTracesAsync(traces, query);
                    await _traceRepository.DeleteTracesByCollectionAsync(query);

                    totalRecords += traces.Count;
                    pageNumber++;

                    await TrySilentAsync(() => _backupRepository.UpdateJobHeartbeatAsync(runId));
                }

                await _backupRepository.MarkTraceArchivedAsync(runId, tenantId, totalRecords);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ProcessSingleTenantTracesAsync - Failed for tenant {TenantId}", tenantId);
                await TrySilentAsync(() => _backupRepository.MarkTraceArchiveFailedAsync(runId, tenantId, ex.ToString()));
            }
            finally
            {
                semaphore.Release();
            }
        }
        private async Task ProcessAllBlocksServiceLogsBackupAsync(string runId, DateTime startDate, DateTime endDate)
        {
            var serviceNames = await _logRepository.GetDistinctBlocksServiceNamesAsync(startDate, endDate);
            if (serviceNames.Count == 0)
            {
                _logger.LogInformation("ProcessAllBlocksServiceLogsBackupAsync - No blocks services found.");
                return;
            }

            _logger.LogInformation("ProcessAllBlocksServiceLogsBackupAsync - Processing {Count} service(s).", serviceNames.Count);

            using var semaphore = new SemaphoreSlim(Constants.MongoQueryMaxConcurrency);
            var tasks = serviceNames.Select(svc => ProcessSingleBlocksServiceLogAsync(runId, svc, startDate, endDate, semaphore));
            await Task.WhenAll(tasks);
        }

        private async Task ProcessSingleBlocksServiceLogAsync(
            string runId, string serviceName, DateTime startDate, DateTime endDate, SemaphoreSlim semaphore)
        {
            if (string.IsNullOrWhiteSpace(serviceName)) return;

            await semaphore.WaitAsync();
            try
            {
                var query = new TenantLogsRequest
                {
                    Filter = new TenantLogsRequestByFilter { StartDate = startDate, EndDate = endDate }
                };

                int pageNumber = 0;

                while (true)
                {
                    var groupedLogs = await _logRepository.GetLogsByServiceGroupedByTenantAsync(
                        serviceName, query, pageNumber, Constants.LogsBatchSize);

                    if (groupedLogs.Count == 0) break;

                    foreach (var (tenantId, logs) in groupedLogs)
                    {
                        if (logs.Count == 0) continue;

                        var traceId = logs.FirstOrDefault(l => !string.IsNullOrWhiteSpace(l.TraceId))?.TraceId;
                        await _backupRepository.CreateLogFileProgressAsync(runId, tenantId, serviceName, traceId);
                        await ArchiveAndDeleteBlocksServiceLogDataAsync(runId, serviceName, tenantId, logs, startDate, endDate);
                    }

                    pageNumber++;
                    await TrySilentAsync(() => _backupRepository.UpdateJobHeartbeatAsync(runId));
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ProcessSingleBlocksServiceLogAsync - Failed for service {ServiceName}", serviceName);
            }
            finally
            {
                semaphore.Release();
            }
        }

        private async Task ArchiveAndDeleteBlocksServiceLogDataAsync(
            string runId, string serviceName, string tenantId, List<StoredLog> logs, DateTime startDate, DateTime endDate)
        {
            try
            {
                var query = new TenantLogsRequest
                {
                    ProjectKey = tenantId,
                    Filter = new TenantLogsRequestByFilter { StartDate = startDate, EndDate = endDate }
                };

                await _logRepository.ArchiveLogsAsync(logs, query);
                await _logRepository.DeleteLogsByServiceAndTenantAsync(serviceName, query);

                await _backupRepository.MarkLogArchivedAsync(runId, tenantId, serviceName, logs.Count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ArchiveAndDeleteBlocksServiceLogDataAsync - Failed for tenant {TenantId}, service {ServiceName}",
                    tenantId, serviceName);
                await TrySilentAsync(() =>
                    _backupRepository.MarkLogArchiveFailedAsync(runId, tenantId, serviceName, ex.ToString()));
            }
        }
        private async Task ProcessAllManagedServiceLogsBackupAsync(string runId, DateTime startDate, DateTime endDate)
        {
            var serviceNames = await _logRepository.GetDistinctManagedServiceNamesAsync(startDate, endDate);
            if (serviceNames.Count == 0)
            {
                _logger.LogInformation("ProcessAllManagedServiceLogsBackupAsync - No managed services found.");
                return;
            }

            _logger.LogInformation("ProcessAllManagedServiceLogsBackupAsync - Processing {Count} service(s).", serviceNames.Count);

            using var semaphore = new SemaphoreSlim(Constants.MongoQueryMaxConcurrency);
            var tasks = serviceNames.Select(svc => ProcessSingleManagedServiceLogAsync(runId, svc, startDate, endDate, semaphore));
            await Task.WhenAll(tasks);
        }

        private async Task ProcessSingleManagedServiceLogAsync(
            string runId, string serviceName, DateTime startDate, DateTime endDate, SemaphoreSlim semaphore)
        {
            if (string.IsNullOrWhiteSpace(serviceName)) return;

            await semaphore.WaitAsync();
            try
            {
                var query = new TenantLogsRequest
                {
                    Filter = new TenantLogsRequestByFilter { StartDate = startDate, EndDate = endDate }
                };

                var (logs, tenantId) = await _logRepository.GetLogsByServiceAsync(serviceName, query);
                var traceId = logs.FirstOrDefault(l => !string.IsNullOrWhiteSpace(l.TraceId))?.TraceId;

                await _backupRepository.CreateServiceLogFileProgressAsync(runId, serviceName, traceId);

                if (logs.Count == 0 || string.IsNullOrWhiteSpace(tenantId))
                {
                    // No data — mark as archived with 0 records
                    await _backupRepository.MarkServiceLogArchivedAsync(runId, serviceName, 0);
                    return;
                }
                await TrySilentAsync(() =>
                    _backupRepository.UpdateServiceLogTenantResolvedAsync(runId, serviceName, tenantId));

                query.ProjectKey = tenantId;

                await _logRepository.ArchiveLogsAsync(logs, query);
                await _logRepository.DeleteLogsByServiceAndTenantAsync(serviceName, query);

                await _backupRepository.MarkServiceLogArchivedAsync(runId, serviceName, logs.Count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ProcessSingleManagedServiceLogAsync - Failed for service {ServiceName}", serviceName);
                await TrySilentAsync(() =>
                    _backupRepository.MarkServiceLogArchiveFailedAsync(runId, serviceName, null, ex.ToString()));
            }
            finally
            {
                semaphore.Release();
            }
        }
        private async Task ProcessArchiveLogsToBlobAsync(string runId)
        {
            var collections = await _logRepository.GetArchiveCollectionsAsync();
            if (collections.Count == 0)
            {
                _logger.LogInformation("ProcessArchiveLogsToBlobAsync - No log archive collections found.");
                return;
            }

            _logger.LogInformation("ProcessArchiveLogsToBlobAsync - Uploading {Count} collection(s) to blob.", collections.Count);

            foreach (var collectionName in collections)
            {
                await ProcessSingleLogCollectionAsync(runId, collectionName);
            }
        }

        private async Task ProcessSingleLogCollectionAsync(string runId, string collectionName)
        {
            var parts = collectionName.Split('_');
            if (parts.Length < 3)
            {
                _logger.LogWarning("ProcessSingleLogCollectionAsync - Skipping invalid collection name: {CollectionName}", collectionName);
                return;
            }

            var tenantId = parts[0];
            var startDateStr = parts[1];
            var endDateStr = parts[2];
            var fileName = $"logs_{tenantId}_{startDateStr}_{endDateStr}.parquet";
            var blobPath = $"{Constants.BackupSubdirectory}/{tenantId}/{Constants.BackupLogsDirectory}/{fileName}";

            try
            {
                var logs = await _logRepository.GetLogsFromArchiveCollectionAsync(collectionName);
                var isCarryover = !await _backupRepository.LogProgressExistsForTenantAsync(runId, tenantId);
                await _backupRepository.CreateLogBlobUploadProgressAsync(runId, tenantId, collectionName, blobPath, isCarryover);

                if (logs.Count == 0)
                {
                    await _logRepository.DeleteArchiveCollectionAsync(collectionName);
                    await _backupRepository.MarkLogBlobCompletedAsync(runId, tenantId, 0);
                    return;
                }

                var (url, error) = await StoreArchivedLogFileAsync(fileName, logs, tenantId);

                if (!string.IsNullOrWhiteSpace(url))
                {
                    await _logRepository.DeleteArchiveCollectionAsync(collectionName);
                    await _backupRepository.MarkLogBlobCompletedAsync(runId, tenantId, logs.Count);
                }
                else
                {
                    await _backupRepository.MarkLogBlobFailedAsync(runId, tenantId, blobPath, error ?? "Upload returned empty URL");
                }

                await TrySilentAsync(() => _backupRepository.UpdateJobHeartbeatAsync(runId));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ProcessSingleLogCollectionAsync - Failed for collection {CollectionName}", collectionName);
                await TrySilentAsync(() =>
                    _backupRepository.MarkLogBlobFailedAsync(runId, tenantId, blobPath, ex.ToString()));
            }
        }

        private async Task ProcessArchiveTracesToBlobAsync(string runId)
        {
            var collections = await _traceRepository.GetArchiveCollectionsAsync();
            if (collections.Count == 0)
            {
                _logger.LogInformation("ProcessArchiveTracesToBlobAsync - No trace archive collections found.");
                return;
            }

            _logger.LogInformation("ProcessArchiveTracesToBlobAsync - Uploading {Count} collection(s) to blob.", collections.Count);

            foreach (var collectionName in collections)
            {
                await ProcessSingleTraceCollectionAsync(runId, collectionName);
            }
        }

        private async Task ProcessSingleTraceCollectionAsync(string runId, string collectionName)
        {
            var parts = collectionName.Split('_');
            if (parts.Length < 3)
            {
                _logger.LogWarning("ProcessSingleTraceCollectionAsync - Skipping invalid collection name: {CollectionName}", collectionName);
                return;
            }

            var tenantId = parts[0];
            var startDateStr = parts[1];
            var endDateStr = parts[2];
            var fileName = $"traces_{tenantId}_{startDateStr}_{endDateStr}.parquet";
            var blobPath = $"{Constants.BackupSubdirectory}/{tenantId}/{Constants.BackupTracesDirectory}/{fileName}";

            var isCarryover = !await _backupRepository.TraceProgressExistsAsync(runId, tenantId);

            await _backupRepository.MarkTraceUploadingAsync(runId, tenantId, collectionName, blobPath, isCarryover);

            try
            {
                var traces = await _traceRepository.GetTracesFromArchiveCollectionAsync(collectionName);

                if (traces.Count == 0)
                {
                    await _traceRepository.DeleteArchiveCollectionAsync(collectionName);
                    await _backupRepository.MarkTraceCompletedAsync(runId, tenantId);
                    return;
                }

                var (url, error) = await StoreArchivedTraceFileAsync(fileName, traces, tenantId);

                if (!string.IsNullOrWhiteSpace(url))
                {
                    await _traceRepository.DeleteArchiveCollectionAsync(collectionName);
                    await _backupRepository.MarkTraceCompletedAsync(runId, tenantId);
                }
                else
                {
                    await _backupRepository.MarkTraceUploadFailedAsync(runId, tenantId, blobPath, error ?? "Upload returned empty URL");
                }

                await TrySilentAsync(() => _backupRepository.UpdateJobHeartbeatAsync(runId));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ProcessSingleTraceCollectionAsync - Failed for collection {CollectionName}", collectionName);
                await TrySilentAsync(() =>
                    _backupRepository.MarkTraceUploadFailedAsync(runId, tenantId, blobPath, ex.ToString()));
            }
        }

        // ── Blob storage helpers ─────────────────────────────────────────────────

        private async Task<(string Url, string? ErrorMessage)> StoreArchivedLogFileAsync(
            string fileName, IEnumerable<StoredLog> logs, string tenantId, CancellationToken ct = default)
        {
            string filePath = string.Empty;
            try
            {
                var logsForParquet = logs.Select(StoredLogForParquet.FromStoredLog).ToList();
                var uniqueLocalFileName = $"{Path.GetFileNameWithoutExtension(fileName)}_{Guid.NewGuid():N}.parquet";
                filePath = await ParquetService.SaveParquetAsync(logsForParquet, uniqueLocalFileName, ct);

                if (string.IsNullOrWhiteSpace(filePath) || !File.Exists(filePath))
                    return (string.Empty, $"Parquet file was not saved for {fileName}");

                var blobPath = $"{Constants.BackupSubdirectory}/{tenantId}/{Constants.BackupLogsDirectory}/{fileName}";
                return await UploadFileAsync(filePath, blobPath, ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "StoreArchivedLogFileAsync - Failed for {FileName}", fileName);
                return (string.Empty, ex.ToString());
            }
            finally
            {
                CleanupTempFile(filePath);
            }
        }

        private async Task<(string Url, string? ErrorMessage)> StoreArchivedTraceFileAsync(
            string fileName, IEnumerable<StoredTrace> traces, string tenantId, CancellationToken ct = default)
        {
            string filePath = string.Empty;
            try
            {
                var tracesForParquet = traces.Select(StoredTraceForParquet.FromStoredTrace).ToList();
                var uniqueLocalFileName = $"{Path.GetFileNameWithoutExtension(fileName)}_{Guid.NewGuid():N}.parquet";
                filePath = await ParquetService.SaveParquetAsync(tracesForParquet, uniqueLocalFileName, ct);

                if (string.IsNullOrWhiteSpace(filePath) || !File.Exists(filePath))
                    return (string.Empty, $"Parquet file was not saved for {fileName}");

                var blobPath = $"{Constants.BackupSubdirectory}/{tenantId}/{Constants.BackupTracesDirectory}/{fileName}";
                return await UploadFileAsync(filePath, blobPath, ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "StoreArchivedTraceFileAsync - Failed for {FileName}", fileName);
                return (string.Empty, ex.ToString());
            }
            finally
            {
                CleanupTempFile(filePath);
            }
        }

        private async Task<(string Url, string? ErrorMessage)> UploadFileAsync(
            string filePath, string blobPath, CancellationToken ct)
        {
            const int maxRetries = Constants.fileUploadRetries;
            string? lastError = null;

            for (int attempt = 1; attempt <= maxRetries; attempt++)
            {
                try
                {
                    await using var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read,
                        FileShare.Read | FileShare.Delete);

                    var url = await _blobStorage.SaveAsync(new UploadLogToStorageRequest
                    {
                        FileName = blobPath,
                        Content = stream,
                        ct = ct
                    });

                    return (url ?? string.Empty, null);
                }
                catch (Exception ex) when (attempt < maxRetries)
                {
                    lastError = ex.ToString();
                    _logger.LogWarning(ex, "UploadFileAsync - Attempt {Attempt}/{Max} failed for {Path}", attempt, maxRetries, blobPath);
                    await Task.Delay(TimeSpan.FromSeconds(Math.Pow(2, attempt)), ct);
                }
                catch (Exception ex)
                {
                    lastError = ex.ToString();
                    _logger.LogError(ex, "UploadFileAsync - All {Max} attempts failed for {Path}", maxRetries, blobPath);
                    return (string.Empty, lastError);
                }
            }

            return (string.Empty, lastError);
        }

        private void CleanupTempFile(string filePath)
        {
            try
            {
                if (!string.IsNullOrWhiteSpace(filePath) && File.Exists(filePath))
                    File.Delete(filePath);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "CleanupTempFile - Could not delete {FilePath}", filePath);
            }
        }

        // ── Utilities ────────────────────────────────────────────────────────────

        private async Task<(DateTime StartDate, DateTime EndDate)> ComputeBackupDateRangeAsync()
        {
            var config = await _lmtArchiveRestoreConfigurationRepository.GetLmtArchiveRestoreConfigurationsAsync();
            var today = DateTime.UtcNow.Date;
            var endDate = today.AddDays(-config.HotDataRetentionPeriodInDays);
            var startDate = endDate.AddDays(-1);
            return (startDate, endDate);
        }

        /// <summary>Awaits a monitoring call without propagating exceptions — monitoring must never crash the backup pipeline.</summary>
        private static async Task TrySilentAsync(Func<Task> action)
        {
            try { await action(); }
            catch { /* intentionally swallowed */ }
        }
    }
}
