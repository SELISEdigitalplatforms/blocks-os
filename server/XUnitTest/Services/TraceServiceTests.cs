using System;
using System.Linq;
using System.Threading.Tasks;
using Cloud.LmtService.Models.Trace;
using Cloud.LmtService.Repositories.Trace;
using Cloud.LmtService.Services.Trace;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;

namespace XUnitTest.Services
{
    public class TraceServiceTests
    {
        private readonly Mock<ITraceRepository> _repo = new();
        private readonly Mock<ILogger<TraceService>> _logger = new();
        private TraceService Service() => new(_logger.Object, _repo.Object);

        [Fact]
        public async Task GetTraceAsync_MissingTraceId_ReturnsError()
        {
            var response = await Service().GetTraceAsync(new GetTraceRequest { TraceId = "" });

            response.Errors.Should().ContainKey("Error");
            _repo.Verify(r => r.GetTraces(It.IsAny<GetTraceRequest>()), Times.Never);
        }

        [Fact]
        public async Task GetTraceAsync_Valid_ReturnsData()
        {
            var spans = new[] { new SingleTraceProjection { TraceId = "t1" } }.AsQueryable();
            _repo.Setup(r => r.GetTraces(It.IsAny<GetTraceRequest>())).ReturnsAsync(spans);

            var response = await Service().GetTraceAsync(new GetTraceRequest { TraceId = "t1" });

            response.Data.Should().NotBeNull();
            response.Errors.Should().BeNullOrEmpty();
        }

        [Fact]
        public async Task GetTracesAsync_ReturnsDataAndTotal()
        {
            var traces = new[] { new TraceProjection { TraceId = "t" } }.AsQueryable();
            _repo.Setup(r => r.GetTraces(It.IsAny<GetTracesRequest>())).ReturnsAsync((traces, 33L));

            var response = await Service().GetTracesAsync(new GetTracesRequest());

            response.TotalCount.Should().Be(33);
            response.Data.Should().NotBeNull();
        }

        [Fact]
        public async Task GetOperationalAnalytics_DelegatesToRepository()
        {
            var expected = new { Value = 1 };
            _repo.Setup(r => r.GetOperationalAnalytics(It.IsAny<DateTime>(), It.IsAny<DateTime>(), "svc", "op"))
                 .ReturnsAsync(expected);

            var result = await Service().GetOperationalAnalytics(new GetApiAnalyticsRequest
            {
                StartTime = DateTime.UtcNow.AddHours(-1),
                EndTime = DateTime.UtcNow,
                ServiceName = "svc",
                OperationName = "op"
            });

            result.Should().BeSameAs(expected);
        }

        [Fact]
        public async Task GetServiceAnalytics_DelegatesToRepository()
        {
            var expected = new { Count = 9 };
            _repo.Setup(r => r.GetServiceAnalytics(It.IsAny<DateTime>(), It.IsAny<DateTime>(), "svc"))
                 .ReturnsAsync(expected);

            var result = await Service().GetServiceAnalytics(new GetHttpStatusAnalyticsRequest
            {
                StartTime = DateTime.UtcNow.AddHours(-1),
                EndTime = DateTime.UtcNow,
                ServiceName = "svc"
            });

            result.Should().BeSameAs(expected);
        }
    }
}
