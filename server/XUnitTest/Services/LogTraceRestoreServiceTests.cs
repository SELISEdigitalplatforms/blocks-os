using System;
using System.Collections.Generic;
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
            _tenants.Object);

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
        public async Task CheckRequestStatus_AlreadyInProgress_ReturnsFalseWithoutTransition()
        {
            _coldRestoreRepository
                .Setup(r => r.GetRequestByIdAsync("req-1", It.IsAny<CancellationToken>()))
                .ReturnsAsync(new RestoreRequestRecord { RequestId = "req-1", Status = RestoreRequestStatus.InProgress });

            var result = await Service().CheckRequestStatus("req-1");

            result.Should().BeFalse();
            _coldRestoreRepository.Verify(r => r.UpdateRequestStatusAsync(
                It.IsAny<string>(), It.IsAny<RestoreRequestStatus>(), It.IsAny<DateTime?>(), It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task CheckRequestStatus_NotYetStarted_TransitionsToInProgressAndReturnsTrue()
        {
            _coldRestoreRepository
                .Setup(r => r.GetRequestByIdAsync("req-1", It.IsAny<CancellationToken>()))
                .ReturnsAsync((RestoreRequestRecord?)null);

            var result = await Service().CheckRequestStatus("req-1");

            result.Should().BeTrue();
            _coldRestoreRepository.Verify(r => r.ResetStuckProcessingFilesAsync("req-1", It.IsAny<CancellationToken>()), Times.Once);
            _coldRestoreRepository.Verify(r => r.UpdateRequestStatusAsync(
                "req-1", RestoreRequestStatus.InProgress, It.IsAny<DateTime?>(), null, It.IsAny<CancellationToken>()), Times.Once);
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
    }
}
