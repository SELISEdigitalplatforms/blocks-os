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
            var requestId = Guid.NewGuid().ToString("N");
            var now = DateTime.UtcNow;
            var tenantId = BlocksContext.GetContext()?.TenantId ?? string.Empty;

            var retentionDays = await GetRetentionDaysAsync(ct);
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
                UserEmail = request.UserMail
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
                await PlanFileAsync(message.RequestId, message.TenantId, date, RestoreDataType.Trace, message.ServiceName, ct);
                await PlanFileAsync(message.RequestId, message.TenantId, date, RestoreDataType.Log, message.ServiceName, ct);
            }

            var allFiles = await _coldRestoreRepository.GetFileProgressByRequestIdAsync(message.RequestId, ct);
            await _coldRestoreRepository.UpdateTotalFilesAsync(message.RequestId, allFiles.Count, ct);
        }

        private async Task PlanFileAsync(string requestId, string tenantId, DateTime date, RestoreDataType dataType, string? serviceName, CancellationToken ct)
        {
            var alreadyPlanned = await _coldRestoreRepository.FileProgressExistsAsync(requestId, dataType, date, ct);
            if (alreadyPlanned)
                return;

            var blobPath = dataType switch
            {
                RestoreDataType.Trace => BuildTraceBlobPath(tenantId, date),
                RestoreDataType.Log => BuildLogBlobPath(tenantId, date, serviceName),
                _ => throw new InvalidOperationException($"Unsupported data type {dataType}")
            };

            var exists = await _blobStorage.ExistsAsync(blobPath, ct);
            if (!exists)
            {
                _logger.LogWarning("Blob not found during planning: {BlobPath}", blobPath);
                return;
            }

            var properties = await _blobStorage.GetPropertiesAsync(blobPath, ct);

            if (properties.AccessTier == AccessTier.Archive)
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

            var options = new ParallelOptions
            {
                MaxDegreeOfParallelism = 3,
                CancellationToken = ct
            };

            await Parallel.ForEachAsync(ordered, options, async (file, fileCt) =>
            {
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
            catch (Azure.RequestFailedException ex) when (ex.Status == 404)
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
                var exists = await _blobStorage.ExistsAsync(job.BlobPath, ct);

                if (!exists)
                {
                    _logger.LogWarning("Hydration blob not found: {BlobPath}", job.BlobPath);
                    await HandleHydrationFailureAsync(job, $"Blob not found: {job.BlobPath}", ct);
                    return;
                }

                var properties = await _blobStorage.GetPropertiesAsync(job.BlobPath, ct);

                if (properties.AccessTier == AccessTier.Archive)
                {
                    await _archiveRepository.UpdateHydrationStatusByIdAsync(
                        job.Id,
                        ArchiveHydrationStatus.RehydrationRequested,
                        lastCheckedAt: DateTime.UtcNow,
                        ct: ct);

                    _logger.LogInformation(
                        "Blob {BlobPath} is still in Archive tier. Waiting for hydration.",
                        job.BlobPath);
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

        private static string BuildTraceBlobPath(string tenantId, DateTime date)
        {
            var nextDate = date.AddDays(1);
            return $"{Constants.BackupSubdirectory}/{tenantId}/traces/traces_{tenantId}_{date:yyyyMMdd}_{nextDate:yyyyMMdd}.parquet";
        }

        private static string BuildLogBlobPath(string tenantId, DateTime date, string? serviceName)
        {
            var serviceSegment = string.IsNullOrWhiteSpace(serviceName)
                ? "logs"
                : serviceName;
            var nextDate = date.AddDays(1);
            return $"{Constants.BackupSubdirectory}/{tenantId}/logs/{serviceSegment}_{tenantId}_{date:yyyyMMdd}_{nextDate:yyyyMMdd}.parquet";
        }
    }
}
