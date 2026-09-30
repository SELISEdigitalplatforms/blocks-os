using Configuration.DomainService.Integration.Entities;
using Configuration.DomainService.Integration.RequestModel;
using Configuration.DomainService.Integration.Services;
using Configuration.DomainService.Integration.Validators;
using FluentAssertions;
using Moq;
using XUnitTest.TestSupport;

namespace XUnitTest.Services
{
    public class IntegrationServiceTests
    {
        private readonly Mock<IIntegrationRepository> _repo = new();
        private readonly Mock<IIamClient> _iam = new();

        private IntegrationService RunService() => new(_repo.Object, new RunIntegrationSetupRequestValidator(), _iam.Object);

        private static RunIntegrationSetupRequest RunRequest() => new() { TemplateKey = "localization-read", ConnectionName = "WordPress" };

        private static IntegrationTemplate Template() => new()
        {
            ItemId = "t-1",
            Key = "localization",
            DisplayName = "Blocks Localization",
            IsActive = true
        };

        private static IntegrationTemplate RunTemplate() => new()
        {
            Key = "localization-read", Family = "localization", AccessLevel = "read", DisplayName = "Localization Read",
            RoleName = "Localization Integrator (Read)", RoleSlug = "localization-integrator-read", ClientCredentialName = "Blocks Localization Integration (Read)",
            BaseUrl = "https://localization.example.test", Permissions = ["blocks-localization::key::gets"]
        };

        [Fact]
        public async Task GetTemplates_ReturnsRepositoryTemplates()
        {
            _repo.Setup(r => r.GetActiveTemplatesAsync()).ReturnsAsync([Template()]);

            var templates = await RunService().GetTemplatesAsync();

            templates.Should().ContainSingle().Which.Key.Should().Be("localization");
        }

        [Fact]
        public async Task GetTemplates_PassesTheOptionalFamilyFilter()
        {
            _repo.Setup(r => r.GetActiveTemplatesAsync("localization")).ReturnsAsync([Template()]);

            var templates = await RunService().GetTemplatesAsync("localization");

            templates.Should().ContainSingle();
            _repo.Verify(r => r.GetActiveTemplatesAsync("localization"), Times.Once);
        }

        [Fact]
        public async Task GetTemplate_CanIncludeAnInactiveLegacyTemplate()
        {
            var legacy = Template();
            legacy.IsActive = false;
            _repo.Setup(r => r.GetTemplateByKeyAsync("localization", true)).ReturnsAsync(legacy);

            var template = await RunService().GetTemplateByKeyAsync("localization", true);

            template.Should().BeSameAs(legacy);
        }

        [Fact]
        public async Task RunSetup_InvalidTemplatePrefix_StopsBeforeCallingIam()
        {
            using var _ = new BlocksTestContext(impersonated: true);
            var template = RunTemplate(); template.Permissions = ["blocks-other::key::gets"];
            _repo.Setup(r => r.GetTemplateByKeyAsync(template.Key, false)).ReturnsAsync(template);
            var response = await RunService().RunSetupAsync(RunRequest());
            response.IsSuccess.Should().BeFalse(); response.Errors.Should().ContainKey("template_invalid");
            _iam.Verify(i => i.GetPermissionsByResourcesAsync(It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task RunSetup_CreatesRoleCredentialAndConnection()
        {
            using var _ = new BlocksTestContext(tenantId: "tenant-1", userId: "u1", impersonated: true);
            var template = RunTemplate(); IntegrationSetup? saved = null;
            _repo.Setup(r => r.GetTemplateByKeyAsync(template.Key, false)).ReturnsAsync(template);
            _repo.Setup(r => r.HasActiveConnectionNamedAsync("WordPress")).ReturnsAsync(false);
            _repo.Setup(r => r.TryInsertSetupAsync(It.IsAny<IntegrationSetup>())).Callback<IntegrationSetup>(s => saved = s).ReturnsAsync(true);
            _iam.Setup(i => i.GetPermissionsByResourcesAsync(It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>())).ReturnsAsync(new IamPermissionsResult([new("p1", template.Permissions[0])]));
            _iam.Setup(i => i.FindRoleAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync((IamRole?)null);
            _iam.Setup(i => i.CreateRoleAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>())).ReturnsAsync(new IamMutationResult(true, "role-1"));
            _iam.Setup(i => i.GetRoleAsync("role-1", It.IsAny<CancellationToken>())).ReturnsAsync(new IamRole("role-1", template.RoleName, template.RoleSlug, null));
            _iam.Setup(i => i.AssignPermissionsAsync(template.RoleSlug, It.IsAny<IReadOnlyCollection<string>>(), null, It.IsAny<CancellationToken>())).ReturnsAsync(new IamMutationResult(true));
            _iam.Setup(i => i.CreateCredentialAsync(It.IsAny<object>(), It.IsAny<CancellationToken>())).ReturnsAsync(new IamCreateCredentialResult(true, "client-1", "secret"));
            var response = await RunService().RunSetupAsync(RunRequest());
            response.IsSuccess.Should().BeTrue(); response.ClientSecret.Should().Be("secret"); response.XBlocksKey.Should().Be("tenant-1");
            saved!.ConnectionName.Should().Be("WordPress"); saved.Status.Should().Be("active"); saved.ClientCredentialId.Should().Be("client-1");
        }

        [Fact]
        public async Task GetConnections_LabelsLegacyRecords()
        {
            using var _ = new BlocksTestContext(impersonated: true);
            _repo.Setup(r => r.GetConnectionsAsync()).ReturnsAsync([new IntegrationSetup { ItemId = "legacy", TemplateKey = "localization" }]);
            var result = await RunService().GetConnectionsAsync();
            result.Data.Should().ContainSingle().Which.ConnectionName.Should().Be("Legacy connection");
        }

        [Fact]
        public async Task RevokeConnection_RecordsTheCurrentUser()
        {
            using var _ = new BlocksTestContext(userId: "u1", impersonated: true);
            _repo.Setup(r => r.RevokeConnectionAsync("connection-1", "u1")).ReturnsAsync(true);
            var result = await RunService().RevokeConnectionAsync("connection-1");
            result.IsSuccess.Should().BeTrue();
        }

        [Fact]
        public async Task RevokeUndeliveredConnection_UsesTheRecordedEnvironment()
        {
            await RunService().RevokeUndeliveredConnectionAsync("environment-1", "connection-1");

            _repo.Verify(r => r.MarkConnectionNeverDeliveredAsync("environment-1", "connection-1"), Times.Once);
        }

        [Fact]
        public async Task CheckReadiness_AllPermissionsPresent_IsReady()
        {
            using var _ = new BlocksTestContext(impersonated: true);
            var template = RunTemplate();
            _repo.Setup(r => r.GetTemplateByKeyAsync(template.Key, false)).ReturnsAsync(template);
            _iam.Setup(i => i.GetPermissionsByResourcesAsync(It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new IamPermissionsResult([new("p1", template.Permissions[0])]));

            var result = await RunService().CheckReadinessAsync(template.Key);

            result.Ready.Should().BeTrue();
            result.MissingPermissions.Should().BeEmpty();
        }

        [Fact]
        public async Task CheckReadiness_MissingPermissions_ReportsThem()
        {
            using var _ = new BlocksTestContext(impersonated: true);
            var template = RunTemplate();
            template.Permissions = ["blocks-localization::key::gets", "blocks-localization::key::save"];
            _repo.Setup(r => r.GetTemplateByKeyAsync(template.Key, false)).ReturnsAsync(template);
            _iam.Setup(i => i.GetPermissionsByResourcesAsync(It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new IamPermissionsResult([new("p1", "blocks-localization::key::gets")]));

            var result = await RunService().CheckReadinessAsync(template.Key);

            result.Ready.Should().BeFalse();
            result.MissingPermissions.Should().ContainSingle().Which.Should().Be("blocks-localization::key::save");
        }

        [Fact]
        public async Task CheckReadiness_IamError_ReportsEverythingMissing()
        {
            using var _ = new BlocksTestContext(impersonated: true);
            var template = RunTemplate();
            _repo.Setup(r => r.GetTemplateByKeyAsync(template.Key, false)).ReturnsAsync(template);
            _iam.Setup(i => i.GetPermissionsByResourcesAsync(It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new IamPermissionsResult(null!, "iam unreachable"));

            var result = await RunService().CheckReadinessAsync(template.Key);

            result.Ready.Should().BeFalse();
            result.MissingPermissions.Should().BeEquivalentTo(template.Permissions);
        }

        [Fact]
        public async Task CheckReadiness_UnknownTemplate_IsNotReady()
        {
            using var _ = new BlocksTestContext(impersonated: true);
            _repo.Setup(r => r.GetTemplateByKeyAsync("nope", false)).ReturnsAsync((IntegrationTemplate?)null);

            var result = await RunService().CheckReadinessAsync("nope");

            result.Ready.Should().BeFalse();
            result.MissingPermissions.Should().ContainSingle();
        }

        [Fact]
        public async Task CheckReadiness_NotImpersonated_IsNotReadyWithoutCallingIam()
        {
            using var _ = new BlocksTestContext(impersonated: false);

            var result = await RunService().CheckReadinessAsync("localization-read");

            result.Ready.Should().BeFalse();
            _iam.Verify(i => i.GetPermissionsByResourcesAsync(It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>()), Times.Never);
        }
    }
}
