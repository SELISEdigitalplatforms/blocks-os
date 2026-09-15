using System;
using System.Collections.Generic;
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
        public async Task GetTraceAsync_SensitiveAttributesAndBaggage_AreRedacted()
        {
            var spans = new[]
            {
                new SingleTraceProjection
                {
                    TraceId = "t1",
                    Attributes = new Dictionary<string, object?>
                    {
                        ["http.request.header.Authorization"] = "Bearer abc.def.ghi",
                        ["response.status.code"] = "200",
                        ["http.response.status_code"] = 500,
                        ["http.route"] = "Api.Controllers.AuthenticationController.ImpersonationStatus (Api)",
                        ["retry.count"] = 3
                    },
                    Baggage = new Dictionary<string, string>
                    {
                        ["SecurityContext"] = "{\"UserId\":\"u1\"}",
                        ["tenant.id"] = "acme"
                    }
                }
            }.AsQueryable();
            _repo.Setup(r => r.GetTraces(It.IsAny<GetTraceRequest>())).ReturnsAsync(spans);

            var response = await Service().GetTraceAsync(new GetTraceRequest { TraceId = "t1" });

            var span = response.Data.Cast<SingleTraceProjection>().Single();
            span.Attributes["http.request.header.Authorization"].Should().Be("***REDACTED***");
            span.Attributes["response.status.code"].Should().Be("200");
            span.Attributes["http.response.status_code"].Should().Be(500);
            span.Attributes["http.route"].Should()
                .Be("Api.Controllers.AuthenticationController.ImpersonationStatus (Api)");
            span.Attributes["retry.count"].Should().Be(3);
            span.Baggage["SecurityContext"].Should().Be("***REDACTED***");
            span.Baggage["tenant.id"].Should().Be("acme");
        }

        [Fact]
        public async Task GetTracesAsync_SensitiveAttributes_AreRedactedAndStatusCodePreserved()
        {
            var traces = new[]
            {
                new TraceProjection
                {
                    TraceId = "t",
                    Attributes = new Dictionary<string, object?>
                    {
                        ["api-key"] = "k-12345",
                        ["response.status.code"] = "200",
                        ["http.response.status_code"] = "404",
                        ["http.request.headers"] =
                            "{ \"Accept\": \"application/json\", \"X-Token\": \"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk\" }"
                    }
                }
            }.AsQueryable();
            _repo.Setup(r => r.GetTraces(It.IsAny<GetTracesRequest>())).ReturnsAsync((traces, 1L));

            var response = await Service().GetTracesAsync(new GetTracesRequest());

            var trace = response.Data.Cast<TraceProjection>().Single();
            trace.Attributes["api-key"].Should().Be("***REDACTED***");
            trace.Attributes["response.status.code"].Should().Be("200");
            trace.Attributes["http.response.status_code"].Should().Be("404");
            trace.Attributes["http.request.headers"].Should()
                .Be("{ \"Accept\": \"application/json\", \"X-Token\": \"***REDACTED***\" }");
        }

        [Fact]
        public async Task GetTracesAsync_NullAttributes_DoesNotThrow()
        {
            var traces = new[] { new TraceProjection { TraceId = "t", Attributes = null! } }.AsQueryable();
            _repo.Setup(r => r.GetTraces(It.IsAny<GetTracesRequest>())).ReturnsAsync((traces, 1L));

            var response = await Service().GetTracesAsync(new GetTracesRequest());

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
