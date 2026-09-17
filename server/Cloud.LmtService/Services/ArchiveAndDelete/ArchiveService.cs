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
            // A run that died without completing would otherwise hold the lock below forever, so
            // stale rows are released first.
            await ReleaseStaleRunsAsync();

            // Two overlapping runs both enumerate the archive databases and drop each collection
            // once it is uploaded, so the second can drop what the first is still writing. The
            // schedule can overlap for ordinary reasons: a Service Bus lock that expires mid-run
            // gets the message redelivered, and the on-demand endpoint can fire at any time.
            if (await _backupRepository.HasActiveRunAsync())
            {
                _logger.LogWarning("StartBackupAsync - A backup run is already active; skipping this trigger.");
                return;
            }

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
        /// <summary>
        /// Marks runs that stopped sending heartbeats as abandoned. Without this a crashed worker
        /// leaves a Running row behind and every later trigger is refused as "already active".
        /// Failing to reap must not stop the backup, so the error is logged and swallowed.
        /// </summary>
        private async Task ReleaseStaleRunsAsync()
        {
            try
            {
                var staleRunIds = await _backupRepository.GetStaleRunningJobIdsAsync(Constants.BackupStaleRunThreshold);

                foreach (var staleRunId in staleRunIds)
                {
                    _logger.LogWarning("ReleaseStaleRunsAsync - Abandoning stale backup run {RunId}", staleRunId);
                    await _backupRepository.MarkJobAbandonedAsync(staleRunId);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ReleaseStaleRunsAsync - Could not release stale runs");
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

                int totalRecords = 0;

                // The delete covers the whole window, so it can only run once the whole window has
                // been archived. Deleting per batch - as this used to - destroyed every trace past
                // the first batch, because the delete was never scoped to the batch just written.
                await foreach (var batch in _traceRepository.StreamTracesByCollectionAsync(
                    tenantId, query, Constants.TracesBatchSize))
                {
                    await _traceRepository.ArchiveTracesAsync(batch, query);
                    totalRecords += batch.Count;

                    await TrySilentAsync(() => _backupRepository.UpdateJobHeartbeatAsync(runId));
                }

                // An exception above skips this, leaving the source data in place for a later run.
                if (totalRecords > 0)
                    await _traceRepository.DeleteTracesByCollectionAsync(query);

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

                var archived = await ArchiveServiceLogsByTenantAsync(
                    runId, serviceName, startDate, endDate,
                    _logRepository.StreamBlocksServiceLogsAsync(serviceName, query, Constants.LogsBatchSize),
                    (tenantId, traceId) => _backupRepository.CreateLogFileProgressAsync(runId, tenantId, serviceName, traceId),
                    (tenantId, error) => _backupRepository.MarkLogArchiveFailedAsync(runId, tenantId, serviceName, error));

                await DeleteArchivedServiceLogsAsync(runId, serviceName, startDate, endDate, archived,
                    (tenantId, count) => _backupRepository.MarkLogArchivedAsync(runId, tenantId, serviceName, count));
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

        /// <summary>
        /// Archives a service's logs, filing every log under the tenant that owns it.
        /// <para>
        /// Nothing is deleted here. The delete is scoped to a tenant and the whole window, so it
        /// cannot run until that tenant's logs have all been archived - see
        /// <see cref="DeleteArchivedServiceLogsAsync"/>. A tenant whose archive write fails is left
        /// out of the returned set, so its source logs survive to be retried.
        /// </para>
        /// </summary>
        private async Task<Dictionary<string, int>> ArchiveServiceLogsByTenantAsync(
            string runId,
            string serviceName,
            DateTime startDate,
            DateTime endDate,
            IAsyncEnumerable<List<StoredLog>> batches,
            Func<string, string?, Task> createProgressAsync,
            Func<string, string, Task> markFailedAsync)
        {
            var archivedByTenant = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            var failedTenants = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            await foreach (var batch in batches)
            {
                foreach (var group in batch.GroupBy(log => log.TenantId, StringComparer.OrdinalIgnoreCase))
                {
                    var tenantId = group.Key;

                    // Logs with no tenant have always been skipped: there is no tenant folder to
                    // archive them under, and deleting them would be deleting an unbacked-up log.
                    if (string.IsNullOrWhiteSpace(tenantId) || failedTenants.Contains(tenantId))
                        continue;

                    var logs = group.ToList();

                    try
                    {
                        if (!archivedByTenant.ContainsKey(tenantId))
                        {
                            var traceId = logs.FirstOrDefault(l => !string.IsNullOrWhiteSpace(l.TraceId))?.TraceId;
                            await createProgressAsync(tenantId, traceId);
                        }

                        await _logRepository.ArchiveLogsAsync(logs, TenantWindow(tenantId, startDate, endDate));
                        archivedByTenant[tenantId] = archivedByTenant.GetValueOrDefault(tenantId) + logs.Count;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "ArchiveServiceLogsByTenantAsync - Failed for tenant {TenantId}, service {ServiceName}",
                            tenantId, serviceName);

                        // Give up on this tenant only. Its logs stay put rather than being deleted
                        // against an archive that never received them.
                        archivedByTenant.Remove(tenantId);
                        failedTenants.Add(tenantId);
                        await TrySilentAsync(() => markFailedAsync(tenantId, ex.ToString()));
                    }
                }

                await TrySilentAsync(() => _backupRepository.UpdateJobHeartbeatAsync(runId));
            }

            return archivedByTenant;
        }

        /// <summary>
        /// Deletes the source logs of every tenant that was archived in full, one delete per tenant.
        /// </summary>
        private async Task DeleteArchivedServiceLogsAsync(
            string runId,
            string serviceName,
            DateTime startDate,
            DateTime endDate,
            Dictionary<string, int> archivedByTenant,
            Func<string, int, Task> markArchivedAsync)
        {
            foreach (var (tenantId, recordCount) in archivedByTenant)
            {
                try
                {
                    await _logRepository.DeleteLogsByServiceAndTenantAsync(
                        serviceName, TenantWindow(tenantId, startDate, endDate));

                    await markArchivedAsync(tenantId, recordCount);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "DeleteArchivedServiceLogsAsync - Failed for tenant {TenantId}, service {ServiceName}",
                        tenantId, serviceName);
                }

                await TrySilentAsync(() => _backupRepository.UpdateJobHeartbeatAsync(runId));
            }
        }

        private static TenantLogsRequest TenantWindow(string tenantId, DateTime startDate, DateTime endDate) => new()
        {
            ProjectKey = tenantId,
            Filter = new TenantLogsRequestByFilter { StartDate = startDate, EndDate = endDate }
        };
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

            // The progress document is per service, not per tenant, so it is created once - on the
            // first tenant seen, which is also where its TraceId comes from. Declared out here so
            // the failure path below can still guarantee the row exists.
            var progressCreated = false;

            async Task EnsureServiceProgressAsync(string? traceId)
            {
                if (progressCreated) return;

                progressCreated = true;
                await _backupRepository.CreateServiceLogFileProgressAsync(runId, serviceName, traceId);
            }

            try
            {
                var query = new TenantLogsRequest
                {
                    Filter = new TenantLogsRequestByFilter { StartDate = startDate, EndDate = endDate }
                };

                // A managed service collection holds more than one tenant's logs. Reading the
                // tenant off the first document filed everyone else's logs under that tenant - and
                // into that tenant's blob folder - while leaving their source logs undeleted.
                var archived = await ArchiveServiceLogsByTenantAsync(
                    runId, serviceName, startDate, endDate,
                    _logRepository.StreamManagedServiceLogsAsync(serviceName, query, Constants.LogsBatchSize),
                    async (tenantId, traceId) =>
                    {
                        await EnsureServiceProgressAsync(traceId);
                        await TrySilentAsync(() =>
                            _backupRepository.UpdateServiceLogTenantResolvedAsync(runId, serviceName, tenantId));
                    },
                    (tenantId, error) =>
                        _backupRepository.MarkServiceLogArchiveFailedAsync(runId, serviceName, tenantId, error));

                // A service with no logs in the window still gets its progress row, recorded as 0.
                await EnsureServiceProgressAsync(null);

                await DeleteArchivedServiceLogsAsync(runId, serviceName, startDate, endDate, archived,
                    (_, _) => Task.CompletedTask);

                // The progress document is per service, so it carries the whole service's total.
                await _backupRepository.MarkServiceLogArchivedAsync(runId, serviceName, archived.Values.Sum());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ProcessSingleManagedServiceLogAsync - Failed for service {ServiceName}", serviceName);

                // The failure is recorded against a row that is guaranteed to exist, even when the
                // read failed before a single batch arrived.
                await TrySilentAsync(async () =>
                {
                    await EnsureServiceProgressAsync(null);
                    await _backupRepository.MarkServiceLogArchiveFailedAsync(runId, serviceName, null, ex.ToString());
                });
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

            // Bounded concurrency, matching the archiving phase. Each upload now streams one batch
            // at a time, so running several at once costs a bounded amount of memory rather than
            // one tenant-day per upload.
            using var semaphore = new SemaphoreSlim(Constants.MongoQueryMaxConcurrency);
            await Task.WhenAll(collections.Select(collectionName =>
                RunWithSemaphoreAsync(semaphore, () => ProcessSingleLogCollectionAsync(runId, collectionName))));
        }

        private async Task ProcessSingleLogCollectionAsync(string runId, string collectionName)
        {
            if (!TryParseArchiveCollectionName(collectionName, out var tenantId, out var startDateStr, out var endDateStr))
            {
                _logger.LogWarning("ProcessSingleLogCollectionAsync - Skipping invalid collection name: {CollectionName}", collectionName);
                return;
            }

            var fileName = $"logs_{tenantId}_{startDateStr}_{endDateStr}.parquet";
            var blobPath = $"{Constants.BackupSubdirectory}/{tenantId}/{Constants.BackupLogsDirectory}/{fileName}";

            try
            {
                var isCarryover = !await _backupRepository.LogProgressExistsForTenantAsync(runId, tenantId);
                await _backupRepository.CreateLogBlobUploadProgressAsync(runId, tenantId, collectionName, blobPath, isCarryover);

                // A read failure throws out of here instead of arriving as an empty result, so the
                // collection is only ever dropped once its contents are safely in blob storage.
                var (url, rowCount, error) = await StoreArchivedLogFileAsync(fileName, collectionName, tenantId);

                if (rowCount == 0)
                {
                    await _logRepository.DeleteArchiveCollectionAsync(collectionName);
                    await _backupRepository.MarkLogBlobCompletedAsync(runId, tenantId, 0);
                    return;
                }

                if (!string.IsNullOrWhiteSpace(url))
                {
                    await _logRepository.DeleteArchiveCollectionAsync(collectionName);
                    await _backupRepository.MarkLogBlobCompletedAsync(runId, tenantId, (int)rowCount);
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

            using var semaphore = new SemaphoreSlim(Constants.MongoQueryMaxConcurrency);
            await Task.WhenAll(collections.Select(collectionName =>
                RunWithSemaphoreAsync(semaphore, () => ProcessSingleTraceCollectionAsync(runId, collectionName))));
        }

        private static async Task RunWithSemaphoreAsync(SemaphoreSlim semaphore, Func<Task> action)
        {
            await semaphore.WaitAsync();
            try
            {
                await action();
            }
            finally
            {
                semaphore.Release();
            }
        }

        /// <summary>
        /// Splits an archive collection name into its tenant and window parts.
        /// The name is <c>{tenantId}_{yyyyMMdd}_{yyyyMMdd}</c>, and the two dates are always the
        /// last two segments, so a tenant id that itself contains an underscore still resolves to
        /// the right tenant instead of being truncated at the first separator.
        /// </summary>
        private static bool TryParseArchiveCollectionName(
            string collectionName, out string tenantId, out string startDateStr, out string endDateStr)
        {
            tenantId = startDateStr = endDateStr = string.Empty;

            var parts = collectionName.Split('_');
            if (parts.Length < 3) return false;

            endDateStr = parts[^1];
            startDateStr = parts[^2];
            tenantId = string.Join('_', parts[..^2]);

            return !string.IsNullOrWhiteSpace(tenantId);
        }

        private async Task ProcessSingleTraceCollectionAsync(string runId, string collectionName)
        {
            if (!TryParseArchiveCollectionName(collectionName, out var tenantId, out var startDateStr, out var endDateStr))
            {
                _logger.LogWarning("ProcessSingleTraceCollectionAsync - Skipping invalid collection name: {CollectionName}", collectionName);
                return;
            }

            var fileName = $"traces_{tenantId}_{startDateStr}_{endDateStr}.parquet";
            var blobPath = $"{Constants.BackupSubdirectory}/{tenantId}/{Constants.BackupTracesDirectory}/{fileName}";

            try
            {
                // Inside the try: a failure reading or writing progress used to escape this method,
                // abort the enclosing loop and leave every remaining tenant unuploaded.
                var isCarryover = !await _backupRepository.TraceProgressExistsAsync(runId, tenantId);
                await _backupRepository.MarkTraceUploadingAsync(runId, tenantId, collectionName, blobPath, isCarryover);

                var (url, rowCount, error) = await StoreArchivedTraceFileAsync(fileName, collectionName, tenantId);

                if (rowCount == 0)
                {
                    await _traceRepository.DeleteArchiveCollectionAsync(collectionName);
                    await _backupRepository.MarkTraceCompletedAsync(runId, tenantId);
                    return;
                }

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

        /// <summary>
        /// Streams the archive collection straight into a Parquet file and uploads it.
        /// <para>
        /// A read failure propagates to the caller rather than being reported as an empty result:
        /// the caller drops the archive collection when the row count is zero, so "empty" and
        /// "could not be read" must not look alike.
        /// </para>
        /// </summary>
        private async Task<(string Url, long RowCount, string? ErrorMessage)> StoreArchivedLogFileAsync(
            string fileName, string collectionName, string tenantId, CancellationToken ct = default)
        {
            string filePath = string.Empty;
            try
            {
                var uniqueLocalFileName = $"{Path.GetFileNameWithoutExtension(fileName)}_{Guid.NewGuid():N}.parquet";

                var batches = _logRepository
                    .StreamLogsFromArchiveCollectionAsync(collectionName, Constants.LogsBatchSize, ct)
                    .Select(batch => batch.ConvertAll(StoredLogForParquet.FromStoredLog));

                long rowCount;
                (filePath, rowCount) = await ParquetService.SaveLogsParquetAsync(batches, uniqueLocalFileName, ct);

                if (rowCount == 0)
                    return (string.Empty, 0, null);

                if (string.IsNullOrWhiteSpace(filePath) || !File.Exists(filePath))
                    return (string.Empty, rowCount, $"Parquet file was not saved for {fileName}");

                var blobPath = $"{Constants.BackupSubdirectory}/{tenantId}/{Constants.BackupLogsDirectory}/{fileName}";
                var (url, error) = await UploadFileAsync(filePath, blobPath, ct);
                return (url, rowCount, error);
            }
            finally
            {
                CleanupTempFile(filePath);
            }
        }

        /// <inheritdoc cref="StoreArchivedLogFileAsync"/>
        private async Task<(string Url, long RowCount, string? ErrorMessage)> StoreArchivedTraceFileAsync(
            string fileName, string collectionName, string tenantId, CancellationToken ct = default)
        {
            string filePath = string.Empty;
            try
            {
                var uniqueLocalFileName = $"{Path.GetFileNameWithoutExtension(fileName)}_{Guid.NewGuid():N}.parquet";

                var batches = _traceRepository
                    .StreamTracesFromArchiveCollectionAsync(collectionName, Constants.TracesBatchSize, ct)
                    .Select(batch => batch.ConvertAll(StoredTraceForParquet.FromStoredTrace));

                long rowCount;
                (filePath, rowCount) = await ParquetService.SaveTracesParquetAsync(batches, uniqueLocalFileName, ct);

                if (rowCount == 0)
                    return (string.Empty, 0, null);

                if (string.IsNullOrWhiteSpace(filePath) || !File.Exists(filePath))
                    return (string.Empty, rowCount, $"Parquet file was not saved for {fileName}");

                var blobPath = $"{Constants.BackupSubdirectory}/{tenantId}/{Constants.BackupTracesDirectory}/{fileName}";
                var (url, error) = await UploadFileAsync(filePath, blobPath, ct);
                return (url, rowCount, error);
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
