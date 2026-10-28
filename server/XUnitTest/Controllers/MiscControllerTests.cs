using Cloud.LmtService.Services.BlocksServices;
using Cloud.LmtService.Services.BlocksServices;
using System.Collections.Generic;
using System.Threading.Tasks;
using BlocksOs.Api.Controllers;
using Blocks.Genesis;
using Cloud.DomainService.Requests;
using Cloud.DomainService.Responses;
using Cloud.DomainService.Services;
using Cloud.LmtService.Models.Logs;
using Cloud.LmtService.Models.Trace;
using Cloud.LmtService.Services.Logs;
using Cloud.LmtService.Services.Trace;
using DomainService.Shared;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Moq;
using System.Linq;
using System.Reflection;
using Microsoft.AspNetCore.Authorization;

namespace XUnitTest.Controllers
{
    // SecretsControllerTests moved to Controllers/SecretsControllerTests.cs when the controller
    // was rewritten onto ISecretService.

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
        private DomainController Controller() => new(_service.Object, Microsoft.Extensions.Logging.Abstractions.NullLogger<DomainController>.Instance);

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
        private readonly Mock<IBlocksServicesService> _bs = new();
        private LogController Controller() => new(_service.Object, _bs.Object);

        // NOTE: All LogController endpoints are gated behind "blocks-os::log::gets".
        // These tests assert delegation behavior only; the attribute is not
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
        private readonly Mock<IBlocksServicesService> _bs = new();
        private TraceController Controller() => new(_service.Object, _bs.Object);

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

    /// <summary>
    /// Named-permission protection (owner 2026-10-14, handoff os-iam-protect-list.md): each action
    /// below carries exactly this resource, and no plain [Authorize] beside it.
    /// </summary>
    public class NamedPermissionProtectionTests
    {
        [Theory]
        [InlineData(typeof(ApiEndpointConfigController), nameof(ApiEndpointConfigController.GetList), "blocks-iam::iam::permissions")]
        [InlineData(typeof(ApiEndpointConfigController), nameof(ApiEndpointConfigController.Update), "blocks-iam::iam::mutate-permissions")]
        [InlineData(typeof(ApiEndpointConfigController), nameof(ApiEndpointConfigController.BulkUpdate), "blocks-iam::iam::mutate-permissions")]
        [InlineData(typeof(CaptchaConfigController), nameof(CaptchaConfigController.Save), "blocks-os::secret-config::save")]
        [InlineData(typeof(CaptchaConfigController), nameof(CaptchaConfigController.Get), "blocks-os::secret-config::get")]
        [InlineData(typeof(CaptchaConfigController), nameof(CaptchaConfigController.List), "blocks-os::secret-config::get")]
        [InlineData(typeof(CaptchaConfigController), nameof(CaptchaConfigController.Delete), "blocks-os::secret-config::delete")]
        [InlineData(typeof(DomainController), nameof(DomainController.Configure), "blocks-os::project::mutate-domain")]
        [InlineData(typeof(DomainController), nameof(DomainController.SetupGuide), "blocks-os::project::domain")]
        [InlineData(typeof(DomainController), nameof(DomainController.ConfigureStream), "blocks-os::project::mutate-domain")]
        [InlineData(typeof(LogAndTraceRestoreController), nameof(LogAndTraceRestoreController.StartColdRestoreProcess), "blocks-os::lmt-restore::start-cold")]
        [InlineData(typeof(LogAndTraceRestoreController), nameof(LogAndTraceRestoreController.StartArchiveRestoreProcess), "blocks-os::lmt-restore::start-archive")]
        [InlineData(typeof(LogAndTraceRestoreController), nameof(LogAndTraceRestoreController.Status), "blocks-os::lmt-restore::status")]
        [InlineData(typeof(LogAndTraceRestoreController), nameof(LogAndTraceRestoreController.CancelRestoreProcess), "blocks-os::lmt-restore::cancel")]
        [InlineData(typeof(LogAndTraceRestoreController), nameof(LogAndTraceRestoreController.GetRestoredTraces), "blocks-os::lmt-restore::get-traces")]
        [InlineData(typeof(LogAndTraceRestoreController), nameof(LogAndTraceRestoreController.GetRestoredLogs), "blocks-os::lmt-restore::get-logs")]
        [InlineData(typeof(LogAndTraceRestoreController), nameof(LogAndTraceRestoreController.GetRestoredTrace), "blocks-os::lmt-restore::get-trace")]
        [InlineData(typeof(LogAndTraceRestoreController), nameof(LogAndTraceRestoreController.GetRestoredLogsByTrace), "blocks-os::lmt-restore::get-logs-by-trace")]
        [InlineData(typeof(LogAndTraceRestoreController), nameof(LogAndTraceRestoreController.DownloadParquet), "blocks-os::lmt-restore::download-parquet")]
        [InlineData(typeof(LogAndTraceRestoreController), nameof(LogAndTraceRestoreController.DownloadJson), "blocks-os::lmt-restore::download-json")]
        [InlineData(typeof(LogAndTraceRestoreController), nameof(LogAndTraceRestoreController.GetRequestId), "blocks-os::lmt-restore::get-request-id")]
        [InlineData(typeof(LogAndTraceRestoreController), nameof(LogAndTraceRestoreController.GetHotDataBlobUploadInDays), "blocks-os::lmt-restore::get-hot-data-retention")]
        [InlineData(typeof(LogController), nameof(LogController.GetBlocksServices), "blocks-os::log::gets")]
        [InlineData(typeof(TraceController), nameof(TraceController.GetBlocksServices), "blocks-os::trace::gets")]
        [InlineData(typeof(MailController), nameof(MailController.GetMailBoxMails), "blocks-os::mailbox::gets")]
        [InlineData(typeof(MailController), nameof(MailController.GetMailBoxMail), "blocks-os::mailbox::gets")]
        [InlineData(typeof(MailController), nameof(MailController.GetMailBoxMailAttachment), "blocks-os::mailbox::gets")]
        [InlineData(typeof(MigrationController), nameof(MigrationController.Migrate), "blocks-os::migration::migrate")]
        [InlineData(typeof(MigrationController), nameof(MigrationController.Verify), "blocks-os::migration::migrate")]
        [InlineData(typeof(MigrationController), nameof(MigrationController.GetMigrationStatus), "blocks-os::migration::gets")]
        [InlineData(typeof(MigrationController), nameof(MigrationController.DataCleanup), "blocks-os::migration::data-cleanup")]
        [InlineData(typeof(PeopleController), nameof(PeopleController.SaveAccessPolicy), "blocks-os::people::save-access-policy")]
        [InlineData(typeof(ProjectController), nameof(ProjectController.GetProjectStatus), "blocks-os::project::projects")]
        [InlineData(typeof(ReleaseController), nameof(ReleaseController.IsAuthorized), "blocks-release::auth::authorization-status")]
        [InlineData(typeof(ReleaseController), nameof(ReleaseController.AccessToken), "blocks-release::auth::access-token")]
        [InlineData(typeof(ReleaseController), nameof(ReleaseController.RemoveAuthorization), "blocks-release::auth::remove-authorization")]
        [InlineData(typeof(ReleaseController), nameof(ReleaseController.DeleteAuthorization), "blocks-release::auth::delete-authorization")]
        [InlineData(typeof(ReleaseController), nameof(ReleaseController.GetReposList), "blocks-release::build::repos-list")]
        [InlineData(typeof(ReleaseController), nameof(ReleaseController.GetUser), "blocks-release::github::user")]
        [InlineData(typeof(ReleaseController), nameof(ReleaseController.GetRepos), "blocks-release::github::repos")]
        [InlineData(typeof(ReleaseController), nameof(ReleaseController.GetBranches), "blocks-release::github::branches")]
        [InlineData(typeof(ReleaseController), nameof(ReleaseController.GithubBranchExists), "blocks-release::github::branch-exists")]
        // Mail templates are protected again (owner 2026-10-28): with plain [Authorize] any
        // signed-in user could rewrite the system mails.
        [InlineData(typeof(MailController), nameof(MailController.SaveTemplate), "blocks-os::mail-template::save")]
        [InlineData(typeof(MailController), nameof(MailController.CloneTemplate), "blocks-os::mail-template::save")]
        [InlineData(typeof(MailController), nameof(MailController.GetTemplate), "blocks-os::mail-template::gets")]
        [InlineData(typeof(MailController), nameof(MailController.GetTemplates), "blocks-os::mail-template::gets")]
        [InlineData(typeof(MailController), nameof(MailController.DeleteTemplate), "blocks-os::mail-template::delete")]
        [InlineData(typeof(ReleaseController), nameof(ReleaseController.UpdateRepoDomain), "blocks-release::build::repo-domain-update")]
        public void ActionCarriesItsProtectedResource(System.Type controller, string action, string expectedResource)
        {
            var method = Action(controller, action);

            method.GetCustomAttributes<ProtectedEndPointAttribute>().Select(a => a.ResourceName)
                .Should().ContainSingle().Which.Should().Be(expectedResource);
            method.GetCustomAttributes<AuthorizeAttribute>().Where(a => a is not ProtectedEndPointAttribute)
                .Should().BeEmpty("the named permission replaces the plain [Authorize]");
            method.GetCustomAttribute<AllowAnonymousAttribute>().Should().BeNull();
        }

        // Kept on plain [Authorize] by the owner: GetMyAccess (gating it is circular) and the
        // claimer-bound Integration connect steps.
        [Theory]
        [InlineData(typeof(PeopleController), nameof(PeopleController.GetMyAccess))]
        [InlineData(typeof(IntegrationController), nameof(IntegrationController.GetRequest))]
        [InlineData(typeof(IntegrationController), nameof(IntegrationController.Cancel))]
        // The caller's own settings: no grant could add anything to reading or writing your own row.
        [InlineData(typeof(UserPreferenceController), nameof(UserPreferenceController.Get))]
        [InlineData(typeof(UserPreferenceController), nameof(UserPreferenceController.Save))]
        public void ActionStaysOnPlainAuthorize(System.Type controller, string action)
        {
            var method = Action(controller, action);

            method.GetCustomAttributes<ProtectedEndPointAttribute>().Should().BeEmpty();
            method.GetCustomAttributes<AuthorizeAttribute>().Should().ContainSingle();
            method.GetCustomAttribute<AllowAnonymousAttribute>().Should().BeNull();
        }

        [Theory]
        [InlineData(typeof(IntegrationController), nameof(IntegrationController.Exchange))]
        [InlineData(typeof(IntegrationController), nameof(IntegrationController.CreateRequest))]
        [InlineData(typeof(PeopleController), nameof(PeopleController.ConfirmInvitation))]
        public void OpenByDesignActionStaysAnonymous(System.Type controller, string action)
        {
            var method = Action(controller, action);

            method.GetCustomAttributes<ProtectedEndPointAttribute>().Should().BeEmpty();
            method.GetCustomAttribute<AllowAnonymousAttribute>().Should().NotBeNull();
        }

        [Fact]
        public void VersionStaysAnonymous()
        {
            typeof(VersionController).GetCustomAttribute<AllowAnonymousAttribute>().Should().NotBeNull();
            typeof(VersionController).GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
                .SelectMany(m => m.GetCustomAttributes<ProtectedEndPointAttribute>())
                .Should().BeEmpty();
        }

        [Fact]
        public void ArchiveTestControllerIsRemoved()
        {
            // It had three anonymous actions that queued backup / cleanup / hydration jobs.
            typeof(MailController).Assembly.GetType("BlocksOs.Api.Controllers.ArchiveController")
                .Should().BeNull();
        }

        private static MethodInfo Action(System.Type controller, string action) =>
            controller.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
                .Single(m => m.Name == action);
    }
}
