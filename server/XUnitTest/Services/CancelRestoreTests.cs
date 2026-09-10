using System;
using System.Collections.Generic;
using System.IO;
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
    /// <summary>
    /// Cancellation of a cold or archive restore. Both tiers share the request collection, so one
    /// operation serves both. Cancelling purges the partial results, which is what lets the user
    /// immediately request the same range again.
    /// </summary>
    public class CancelRestoreTests : IDisposable
    {
        private const string Tenant = "tenant-a";

        private readonly Mock<ILogger<LogTraceRestoreService>> _logger = new();
        private readonly Mock<ILogTraceRestoreRepository> _restoreRepository = new();
        private readonly Mock<IMessageClient> _messageClient = new();
        private readonly Mock<ILogTraceRestoreResultRepository> _resultRepository = new();
        private readonly Mock<ILogTraceRestoreParquetReader> _parquetReader = new();
        private readonly Mock<IBlobStorage> _blobStorage = new();
        private readonly Mock<IConfiguration> _configuration = new();
        private readonly Mock<ILmtArchiveRestoreConfigurationRepository> _configRepository = new();
        private readonly Mock<IMailDriverService> _mailDriverService = new();
        private readonly Mock<IHttpService> _httpService = new();
        private readonly Mock<ICryptoService> _cryptoService = new();
        private readonly Mock<ITenants> _tenants = new();
        private readonly Mock<IArchiveRestoreRepository> _archiveRepository = new();
        private readonly Mock<IRestoreUserRepository> _userRepository = new();

        public CancelRestoreTests() =>
            BlocksContext.SetContext(BlocksContext.Create(
                tenantId: Tenant,
                roles: [],
                userId: "user-1",
                isAuthenticated: true,
                requestUri: "/",
                organizationId: "org-1",
                expireOn: DateTime.UtcNow.AddHours(1),
                email: "user@example.com",
                permissions: [],
                userName: "user",
                phoneNumber: null,
                displayName: "User",
                oauthToken: null,
                originalTenantId: Tenant));

        public void Dispose()
        {
            BlocksContext.ClearContext();
            GC.SuppressFinalize(this);
        }

        private LogTraceRestoreService Service() => new(
            _logger.Object,
            _restoreRepository.Object,
            _messageClient.Object,
            _resultRepository.Object,
            _parquetReader.Object,
            _blobStorage.Object,
            _configuration.Object,
            _configRepository.Object,
            _mailDriverService.Object,
            _httpService.Object,
            _cryptoService.Object,
            _tenants.Object,
            _archiveRepository.Object,
            _userRepository.Object);

        [Fact]
        public async Task CancelRestoreAsync_StopsOutstandingWorkAndPurgesPartialResults()
        {
            GivenRequest(RestoreRequestStatus.InProgress);

            _restoreRepository
                .Setup(r => r.TryCancelRequestAsync("req-1", It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            var response = await Service().CancelRestoreAsync(new CancelRestoreRequest { RequestId = "req-1" });

            response.Cancelled.Should().BeTrue();
            response.Status.Should().Be(nameof(RestoreRequestStatus.Cancelled));

            _restoreRepository.Verify(r => r.CancelOutstandingFileProgressAsync("req-1", It.IsAny<CancellationToken>()), Times.Once);
            _archiveRepository.Verify(r => r.CancelHydrationJobsForRequestAsync("req-1", It.IsAny<CancellationToken>()), Times.Once);
            _resultRepository.Verify(r => r.DropResultCollectionsAsync("req-1", It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task CancelRestoreAsync_ReportsNothingToCancel_WhenTheRestoreAlreadyCompleted()
        {
            GivenRequest(RestoreRequestStatus.Completed);

            var response = await Service().CancelRestoreAsync(new CancelRestoreRequest { RequestId = "req-1" });

            response.Cancelled.Should().BeFalse();
            response.Status.Should().Be(nameof(RestoreRequestStatus.Completed));

            // A finished restore's data must survive a stray cancel click.
            _resultRepository.Verify(r => r.DropResultCollectionsAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
            _restoreRepository.Verify(r => r.TryCancelRequestAsync(It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task CancelRestoreAsync_ReportsNothingToCancel_WhenItLosesTheRaceToAnotherCaller()
        {
            GivenRequest(RestoreRequestStatus.InProgress);

            _restoreRepository
                .Setup(r => r.TryCancelRequestAsync("req-1", It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);

            var response = await Service().CancelRestoreAsync(new CancelRestoreRequest { RequestId = "req-1" });

            response.Cancelled.Should().BeFalse();
            _resultRepository.Verify(r => r.DropResultCollectionsAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task CancelRestoreAsync_RefusesToCancelAnotherTenantsRequest()
        {
            _restoreRepository
                .Setup(r => r.GetRequestByIdAsync("req-1", It.IsAny<CancellationToken>()))
                .ReturnsAsync(new RestoreRequestRecord
                {
                    RequestId = "req-1",
                    TenantId = "someone-else",
                    Status = RestoreRequestStatus.InProgress
                });

            await Assert.ThrowsAsync<UnauthorizedAccessException>(
                () => Service().CancelRestoreAsync(new CancelRestoreRequest { RequestId = "req-1" }));

            _restoreRepository.Verify(r => r.TryCancelRequestAsync(It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task CancelRestoreAsync_ThrowsWhenTheRequestDoesNotExist()
        {
            _restoreRepository
                .Setup(r => r.GetRequestByIdAsync("missing", It.IsAny<CancellationToken>()))
                .ReturnsAsync((RestoreRequestRecord?)null);

            await Assert.ThrowsAsync<KeyNotFoundException>(
                () => Service().CancelRestoreAsync(new CancelRestoreRequest { RequestId = "missing" }));
        }

        /// <summary>
        /// The worker has to notice a cancellation that arrives mid-range, or a seven-day restore
        /// keeps writing rows for hours after the user cancelled it.
        /// </summary>
        [Fact]
        public async Task ExecutePendingFilesAsync_StartsNoFiles_WhenTheRequestIsAlreadyCancelled()
        {
            _restoreRepository
                .Setup(r => r.GetPendingFileProgressByRequestIdAsync("req-1", It.IsAny<CancellationToken>()))
                .ReturnsAsync(
                [
                    PendingFile(new DateTime(2026, 3, 17, 0, 0, 0, DateTimeKind.Utc)),
                    PendingFile(new DateTime(2026, 3, 18, 0, 0, 0, DateTimeKind.Utc)),
                    PendingFile(new DateTime(2026, 3, 19, 0, 0, 0, DateTimeKind.Utc))
                ]);

            _restoreRepository
                .Setup(r => r.IsRequestCancelledAsync("req-1", It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            await Service().ExecutePendingFilesAsync("req-1");

            _blobStorage.Verify(b => b.OpenReadAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
            _resultRepository.Verify(r => r.DropResultCollectionsAsync("req-1", It.IsAny<CancellationToken>()), Times.Once);
        }

        private void GivenRequest(RestoreRequestStatus status) =>
            _restoreRepository
                .Setup(r => r.GetRequestByIdAsync("req-1", It.IsAny<CancellationToken>()))
                .ReturnsAsync(new RestoreRequestRecord
                {
                    RequestId = "req-1",
                    TenantId = Tenant,
                    Status = status
                });

        private static LogTraceRestoreFileProgressRecord PendingFile(DateTime date) => new()
        {
            RequestId = "req-1",
            TenantId = Tenant,
            DataType = RestoreDataType.Log,
            FileDate = date,
            BlobPath = $"Tenants/{Tenant}/logs/logs_{Tenant}_{date:yyyyMMdd}_{date.AddDays(1):yyyyMMdd}.parquet",
            Status = RestoreFileProgressStatus.Pending
        };
    }
}
