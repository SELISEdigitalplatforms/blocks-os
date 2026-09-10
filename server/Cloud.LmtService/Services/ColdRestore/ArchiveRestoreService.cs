using Azure.Storage.Blobs.Models;
using Blocks.Genesis;
using Cloud.LmtService.Models.ColdRestore;
using Cloud.LmtService.Repositories.ColdRestore;
using Cloud.LmtService.Repositories.Shared;
using Cloud.LmtService.Services.ArchiveAndDelete;
using Cloud.LmtService.Utilities;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace Cloud.LmtService.Services.ColdRestore
{
    public class ArchiveRestoreService : IArchiveRestoreService
    {
        private readonly ILogger<ArchiveRestoreService> _logger;
        private readonly IBlobStorage _blobStorage;
        private readonly IArchiveRestoreRepository _archiveRepository;
        private readonly ILogTraceRestoreRepository _coldRestoreRepository;
        private readonly ILmtArchiveRestoreConfigurationRepository _lmtConfigRepository;
        private readonly IMessageClient _messageClient;
        private readonly ILogTraceRestoreService _logTraceRestoreService;

        public ArchiveRestoreService(
            ILogger<ArchiveRestoreService> logger,
            IBlobStorage blobStorage,
            IArchiveRestoreRepository archiveRepository,
            ILogTraceRestoreRepository coldRestoreRepository,
            ILmtArchiveRestoreConfigurationRepository lmtConfigRepository,
            IMessageClient messageClient,
            ILogTraceRestoreService logTraceRestoreService)
        {
            _logger = logger;
            _blobStorage = blobStorage;
            _archiveRepository = archiveRepository;
            _coldRestoreRepository = coldRestoreRepository;
            _lmtConfigRepository = lmtConfigRepository ?? throw new ArgumentNullException(nameof(lmtConfigRepository));
            _messageClient = messageClient;
            _logTraceRestoreService = logTraceRestoreService;
        }

        public async Task<StartArchiveRestoreResponse> StartArchiveRestoreAsync(StartArchiveRestoreRequest request, CancellationToken ct = default)
        {
            var (normalizedStartDate, normalizedEndDate) = Constants.ValidateAndNormalize(request.StartDate, request.EndDate);

            var config = await _lmtConfigRepository.GetLmtArchiveRestoreConfigurationsAsync(ct);
            var window = RestoreWindow.ForArchive(
                config.HotDataRetentionPeriodInDays, config.ColdToArchiveLifeCycleInDays, config.MaxRestoreRangeInDays, DateTime.UtcNow);

            if (!window.Contains(normalizedStartDate) || !window.Contains(normalizedEndDate))
            {
                throw new ArgumentException(
                    $"Archive restore is only available for dates {window.Describe()}. " +
                    "More recent dates are served by a cold restore.");
            }

            // Archive has no earliest date, so without this a request could ask for years of
            // rehydration in one go.
            if (window.SpanExceedsLimit(normalizedStartDate, normalizedEndDate))
            {
                throw new ArgumentException(
                    $"An archive restore may cover at most {window.MaxSpanDays} days.");
            }

            var requestId = Guid.NewGuid().ToString("N");
            var now = DateTime.UtcNow;
            var tenantId = BlocksContext.GetContext()?.TenantId ?? string.Empty;

            var retentionDays = config.RetentionDay;
            var requestRecord = new RestoreRequestRecord
            {
                RequestId = requestId,
                TenantId = tenantId,
                ServiceName = request.ServiceName,
                StartDate = normalizedStartDate,
                EndDate = normalizedEndDate,
                Timestamp = now,
                CreatedAt = now,
                Status = RestoreRequestStatus.Pending,
                TotalFiles = 0,
                ProcessedFiles = 0,
                FailedFiles = 0,
                TraceRowsRestored = 0,
                LogRowsRestored = 0,
                ExpireAt = DateTime.UtcNow.AddDays(retentionDays),
                SourceType = RestoreSourceType.Archive,
                UserEmail = request.UserMail,
                UserId = BlocksContext.GetContext()?.UserId
            };

            await _coldRestoreRepository.CreateRequestAsync(requestRecord);

            var message = new ArchiveRestoreMessage
            {
                RequestId = requestId,
                TenantId = tenantId,
                StartDate = normalizedStartDate,
                EndDate = normalizedEndDate,
                ServiceName = request.ServiceName
            };

            await _messageClient.SendToConsumerAsync(
                new ConsumerMessage<ArchiveRestoreMessage>
                {
                    ConsumerName = Constants.ArchiveRestoreQueue,
                    Payload = message
                });

            return new StartArchiveRestoreResponse
            {
                RequestId = requestId,
                Status = "Started",
                StartDate = normalizedStartDate,
                EndDate = normalizedEndDate
            };
        }

        public async Task ProcessRestoreAsync(ArchiveRestoreMessage message, CancellationToken ct = default)
        {
            try
            {
                if(!await _logTraceRestoreService.CheckRequestStatus(message.RequestId, ct))
                {
                    _logger.LogWarning("Received restore message for RequestId {RequestId} which is not in a valid state for processing. Skipping.", message.RequestId);
                    return;
                }

                await PrepareArchiveRestorePlanAsync(message, ct);
                await ExecuteReadableFilesAsync(message.RequestId, ct);
                await _logTraceRestoreService.UpdateFileRequestStatus(message.RequestId, ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Failed to process archive restore request for RequestId {RequestId}",
                    message.RequestId);

                await _coldRestoreRepository.UpdateRequestStatusAsync(
                    message.RequestId,
                    RestoreRequestStatus.Failed,
                    completedAt: DateTime.UtcNow,
                    ct: CancellationToken.None);

                throw;
            }
        }

        private async Task PrepareArchiveRestorePlanAsync(ArchiveRestoreMessage message, CancellationToken ct)
        {
            var dates = GenerateDateRange(message.StartDate, message.EndDate);

            foreach (var date in dates)
            {
                ct.ThrowIfCancellationRequested();
                await PlanFileAsync(message.RequestId, message.TenantId, date, RestoreDataType.Trace, ct);
                await PlanFileAsync(message.RequestId, message.TenantId, date, RestoreDataType.Log, ct);
            }

            var allFiles = await _coldRestoreRepository.GetFileProgressByRequestIdAsync(message.RequestId, ct);
            await _coldRestoreRepository.UpdateTotalFilesAsync(message.RequestId, allFiles.Count, ct);
        }

        private async Task PlanFileAsync(string requestId, string tenantId, DateTime date, RestoreDataType dataType, CancellationToken ct)
        {
            var alreadyPlanned = await _coldRestoreRepository.FileProgressExistsAsync(requestId, dataType, date, ct);
            if (alreadyPlanned)
                return;

            var blobPath = dataType switch
            {
                RestoreDataType.Trace => RestoreBlobPath.ForTraces(tenantId, date),
                RestoreDataType.Log => RestoreBlobPath.ForLogs(tenantId, date),
                _ => throw new InvalidOperationException($"Unsupported data type {dataType}")
            };

            // One call answers existence and tier; asking separately cost two round trips per file.
            var tier = await _blobStorage.GetTierStateAsync(blobPath, ct);
            if (!tier.Exists)
            {
                _logger.LogWarning("Blob not found during planning: {BlobPath}", blobPath);
                return;
            }

            if (tier.IsArchived)
            {
                await CreateArchiveTierProgressAsync(requestId, tenantId, date, blobPath, dataType, ct);
            }
            else
            {
                await CreateReadableProgressAsync(requestId, tenantId, date, blobPath, dataType, ct);
            }
        }

        private async Task CreateArchiveTierProgressAsync(string requestId, string tenantId, DateTime date, string blobPath, RestoreDataType dataType, CancellationToken ct)
        {
            var hydrationExists = await _archiveRepository.HydrationJobExistsAsync(requestId, blobPath, ct);
            if (!hydrationExists)
            {
                await _blobStorage.RequestRehydrationAsync(blobPath, AccessTier.Cool, ct);

                var retentionDays = await GetRetentionDaysAsync(ct);
                var hydrationJob = new ArchiveHydrationJobRecord
                {
                    RequestId = requestId,
                    TenantId = tenantId,
                    BlobPath = blobPath,
                    DataType = dataType,
                    FileDate = date,
                    Status = ArchiveHydrationStatus.RehydrationRequested,
                    RequestedAt = DateTime.UtcNow,
                    ExpireAt = DateTime.UtcNow.AddDays(retentionDays)
                };

                await _archiveRepository.CreateHydrationJobAsync(hydrationJob, ct);
            }

            var archiveProgress = new LogTraceRestoreFileProgressRecord
            {
                RequestId = requestId,
                TenantId = tenantId,
                BlobPath = blobPath,
                FileDate = date,
                DataType = dataType,
                NeedsHydration = true,
                HydrationStatus = ArchiveHydrationStatus.RehydrationRequested,
                Status = RestoreFileProgressStatus.Pending,
                Timestamp = DateTime.UtcNow,
                ExpireAt = DateTime.UtcNow.AddDays(await GetRetentionDaysAsync(ct)),
                SourceType = RestoreSourceType.Archive
            };

            await _coldRestoreRepository.CreateFileProgressAsync(archiveProgress, ct);
        }

        private async Task CreateReadableProgressAsync(string requestId, string tenantId, DateTime date, string blobPath, RestoreDataType dataType, CancellationToken ct)
        {
            var progress = new LogTraceRestoreFileProgressRecord
            {
                RequestId = requestId,
                TenantId = tenantId,
                BlobPath = blobPath,
                FileDate = date,
                DataType = dataType,
                NeedsHydration = false,
                HydrationStatus = ArchiveHydrationStatus.Ready,
                Status = RestoreFileProgressStatus.Pending,
                Timestamp = DateTime.UtcNow,
                ExpireAt = DateTime.UtcNow.AddDays(await GetRetentionDaysAsync(ct)),
                SourceType = RestoreSourceType.Archive
            };

            await _coldRestoreRepository.CreateFileProgressAsync(progress, ct);
        }

        private async Task ExecuteReadableFilesAsync(string requestId, CancellationToken ct)
        {
            var pendingFiles = await _coldRestoreRepository.GetReadablePendingFileProgressByRequestIdAsync(requestId, ct);

            var ordered = pendingFiles
                .OrderBy(x => x.FileDate)
                .ThenBy(x => x.DataType)
                .ToList();

            using var cancellation = CancellationTokenSource.CreateLinkedTokenSource(ct);

            var options = new ParallelOptions
            {
                MaxDegreeOfParallelism = 3,
                CancellationToken = ct
            };

            await Parallel.ForEachAsync(ordered, options, async (file, fileCt) =>
            {
                if (cancellation.IsCancellationRequested)
                    return;

                if (await _coldRestoreRepository.IsRequestCancelledAsync(requestId, fileCt))
                {
                    await cancellation.CancelAsync();
                    return;
                }

                await RestoreSingleFileAsync(file, fileCt);
            });
        }

        private async Task RestoreSingleFileAsync(LogTraceRestoreFileProgressRecord file, CancellationToken ct)
        {
            var progressId = file.Id;

            try
            {
                await _coldRestoreRepository.UpdateFileProgressStatusByObjectIdAsync(
                    progressId,
                    RestoreFileProgressStatus.Processing,
                    needsHydration: false,
                    rowsRestored: 0,
                    hydrationStatus: ArchiveHydrationStatus.Ready,
                    startedAt: DateTime.UtcNow,
                    ct: ct);

                int restoredRowCount = file.DataType switch
                {
                    RestoreDataType.Trace => await _logTraceRestoreService.RestoreTraceFileAsync(file, ct),
                    RestoreDataType.Log => await _logTraceRestoreService.RestoreLogFileAsync(file, ct),
                    _ => throw new InvalidOperationException($"Unsupported data type {file.DataType}")
                };

                await _coldRestoreRepository.UpdateFileProgressStatusByObjectIdAsync(
                    progressId,
                    RestoreFileProgressStatus.Completed,
                    needsHydration: false,
                    rowsRestored: restoredRowCount,
                    hydrationStatus: ArchiveHydrationStatus.Ready,
                    completedAt: DateTime.UtcNow,
                    ct: ct);

                await _coldRestoreRepository.IncrementRequestProgressAsync(
                    requestId: file.RequestId,
                    processedFilesIncrement: 1,
                    failedFilesIncrement: 0,
                    traceRowsIncrement: file.DataType == RestoreDataType.Trace ? restoredRowCount : 0,
                    logRowsIncrement: file.DataType == RestoreDataType.Log ? restoredRowCount : 0,
                    ct: ct);
            }
            catch (FileNotFoundException ex)
            {
                _logger.LogWarning(ex,
                    "Blob stream not found for RequestId {RequestId}, BlobPath {BlobPath}",
                    file.RequestId, file.BlobPath);

                await MarkFileFailedAsync(progressId, file, RestoreFileProgressStatus.FileNotFound, ex.Message, CancellationToken.None);
            }
            catch (Azure.RequestFailedException ex) when (ex.Status is 404 or 409)
            {
                _logger.LogWarning(ex,
                    "Blob not found for RequestId {RequestId}, BlobPath {BlobPath}",
                    file.RequestId, file.BlobPath);

                await MarkFileFailedAsync(progressId, file, RestoreFileProgressStatus.FileNotFound, ex.Message, CancellationToken.None);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Failed processing file for RequestId {RequestId}, BlobPath {BlobPath}",
                    file.RequestId, file.BlobPath);

                await MarkFileFailedAsync(progressId, file, RestoreFileProgressStatus.Failed, ex.Message, CancellationToken.None);
            }
        }

        private async Task MarkFileFailedAsync(ObjectId progressId, LogTraceRestoreFileProgressRecord file, RestoreFileProgressStatus status, string errorMessage, CancellationToken ct)
        {
            await _coldRestoreRepository.UpdateFileProgressStatusByObjectIdAsync(
                progressId,
                status,
                needsHydration: false,
                rowsRestored: 0,
                hydrationStatus: ArchiveHydrationStatus.Ready,
                completedAt: DateTime.UtcNow,
                errorMessage: errorMessage,
                ct: ct);

            await _coldRestoreRepository.IncrementRequestProgressAsync(
                requestId: file.RequestId,
                processedFilesIncrement: 1,
                failedFilesIncrement: 1,
                traceRowsIncrement: 0,
                logRowsIncrement: 0,
                ct: ct);
        }

        public async Task DeleteExpiredHydrationJobsAsync(CancellationToken ct = default)
        {
            var deleted = await _archiveRepository.DeleteExpiredHydrationJobsAsync(ct);

            if (deleted > 0)
            {
                _logger.LogInformation("Deleted {Count} expired hydration job(s)", deleted);
            }
        }

        public async Task CheckPendingHydrationsAsync(CancellationToken ct = default)
        {
            _logger.LogInformation("Starting hydration check job");

            var hydrationJobs = await _archiveRepository.GetPendingHydrationJobsAsync(ct);

            if (hydrationJobs.Count == 0)
            {
                _logger.LogInformation("No pending hydration jobs found");
                return;
            }

            var options = new ParallelOptions
            {
                MaxDegreeOfParallelism = 3,
                CancellationToken = ct
            };

            await Parallel.ForEachAsync(hydrationJobs, options, async (job, jobCt) =>
            {
                await ProcessHydrationJobAsync(job, jobCt);
            });
        }

        private async Task ProcessHydrationJobAsync(ArchiveHydrationJobRecord job, CancellationToken ct)
        {
            try
            {
                var tier = await _blobStorage.GetTierStateAsync(job.BlobPath, ct);

                if (!tier.Exists)
                {
                    _logger.LogWarning("Hydration blob not found: {BlobPath}", job.BlobPath);
                    await HandleHydrationFailureAsync(job, $"Blob not found: {job.BlobPath}", ct);
                    return;
                }

                if (tier.IsArchived)
                {
                    var waitedFor = DateTime.UtcNow - job.RequestedAt;

                    // Without a deadline a blob that never rehydrates is re-polled forever and its
                    // request never leaves InProgress, so the user can never ask again.
                    if (waitedFor > Constants.MaxHydrationWait)
                    {
                        _logger.LogError(
                            "Blob {BlobPath} has been rehydrating for {Hours:F1}h, past the {Limit:F0}h limit. Failing the request.",
                            job.BlobPath, waitedFor.TotalHours, Constants.MaxHydrationWait.TotalHours);

                        await HandleHydrationFailureAsync(
                            job,
                            $"Rehydration did not finish within {Constants.MaxHydrationWait.TotalHours:F0} hours.",
                            ct);
                        return;
                    }

                    await _archiveRepository.UpdateHydrationStatusByIdAsync(
                        job.Id,
                        ArchiveHydrationStatus.RehydrationRequested,
                        lastCheckedAt: DateTime.UtcNow,
                        ct: ct);

                    // Keep the request's bookkeeping alive while we wait. Retention is stamped from
                    // when the restore was asked for, and a rehydration can outlast it — the
                    // cleanup job would otherwise delete the request this job belongs to.
                    var retentionDays = await GetRetentionDaysAsync(ct);
                    await _coldRestoreRepository.ExtendRequestExpiryAsync(
                        job.RequestId, DateTime.UtcNow.AddDays(retentionDays), ct);

                    _logger.LogInformation(
                        "Blob {BlobPath} is still in Archive tier after {Hours:F1}h. Waiting for hydration.",
                        job.BlobPath, waitedFor.TotalHours);
                    return;
                }

                await RestoreHydratedBlobAsync(job, ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to check hydration for blob {BlobPath}", job.BlobPath);
                await HandleHydrationFailureAsync(job, ex.Message, CancellationToken.None);
            }
        }

        private async Task RestoreHydratedBlobAsync(ArchiveHydrationJobRecord job, CancellationToken ct)
        {
            var progressRows = await _coldRestoreRepository.GetFileProgressByBlobPathAsync(job.RequestId, job.BlobPath, ct);
            var progress = progressRows.FirstOrDefault(x => x.DataType == job.DataType);

            if (progress == null)
            {
                _logger.LogWarning(
                    "No file progress found for hydrated blob RequestId={RequestId}, BlobPath={BlobPath}",
                    job.RequestId, job.BlobPath);

                await _archiveRepository.UpdateHydrationStatusByIdAsync(
                    job.Id,
                    ArchiveHydrationStatus.Failed,
                    lastCheckedAt: DateTime.UtcNow,
                    completedAt: DateTime.UtcNow,
                    errorMessage: "File progress record not found",
                    ct: ct);

                await _logTraceRestoreService.UpdateFileRequestStatus(job.RequestId, ct);
                return;
            }

            if (progress.Status is RestoreFileProgressStatus.Completed
                               or RestoreFileProgressStatus.Failed
                               or RestoreFileProgressStatus.FileNotFound)
            {
                _logger.LogDebug(
                    "Skipping already-terminal file progress for RequestId={RequestId}, BlobPath={BlobPath}, Status={Status}",
                    job.RequestId, job.BlobPath, progress.Status);

                await _archiveRepository.UpdateHydrationStatusByIdAsync(
                    job.Id,
                    ArchiveHydrationStatus.Ready,
                    lastCheckedAt: DateTime.UtcNow,
                    completedAt: DateTime.UtcNow,
                    ct: ct);

                await _logTraceRestoreService.UpdateFileRequestStatus(job.RequestId, ct);
                return;
            }

            try
            {
                await _coldRestoreRepository.UpdateFileProgressStatusByObjectIdAsync(
                    progress.Id,
                    RestoreFileProgressStatus.Processing,
                    needsHydration: false,
                    rowsRestored: 0,
                    hydrationStatus: ArchiveHydrationStatus.Ready,
                    startedAt: DateTime.UtcNow,
                    ct: ct);

                int restoredRowCount = job.DataType switch
                {
                    RestoreDataType.Trace => await _logTraceRestoreService.RestoreTraceFileAsync(progress, ct),
                    RestoreDataType.Log => await _logTraceRestoreService.RestoreLogFileAsync(progress, ct),
                    _ => throw new InvalidOperationException($"Unsupported data type {job.DataType}")
                };

                await _coldRestoreRepository.UpdateFileProgressStatusByObjectIdAsync(
                    progress.Id,
                    RestoreFileProgressStatus.Completed,
                    needsHydration: false,
                    rowsRestored: restoredRowCount,
                    hydrationStatus: ArchiveHydrationStatus.Ready,
                    completedAt: DateTime.UtcNow,
                    ct: ct);

                await _coldRestoreRepository.IncrementRequestProgressAsync(
                    requestId: progress.RequestId,
                    processedFilesIncrement: 1,
                    failedFilesIncrement: 0,
                    traceRowsIncrement: job.DataType == RestoreDataType.Trace ? restoredRowCount : 0,
                    logRowsIncrement: job.DataType == RestoreDataType.Log ? restoredRowCount : 0,
                    ct: ct);

                await _archiveRepository.UpdateHydrationStatusByIdAsync(
                    job.Id,
                    ArchiveHydrationStatus.Ready,
                    lastCheckedAt: DateTime.UtcNow,
                    completedAt: DateTime.UtcNow,
                    ct: ct);

                _logger.LogInformation(
                    "Successfully restored hydrated blob {BlobPath}, {RowCount} rows",
                    job.BlobPath, restoredRowCount);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Failed to restore hydrated blob {BlobPath}",
                    job.BlobPath);

                await _coldRestoreRepository.UpdateFileProgressStatusByObjectIdAsync(
                    progress.Id,
                    RestoreFileProgressStatus.Failed,
                    needsHydration: false,
                    rowsRestored: 0,
                    hydrationStatus: ArchiveHydrationStatus.Failed,
                    completedAt: DateTime.UtcNow,
                    errorMessage: ex.Message,
                    ct: CancellationToken.None);

                await _coldRestoreRepository.IncrementRequestProgressAsync(
                    requestId: progress.RequestId,
                    processedFilesIncrement: 1,
                    failedFilesIncrement: 1,
                    traceRowsIncrement: 0,
                    logRowsIncrement: 0,
                    ct: CancellationToken.None);

                await _archiveRepository.UpdateHydrationStatusByIdAsync(
                    job.Id,
                    ArchiveHydrationStatus.Failed,
                    lastCheckedAt: DateTime.UtcNow,
                    completedAt: DateTime.UtcNow,
                    errorMessage: ex.Message,
                    ct: CancellationToken.None);
            }

            await _logTraceRestoreService.UpdateFileRequestStatus(progress.RequestId, ct);
        }

        private async Task HandleHydrationFailureAsync(ArchiveHydrationJobRecord job, string errorMessage, CancellationToken ct)
        {
            await _archiveRepository.UpdateHydrationStatusByIdAsync(
                job.Id,
                ArchiveHydrationStatus.Failed,
                lastCheckedAt: DateTime.UtcNow,
                completedAt: DateTime.UtcNow,
                errorMessage: errorMessage,
                ct: ct);

            var progressRows = await _coldRestoreRepository.GetFileProgressByBlobPathAsync(job.RequestId, job.BlobPath, ct);

            foreach (var progress in progressRows)
            {
                if (progress.Status is RestoreFileProgressStatus.Completed
                                    or RestoreFileProgressStatus.Failed
                                    or RestoreFileProgressStatus.FileNotFound)
                    continue;

                await _coldRestoreRepository.UpdateFileProgressStatusByObjectIdAsync(
                    progress.Id,
                    RestoreFileProgressStatus.Failed,
                    needsHydration: true,
                    rowsRestored: 0,
                    hydrationStatus: ArchiveHydrationStatus.Failed,
                    completedAt: DateTime.UtcNow,
                    errorMessage: errorMessage,
                    ct: ct);

                await _coldRestoreRepository.IncrementRequestProgressAsync(
                    requestId: progress.RequestId,
                    processedFilesIncrement: 1,
                    failedFilesIncrement: 1,
                    traceRowsIncrement: 0,
                    logRowsIncrement: 0,
                    ct: ct);
            }

            await _logTraceRestoreService.UpdateFileRequestStatus(job.RequestId, ct);
        }
        private static List<DateTime> GenerateDateRange(DateTime start, DateTime end)
        {
            var dates = new List<DateTime>();
            for (var date = start.Date; date <= end.Date; date = date.AddDays(1))
                dates.Add(date);
            return dates;
        }

        private async Task<int> GetRetentionDaysAsync(CancellationToken ct = default)
        {
            var config = await _lmtConfigRepository.GetLmtArchiveRestoreConfigurationsAsync(ct);
            return config.RetentionDay;
        }

    }
}
