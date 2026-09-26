using Configuration.DomainService.Connect.Entities;
using Configuration.DomainService.Connect.RequestModel;
using Configuration.DomainService.Connect.Services;
using Configuration.DomainService.Connect.Validators;
using FluentAssertions;
using Moq;
using XUnitTest.TestSupport;

namespace XUnitTest.Services
{
    public class ConnectServiceTests
    {
        private readonly Mock<IConnectRepository> _repo = new();

        private ConnectService Service() => new(_repo.Object, new SaveConnectSetupRequestValidator());

        private static SaveConnectSetupRequest ValidRequest() => new()
        {
            TemplateKey = "localization",
            RoleId = "role-1",
            RoleSlug = "localization-connect",
            ClientCredentialId = "client-1"
        };

        private static ConnectTemplate Template() => new()
        {
            ItemId = "t-1",
            Key = "localization",
            DisplayName = "Blocks Localization",
            IsActive = true
        };

        [Fact]
        public async Task SaveSetup_Invalid_ReturnsErrorsAndWritesNothing()
        {
            var response = await Service().SaveSetupAsync(new SaveConnectSetupRequest());

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKeys("TemplateKey", "RoleId", "RoleSlug", "ClientCredentialId");
            _repo.Verify(r => r.TryInsertSetupAsync(It.IsAny<ConnectSetup>()), Times.Never);
        }

        [Fact]
        public async Task SaveSetup_UnknownTemplate_Fails()
        {
            _repo.Setup(r => r.GetActiveTemplateByKeyAsync("localization")).ReturnsAsync((ConnectTemplate?)null);

            var response = await Service().SaveSetupAsync(ValidRequest());

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("TemplateKey");
            _repo.Verify(r => r.TryInsertSetupAsync(It.IsAny<ConnectSetup>()), Times.Never);
        }

        [Fact]
        public async Task SaveSetup_Valid_InsertsSingletonRecord()
        {
            using var _ = new BlocksTestContext(tenantId: "tenant-1", userId: "u1");
            ConnectSetup? saved = null;
            _repo.Setup(r => r.GetActiveTemplateByKeyAsync("localization")).ReturnsAsync(Template());
            _repo.Setup(r => r.TryInsertSetupAsync(It.IsAny<ConnectSetup>()))
                 .Callback<ConnectSetup>(s => saved = s)
                 .ReturnsAsync(true);

            var response = await Service().SaveSetupAsync(ValidRequest());

            response.IsSuccess.Should().BeTrue();
            response.ItemId.Should().Be(ConnectSetup.SingletonId);
            saved.Should().NotBeNull();
            saved!.ItemId.Should().Be(ConnectSetup.SingletonId);
            saved.TemplateKey.Should().Be("localization");
            saved.TemplateDisplayName.Should().Be("Blocks Localization");
            saved.RoleSlug.Should().Be("localization-connect");
            saved.ClientCredentialId.Should().Be("client-1");
            saved.CreatedBy.Should().Be("u1");
        }

        [Fact]
        public async Task SaveSetup_AlreadyConfigured_Fails()
        {
            _repo.Setup(r => r.GetActiveTemplateByKeyAsync("localization")).ReturnsAsync(Template());
            _repo.Setup(r => r.TryInsertSetupAsync(It.IsAny<ConnectSetup>())).ReturnsAsync(false);

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
