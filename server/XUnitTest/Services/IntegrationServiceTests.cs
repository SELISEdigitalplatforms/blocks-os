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

        private IntegrationService Service() => new(_repo.Object, new SaveIntegrationSetupRequestValidator());

        private static SaveIntegrationSetupRequest ValidRequest() => new()
        {
            TemplateKey = "localization",
            RoleId = "role-1",
            RoleSlug = "localization-integration",
            ClientCredentialId = "client-1"
        };

        private static IntegrationTemplate Template() => new()
        {
            ItemId = "t-1",
            Key = "localization",
            DisplayName = "Blocks Localization",
            IsActive = true
        };

        [Fact]
        public async Task SaveSetup_Invalid_ReturnsErrorsAndWritesNothing()
        {
            var response = await Service().SaveSetupAsync(new SaveIntegrationSetupRequest());

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKeys("TemplateKey", "RoleId", "RoleSlug", "ClientCredentialId");
            _repo.Verify(r => r.TryInsertSetupAsync(It.IsAny<IntegrationSetup>()), Times.Never);
        }

        [Fact]
        public async Task SaveSetup_UnknownTemplate_Fails()
        {
            _repo.Setup(r => r.GetActiveTemplateByKeyAsync("localization")).ReturnsAsync((IntegrationTemplate?)null);

            var response = await Service().SaveSetupAsync(ValidRequest());

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("TemplateKey");
            _repo.Verify(r => r.TryInsertSetupAsync(It.IsAny<IntegrationSetup>()), Times.Never);
        }

        [Fact]
        public async Task SaveSetup_Valid_InsertsSingletonRecord()
        {
            using var _ = new BlocksTestContext(tenantId: "tenant-1", userId: "u1");
            IntegrationSetup? saved = null;
            _repo.Setup(r => r.GetActiveTemplateByKeyAsync("localization")).ReturnsAsync(Template());
            _repo.Setup(r => r.TryInsertSetupAsync(It.IsAny<IntegrationSetup>()))
                 .Callback<IntegrationSetup>(s => saved = s)
                 .ReturnsAsync(true);

            var response = await Service().SaveSetupAsync(ValidRequest());

            response.IsSuccess.Should().BeTrue();
            response.ItemId.Should().Be(IntegrationSetup.SingletonId);
            saved.Should().NotBeNull();
            saved!.ItemId.Should().Be(IntegrationSetup.SingletonId);
            saved.TemplateKey.Should().Be("localization");
            saved.TemplateDisplayName.Should().Be("Blocks Localization");
            saved.RoleSlug.Should().Be("localization-integration");
            saved.ClientCredentialId.Should().Be("client-1");
            saved.CreatedBy.Should().Be("u1");
        }

        [Fact]
        public async Task SaveSetup_AlreadyConfigured_Fails()
        {
            _repo.Setup(r => r.GetActiveTemplateByKeyAsync("localization")).ReturnsAsync(Template());
            _repo.Setup(r => r.TryInsertSetupAsync(It.IsAny<IntegrationSetup>())).ReturnsAsync(false);

            var response = await Service().SaveSetupAsync(ValidRequest());

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("already_configured");
        }

        [Fact]
        public async Task GetTemplates_ReturnsRepositoryTemplates()
        {
            _repo.Setup(r => r.GetActiveTemplatesAsync()).ReturnsAsync([Template()]);

            var templates = await Service().GetTemplatesAsync();

            templates.Should().ContainSingle().Which.Key.Should().Be("localization");
        }
    }
}
