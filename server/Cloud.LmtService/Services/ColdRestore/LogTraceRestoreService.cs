using Azure;
using Blocks.Genesis;
using Blocks.MailDriver;
using Cloud.LmtService.Models.ArchiveAndDelete;
using Cloud.LmtService.Models.ColdRestore;
using Cloud.LmtService.Models.Logs;
using Cloud.LmtService.Models.Shared;
using Cloud.LmtService.Models.Trace;
using Cloud.LmtService.Repositories.ColdRestore;
using Cloud.LmtService.Repositories.Shared;
using Cloud.LmtService.Services.ArchiveAndDelete;
using Cloud.LmtService.Utilities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace Cloud.LmtService.Services.ColdRestore
{
    public class LogTraceRestoreService : ILogTraceRestoreService
    {
        /// <summary>Calendar-day wire format: no time, no offset, nothing for a client to shift.</summary>
        private const string IsoDate = "yyyy-MM-dd";

        private const string RequestIdRequired = "RequestId is required.";
        private const string TraceDataType = "Trace";
        private readonly ILogger<LogTraceRestoreService> _logger;
        private readonly ILogTraceRestoreRepository _coldRestoreRepository;
        private readonly IMessageClient _messageClient;
        private readonly IBlobStorage _blobStorage;
        private readonly ILogTraceRestoreResultRepository _coldRestoreResultRepository;
        private readonly ILogTraceRestoreParquetReader _coldRestoreParquetReader;
        private readonly ILmtArchiveRestoreConfigurationRepository _lmtArchiveRestoreConfigurationRepository;
        private readonly IMailDriverService _mailDriverService;
        private readonly IHttpService _httpService;
        private readonly ICryptoService _cryptoService;
        private readonly ITenants _tenants;
        private readonly IArchiveRestoreRepository _archiveRestoreRepository;
        private readonly IRestoreUserRepository _userRepository;
        public LogTraceRestoreService(ILogger<LogTraceRestoreService> logger, ILogTraceRestoreRepository coldRestoreRepository, IMessageClient messageClient, ILogTraceRestoreResultRepository coldRestoreResultRepository,
    ILogTraceRestoreParquetReader coldRestoreParquetReader, IBlobStorage blobStorage, IConfiguration configuration,
    ILmtArchiveRestoreConfigurationRepository lmtArchiveRestoreConfigurationRepository, IMailDriverService mailDriverService,
    IHttpService httpService, ICryptoService cryptoService, ITenants tenants, IArchiveRestoreRepository archiveRestoreRepository,
    IRestoreUserRepository userRepository)
        {
            _logger = logger;
            _coldRestoreRepository = coldRestoreRepository;
            _messageClient = messageClient;
            _coldRestoreParquetReader = coldRestoreParquetReader;
            _coldRestoreResultRepository = coldRestoreResultRepository;
            _blobStorage = blobStorage;

            _lmtArchiveRestoreConfigurationRepository = lmtArchiveRestoreConfigurationRepository;
            _mailDriverService = mailDriverService;
            _httpService = httpService;
            _cryptoService = cryptoService;
            _tenants = tenants;
            _archiveRestoreRepository = archiveRestoreRepository;
            _userRepository = userRepository;
        }


        public async Task<StartColdRestoreResponse> StartRestoreAsync(StartColdRestoreRequest request)
        {
            var (normalizedStartDate, normalizedEndDate) = Constants.ValidateAndNormalize(request.StartDate, request.EndDate);

            var config = await _lmtArchiveRestoreConfigurationRepository.GetLmtArchiveRestoreConfigurationsAsync();
            var window = RestoreWindow.ForCold(
                config.HotDataRetentionPeriodInDays, config.ColdToArchiveLifeCycleInDays, config.MaxRestoreRangeInDays, DateTime.UtcNow);

            // Fail here rather than hours later in the worker: outside this window the day is
            // either still in Mongo (no blob yet) or already in the unreadable Archive tier.
            if (!window.Contains(normalizedStartDate) || !window.Contains(normalizedEndDate))
            {
                throw new ArgumentException(
                    $"Cold restore is only available for dates {window.Describe()}. " +
                    "Use an archive restore for older dates.");
            }

            if (window.SpanExceedsLimit(normalizedStartDate, normalizedEndDate))
            {
                throw new ArgumentException(
                    $"A cold restore may cover at most {window.MaxSpanDays} days.");
            }

            var requestId = Guid.NewGuid().ToString("N");
            var now = DateTime.UtcNow;
            var tenantId = BlocksContext.GetContext()?.TenantId ?? string.Empty;

            // The token carries the user id but neither a user name nor an email, so the address
            // for the completion mail has to be read from the user record — and read here, on the
            // request path, because the worker that sends the mail has no such context.
            var userId = BlocksContext.GetContext()?.UserId;
            var _retentionDays = config.RetentionDay;
            var record = new RestoreRequestRecord
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
                ExpireAt = DateTime.UtcNow.AddDays(_retentionDays),
                SourceType = RestoreSourceType.Cold,
                UserEmail =await _userRepository.GetEmailByUserIdAsync(userId),
                UserId = userId
            };
            await _coldRestoreRepository.CreateRequestAsync(record);

              var message = new ColdRestoreMessage
            {
                RequestId = requestId,
                TenantId = tenantId,
                StartDate = normalizedStartDate,
                EndDate = normalizedEndDate,
                ServiceName = request.ServiceName
            };
            await _messageClient.SendToConsumerAsync(
                new ConsumerMessage<ColdRestoreMessage>
                {
                    ConsumerName = Constants.ColdRestoreQueue,
                    Payload = message
                });

            return new StartColdRestoreResponse
            {
                RequestId = requestId,
                Status = RestoreRequestStatus.Pending.ToString(),
                StartDate = normalizedStartDate,
                EndDate = normalizedEndDate
            };
        }
        public async Task<CancelRestoreResponse> CancelRestoreAsync(CancelRestoreRequest request, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(request.RequestId))
                throw new ArgumentException(RequestIdRequired);

            var tenantId = BlocksContext.GetContext()?.TenantId ?? string.Empty;
            var record = await _coldRestoreRepository.GetRequestByIdAsync(request.RequestId, ct);

            if (record == null)
                throw new KeyNotFoundException($"Restore request not found for RequestId {request.RequestId}");

            if (!string.Equals(record.TenantId, tenantId, StringComparison.OrdinalIgnoreCase))
                throw new UnauthorizedAccessException("TenantId does not match the restore request.");

            if (IsTerminal(record.Status))
            {
                return NothingToCancel(record.RequestId, record.Status);
            }

            var cancelled = await _coldRestoreRepository.TryCancelRequestAsync(request.RequestId, DateTime.UtcNow, ct);

            if (!cancelled)
            {
                // Another caller, or the worker finishing, got there between our read and our write.
                var current = await _coldRestoreRepository.GetRequestByIdAsync(request.RequestId, ct);
                return NothingToCancel(request.RequestId, current?.Status ?? record.Status);
            }

            var stoppedFiles = await _coldRestoreRepository.CancelOutstandingFileProgressAsync(request.RequestId, ct);
            var stoppedHydrations = await _archiveRestoreRepository.CancelHydrationJobsForRequestAsync(request.RequestId, ct);

            // Purge here so the user can re-request the range straight away. The worker drops these
            // again when it notices the cancellation, which cleans up anything an in-flight batch
            // wrote between this call and the loop's next check.
            await _coldRestoreResultRepository.DropResultCollectionsAsync(request.RequestId, ct);

            _logger.LogInformation(
                "Cancelled RequestId {RequestId}: stopped {Files} file(s) and {Hydrations} hydration job(s)",
                request.RequestId, stoppedFiles, stoppedHydrations);

            return new CancelRestoreResponse
            {
                RequestId = request.RequestId,
                Status = nameof(RestoreRequestStatus.Cancelled),
                Cancelled = true,
                Message = "Restore request cancelled. Partially restored data has been discarded."
            };
        }

        private static CancelRestoreResponse NothingToCancel(string requestId, RestoreRequestStatus status) => new()
        {
            RequestId = requestId,
            Status = status.ToString(),
            Cancelled = false,
            Message = $"Restore request is already {status} and cannot be cancelled."
        };

        private async Task<bool> SendEmailAsync(string email, string tier, string status, CancellationToken ct = default)
        {
            try
            {
                var configuration = await GetEmailTemplateConfig(ct);
                if (string.IsNullOrEmpty(configuration.TemplateName))
                {
                    _logger.LogWarning("Email template name is not configured. Skipping email notification for {Email}.", email);
                    return false;
                }
                if (string.IsNullOrEmpty(email))
                {
                    _logger.LogWarning("User email is not provided. Skipping email notification.");
                    return false;
                }
                if (string.IsNullOrEmpty(tier) || string.IsNullOrEmpty(status))
                {
                    _logger.LogWarning("Data tier or status information is missing for {Email}. Skipping email notification.", email);
                    return false;
                }
                _logger.LogInformation("Sending email notification to {Email} with tier {Tier} and status {Status}.", email, tier, status);

                var sendMailCommand = new SendMail
                {
                    Cc = Array.Empty<string>(),
                    Bcc = Array.Empty<string>(),
                    BodyDataContext = new Dictionary<string, string>
                                {
                                   { "tier", tier },
                                   {"status", status}
                                },

                    Purpose = configuration.TemplateName,
                    Language = "en-US",
                    To = [email],
                    SendPhoneNumberAsEmail = true
                };

                var response = await _mailDriverService.SendAsync(sendMailCommand);
                _logger.LogInformation("Email notification sent to {Email} with tier {Tier} and status {Status}. Success: {IsSuccess}", email, tier, status, response.IsSuccess);
                return response.IsSuccess;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send email notification to {Email} with tier {Tier} and status {Status}.", email, tier, status);
                return false;
            }

        }
        private async Task<bool> NotifyEvent(string tier, string status, string? messageCoRelationId, string tenantId, string? userId, CancellationToken ct = default)
        {
            try
            {
                var config = await GetNotificationConfig(ct);

                if (string.IsNullOrWhiteSpace(config.NotificationUrl))
                {
                    _logger.LogWarning("Notification URL is not configured. Skipping notification for tenant {TenantId}.", tenantId);
                    return false;
                }

                var requestData = new NotificationRequest
                {
                    ConnectionId = messageCoRelationId,
                    UserIds = [userId ?? string.Empty],
                    DenormalizedPayload = JsonSerializer.Serialize(new
                    {
                        title = "Log and Trace Restoration Status Update",
                        description = $"{tier} data restoration has been {status}."
                    }),
                    SaveDenormalizedPayloadAsAnObject = false,
                    ConfigurationName = config.NotificationConfigName,
                    ContentAvailable = true,
                    ResponseKey = "Log and Trace Restoration Status Update",
                    ResponseValue = $"{tier} data restoration has been {status}.",
                };

                // Prefer the ambient context's originating tenant, which is what the notification
                // service authenticates against. Falls back to the tenant on the persisted request
                // because this also runs on a queue consumer, where there may be no ambient context
                // at all — and dereferencing a missing one threw inside this try, turning a missing
                // context into a silently skipped notification.
                var xblocksKey = BlocksContext.GetContext()?.OriginalTenantId ?? tenantId;
                var salt = _tenants.GetTenantByID(xblocksKey)?.TenantSalt;
                var signedSecret = _cryptoService.Hash(xblocksKey, salt);

                var headers = new Dictionary<string, string>
                {
                    { "x-blocks-key", xblocksKey },
                    { "Secret", signedSecret }
                };

                var (response, _) = await _httpService.Post<NotificationResponse>(
                     requestData, config.NotificationUrl, "application/json", headers, ct);

                _logger.LogInformation("Notification sent with result {Result} for tenant {TenantId} with tier {Tier} and status {Status}.", response?.isSuccess, tenantId, tier, status);
                return response != null && response.isSuccess;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send notification for tenant {TenantId} with tier {Tier} and status {Status}.", tenantId, tier, status);
                return false;
            }

        }

        private async Task<int> GetRetentionDaysAsync(CancellationToken ct = default)
        {
            var config = await _lmtArchiveRestoreConfigurationRepository.GetLmtArchiveRestoreConfigurationsAsync(ct);
            return config.RetentionDay;
        }
        private async Task<LogTraceRestoreEmailTConfig>GetEmailTemplateConfig(CancellationToken ct = default)
        {
            var config = await _lmtArchiveRestoreConfigurationRepository.GetLmtArchiveRestoreConfigurationsAsync(ct);
            return config.EmailTemplateConfig ?? new LogTraceRestoreEmailTConfig {TemplateName = string.Empty };
        }
        private async Task<NotificationConfig>GetNotificationConfig(CancellationToken ct = default)
        {
            var config = await _lmtArchiveRestoreConfigurationRepository.GetLmtArchiveRestoreConfigurationsAsync(ct);
            return config.NotificationConfig ?? new NotificationConfig { NotificationUrl = string.Empty, NotificationConfigName = string.Empty };
        }
        public async Task<GetHotDataUploadToBlobInDays> GetHotDataRetentionPeriodInDays(CancellationToken ct = default)
        {
            var config = await _lmtArchiveRestoreConfigurationRepository.GetLmtArchiveRestoreConfigurationsAsync(ct);
            var now = DateTime.UtcNow;
            var cold = RestoreWindow.ForCold(
                config.HotDataRetentionPeriodInDays, config.ColdToArchiveLifeCycleInDays, config.MaxRestoreRangeInDays, now);
            var archive = RestoreWindow.ForArchive(
                config.HotDataRetentionPeriodInDays, config.ColdToArchiveLifeCycleInDays, config.MaxRestoreRangeInDays, now);

            // + 1 because a day's blob is only written by the following backup run: with hot
            // retention of 1, the run on the 10th uploads the 8th, so the newest restorable day is
            // two back, not one. RestoreWindow.ForCold applies the same offset.
            var coldDataSelectionDays = config.HotDataRetentionPeriodInDays +1;

            return new GetHotDataUploadToBlobInDays
            {
                // Day counts are kept for callers that still compute their own offsets.
                ColdDataSelectionDays = coldDataSelectionDays,
                ArchiveDataSelectionDays = coldDataSelectionDays + config.ColdToArchiveLifeCycleInDays,

                // The dates themselves, so the client does not re-derive them: it would have to
                // pick a "today", and a browser's local midnight is not the UTC midnight this
                // window is measured from. For part of every day the two disagree by a full day.
                ColdEarliestDate = cold.Earliest.ToString(IsoDate, CultureInfo.InvariantCulture),
                ColdLatestDate = cold.Latest.ToString(IsoDate, CultureInfo.InvariantCulture),
                ArchiveLatestDate = archive.Latest.ToString(IsoDate, CultureInfo.InvariantCulture),

                ColdMaxRangeDays = cold.MaxSpanDays,
                ArchiveMaxRangeDays = archive.MaxSpanDays,
            };
        }

        public async Task<GetColdRestoreStatusResponse> GetStatusAsync(GetColdRestoreStatusRequest request)
        {
            _logger.LogInformation("Start of GetStatusAsync");

            if (string.IsNullOrWhiteSpace(request.RequestId))
            {
                throw new ArgumentException(RequestIdRequired);
            }

            var record = await _coldRestoreRepository.GetRequestStatusAsync(request.RequestId, request.SourceType);

            if (record == null)
            {
                throw new KeyNotFoundException($"Cold restore request not found for RequestId {request.RequestId}");
            }

            // Tenant-scoped like the download endpoints: without this, any authenticated tenant
            // could read another tenant's restore progress from a guessed RequestId.
            var tenantId = BlocksContext.GetContext()?.TenantId ?? string.Empty;
            if (!string.Equals(record.TenantId, tenantId, StringComparison.OrdinalIgnoreCase))
            {
                throw new UnauthorizedAccessException("TenantId does not match the restore request.");
            }

            return new GetColdRestoreStatusResponse
            {
                RequestId = record.RequestId,
                Status = record.Status.ToString(),
                TotalFiles = record.TotalFiles,
                ProcessedFiles = record.ProcessedFiles,
                FailedFiles = record.FailedFiles
            };
        }
        public async Task<bool> CheckRequestStatus(string requestId, CancellationToken ct = default)
        {
            // One conditional update decides the winner. A read-then-write here let two concurrent
            // deliveries of the same message both start processing the request.
            var claimed = await _coldRestoreRepository.TryBeginProcessingAsync(requestId, DateTime.UtcNow, ct);

            if (!claimed)
            {
                _logger.LogWarning(
                    "Skipping duplicate restore delivery for RequestId {RequestId}: it is already running, finished or cancelled",
                    requestId);
                return false;
            }

            await _coldRestoreRepository.ResetStuckProcessingFilesAsync(requestId, ct);
            return true;
        }
        public async Task ProcessRestoreAsync(ColdRestoreMessage message, CancellationToken ct = default)
        {
            try
            {
                if (!await CheckRequestStatus(message.RequestId, ct))
                {
                    _logger.LogInformation(
                        "Aborting ProcessRestoreAsync for RequestId {RequestId} because request is already completed or in progress",
                        message.RequestId);
                    return;
                }
                await PrepareRestorePlanAsync(message, ct);
                await ExecutePendingFilesAsync(message.RequestId, ct);
                await UpdateFileRequestStatus(message.RequestId, ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Failed to process cold restore request for RequestId {RequestId}",
                    message.RequestId);
                await _coldRestoreRepository.UpdateRequestStatusAsync(
                    message.RequestId,
                    RestoreRequestStatus.Failed,
                    completedAt: DateTime.UtcNow,
                    ct: CancellationToken.None);

                throw new InvalidOperationException(
                    $"Failed to process cold restore request for RequestId {message.RequestId}",
                    ex);
            }
        }
        public async Task UpdateFileRequestStatus(string requestId, CancellationToken ct = default)
        {
            var requestRecord = await _coldRestoreRepository.GetRequestByIdAsync(requestId, ct);
            if (requestRecord == null)
                return;

            if (IsTerminal(requestRecord.Status))
                return;

            var allFiles = await _coldRestoreRepository.GetFileProgressByRequestIdAsync(requestId, ct);

            // No files at all means the requested range had nothing archived. That is still a
            // finished request: leaving it InProgress strands it, because the next delivery is
            // refused and the UI keeps showing a blocking progress overlay.
            var allTerminal = allFiles.Count == 0 || allFiles.All(x => IsTerminal(x.Status));

            if (!allTerminal)
                return;

            var totalFiles = allFiles.Count;
            var failedFiles = allFiles.Count(x =>
                x.Status is RestoreFileProgressStatus.Failed
                         or RestoreFileProgressStatus.FileNotFound);
            var traceRows = allFiles.Where(x => x.DataType == RestoreDataType.Trace).Sum(x => x.RowsRestored);
            var logRows = allFiles.Where(x => x.DataType == RestoreDataType.Log).Sum(x => x.RowsRestored);
            var processedFiles = allFiles.Count(x => IsTerminal(x.Status));

            await _coldRestoreRepository.UpdateRequestCountersAsync(
                requestId, processedFiles, failedFiles, traceRows, logRows, ct);

            var finalStatus = failedFiles switch
            {
                0 => RestoreRequestStatus.Completed,
                _ when failedFiles == totalFiles => RestoreRequestStatus.Failed,
                _ => RestoreRequestStatus.PartialSuccess
            };

            // Only the caller that actually performs the transition notifies. Concurrent hydration
            // workers can all observe the final file finishing, and each would otherwise email.
            var finalized = await _coldRestoreRepository.TryCompleteRequestAsync(
                requestId, finalStatus, DateTime.UtcNow, ct);

            if (!finalized)
            {
                _logger.LogInformation(
                    "Another worker finalized RequestId {RequestId} first; skipping duplicate notification",
                    requestId);
                return;
            }

            await ExtendRetentionFromCompletionAsync(requestId, ct);

            if (!string.IsNullOrEmpty(requestRecord.UserEmail))
            {
                var emailed = await SendEmailAsync(requestRecord.UserEmail, requestRecord.SourceType.ToString(), finalStatus.ToString(), ct);
                _logger.LogInformation("Email sent status {Result} for RequestId {RequestId}", emailed, requestId);
            }

            // Deliberately outside the email guard: the in-app notification is what lets the UI
            // drop its progress overlay, so a missing address must not suppress it.
            await NotifyEvent(
                requestRecord.SourceType.ToString(),
                finalStatus.ToString(),
                requestId,
                requestRecord.TenantId,
                requestRecord.UserId,
                ct);
        }

        private static bool IsTerminal(RestoreRequestStatus status) =>
            status is RestoreRequestStatus.Completed
                   or RestoreRequestStatus.PartialSuccess
                   or RestoreRequestStatus.Failed
                   or RestoreRequestStatus.Cancelled;

        private static bool IsTerminal(RestoreFileProgressStatus status) =>
            status is RestoreFileProgressStatus.Completed
                   or RestoreFileProgressStatus.Failed
                   or RestoreFileProgressStatus.FileNotFound
                   or RestoreFileProgressStatus.Cancelled;

        /// <summary>
        /// Restarts the retention clock from completion. Stamped at request time it can expire
        /// mid-flight, which for archive restores (hours of rehydration) deletes the request record
        /// out from under the job that is still working on it.
        /// </summary>
        private async Task ExtendRetentionFromCompletionAsync(string requestId, CancellationToken ct)
        {
            try
            {
                var retentionDays = await GetRetentionDaysAsync(ct);
                await _coldRestoreRepository.ExtendRequestExpiryAsync(
                    requestId, DateTime.UtcNow.AddDays(retentionDays), ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not extend retention for RequestId {RequestId}", requestId);
            }
        }
        private async Task PrepareRestorePlanAsync(ColdRestoreMessage message, CancellationToken ct = default)
        {
            var dates = GenerateDateRange(message.StartDate, message.EndDate);

            // Read once for the whole plan instead of per date per data type.
            var retentionDays = await GetRetentionDaysAsync(ct);

            foreach (var date in dates)
            {
                ct.ThrowIfCancellationRequested();

                await PlanColdFileAsync(message, date, RestoreDataType.Trace, retentionDays, ct);
                await PlanColdFileAsync(message, date, RestoreDataType.Log, retentionDays, ct);
            }

            var allFiles = await _coldRestoreRepository.GetFileProgressByRequestIdAsync(message.RequestId, ct);
            await _coldRestoreRepository.UpdateTotalFilesAsync(message.RequestId, allFiles.Count, ct);
        }

        private async Task PlanColdFileAsync(
            ColdRestoreMessage message,
            DateTime date,
            RestoreDataType dataType,
            int retentionDays,
            CancellationToken ct)
        {
            var alreadyPlanned = await _coldRestoreRepository.FileProgressExistsAsync(
                message.RequestId, dataType, date, ct);

            if (alreadyPlanned)
                return;

            var blobPath = dataType == RestoreDataType.Trace
                ? RestoreBlobPath.ForTraces(message.TenantId, date)
                : RestoreBlobPath.ForLogs(message.TenantId, date);

            var tier = await _blobStorage.GetTierStateAsync(blobPath, ct);

            if (!tier.Exists)
            {
                _logger.LogWarning("Blob not found {BlobPath}", blobPath);
                return;
            }

            var record = new LogTraceRestoreFileProgressRecord
            {
                RequestId = message.RequestId,
                TenantId = message.TenantId,
                DataType = dataType,
                FileDate = date.Date,
                BlobPath = blobPath,
                Timestamp = DateTime.UtcNow,
                ExpireAt = DateTime.UtcNow.AddDays(retentionDays),
                SourceType = RestoreSourceType.Cold
            };

            if (tier.IsArchived)
            {
                // Queuing this would make OpenReadAsync return 409 InvalidBlobTier and surface a raw
                // Azure message. Recording it as failed keeps the reason visible and actionable.
                record.Status = RestoreFileProgressStatus.Failed;
                record.ErrorMessage =
                    $"Blob {blobPath} is in the Archive tier and cannot be read by a cold restore. " +
                    "Request an archive restore for this date instead.";
                record.CompletedAt = DateTime.UtcNow;

                _logger.LogWarning(
                    "Cold restore skipped Archive-tier blob {BlobPath} for RequestId {RequestId}",
                    blobPath, message.RequestId);
            }
            else
            {
                record.Status = RestoreFileProgressStatus.Pending;
            }

            await _coldRestoreRepository.CreateFileProgressAsync(record, ct);
        }
        public async Task ExecutePendingFilesAsync(string requestId, CancellationToken ct = default)
        {
            var pendingFiles = await _coldRestoreRepository.GetPendingFileProgressByRequestIdAsync(requestId, ct);
            var ordered = pendingFiles
                .OrderBy(x => x.FileDate)
                .ThenBy(x => x.DataType)
                .ToList();

            // Linked source so a cancellation observed between files drains the loop promptly
            // instead of restoring the rest of what can be a seven-day range.
            using var cancellation = CancellationTokenSource.CreateLinkedTokenSource(ct);
            var wasCancelled = false;

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
                    wasCancelled = true;
                    await cancellation.CancelAsync();
                    return;
                }

                try
                {
                    await _coldRestoreRepository.UpdateFileProgressAsync(
                        requestId: file.RequestId,
                        dataType: file.DataType,
                        fileDate: file.FileDate,
                        status: RestoreFileProgressStatus.Processing,
                        startedAt: DateTime.UtcNow,
                        ct: fileCt);

                    int restoredRowCount = file.DataType switch
                    {
                        RestoreDataType.Trace => await RestoreTraceFileAsync(file, fileCt),
                        RestoreDataType.Log => await RestoreLogFileAsync(file, fileCt),
                        _ => throw new InvalidOperationException($"Unsupported data type {file.DataType}")
                    };

                    await _coldRestoreRepository.UpdateFileProgressAsync(
                        requestId: file.RequestId,
                        dataType: file.DataType,
                        fileDate: file.FileDate,
                        status: RestoreFileProgressStatus.Completed,
                        rowsRestored: restoredRowCount,
                        completedAt: DateTime.UtcNow,
                        ct: fileCt);

                    await _coldRestoreRepository.IncrementRequestProgressAsync(
                        requestId: file.RequestId,
                        processedFilesIncrement: 1,
                        failedFilesIncrement: 0,
                        traceRowsIncrement: file.DataType == RestoreDataType.Trace ? restoredRowCount : 0,
                        logRowsIncrement:   file.DataType == RestoreDataType.Log   ? restoredRowCount : 0,
                        ct: fileCt);
                }
                catch (FileNotFoundException ex)
                {
                    _logger.LogWarning(
                        ex,
                        "Cold restore file not found for RequestId {RequestId}, DataType {DataType}, FileDate {FileDate}",
                        file.RequestId, file.DataType, file.FileDate);

                    await _coldRestoreRepository.UpdateFileProgressAsync(
                        requestId: file.RequestId,
                        dataType: file.DataType,
                        fileDate: file.FileDate,
                        status: RestoreFileProgressStatus.FileNotFound,
                        rowsRestored: 0,
                        errorMessage: ex.Message,
                        completedAt: DateTime.UtcNow,
                        ct: CancellationToken.None);

                    await _coldRestoreRepository.IncrementRequestProgressAsync(
                        requestId: file.RequestId,
                        processedFilesIncrement: 1,
                        failedFilesIncrement: 1,
                        traceRowsIncrement: 0,
                        logRowsIncrement: 0,
                        ct: CancellationToken.None);
                }
                catch (RequestFailedException ex) when (ex.Status is 404 or 409)
                {
                    _logger.LogWarning(
                        ex,
                        "Blob not found for RequestId {RequestId}, DataType {DataType}, FileDate {FileDate}",
                        file.RequestId, file.DataType, file.FileDate);

                    await _coldRestoreRepository.UpdateFileProgressAsync(
                        requestId: file.RequestId,
                        dataType: file.DataType,
                        fileDate: file.FileDate,
                        status: RestoreFileProgressStatus.FileNotFound,
                        rowsRestored: 0,
                        errorMessage: ex.Message,
                        completedAt: DateTime.UtcNow,
                        ct: CancellationToken.None);

                    await _coldRestoreRepository.IncrementRequestProgressAsync(
                        requestId: file.RequestId,
                        processedFilesIncrement: 1,
                        failedFilesIncrement: 1,
                        traceRowsIncrement: 0,
                        logRowsIncrement: 0,
                        ct: CancellationToken.None);
                }
                catch (Exception ex)
                {
                    _logger.LogError(
                        ex,
                        "Failed processing file for RequestId {RequestId}, DataType {DataType}, FileDate {FileDate}",
                        file.RequestId, file.DataType, file.FileDate);

                    await _coldRestoreRepository.UpdateFileProgressAsync(
                        requestId: file.RequestId,
                        dataType: file.DataType,
                        fileDate: file.FileDate,
                        status: RestoreFileProgressStatus.Failed,
                        rowsRestored: 0,
                        errorMessage: ex.Message,
                        completedAt: DateTime.UtcNow,
                        ct: CancellationToken.None);

                    await _coldRestoreRepository.IncrementRequestProgressAsync(
                        requestId: file.RequestId,
                        processedFilesIncrement: 1,
                        failedFilesIncrement: 1,
                        traceRowsIncrement: 0,
                        logRowsIncrement: 0,
                        ct: CancellationToken.None);
                }
            });

            if (wasCancelled)
            {
                // Drop again on the way out: the cancel endpoint already purged, but a batch that
                // was mid-insert when the cancellation landed can have written rows since.
                _logger.LogInformation("RequestId {RequestId} was cancelled; discarding partially restored data", requestId);
                await _coldRestoreResultRepository.DropResultCollectionsAsync(requestId, CancellationToken.None);
            }
        }
        private List<DateTime> GenerateDateRange(DateTime startDate, DateTime endDate)
        {
            var dates = new List<DateTime>();

            var current = startDate.Date;

            while (current <= endDate.Date)
            {
                dates.Add(current);
                current = current.AddDays(1);
            }

            return dates;
        }
        public async Task<int> RestoreTraceFileAsync(LogTraceRestoreFileProgressRecord file, CancellationToken ct = default)
        {
            await using var stream = await _blobStorage.OpenReadAsync(file.BlobPath, ct);
            if (stream == null)
                throw new FileNotFoundException($"Blob stream is null for path {file.BlobPath}");
            await _coldRestoreResultRepository.DeleteTraceResultsByRequestAndDateAsync(file.RequestId, file.FileDate, ct);

            var totalCount = 0;
            var batch = new List<RestoreTraceResultRecord>(Constants.RestoreInsertBatchSize);
            var _retentionDays = await GetRetentionDaysAsync();
            await foreach (var trace in _coldRestoreParquetReader.ReadTracesAsync(stream, ct).ConfigureAwait(false))
            {
                batch.Add(new RestoreTraceResultRecord
                {
                    RequestId         = file.RequestId,
                    TenantId          = file.TenantId,
                    SourceDate        = file.FileDate,
                    Timestamp         = trace.Timestamp,
                    TraceId           = trace.TraceId,
                    OperationName     = trace.OperationName,
                    StartTime         = trace.StartTime,
                    EndTime           = trace.EndTime,
                    Duration          = trace.Duration,
                    AttributesJson    = trace.AttributesJson,
                    ServiceName       = trace.ServiceName,
                    SpanId            = trace.SpanId,
                    ParentSpanId      = trace.ParentSpanId,
                    ParentId          = trace.ParentId,
                    Status            = trace.Status,
                    StatusDescription = trace.StatusDescription,
                    Baggage           = trace.BaggageJson,
                    Kind              = trace.Kind,
                    ActivitySourceName= trace.ActivitySourceName,
                    BlobPath          = file.BlobPath,
                    ExpireAt          = DateTime.UtcNow.AddDays(_retentionDays),
                });

                if (batch.Count >= Constants.RestoreInsertBatchSize)
                {
                    await _coldRestoreResultRepository.InsertTraceResultsAsync(batch, ct);
                    totalCount += batch.Count;
                    batch.Clear();
                }
            }

            if (batch.Count > 0)
            {
                await _coldRestoreResultRepository.InsertTraceResultsAsync(batch, ct);
                totalCount += batch.Count;
            }

            return totalCount;
        }

        public async Task<int> RestoreLogFileAsync(LogTraceRestoreFileProgressRecord file, CancellationToken ct = default)
        {
            await using var stream = await _blobStorage.OpenReadAsync(file.BlobPath, ct);
            if (stream == null)
                throw new FileNotFoundException($"Blob stream is null for path {file.BlobPath}");

            // Delete stale results BEFORE streaming (same rationale as traces above).
            await _coldRestoreResultRepository.DeleteLogResultsByRequestAndDateAsync(file.RequestId, file.FileDate, ct);

            var totalCount = 0;
            var batch = new List<RestoreLogResultRecord>(Constants.RestoreInsertBatchSize);
            var _retentionDays = await GetRetentionDaysAsync();
            await foreach (var log in _coldRestoreParquetReader.ReadLogsAsync(stream, ct).ConfigureAwait(false))
            {
                batch.Add(new RestoreLogResultRecord
                {
                    RequestId   = file.RequestId,
                    TenantId    = file.TenantId,
                    SourceDate  = file.FileDate,
                    Timestamp   = log.Timestamp,
                    Level       = log.Level,
                    Message     = log.Message,
                    TraceId     = log.TraceId,
                    SpanId      = log.SpanId,
                    ServiceName = log.ServiceName,
                    ActionName  = log.ActionName,
                    Exception   = log.Exception,
                    BlobPath    = file.BlobPath,
                    ExpireAt    = DateTime.UtcNow.AddDays(_retentionDays),
                });

                if (batch.Count >= Constants.RestoreInsertBatchSize)
                {
                    await _coldRestoreResultRepository.InsertLogResultsAsync(batch, ct);
                    totalCount += batch.Count;
                    batch.Clear();
                }
            }

            if (batch.Count > 0)
            {
                await _coldRestoreResultRepository.InsertLogResultsAsync(batch, ct);
                totalCount += batch.Count;
            }

            return totalCount;
        }
        public async Task<BaseQueryListResponse<IQueryable<SingleTraceProjection>>> GetRestoredTracesAsync(GetRestoredTracesRequest request)
        {
            _logger.LogInformation(
                "Start of GetRestoredTracesAsync for RequestId {RequestId}",
                request.RequestId);

            if (string.IsNullOrWhiteSpace(request.RequestId))
            {
                throw new ArgumentException(RequestIdRequired);
            }

            var (data, total) = await _coldRestoreResultRepository.GetRestoredTracesAsync(request);

            return new BaseQueryListResponse<IQueryable<SingleTraceProjection>>
            {
                Data = data,
                TotalCount = total
            };
        }

        public async Task<GetLogsResponse> GetRestoredLogsAsync(GetRestoredLogsRequest request)
        {
            _logger.LogInformation(
                "Start of GetRestoredLogsAsync for RequestId {RequestId}",
                request.RequestId);

            if (string.IsNullOrWhiteSpace(request.RequestId))
            {
                throw new ArgumentException(RequestIdRequired);
            }

            var (data, total) = await _coldRestoreResultRepository.GetRestoredLogsAsync(request);

            return new GetLogsResponse
            {
                Data = data,
                TotalCount = total
            };
        }
        public async Task DeleteAllExpiredColdRestoreDataAsync()
        {
            var request = _coldRestoreRepository.DeleteExpiredRequestsAsync();
            var fileProgress = _coldRestoreRepository.DeleteExpiredFileProgressAsync();
            var traceResult = _coldRestoreResultRepository.DeleteExpiredTraceResultsAsync();
            var logResult = _coldRestoreResultRepository.DeleteExpiredLogResultsAsync();
            await Task.WhenAll(request, fileProgress, traceResult, logResult);

        }
        public async Task<BaseQueryListResponse<IQueryable<SingleTraceProjection>>> GetRestoredTraceAsync(GetRestoredTraceRequest request)
        {
            _logger.LogInformation(
                "Start of GetRestoredTraceAsync for RequestId {RequestId}, TraceId {TraceId}",
                request.RequestId,
                request.TraceId);

            if (string.IsNullOrWhiteSpace(request.RequestId))
                throw new ArgumentException(RequestIdRequired);

            if (string.IsNullOrWhiteSpace(request.TraceId))
                throw new ArgumentException("TraceId is required.");

            var data = await _coldRestoreResultRepository.GetRestoredTraceAsync(request);

            return new BaseQueryListResponse<IQueryable<SingleTraceProjection>>
            {
                Data = data,
                TotalCount = data.Count()
            };
        }
        public async Task<GetLogsResponse> GetRestoredLogsByTraceAsync(GetRestoredLogsByTraceRequest request)
        {
            _logger.LogInformation(
                "Start of GetRestoredLogsByTraceAsync for RequestId {RequestId}, TraceId {TraceId}",
                request.RequestId,
                request.TraceId);

            if (string.IsNullOrWhiteSpace(request.RequestId))
                throw new ArgumentException(RequestIdRequired);

            if (string.IsNullOrWhiteSpace(request.TraceId))
                throw new ArgumentException("TraceId is required.");

            var (data, total) = await _coldRestoreResultRepository.GetRestoredLogsByTraceAsync(request);

            return new GetLogsResponse
            {
                Data = data,
                TotalCount = total
            };
        }
        public async Task<ColdRestoreDownloadResult> BuildParquetDownloadAsync(DownloadColdRestoreParquetRequest request, CancellationToken ct = default)
        {
            var tenantId = BlocksContext.GetContext()?.TenantId ?? string.Empty;

            _logger.LogInformation(
                "Start of BuildParquetDownloadAsync for RequestId {RequestId}, TenantId {TenantId}",
                request.RequestId,
                tenantId);

            if (string.IsNullOrWhiteSpace(request.RequestId))
            {
                throw new ArgumentException(RequestIdRequired);
            }

            if (request.StartDate == DateTime.MinValue || request.EndDate == DateTime.MinValue)
            {
                throw new ArgumentException("StartDate and EndDate are required.");
            }

            if (request.StartDate > request.EndDate)
            {
                throw new ArgumentException("StartDate cannot be greater than EndDate.");
            }

            if (!string.Equals(request.DataType, TraceDataType, StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(request.DataType, "Log", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(request.DataType, "Both", StringComparison.OrdinalIgnoreCase))
            {
                throw new ArgumentException("DataType must be Trace, Log, or Both.");
            }

            var restoreRequest = await _coldRestoreRepository.GetRequestByIdAsync(request.RequestId, ct);

            if (restoreRequest == null)
            {
                throw new KeyNotFoundException($"Cold restore request not found for RequestId {request.RequestId}");
            }

            if (!string.Equals(restoreRequest.TenantId, tenantId, StringComparison.OrdinalIgnoreCase))
            {
                throw new UnauthorizedAccessException("TenantId does not match the restore request.");
            }

            var normalizedStartDate = request.StartDate.Date;
            var normalizedEndDate = request.EndDate.Date;

            if (normalizedStartDate < restoreRequest.StartDate.Date ||
                normalizedEndDate > restoreRequest.EndDate.Date)
            {
                throw new InvalidOperationException("Requested download range is outside the restore request range.");
            }

            var dates = GenerateDateRange(normalizedStartDate, normalizedEndDate);

            var zipStream = new MemoryStream();
            var addedFiles = 0;

            using (var archive = new ZipArchive(zipStream, ZipArchiveMode.Create, leaveOpen: true))
            {
                foreach (var date in dates)
                {
                    if (string.Equals(request.DataType, TraceDataType, StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(request.DataType, "Both", StringComparison.OrdinalIgnoreCase))
                    {
                        var traceBlobPath = RestoreBlobPath.ForTraces(tenantId, date);

                        var added = await AddBlobToZipIfExistsAsync(
                            archive,
                            traceBlobPath,
                            $"traces/{Path.GetFileName(traceBlobPath)}",
                            ct);

                        if (added)
                        {
                            addedFiles++;
                        }
                    }

                    if (string.Equals(request.DataType, "Log", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(request.DataType, "Both", StringComparison.OrdinalIgnoreCase))
                    {
                        var logBlobPath = RestoreBlobPath.ForLogs(tenantId, date);

                        var added = await AddBlobToZipIfExistsAsync(
                            archive,
                            logBlobPath,
                            $"logs/{Path.GetFileName(logBlobPath)}",
                            ct);

                        if (added)
                        {
                            addedFiles++;
                        }
                    }
                }
            }

            if (addedFiles == 0)
            {
                zipStream.Dispose();
                throw new FileNotFoundException("No parquet files were found for the requested range.");
            }

            zipStream.Position = 0;

            return new ColdRestoreDownloadResult
            {
                Content = zipStream,
                ContentType = "application/zip",
                FileName = BuildDownloadFileName(request, tenantId, normalizedStartDate, normalizedEndDate)
            };
        }
        private async Task<bool> AddBlobToZipIfExistsAsync(ZipArchive archive, string blobPath, string entryName, CancellationToken ct)
        {
            try
            {
                await using var blobStream = await _blobStorage.OpenReadAsync(blobPath, ct);

                if (blobStream == null)
                {
                    return false;
                }

                var entry = archive.CreateEntry(entryName, CompressionLevel.Fastest);

                await using var entryStream = entry.Open();
                await blobStream.CopyToAsync(entryStream, ct);

                return true;
            }
            catch (FileNotFoundException ex)
            {
                _logger.LogWarning(ex, "Blob not found for zip download. BlobPath: {BlobPath}", blobPath);
                return false;
            }
            catch (RequestFailedException ex) when (ex.Status is 404 or 409)
            {
                _logger.LogWarning(ex, "Blob not found for zip download. BlobPath: {BlobPath}", blobPath);
                return false;
            }
        }
        private static string BuildDownloadFileName(DownloadColdRestoreParquetRequest request, string tenantId, DateTime startDate, DateTime endDate)
        {
            var dataType = request.DataType.ToLowerInvariant();

            return $"cold-restore-{dataType}-{tenantId}-{startDate:yyyyMMdd}-{endDate:yyyyMMdd}.zip";
        }
        public async Task<ColdRestoreDownloadResult> BuildJsonDownloadAsync(DownloadColdRestoreJsonRequest request, CancellationToken ct = default)
        {
            var tenantId = BlocksContext.GetContext()?.TenantId ?? string.Empty;

            _logger.LogInformation(
                "Start of BuildJsonDownloadAsync for RequestId {RequestId}, TenantId {TenantId}",
                request.RequestId,
                tenantId);

            if (string.IsNullOrWhiteSpace(request.RequestId))
            {
                throw new ArgumentException(RequestIdRequired);
            }

            if (!string.Equals(request.DataType, TraceDataType, StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(request.DataType, "Log", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(request.DataType, "Both", StringComparison.OrdinalIgnoreCase))
            {
                throw new ArgumentException("DataType must be Trace, Log, or Both.");
            }

            var restoreRequest = await _coldRestoreRepository.GetRequestByIdAsync(request.RequestId, ct);

            if (restoreRequest == null)
            {
                throw new KeyNotFoundException($"Cold restore request not found for RequestId {request.RequestId}");
            }

            if (!string.Equals(restoreRequest.TenantId, tenantId, StringComparison.OrdinalIgnoreCase))
            {
                throw new UnauthorizedAccessException("TenantId does not match the restore request.");
            }

            var jsonOptions = new JsonSerializerOptions
            {
                WriteIndented = true
            };

            var wantTrace =
                string.Equals(request.DataType, TraceDataType, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(request.DataType, "Both", StringComparison.OrdinalIgnoreCase);

            var wantLog =
                string.Equals(request.DataType, "Log", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(request.DataType, "Both", StringComparison.OrdinalIgnoreCase);

            if (wantTrace && !wantLog)
            {
                var traces = await _coldRestoreResultRepository.GetTraceResultsForDownloadAsync(
                    request.RequestId,
                    tenantId,
                    ct);

                var tracePayload = traces.Select(x => new
                {
                    x.RequestId,
                    x.TenantId,
                    x.SourceDate,
                    x.BlobPath,
                    x.Timestamp,
                    x.TraceId,
                    x.SpanId,
                    x.ParentSpanId,
                    x.ParentId,
                    x.Kind,
                    x.ActivitySourceName,
                    x.OperationName,
                    x.StartTime,
                    x.EndTime,
                    x.Duration,
                    Attributes = ParseAttributesJson(x.AttributesJson),
                    x.Status,
                    x.StatusDescription,
                    Baggage = ParseBaggageJson(x.Baggage),
                    x.ServiceName
                }).ToList();

                var bytes = JsonSerializer.SerializeToUtf8Bytes(tracePayload, jsonOptions);

                return new ColdRestoreDownloadResult
                {
                    Content = new MemoryStream(bytes),
                    ContentType = "application/json",
                    FileName = $"traces-{tenantId}-{request.RequestId}.json"
                };
            }

            if (!wantTrace && wantLog)
            {
                var logs = await _coldRestoreResultRepository.GetLogResultsForDownloadAsync(
                    request.RequestId,
                    tenantId,
                    ct);

                var logPayload = logs.Select(x => new
                {
                    x.RequestId,
                    x.TenantId,
                    x.SourceDate,
                    x.Timestamp,
                    x.TraceId,
                    x.SpanId,
                    x.Level,
                    x.Message,
                    x.ServiceName,
                    x.ActionName
                }).ToList();

                var bytes = JsonSerializer.SerializeToUtf8Bytes(logPayload, jsonOptions);

                return new ColdRestoreDownloadResult
                {
                    Content = new MemoryStream(bytes),
                    ContentType = "application/json",
                    FileName = $"logs-{tenantId}-{request.RequestId}.json"
                };
            }

            var traceRows = await _coldRestoreResultRepository.GetTraceResultsForDownloadAsync(
                request.RequestId,
                tenantId,
                ct);

            var logRows = await _coldRestoreResultRepository.GetLogResultsForDownloadAsync(
                request.RequestId,
                tenantId,
                ct);

            var zipStream = new MemoryStream();

            using (var archive = new ZipArchive(
                zipStream,
                ZipArchiveMode.Create,
                leaveOpen: true))
            {
                var tracesEntry = archive.CreateEntry(
                    "traces.json",
                    CompressionLevel.Fastest);

                await using (var entryStream = tracesEntry.Open())
                {
                    var tracePayload = traceRows.Select(x => new
                    {
                        x.RequestId,
                        x.TenantId,
                        x.SourceDate,
                        x.BlobPath,
                        x.Timestamp,
                        x.TraceId,
                        x.SpanId,
                        x.ParentSpanId,
                        x.ParentId,
                        x.Kind,
                        x.ActivitySourceName,
                        x.OperationName,
                        x.StartTime,
                        x.EndTime,
                        x.Duration,
                        Attributes = ParseAttributesJson(x.AttributesJson),
                        x.Status,
                        x.StatusDescription,
                        Baggage = ParseBaggageJson(x.Baggage),
                        x.ServiceName
                    }).ToList();

                    await JsonSerializer.SerializeAsync(
                        entryStream,
                        tracePayload,
                        jsonOptions,
                        ct);
                }

                var logsEntry = archive.CreateEntry(
                    "logs.json",
                    CompressionLevel.Fastest);

                await using (var entryStream = logsEntry.Open())
                {
                    var logPayload = logRows.Select(x => new
                    {
                        x.RequestId,
                        x.TenantId,
                        x.SourceDate,
                        x.Timestamp,
                        x.TraceId,
                        x.SpanId,
                        x.Level,
                        x.Message,
                        x.ServiceName,
                        x.ActionName
                    }).ToList();

                    await JsonSerializer.SerializeAsync(
                        entryStream,
                        logPayload,
                        jsonOptions,
                        ct);
                }
            }

            zipStream.Position = 0;

            return new ColdRestoreDownloadResult
            {
                Content = zipStream,
                ContentType = "application/zip",
                FileName = $"cold-restore-json-{tenantId}-{request.RequestId}.zip"
            };
        }
        private static Dictionary<string, object?> ParseAttributesJson(string? json)
        {
            if (string.IsNullOrWhiteSpace(json))
                return new Dictionary<string, object?>();

            try
            {
                using var doc = JsonDocument.Parse(json);
                return ConvertJsonElementToDictionary(doc.RootElement);
            }
            catch
            {
                return new Dictionary<string, object?>();
            }
        }

        private static Dictionary<string, object?> ConvertJsonElementToDictionary(JsonElement element)
        {
            var result = new Dictionary<string, object?>();

            foreach (var property in element.EnumerateObject())
            {
                result[property.Name] = ConvertJsonValue(property.Value);
            }

            return result;
        }

        private static object? ConvertJsonValue(JsonElement element)
        {
            switch (element.ValueKind)
            {
                case JsonValueKind.Object:
                    return ConvertJsonElementToDictionary(element);

                case JsonValueKind.Array:
                    return element.EnumerateArray().Select(ConvertJsonValue).ToList();

                case JsonValueKind.String:
                    return element.GetString();

                case JsonValueKind.Number:
                    if (element.TryGetInt64(out var l))
                    {
                        return l;
                    }

                    if (element.TryGetDouble(out var d))
                    {
                        return d;
                    }

                    return element.ToString();

                case JsonValueKind.True:
                    return true;

                case JsonValueKind.False:
                    return false;

                case JsonValueKind.Null:
                    return null;

                default:
                    return element.ToString();
            }
        }

        private static Dictionary<string, string> ParseBaggageJson(string? json)
        {
            if (string.IsNullOrWhiteSpace(json))
                return new Dictionary<string, string>();

            try
            {
                return JsonSerializer.Deserialize<Dictionary<string, string>>(json)
                       ?? new Dictionary<string, string>();
            }
            catch
            {
                return new Dictionary<string, string>();
            }
        }
        public async Task<GetLatestColdRestoreRequestIdResponse> GetLatestRequestIdAsync(GetLatestColdRestoreRequestIdRequest request, CancellationToken ct = default)
        {
            var tenantId = BlocksContext.GetContext()?.TenantId ?? string.Empty;

            _logger.LogInformation(
                "Start of GetLatestRequestIdAsync for TenantId {TenantId}",
                tenantId);

            var requestId = await _coldRestoreRepository.GetLatestRequestIdByProjectKeyAsync(tenantId, request.SourceType, ct);

            // A tenant that has never requested a restore is the normal first-visit state, so an
            // empty id is the answer rather than an error. Throwing made every fresh project's
            // first page load raise an exception, which the client could only absorb with a
            // catch-all that hid genuine failures along with it.
            if (string.IsNullOrWhiteSpace(requestId))
            {
                _logger.LogInformation(
                    "No {SourceType} restore request exists yet for TenantId {TenantId}",
                    request.SourceType, tenantId);
            }

            return new GetLatestColdRestoreRequestIdResponse
            {
                RequestId = requestId ?? string.Empty
            };
        }

    }
}
