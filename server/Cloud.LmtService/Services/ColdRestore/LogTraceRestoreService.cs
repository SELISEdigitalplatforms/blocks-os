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
        public LogTraceRestoreService(ILogger<LogTraceRestoreService> logger, ILogTraceRestoreRepository coldRestoreRepository, IMessageClient messageClient, ILogTraceRestoreResultRepository coldRestoreResultRepository,
    ILogTraceRestoreParquetReader coldRestoreParquetReader, IBlobStorage blobStorage, IConfiguration configuration,
    ILmtArchiveRestoreConfigurationRepository lmtArchiveRestoreConfigurationRepository, IMailDriverService mailDriverService,
    IHttpService httpService, ICryptoService cryptoService, ITenants tenants)
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
        }


        public async Task<StartColdRestoreResponse> StartRestoreAsync(StartColdRestoreRequest request)
        {
            var (normalizedStartDate, normalizedEndDate) = Constants.ValidateAndNormalize(request.StartDate, request.EndDate);

            var requestId = Guid.NewGuid().ToString("N");
            var now = DateTime.UtcNow;
            var tenantId = BlocksContext.GetContext()?.TenantId ?? string.Empty;
            var _retentionDays = await GetRetentionDaysAsync();
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
                UserEmail = request.UserMail

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
                _logger.LogError(ex.ToString(), "Failed to send email notification to {Email} with tier {Tier} and status {Status}.", email, tier, status);
                return false;
            }

        }
        private async Task<bool> NotifyEvent( string tier, string status, string? messageCoRelationId, string tenantId, CancellationToken ct = default)
        {
            try
            {
                var config = await GetNotificationConfig(ct);
                var requestData = new
                {
                    ConnectionId = messageCoRelationId,
                    Roles = new List<string> { },
                    UserIds = new List<string> { BlocksContext.GetContext()?.UserId ?? "" },
                    DenormalizedPayload = JsonSerializer.Serialize(new
                    {
                        title = "Log and Trace Restoration Status Update",
                        description = $"{tier} data restoration has been {status}."

                    }),
                    SaveDenormalizedPayloadAsAnObject = false,
                    ConfiguratoinName = config.NotificationConfigName,
                    ContentAvailable = true,
                    ResponseKey = "Log and Trace Restoration Status Update",
                    ResponseValue = $"{tier} data restoration has been {status}.",
                };

                var blocksKey = BlocksContext.GetContext()?.TenantId;
                var salt = _tenants.GetTenantByID(blocksKey)?.TenantSalt;
                var actulalSecret = _cryptoService.Hash(blocksKey, salt);

                var url = config.NotificationUrl;
                var headers = new Dictionary<string, string>
                {
                    { "x-blocks-key", blocksKey },
                    { "Secret", actulalSecret}
                };

                var (result1, _) = await _httpService.Post<NotificationResponse>(
                     requestData, url, "application/json", headers);

                _logger.LogInformation("Notification sent with result {Result} for tenant {TenantId} with tier {Tier} and status {Status}.", result1?.isSuccess, tenantId, tier, status);
                return result1 != null && result1.isSuccess;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex.ToString(), "Failed to send notification for tenant {TenantId} with tier {Tier} and status {Status}.", tenantId, tier, status);
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
            var coldDataSelectionDays = config.HotDataRetentionPeriodInDays + 1;
            return new GetHotDataUploadToBlobInDays { ColdDataSelectionDays = coldDataSelectionDays, ArchiveDataSelectionDays=coldDataSelectionDays+config.ColdToArchiveLifeCycleInDays };
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

            return new GetColdRestoreStatusResponse
            {
                RequestId = record.RequestId,
                Status = record.Status.ToString(),
                TotalFiles = record.TotalFiles,
                ProcessedFiles = record.ProcessedFiles,
                FailedFiles = record.FailedFiles
            };
        }
        public async Task<bool>CheckRequestStatus(string requestId, CancellationToken ct = default)
        {
            var existing = await _coldRestoreRepository.GetRequestByIdAsync(requestId, ct);
            if (existing?.Status is RestoreRequestStatus.Completed
                                 or RestoreRequestStatus.PartialSuccess
                                 or RestoreRequestStatus.InProgress)
            {
                _logger.LogWarning(
                    "Skipping duplicate ColdRestore delivery for RequestId {RequestId}, Status {Status}",
                    requestId, existing.Status);
                return false;
            }
            await _coldRestoreRepository.ResetStuckProcessingFilesAsync(requestId, ct);
            await _coldRestoreRepository.UpdateRequestStatusAsync(
                requestId,
                RestoreRequestStatus.InProgress,
                startedAt: DateTime.UtcNow,
                ct: ct);
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

            if (requestRecord.Status is RestoreRequestStatus.Completed
                                     or RestoreRequestStatus.PartialSuccess
                                     or RestoreRequestStatus.Failed)
                return;

            var allFiles = await _coldRestoreRepository.GetFileProgressByRequestIdAsync(requestId, ct);
            if (allFiles.Count == 0)
                return;

            var allTerminal = allFiles.All(x =>
                x.Status is RestoreFileProgressStatus.Completed
                         or RestoreFileProgressStatus.Failed
                         or RestoreFileProgressStatus.FileNotFound);

            if (!allTerminal)
                return;

            var totalFiles = allFiles.Count;
            var failedFiles = allFiles.Count(x =>
                x.Status is RestoreFileProgressStatus.Failed
                         or RestoreFileProgressStatus.FileNotFound);
            var traceRows = allFiles.Where(x => x.DataType == RestoreDataType.Trace).Sum(x => x.RowsRestored);
            var logRows = allFiles.Where(x => x.DataType == RestoreDataType.Log).Sum(x => x.RowsRestored);
            var processedFiles = allFiles.Count(x =>
                x.Status is RestoreFileProgressStatus.Completed
                         or RestoreFileProgressStatus.Failed
                         or RestoreFileProgressStatus.FileNotFound);

            await _coldRestoreRepository.UpdateRequestCountersAsync(
                requestId, processedFiles, failedFiles, traceRows, logRows, ct);

            RestoreRequestStatus finalStatus;
            if (failedFiles == 0)
                finalStatus = RestoreRequestStatus.Completed;
            else if (failedFiles == totalFiles)
                finalStatus = RestoreRequestStatus.Failed;
            else
                finalStatus = RestoreRequestStatus.PartialSuccess;

            await _coldRestoreRepository.UpdateRequestStatusAsync(
                requestId,
                finalStatus,
                completedAt: DateTime.UtcNow,
                ct: ct);
            if(string.IsNullOrEmpty(requestRecord.UserEmail))
                return;
             var result = await SendEmailAsync(requestRecord.UserEmail, requestRecord.SourceType.ToString(), finalStatus.ToString());
             _logger.LogInformation("Email sent status {Result} for RequestId {RequestId}", result, requestId);
            await NotifyEvent(requestRecord.SourceType.ToString(), finalStatus.ToString(), requestId, requestRecord.TenantId, ct);

        }
        private async Task PrepareRestorePlanAsync(ColdRestoreMessage message, CancellationToken ct = default)
        {
            var dates = GenerateDateRange(message.StartDate, message.EndDate);

            foreach (var date in dates)
            {
                ct.ThrowIfCancellationRequested();

                var traceExists = await _coldRestoreRepository.FileProgressExistsAsync(
                    message.RequestId, RestoreDataType.Trace, date, ct);

                if (!traceExists)
                {
                    var traceBlobPath = BuildTraceBlobPath(message.TenantId, date);
                    var exists = await _blobStorage.ExistsAsync(traceBlobPath, ct);
                    var _retentionDays = await GetRetentionDaysAsync();
                    if (exists)
                    {
                        var traceRecord = new LogTraceRestoreFileProgressRecord
                        {
                            RequestId = message.RequestId,
                            TenantId = message.TenantId,
                            DataType = RestoreDataType.Trace,
                            FileDate = date.Date,
                            BlobPath = traceBlobPath,
                            Status = RestoreFileProgressStatus.Pending,
                            Timestamp = DateTime.UtcNow,
                            ExpireAt = DateTime.UtcNow.AddDays(_retentionDays)
                        };
                        await _coldRestoreRepository.CreateFileProgressAsync(traceRecord, ct);
                    }
                    else
                    {
                        _logger.LogWarning("Blob not found {BlobPath}", traceBlobPath);
                    }
                }

                var logExists = await _coldRestoreRepository.FileProgressExistsAsync(
                    message.RequestId, RestoreDataType.Log, date, ct);

                if (!logExists)
                {
                    var logBlobPath = BuildLogBlobPath(message.TenantId, date, message.ServiceName);
                    var exists = await _blobStorage.ExistsAsync(logBlobPath, ct);
                    var _retentionDays = await GetRetentionDaysAsync();
                    if (exists)
                    {
                        var logRecord = new LogTraceRestoreFileProgressRecord
                        {
                            RequestId = message.RequestId,
                            TenantId = message.TenantId,
                            DataType = RestoreDataType.Log,
                            FileDate = date.Date,
                            BlobPath = logBlobPath,
                            Status = RestoreFileProgressStatus.Pending,
                            Timestamp = DateTime.UtcNow,
                            ExpireAt = DateTime.UtcNow.AddDays(_retentionDays)
                        };
                        await _coldRestoreRepository.CreateFileProgressAsync(logRecord, ct);
                    }
                    else
                    {
                        _logger.LogWarning("Blob not found {BlobPath}", logBlobPath);
                    }
                }
            }

            var allFiles = await _coldRestoreRepository.GetFileProgressByRequestIdAsync(message.RequestId, ct);
            await _coldRestoreRepository.UpdateTotalFilesAsync(message.RequestId, allFiles.Count, ct);
        }
        public async Task ExecutePendingFilesAsync(string requestId, CancellationToken ct = default)
        {
            var pendingFiles = await _coldRestoreRepository.GetPendingFileProgressByRequestIdAsync(requestId, ct);
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
                catch (RequestFailedException ex) when (ex.Status == 404)
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
        public async Task<int> RestoreTraceFileAsync(LogTraceRestoreFileProgressRecord file, CancellationToken ct = default)
        {
            var existingRows = await _coldRestoreResultRepository.GetTraceResultsByBlobPathAsync(file.RequestId, file.TenantId, file.BlobPath, ct);
            if (existingRows.Count > 0)
            {
                var sourceRows = existingRows
                    .GroupBy(x => x.RequestId)
                    .First()
                    .ToList();

                await _coldRestoreResultRepository.DeleteTraceResultsByRequestAndDateAsync(file.RequestId, file.FileDate, ct);
                await _coldRestoreResultRepository.CloneTraceResultsForRequestAsync(
                    newRequestId: file.RequestId,
                    tenantId: file.TenantId,
                    sourceDate: file.FileDate,
                    blobPath: file.BlobPath,
                    existingRows: sourceRows,
                    ct: ct);
                return sourceRows.Count;
            }

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
            var existingRows = await _coldRestoreResultRepository.GetLogResultsByBlobPathAsync(file.RequestId, file.TenantId, file.BlobPath, ct);
            if (existingRows.Count > 0)
            {
                var sourceRows = existingRows
                    .GroupBy(x => x.RequestId)
                    .First()
                    .ToList();

                await _coldRestoreResultRepository.DeleteLogResultsByRequestAndDateAsync(file.RequestId, file.FileDate, ct);
                await _coldRestoreResultRepository.CloneLogResultsForRequestAsync(
                    newRequestId: file.RequestId,
                    tenantId: file.TenantId,
                    sourceDate: file.FileDate,
                    blobPath: file.BlobPath,
                    existingRows: sourceRows,
                    ct: ct);
                return sourceRows.Count;
            }

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
                        var traceBlobPath = BuildTraceBlobPath(tenantId, date);

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
                        var logBlobPath = BuildLogBlobPath(tenantId, date, null);

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
            catch (RequestFailedException ex) when (ex.Status == 404)
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

            if (string.IsNullOrWhiteSpace(requestId))
            {
                throw new KeyNotFoundException(
                    $"No cold restore request found for TenantId {tenantId}");
            }

            return new GetLatestColdRestoreRequestIdResponse
            {
                RequestId = requestId
            };
        }

    }
}
