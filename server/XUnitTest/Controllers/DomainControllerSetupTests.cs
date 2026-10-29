using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Blocks.Genesis;
using BlocksOs.Api.Controllers;
using DomainService.Shared;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace XUnitTest.Controllers
{
    public class DomainControllerSetupTests
    {
        private readonly Mock<IDomainManagementService> _service = new();

        private (DomainController Controller, MemoryStream Body) StreamingController()
        {
            var body = new MemoryStream();
            var httpContext = new DefaultHttpContext();
            httpContext.Response.Body = body;

            var controller = new DomainController(_service.Object, NullLogger<DomainController>.Instance)
            {
                ControllerContext = new ControllerContext { HttpContext = httpContext },
            };

            return (controller, body);
        }

        // Each SSE event as (name, parsed data), in the order it was written. Heartbeat
        // comments carry no event name and are skipped.
        private static (string Name, JsonElement Data)[] Events(MemoryStream body) =>
            Encoding.UTF8.GetString(body.ToArray())
                .Split("\n\n", StringSplitOptions.RemoveEmptyEntries)
                .Select(block => block.Split('\n'))
                .Where(lines => lines.Any(l => l.StartsWith("event: ", StringComparison.Ordinal)))
                .Select(lines => (
                    lines.Single(l => l.StartsWith("event: ", StringComparison.Ordinal))["event: ".Length..],
                    JsonDocument.Parse(lines.Single(l => l.StartsWith("data: ", StringComparison.Ordinal))["data: ".Length..]).RootElement))
                .ToArray();

        [Fact]
        public async Task SetupGuide_DelegatesToService()
        {
            _service.Setup(s => s.GetDomainSetupGuideAsync())
                    .ReturnsAsync(new DomainSetupGuideResponse { IsSuccess = true });

            var response = await new DomainController(_service.Object, NullLogger<DomainController>.Instance).SetupGuide();

            response.IsSuccess.Should().BeTrue();
        }

        [Fact]
        public async Task ConfigureStream_EmptyDomain_StreamsErrorResult()
        {
            var (controller, body) = StreamingController();

            await controller.ConfigureStream(new ConfigureDomainRequest { CookieDomain = "" });

            controller.Response.ContentType.Should().Be("text/event-stream");
            var events = Events(body);
            events.Should().ContainSingle();
            events[0].Name.Should().Be("result");
            events[0].Data.GetProperty("isSuccess").GetBoolean().Should().BeFalse();
            events[0].Data.GetProperty("errors").GetProperty("missing_required_fields").GetString().Should().Be("domain name is missing");
            _service.Verify(s => s.ConfigureDomainWithProgressAsync(It.IsAny<ConfigureDomainRequest>(), It.IsAny<Func<DomainSetupProgress, Task>>()), Times.Never);
        }

        [Fact]
        public async Task ConfigureStream_StreamsStepsThenResult()
        {
            _service.Setup(s => s.ConfigureDomainWithProgressAsync(It.IsAny<ConfigureDomainRequest>(), It.IsAny<Func<DomainSetupProgress, Task>>()))
                    .Returns(async (ConfigureDomainRequest _, Func<DomainSetupProgress, Task> report) =>
                    {
                        await report(new DomainSetupProgress(DomainSetupSteps.AppDns, DomainSetupStepStatus.Running, "app.example.com"));
                        await report(new DomainSetupProgress(DomainSetupSteps.AppDns, DomainSetupStepStatus.Done, "app.example.com"));
                        return new BaseResponse { IsSuccess = true };
                    });
            var (controller, body) = StreamingController();

            await controller.ConfigureStream(new ConfigureDomainRequest { CookieDomain = "app.example.com" });

            var events = Events(body);
            events.Select(e => e.Name).Should().Equal("step", "step", "result");
            events[0].Data.GetProperty("step").GetString().Should().Be("app_dns");
            events[0].Data.GetProperty("status").GetString().Should().Be("running");
            events[0].Data.GetProperty("host").GetString().Should().Be("app.example.com");
            events[1].Data.GetProperty("status").GetString().Should().Be("done");
            events[2].Data.GetProperty("isSuccess").GetBoolean().Should().BeTrue();
        }

        [Fact]
        public async Task ConfigureStream_ServiceThrows_StreamsGenericFailure()
        {
            _service.Setup(s => s.ConfigureDomainWithProgressAsync(It.IsAny<ConfigureDomainRequest>(), It.IsAny<Func<DomainSetupProgress, Task>>()))
                    .ThrowsAsync(new InvalidOperationException("boom"));
            var (controller, body) = StreamingController();

            await controller.ConfigureStream(new ConfigureDomainRequest { CookieDomain = "app.example.com" });

            var events = Events(body);
            events.Should().ContainSingle();
            events[0].Data.GetProperty("errors").TryGetProperty("setup_failed", out _).Should().BeTrue();
            events[0].Data.ToString().Should().NotContain("boom");
        }
    }
}
