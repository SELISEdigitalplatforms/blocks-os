using System.Collections.Generic;
using System.Threading.Tasks;
using Api.Controllers;
using Blocks.Genesis;
using Cloud.DomainService.Requests;
using Cloud.DomainService.Responses;
using Cloud.DomainService.Services;
using Cloud.LmtService.Models.Logs;
using Cloud.LmtService.Models.Trace;
using Cloud.LmtService.Services.Logs;
using Cloud.LmtService.Services.Trace;
using BlocksTemplate.Api.Controllers;
using DomainService.Shared;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Secrets.DomainService.Entities;
using Secrets.DomainService.ResponseModel;
using Secrets.DomainService.Services;

namespace XUnitTest.Controllers
{
    public class SecretsControllerTests
    {
        private readonly Mock<ISecretManagementService> _service = new();
        private SecretsController Controller() => new(_service.Object);

        [Fact]
        public async Task Save_DelegatesToService()
        {
            _service.Setup(s => s.SaveSecretAsync(It.IsAny<SaveSecretRequest>()))
                    .ReturnsAsync(new BaseResponse { IsSuccess = true });

            var response = await Controller().Save(new SaveSecretRequest { SecretKey = "k" });

            response.IsSuccess.Should().BeTrue();
        }

        [Fact]
        public async Task Gets_LowercasesKeyAndUsesDefaults()
        {
            _service.Setup(s => s.GetSecretAsync("mykey", 1, 10))
                    .ReturnsAsync(new GetSecretsResponse { TotalCount = 1 });

            var response = await Controller().Gets(new GetSecretsRequest { SecretKey = "MyKey" });

            response.TotalCount.Should().Be(1);
            _service.Verify(s => s.GetSecretAsync("mykey", 1, 10), Times.Once);
        }

        [Fact]
        public async Task Get_DelegatesToService()
        {
            var secret = new Secret { ItemId = "s1" };
            _service.Setup(s => s.SecretAsync("s1")).ReturnsAsync(secret);

            var response = await Controller().Get(new GetSecretRequest { ItemId = "s1" });

            response.Should().BeSameAs(secret);
        }

        [Fact]
        public async Task Delete_DelegatesToService()
        {
            _service.Setup(s => s.DeleteSecretAsync(It.IsAny<DeleteSecretRequest>()))
                    .ReturnsAsync(new BaseResponse { IsSuccess = true });

            var response = await Controller().Delete(new DeleteSecretRequest { ItemId = "s1" });

            response.IsSuccess.Should().BeTrue();
        }
    }

    public class ApiEndpointConfigControllerTests
    {
        private readonly Mock<IApiEndpointConfigService> _service = new();
        private ApiEndpointConfigController Controller() => new(_service.Object);

        [Fact]
        public async Task GetList_ReturnsOk()
        {
            _service.Setup(s => s.GetListAsync(It.IsAny<GetApiEndpointConfigsRequest>()))
                    .ReturnsAsync(new GetApiEndpointConfigsResponse { TotalCount = 4 });

            var result = await Controller().GetList(new GetApiEndpointConfigsRequest());

            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task Update_Success_ReturnsOk()
        {
            _service.Setup(s => s.UpdateAsync(It.IsAny<UpdateApiEndpointConfigRequest>()))
                    .ReturnsAsync(new BaseResponse { IsSuccess = true });

            var result = await Controller().Update(new UpdateApiEndpointConfigRequest());

            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task Update_Failure_ReturnsBadRequest()
        {
            _service.Setup(s => s.UpdateAsync(It.IsAny<UpdateApiEndpointConfigRequest>()))
                    .ReturnsAsync(new BaseResponse { IsSuccess = false });

            var result = await Controller().Update(new UpdateApiEndpointConfigRequest());

            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task BulkUpdate_NoItemIds_ReturnsBadRequest()
        {
            var result = await Controller().BulkUpdate(new BulkUpdateApiEndpointConfigRequest { ItemIds = new List<string>() });

            result.Should().BeOfType<BadRequestObjectResult>();
            _service.Verify(s => s.BulkUpdateAsync(It.IsAny<BulkUpdateApiEndpointConfigRequest>()), Times.Never);
        }

        [Fact]
        public async Task BulkUpdate_Success_ReturnsOk()
        {
            _service.Setup(s => s.BulkUpdateAsync(It.IsAny<BulkUpdateApiEndpointConfigRequest>()))
                    .ReturnsAsync(new BaseResponse { IsSuccess = true });

            var result = await Controller().BulkUpdate(new BulkUpdateApiEndpointConfigRequest { ItemIds = new List<string> { "a" } });

            result.Should().BeOfType<OkObjectResult>();
        }
    }

    public class DomainControllerTests
    {
        private readonly Mock<IDomainManagementService> _service = new();
        private DomainController Controller() => new(_service.Object);

        [Fact]
        public async Task Configure_EmptyDomain_ReturnsError()
        {
            var response = await Controller().Configure(new ConfigureDomainRequest { CookieDomain = "" });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("missing_required_fields");
            _service.Verify(s => s.ConfigureDomainAsync(It.IsAny<ConfigureDomainRequest>()), Times.Never);
        }

        [Fact]
        public async Task Configure_Valid_DelegatesToService()
        {
            _service.Setup(s => s.ConfigureDomainAsync(It.IsAny<ConfigureDomainRequest>()))
                    .ReturnsAsync(new BaseResponse { IsSuccess = true });

            var response = await Controller().Configure(new ConfigureDomainRequest { CookieDomain = "app.example.com" });

            response.IsSuccess.Should().BeTrue();
        }
    }

    public class LogControllerTests
    {
        private readonly Mock<ILogService> _service = new();
        private LogController Controller() => new(_service.Object);

        // NOTE: All LogController endpoints are gated behind "blocks-os::mail::gets"
        // which looks like a copy-paste bug (should be a log-specific permission).
        // These tests assert current delegation behavior only; the attribute is not
        // exercised by direct controller invocation.

        [Fact]
        public async Task GetLogs_ReturnsOk()
        {
            _service.Setup(s => s.GetLogsAsync(It.IsAny<GetLogsRequest>()))
                    .ReturnsAsync(new GetLogsResponse { TotalCount = 2 });

            var result = await Controller().GetLogs(new GetLogsRequest { ServiceName = "svc" });

            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task GetLogsByDate_DelegatesToService()
        {
            var expected = new GetLogsResponse { TotalCount = 5 };
            _service.Setup(s => s.GetLogsByDateAsync(It.IsAny<LogsByDateRequest>())).ReturnsAsync(expected);

            var response = await Controller().GetLogsByDate(new LogsByDateRequest { ServiceName = "svc" });

            response.Should().BeSameAs(expected);
        }

        [Fact]
        public async Task Live_ReturnsOk()
        {
            _service.Setup(s => s.GetLiveLogsAsync(It.IsAny<LiveLogRequest>()))
                    .ReturnsAsync(new GetLogsResponse());

            var result = await Controller().Live(new LiveLogRequest { Name = "svc" });

            result.Should().BeOfType<OkObjectResult>();
        }
    }

    public class TraceControllerTests
    {
        private readonly Mock<ITraceService> _service = new();
        private TraceController Controller() => new(_service.Object);

        [Fact]
        public async Task GetTraces_DelegatesToService()
        {
            var expected = new BaseQueryListResponse<System.Linq.IQueryable<TraceProjection>>();
            _service.Setup(s => s.GetTracesAsync(It.IsAny<GetTracesRequest>())).ReturnsAsync(expected);

            var response = await Controller().GetTraces(new GetTracesRequest());

            response.Should().BeSameAs(expected);
        }

        [Fact]
        public async Task GetTrace_DelegatesToService()
        {
            var expected = new BaseQueryListResponse<System.Linq.IQueryable<SingleTraceProjection>>();
            _service.Setup(s => s.GetTraceAsync(It.IsAny<GetTraceRequest>())).ReturnsAsync(expected);

            var response = await Controller().GetTrace(new GetTraceRequest { TraceId = "t1" });

            response.Should().BeSameAs(expected);
        }

        [Fact]
        public async Task GetOperationalAnalytics_DelegatesToService()
        {
            var expected = new { Value = 1 };
            _service.Setup(s => s.GetOperationalAnalytics(It.IsAny<GetApiAnalyticsRequest>())).ReturnsAsync(expected);

            var response = await Controller().GetOperationalAnalytics(new GetApiAnalyticsRequest
            {
                StartTime = System.DateTime.UtcNow.AddHours(-1),
                EndTime = System.DateTime.UtcNow,
                ServiceName = "svc"
            });

            response.Should().BeSameAs(expected);
        }

        [Fact]
        public async Task GetServiceAnalytics_DelegatesToService()
        {
            var expected = new { Count = 3 };
            _service.Setup(s => s.GetServiceAnalytics(It.IsAny<GetHttpStatusAnalyticsRequest>())).ReturnsAsync(expected);

            var response = await Controller().GetServiceAnalytics(new GetHttpStatusAnalyticsRequest
            {
                StartTime = System.DateTime.UtcNow.AddHours(-1),
                EndTime = System.DateTime.UtcNow
            });

            response.Should().BeSameAs(expected);
        }
    }
}
