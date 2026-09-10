using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Blocks.MailDriver;
using Cloud.LmtService.Models.ColdRestore;
using Cloud.LmtService.Models.Shared;
using Cloud.LmtService.Repositories.ColdRestore;
using Cloud.LmtService.Repositories.Shared;
using Cloud.LmtService.Services.ArchiveAndDelete;
using Cloud.LmtService.Services.ColdRestore;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;

namespace XUnitTest.Services
{
    public class LogTraceRestoreServiceTests
    {
        private readonly Mock<ILogger<LogTraceRestoreService>> _logger = new();
        private readonly Mock<ILogTraceRestoreRepository> _coldRestoreRepository = new();
        private readonly Mock<IMessageClient> _messageClient = new();
        private readonly Mock<ILogTraceRestoreResultRepository> _coldRestoreResultRepository = new();
        private readonly Mock<ILogTraceRestoreParquetReader> _coldRestoreParquetReader = new();
        private readonly Mock<IBlobStorage> _blobStorage = new();
        private readonly Mock<IConfiguration> _configuration = new();
        private readonly Mock<ILmtArchiveRestoreConfigurationRepository> _configRepository = new();
        private readonly Mock<IMailDriverService> _mailDriverService = new();
        private readonly Mock<IHttpService> _httpService = new();
        private readonly Mock<ICryptoService> _cryptoService = new();
        private readonly Mock<ITenants> _tenants = new();
        private readonly Mock<IArchiveRestoreRepository> _archiveRestoreRepository = new();

        private LogTraceRestoreService Service() => new(
            _logger.Object,
            _coldRestoreRepository.Object,
            _messageClient.Object,
            _coldRestoreResultRepository.Object,
            _coldRestoreParquetReader.Object,
            _blobStorage.Object,
            _configuration.Object,
            _configRepository.Object,
            _mailDriverService.Object,
            _httpService.Object,
            _cryptoService.Object,
            _tenants.Object,
            _archiveRestoreRepository.Object);

        [Fact]
        public async Task GetStatusAsync_MissingRequestId_Throws()
        {
            await Assert.ThrowsAsync<ArgumentException>(() =>
                Service().GetStatusAsync(new GetColdRestoreStatusRequest { RequestId = "", SourceType = "Cold" }));
        }

        [Fact]
        public async Task GetStatusAsync_RequestNotFound_ThrowsKeyNotFound()
        {
            _coldRestoreRepository
                .Setup(r => r.GetRequestStatusAsync("req-1", "Cold", It.IsAny<CancellationToken>()))
                .ReturnsAsync((RestoreRequestRecord?)null);

            await Assert.ThrowsAsync<KeyNotFoundException>(() =>
                Service().GetStatusAsync(new GetColdRestoreStatusRequest { RequestId = "req-1", SourceType = "Cold" }));
        }

        [Fact]
        public async Task GetStatusAsync_Found_ReturnsMappedResponse()
        {
            var record = new RestoreRequestRecord
            {
                RequestId = "req-1",
                Status = RestoreRequestStatus.Completed,
                TotalFiles = 10,
                ProcessedFiles = 10,
                FailedFiles = 0
            };

            _coldRestoreRepository
                .Setup(r => r.GetRequestStatusAsync("req-1", "Cold", It.IsAny<CancellationToken>()))
                .ReturnsAsync(record);

            var response = await Service().GetStatusAsync(new GetColdRestoreStatusRequest { RequestId = "req-1", SourceType = "Cold" });

            response.RequestId.Should().Be("req-1");
            response.Status.Should().Be(RestoreRequestStatus.Completed.ToString());
            response.TotalFiles.Should().Be(10);
            response.ProcessedFiles.Should().Be(10);
            response.FailedFiles.Should().Be(0);
        }

        [Fact]
        public async Task CheckRequestStatus_ReturnsFalse_WhenAnotherDeliveryAlreadyClaimedTheRequest()
        {
            _coldRestoreRepository
                .Setup(r => r.TryBeginProcessingAsync("req-1", It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);

            var result = await Service().CheckRequestStatus("req-1");

            result.Should().BeFalse();
            _coldRestoreRepository.Verify(
                r => r.ResetStuckProcessingFilesAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()),
                Times.Never);
        }

        [Fact]
        public async Task CheckRequestStatus_ClaimsTheRequestAndClearsStuckFiles_WhenItWinsTheTransition()
        {
            _coldRestoreRepository
                .Setup(r => r.TryBeginProcessingAsync("req-1", It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            var result = await Service().CheckRequestStatus("req-1");

            result.Should().BeTrue();
            _coldRestoreRepository.Verify(r => r.ResetStuckProcessingFilesAsync("req-1", It.IsAny<CancellationToken>()), Times.Once);
        }

        /// <summary>
        /// A range the backup never covered plans zero files. That has to reach a terminal status:
        /// leaving it InProgress strands the request forever, because CheckRequestStatus then
        /// refuses to reprocess it and the UI keeps showing a blocking progress overlay.
        /// </summary>
        [Fact]
        public async Task UpdateFileRequestStatus_CompletesTheRequest_WhenTheRangePlannedNoFiles()
        {
            GivenRequest(new RestoreRequestRecord
            {
                RequestId = "req-1",
                TenantId = "tenant-a",
                Status = RestoreRequestStatus.InProgress
            });

            _coldRestoreRepository
                .Setup(r => r.GetFileProgressByRequestIdAsync("req-1", It.IsAny<CancellationToken>()))
                .ReturnsAsync([]);

            GivenCompletionTransitionWon();

            await Service().UpdateFileRequestStatus("req-1");

            _coldRestoreRepository.Verify(
                r => r.TryCompleteRequestAsync("req-1", RestoreRequestStatus.Completed, It.IsAny<DateTime>(), It.IsAny<CancellationToken>()),
                Times.Once);
        }

        /// <summary>
        /// Three hydration workers can observe the last file finishing at the same moment. Only the
        /// one that actually flips the status may notify, or the user gets an email per worker.
        /// </summary>
        [Fact]
        public async Task UpdateFileRequestStatus_SendsNoNotification_WhenItLosesTheCompletionRace()
        {
            GivenRequest(new RestoreRequestRecord
            {
                RequestId = "req-1",
                TenantId = "tenant-a",
                Status = RestoreRequestStatus.InProgress,
                UserEmail = "someone@example.com"
            });

            GivenAllFilesCompleted();

            _coldRestoreRepository
                .Setup(r => r.TryCompleteRequestAsync("req-1", It.IsAny<RestoreRequestStatus>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);

            await Service().UpdateFileRequestStatus("req-1");

            _mailDriverService.Verify(m => m.SendAsync(It.IsAny<SendMail>()), Times.Never);
        }

        /// <summary>
        /// The in-app notification must not be collateral damage of a missing email address — the
        /// UI relies on it to drop its progress overlay.
        /// </summary>
        [Fact]
        public async Task UpdateFileRequestStatus_StillNotifiesInApp_WhenNoEmailWasCaptured()
        {
            GivenRequest(new RestoreRequestRecord
            {
                RequestId = "req-1",
                TenantId = "tenant-a",
                Status = RestoreRequestStatus.InProgress,
                UserEmail = null
            });

            GivenAllFilesCompleted();
            GivenCompletionTransitionWon();
            GivenNotificationEndpointAccepts();

            await Service().UpdateFileRequestStatus("req-1");

            _httpService.Verify(h => h.Post<NotificationResponse>(
                It.IsAny<object>(),
                "https://notify.example.com/send",
                It.IsAny<string>(),
                It.IsAny<Dictionary<string, string>>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<int?>()), Times.Once);
        }

        /// <summary>
        /// The worker has no ambient request context, so the tenant used to sign the notification
        /// has to come from the persisted request rather than BlocksContext.
        /// </summary>
        [Fact]
        public async Task UpdateFileRequestStatus_SignsTheNotificationWithTheRequestsTenant()
        {
            GivenRequest(new RestoreRequestRecord
            {
                RequestId = "req-1",
                TenantId = "tenant-from-record",
                Status = RestoreRequestStatus.InProgress
            });

            GivenAllFilesCompleted();
            GivenCompletionTransitionWon();
            GivenNotificationEndpointAccepts();

            await Service().UpdateFileRequestStatus("req-1");

            _httpService.Verify(h => h.Post<NotificationResponse>(
                It.IsAny<object>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.Is<Dictionary<string, string>>(headers => headers["x-blocks-key"] == "tenant-from-record"),
                It.IsAny<CancellationToken>(),
                It.IsAny<int?>()), Times.Once);
        }

        /// <summary>
        /// The cold window can overlap blobs the lifecycle policy has already moved to Archive.
        /// Reading one fails with HTTP 409, so planning has to reject it up front with a message
        /// that tells the user to use archive restore instead of surfacing a raw Azure error.
        /// </summary>
        [Fact]
        public async Task ProcessRestoreAsync_FailsArchiveTierFilesWithAnActionableMessage()
        {
            var day = new DateTime(2026, 3, 17, 0, 0, 0, DateTimeKind.Utc);

            _coldRestoreRepository
                .Setup(r => r.TryBeginProcessingAsync("req-1", It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            _coldRestoreRepository
                .Setup(r => r.FileProgressExistsAsync("req-1", It.IsAny<RestoreDataType>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);

            _configRepository
                .Setup(r => r.GetLmtArchiveRestoreConfigurationsAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(new LmtArchiveRestoreConfigurations { RetentionDay = 7 });

            _blobStorage
                .Setup(b => b.GetTierStateAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new BlobTierState(Exists: true, IsArchived: true));

            var created = new List<LogTraceRestoreFileProgressRecord>();
            _coldRestoreRepository
                .Setup(r => r.CreateFileProgressAsync(It.IsAny<LogTraceRestoreFileProgressRecord>(), It.IsAny<CancellationToken>()))
                .Callback<LogTraceRestoreFileProgressRecord, CancellationToken>((record, _) => created.Add(record))
                .Returns(Task.CompletedTask);

            _coldRestoreRepository
                .Setup(r => r.GetFileProgressByRequestIdAsync("req-1", It.IsAny<CancellationToken>()))
                .ReturnsAsync(() => created);

            _coldRestoreRepository
                .Setup(r => r.GetPendingFileProgressByRequestIdAsync("req-1", It.IsAny<CancellationToken>()))
                .ReturnsAsync([]);

            GivenRequest(new RestoreRequestRecord
            {
                RequestId = "req-1",
                TenantId = "tenant-a",
                Status = RestoreRequestStatus.InProgress
            });

            await Service().ProcessRestoreAsync(new ColdRestoreMessage
            {
                RequestId = "req-1",
                TenantId = "tenant-a",
                StartDate = day,
                EndDate = day
            });

            created.Should().HaveCount(2);
            created.Should().OnlyContain(record => record.Status == RestoreFileProgressStatus.Failed);
            created.Should().OnlyContain(record => record.ErrorMessage!.Contains("Archive tier", StringComparison.OrdinalIgnoreCase));

            // Nothing may be queued for reading: the read would come back 409, not data.
            _blobStorage.Verify(b => b.OpenReadAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task ProcessRestoreAsync_PlansReadableFilesAsPending()
        {
            var day = new DateTime(2026, 3, 17, 0, 0, 0, DateTimeKind.Utc);

            _coldRestoreRepository
                .Setup(r => r.TryBeginProcessingAsync("req-1", It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            _coldRestoreRepository
                .Setup(r => r.FileProgressExistsAsync("req-1", It.IsAny<RestoreDataType>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);

            _configRepository
                .Setup(r => r.GetLmtArchiveRestoreConfigurationsAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(new LmtArchiveRestoreConfigurations { RetentionDay = 7 });

            _blobStorage
                .Setup(b => b.GetTierStateAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new BlobTierState(Exists: true, IsArchived: false));

            var created = new List<LogTraceRestoreFileProgressRecord>();
            _coldRestoreRepository
                .Setup(r => r.CreateFileProgressAsync(It.IsAny<LogTraceRestoreFileProgressRecord>(), It.IsAny<CancellationToken>()))
                .Callback<LogTraceRestoreFileProgressRecord, CancellationToken>((record, _) => created.Add(record))
                .Returns(Task.CompletedTask);

            _coldRestoreRepository
                .Setup(r => r.GetFileProgressByRequestIdAsync("req-1", It.IsAny<CancellationToken>()))
                .ReturnsAsync(() => created);

            _coldRestoreRepository
                .Setup(r => r.GetPendingFileProgressByRequestIdAsync("req-1", It.IsAny<CancellationToken>()))
                .ReturnsAsync([]);

            GivenRequest(new RestoreRequestRecord
            {
                RequestId = "req-1",
                TenantId = "tenant-a",
                Status = RestoreRequestStatus.InProgress
            });

            await Service().ProcessRestoreAsync(new ColdRestoreMessage
            {
                RequestId = "req-1",
                TenantId = "tenant-a",
                StartDate = day,
                EndDate = day
            });

            created.Should().HaveCount(2);
            created.Should().OnlyContain(record => record.Status == RestoreFileProgressStatus.Pending);
        }

        private void GivenRequest(RestoreRequestRecord record) =>
            _coldRestoreRepository
                .Setup(r => r.GetRequestByIdAsync(record.RequestId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(record);

        private void GivenAllFilesCompleted() =>
            _coldRestoreRepository
                .Setup(r => r.GetFileProgressByRequestIdAsync("req-1", It.IsAny<CancellationToken>()))
                .ReturnsAsync([
                    new LogTraceRestoreFileProgressRecord
                    {
                        RequestId = "req-1",
                        DataType = RestoreDataType.Log,
                        Status = RestoreFileProgressStatus.Completed,
                        RowsRestored = 10
                    }
                ]);

        private void GivenCompletionTransitionWon() =>
            _coldRestoreRepository
                .Setup(r => r.TryCompleteRequestAsync("req-1", It.IsAny<RestoreRequestStatus>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

        /// <summary>
        /// The notification API rejects a payload without ConfigurationName with HTTP 400, and the
        /// send is fire-and-forget, so the only visible symptom was a logged null result. The field
        /// was being set on an anonymous object under a misspelled name — which the compiler
        /// accepts silently, since any name is a valid property on an anonymous type.
        /// </summary>
        [Fact]
        public async Task UpdateFileRequestStatus_SendsTheConfigurationNameTheNotificationApiRequires()
        {
            GivenRequest(new RestoreRequestRecord
            {
                RequestId = "req-1",
                TenantId = "tenant-a",
                Status = RestoreRequestStatus.InProgress
            });

            GivenAllFilesCompleted();
            GivenCompletionTransitionWon();
            GivenNotificationEndpointAccepts();

            var posted = CaptureNotificationPayload();

            await Service().UpdateFileRequestStatus("req-1");

            NotificationField(posted, "ConfigurationName").Should().Be("log_trace_restore");
        }

        /// <summary>Reads a field off the posted payload the way the receiving API binds it: by name,
        /// case-insensitively. A misspelling therefore reads as absent rather than as a different name.</summary>
        private static string? NotificationField(IReadOnlyList<object> posted, string name)
        {
            posted.Should().HaveCount(1, "exactly one notification should have been posted");

            return posted[0].GetType().GetProperties()
                .FirstOrDefault(property => string.Equals(property.Name, name, StringComparison.OrdinalIgnoreCase))
                ?.GetValue(posted[0]) as string;
        }

        private List<object> CaptureNotificationPayload()
        {
            var posted = new List<object>();

            _httpService
                .Setup(h => h.Post<NotificationResponse>(
                    It.IsAny<object>(),
                    It.IsAny<string>(),
                    It.IsAny<string>(),
                    It.IsAny<Dictionary<string, string>>(),
                    It.IsAny<CancellationToken>(),
                    It.IsAny<int?>()))
                .Callback<object, string, string, Dictionary<string, string>, CancellationToken, int?>(
                    (payload, _, _, _, _, _) => posted.Add(payload))
                .ReturnsAsync((new NotificationResponse { isSuccess = true }, "ok"));

            return posted;
        }

        /// <summary>
        /// A tenant that has never asked for a restore is the normal first-visit state, not a
        /// failure. Throwing here made the overview page's first load raise an exception on every
        /// fresh project, which the client could only absorb with a catch-all that hid real errors
        /// too.
        /// </summary>
        [Fact]
        public async Task GetLatestRequestIdAsync_ReturnsNoRequestId_WhenTheTenantHasNeverRequestedOne()
        {
            _coldRestoreRepository
                .Setup(r => r.GetLatestRequestIdByProjectKeyAsync(It.IsAny<string>(), "Cold", It.IsAny<CancellationToken>()))
                .ReturnsAsync((string?)null);

            var response = await Service().GetLatestRequestIdAsync(
                new GetLatestColdRestoreRequestIdRequest { SourceType = "Cold" });

            response.RequestId.Should().BeEmpty();
        }

        [Fact]
        public async Task GetLatestRequestIdAsync_ReturnsTheRequestId_WhenOneExists()
        {
            _coldRestoreRepository
                .Setup(r => r.GetLatestRequestIdByProjectKeyAsync(It.IsAny<string>(), "Cold", It.IsAny<CancellationToken>()))
                .ReturnsAsync("req-7");

            var response = await Service().GetLatestRequestIdAsync(
                new GetLatestColdRestoreRequestIdRequest { SourceType = "Cold" });

            response.RequestId.Should().Be("req-7");
        }

        private void GivenNotificationEndpointAccepts()
        {
            _configRepository
                .Setup(r => r.GetLmtArchiveRestoreConfigurationsAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(new LmtArchiveRestoreConfigurations
                {
                    RetentionDay = 7,
                    NotificationConfig = new NotificationConfig
                    {
                        NotificationUrl = "https://notify.example.com/send",
                        NotificationConfigName = "log_trace_restore"
                    }
                });

            // GetTenantByID is left returning null: the salt lookup is null-conditional in
            // production and Tenant has required members that add nothing to these assertions.
            _cryptoService.Setup(c => c.Hash(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool>())).Returns("hashed");

            _httpService
                .Setup(h => h.Post<NotificationResponse>(
                    It.IsAny<object>(),
                    It.IsAny<string>(),
                    It.IsAny<string>(),
                    It.IsAny<Dictionary<string, string>>(),
                    It.IsAny<CancellationToken>(),
                    It.IsAny<int?>()))
                .ReturnsAsync((new NotificationResponse { isSuccess = true }, "ok"));
        }

        [Fact]
        public async Task GetHotDataRetentionPeriodInDays_ComputesColdAndArchiveWindows()
        {
            _configRepository
                .Setup(r => r.GetLmtArchiveRestoreConfigurationsAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(new LmtArchiveRestoreConfigurations
                {
                    HotDataRetentionPeriodInDays = 30,
                    ColdToArchiveLifeCycleInDays = 90,
                    RetentionDay = 7
                });

            var result = await Service().GetHotDataRetentionPeriodInDays();

            result.ColdDataSelectionDays.Should().Be(31);
            result.ArchiveDataSelectionDays.Should().Be(121);
        }

        /// <summary>
        /// The client used to derive the picker bounds itself from the day counts, computing
        /// "today" in the browser's local zone while the API computed it in UTC. The two disagree
        /// for part of every day, so the API now states the selectable dates outright.
        /// </summary>
        [Fact]
        public async Task GetHotDataRetentionPeriodInDays_StatesTheSelectableDates()
        {
            GivenConfig(hotRetentionDays: 1, coldToArchiveDays: 3, maxRestoreRangeDays: 7);

            var result = await Service().GetHotDataRetentionPeriodInDays();
            var today = DateTime.UtcNow.Date;

            result.ColdEarliestDate.Should().Be(today.AddDays(-5).ToString("yyyy-MM-dd"));
            result.ColdLatestDate.Should().Be(today.AddDays(-2).ToString("yyyy-MM-dd"));
            result.ArchiveLatestDate.Should().Be(today.AddDays(-6).ToString("yyyy-MM-dd"));
        }

        /// <summary>
        /// The dialog advertised a flat "Max 7 Days". With ColdToArchiveLifeCycleInDays = 3 the
        /// cold window is only four days wide, so seven was unreachable; the limit has to come
        /// from the same config the bounds come from.
        /// </summary>
        [Fact]
        public async Task GetHotDataRetentionPeriodInDays_NarrowsTheColdSpanToTheWindowWidth()
        {
            GivenConfig(hotRetentionDays: 1, coldToArchiveDays: 3, maxRestoreRangeDays: 7);

            var result = await Service().GetHotDataRetentionPeriodInDays();

            result.ColdMaxRangeDays.Should().Be(4);
            result.ArchiveMaxRangeDays.Should().Be(7);
        }

        /// <summary>
        /// Deployed configuration documents predate MaxRestoreRangeInDays, and Mongo deserializes
        /// a missing int to 0. Taken literally that would reject every request as too wide, so an
        /// absent value has to fall back to the previous hard-coded seven days.
        /// </summary>
        [Fact]
        public async Task GetHotDataRetentionPeriodInDays_FallsBackToSevenDaysWhenTheMaxRangeIsUnset()
        {
            _configRepository
                .Setup(r => r.GetLmtArchiveRestoreConfigurationsAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(new LmtArchiveRestoreConfigurations
                {
                    HotDataRetentionPeriodInDays = 30,
                    ColdToArchiveLifeCycleInDays = 90,
                    RetentionDay = 1
                });

            var result = await Service().GetHotDataRetentionPeriodInDays();

            result.ColdMaxRangeDays.Should().Be(7);
            result.ArchiveMaxRangeDays.Should().Be(7);
        }

        [Fact]
        public async Task StartRestoreAsync_RejectsARangeWiderThanTheConfiguredMaximum()
        {
            // Window is 91 days wide here, so the range below sits comfortably inside the tier
            // bounds; only the configured span limit can reject it. The limit is deliberately not
            // 7 — the replaced code hard-coded 7, and a 7 here would pass either way.
            GivenConfig(hotRetentionDays: 30, coldToArchiveDays: 90, maxRestoreRangeDays: 3);
            var today = DateTime.UtcNow.Date;

            var act = () => Service().StartRestoreAsync(new StartColdRestoreRequest
            {
                ServiceName = "svc",
                StartDate = today.AddDays(-50),
                EndDate = today.AddDays(-46)
            });

            (await act.Should().ThrowAsync<ArgumentException>())
                .WithMessage("*3 days*");
        }

        [Fact]
        public async Task StartRestoreAsync_AcceptsARangeExactlyAtTheConfiguredMaximum()
        {
            // Guards the boundary: an off-by-one in the span check would reject this.
            GivenConfig(hotRetentionDays: 30, coldToArchiveDays: 90, maxRestoreRangeDays: 3);
            var today = DateTime.UtcNow.Date;

            var response = await Service().StartRestoreAsync(new StartColdRestoreRequest
            {
                ServiceName = "svc",
                StartDate = today.AddDays(-50),
                EndDate = today.AddDays(-48)
            });

            response.RequestId.Should().NotBeNullOrWhiteSpace();
        }

        private void GivenConfig(int hotRetentionDays, int coldToArchiveDays, int maxRestoreRangeDays) =>
            _configRepository
                .Setup(r => r.GetLmtArchiveRestoreConfigurationsAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(new LmtArchiveRestoreConfigurations
                {
                    HotDataRetentionPeriodInDays = hotRetentionDays,
                    ColdToArchiveLifeCycleInDays = coldToArchiveDays,
                    MaxRestoreRangeInDays = maxRestoreRangeDays,
                    RetentionDay = 1
                });

        /// <summary>
        /// A run that dies part way through a file leaves some rows behind. The retry must clear
        /// those and read the blob again to restore the whole day; an earlier version reused the
        /// partial rows and reported a truncated day as a complete one, which is silent data loss.
        /// </summary>
        [Fact]
        public async Task RestoreLogFileAsync_ClearsStaleRowsThenRestoresEveryRowFromTheBlob()
        {
            var file = LogFileProgress();

            _configRepository
                .Setup(r => r.GetLmtArchiveRestoreConfigurationsAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(new LmtArchiveRestoreConfigurations { RetentionDay = 7 });

            _blobStorage
                .Setup(b => b.OpenReadAsync(file.BlobPath, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new MemoryStream([1, 2, 3]));

            _coldRestoreParquetReader
                .Setup(r => r.ReadLogsAsync(It.IsAny<Stream>(), It.IsAny<CancellationToken>()))
                .Returns(AsyncRows(LogRows(5)));

            var inserted = new List<RestoreLogResultRecord>();
            _coldRestoreResultRepository
                .Setup(r => r.InsertLogResultsAsync(It.IsAny<List<RestoreLogResultRecord>>(), It.IsAny<CancellationToken>()))
                .Callback<List<RestoreLogResultRecord>, CancellationToken>((rows, _) => inserted.AddRange(rows))
                .Returns(Task.CompletedTask);

            var restored = await Service().RestoreLogFileAsync(file);

            restored.Should().Be(5);
            inserted.Should().HaveCount(5);
            inserted.Select(r => r.Message).Should().BeEquivalentTo(["row-0", "row-1", "row-2", "row-3", "row-4"]);
            _coldRestoreResultRepository.Verify(
                r => r.DeleteLogResultsByRequestAndDateAsync(file.RequestId, file.FileDate, It.IsAny<CancellationToken>()),
                Times.Once);
        }

        [Fact]
        public async Task RestoreTraceFileAsync_ClearsStaleRowsThenRestoresEveryRowFromTheBlob()
        {
            var file = TraceFileProgress();

            _configRepository
                .Setup(r => r.GetLmtArchiveRestoreConfigurationsAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(new LmtArchiveRestoreConfigurations { RetentionDay = 7 });

            _blobStorage
                .Setup(b => b.OpenReadAsync(file.BlobPath, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new MemoryStream([1, 2, 3]));

            _coldRestoreParquetReader
                .Setup(r => r.ReadTracesAsync(It.IsAny<Stream>(), It.IsAny<CancellationToken>()))
                .Returns(AsyncRows(TraceRows(4)));

            var inserted = new List<RestoreTraceResultRecord>();
            _coldRestoreResultRepository
                .Setup(r => r.InsertTraceResultsAsync(It.IsAny<List<RestoreTraceResultRecord>>(), It.IsAny<CancellationToken>()))
                .Callback<List<RestoreTraceResultRecord>, CancellationToken>((rows, _) => inserted.AddRange(rows))
                .Returns(Task.CompletedTask);

            var restored = await Service().RestoreTraceFileAsync(file);

            restored.Should().Be(4);
            inserted.Should().HaveCount(4);
            inserted.Select(r => r.TraceId).Should().BeEquivalentTo(["trace-0", "trace-1", "trace-2", "trace-3"]);
            _coldRestoreResultRepository.Verify(
                r => r.DeleteTraceResultsByRequestAndDateAsync(file.RequestId, file.FileDate, It.IsAny<CancellationToken>()),
                Times.Once);
        }

        private static LogTraceRestoreFileProgressRecord LogFileProgress() => new()
        {
            RequestId = "req-1",
            TenantId = "tenant-a",
            DataType = RestoreDataType.Log,
            FileDate = new DateTime(2026, 3, 17, 0, 0, 0, DateTimeKind.Utc),
            BlobPath = "Tenants/tenant-a/logs/logs_tenant-a_20260317_20260318.parquet"
        };

        private static LogTraceRestoreFileProgressRecord TraceFileProgress() => new()
        {
            RequestId = "req-1",
            TenantId = "tenant-a",
            DataType = RestoreDataType.Trace,
            FileDate = new DateTime(2026, 3, 17, 0, 0, 0, DateTimeKind.Utc),
            BlobPath = "Tenants/tenant-a/traces/traces_tenant-a_20260317_20260318.parquet"
        };

        private static List<RestoreLogRow> LogRows(int count) =>
            [.. Enumerable.Range(0, count).Select(i => new RestoreLogRow { Message = $"row-{i}", Timestamp = DateTime.UtcNow })];

        private static List<RestoreTraceRow> TraceRows(int count) =>
            [.. Enumerable.Range(0, count).Select(i => new RestoreTraceRow { TraceId = $"trace-{i}", Timestamp = DateTime.UtcNow })];

        private static async IAsyncEnumerable<T> AsyncRows<T>(IEnumerable<T> rows)
        {
            foreach (var row in rows)
            {
                yield return row;
            }

            await Task.CompletedTask;
        }
    }
}
