using System;
using System.Linq;
using System.Threading.Tasks;
using Cloud.LmtService.Models.Logs;
using Cloud.LmtService.Repositories.Logs;
using Cloud.LmtService.Services.Logs;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;

namespace XUnitTest.Services
{
    public class LogServiceTests
    {
        private readonly Mock<ILogRepository> _repo = new();
        private readonly Mock<ILogger<LogService>> _logger = new();
        private LogService Service() => new(_logger.Object, _repo.Object);

        [Fact]
        public async Task GetLiveLogsAsync_MissingName_ReturnsError()
        {
            var response = await Service().GetLiveLogsAsync(new LiveLogRequest { Name = "", LastDate = DateTime.UtcNow });

            response.Errors.Should().ContainKey("Error");
            _repo.Verify(r => r.GetLogs(It.IsAny<LiveLogRequest>()), Times.Never);
        }

        [Fact]
        public async Task GetLiveLogsAsync_MinDate_ReturnsError()
        {
            var response = await Service().GetLiveLogsAsync(new LiveLogRequest { Name = "svc", LastDate = DateTime.MinValue });

            response.Errors.Should().ContainKey("Error");
        }

        [Fact]
        public async Task GetLiveLogsAsync_Valid_ReturnsData()
        {
            var projections = new[] { new LogProjection { Message = "hello" } }.AsQueryable();
            _repo.Setup(r => r.GetLogs(It.IsAny<LiveLogRequest>())).ReturnsAsync(projections);

            var response = await Service().GetLiveLogsAsync(new LiveLogRequest { Name = "svc", LastDate = DateTime.UtcNow });

            response.Errors.Should().BeNullOrEmpty();
            response.Data.Should().NotBeNull();
        }

        [Fact]
        public async Task GetLogsAsync_MissingServiceName_ReturnsError()
        {
            var response = await Service().GetLogsAsync(new GetLogsRequest { ServiceName = "" });

            response.Errors.Should().ContainKey("Error");
            _repo.Verify(r => r.GetLogs(It.IsAny<GetLogsRequest>()), Times.Never);
        }

        [Fact]
        public async Task GetLogsAsync_Valid_ReturnsDataAndTotal()
        {
            var projections = new[] { new LogProjection { Message = "x" } }.AsQueryable();
            _repo.Setup(r => r.GetLogs(It.IsAny<GetLogsRequest>())).ReturnsAsync((projections, 12L));

            var response = await Service().GetLogsAsync(new GetLogsRequest { ServiceName = "svc" });

            response.TotalCount.Should().Be(12);
            response.Data.Should().NotBeNull();
        }

        [Fact]
        public async Task GetLogsByDateAsync_MissingServiceName_ReturnsError()
        {
            var response = await Service().GetLogsByDateAsync(new LogsByDateRequest { ServiceName = "" });

            response.Errors.Should().ContainKey("Error");
        }

        [Fact]
        public async Task GetLogsByDateAsync_Valid_ReturnsDataAndTotal()
        {
            var projections = new[] { new LogProjection() }.AsQueryable();
            _repo.Setup(r => r.GetLogs(It.IsAny<LogsByDateRequest>())).ReturnsAsync((projections, 5L));

            var response = await Service().GetLogsByDateAsync(new LogsByDateRequest { ServiceName = "svc" });

            response.TotalCount.Should().Be(5);
        }

        [Fact]
        public async Task GetLiveLogsAsync_MessageContainsEmail_IsRedacted()
        {
            var projections = new[]
            {
                new LogProjection { Message = "User login failed for jane.doe@example.com", Exception = "" }
            }.AsQueryable();
            _repo.Setup(r => r.GetLogs(It.IsAny<LiveLogRequest>())).ReturnsAsync(projections);

            var response = await Service().GetLiveLogsAsync(new LiveLogRequest { Name = "svc", LastDate = DateTime.UtcNow });

            var data = response.Data.Cast<LogProjection>().ToList();
            data.Should().ContainSingle();
            data[0].Message.Should().Be("User login failed for ***REDACTED***");
        }

        [Fact]
        public async Task GetLogsAsync_MessageAndExceptionContainSensitiveData_AreRedacted()
        {
            var projections = new[]
            {
                new LogProjection
                {
                    Message = "Request from jane.doe@example.com failed",
                    Exception = "System.Exception: password=secret123 at Foo.Bar()"
                }
            }.AsQueryable();
            _repo.Setup(r => r.GetLogs(It.IsAny<GetLogsRequest>())).ReturnsAsync((projections, 1L));

            var response = await Service().GetLogsAsync(new GetLogsRequest { ServiceName = "svc" });

            var data = response.Data.Cast<LogProjection>().ToList();
            data.Should().ContainSingle();
            data[0].Message.Should().Be("Request from ***REDACTED*** failed");
            data[0].Exception.Should().Be("System.Exception: password=***REDACTED*** at Foo.Bar()");
        }
    }
}
