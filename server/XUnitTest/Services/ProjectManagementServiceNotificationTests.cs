using System.Linq;
using System.Threading.Tasks;
using Blocks.Genesis;
using DomainService.Entities;
using DomainService.Projects;
using DomainService.Shared.Entities;
using FluentAssertions;
using Moq;
using Os.DataAccess.Notifications;
using XUnitTest.Notifications;
using XUnitTest.TestSupport;
using Blocks.Genesis.Entities.Os;

namespace XUnitTest.Services
{
    /// <summary>os-project-setup-failed and os-project-disabled-or-deleted.</summary>
    public partial class ProjectManagementServiceTests
    {
        private readonly RecordingSender _notifications = new();

        private ProjectManagementService ServiceWithNotifications(IBuiltInNotificationSender? sender = null) => new(
            _repo.Object, _blocksSecret.Object, _messageClient.Object, _configuration,
            _storage.Object, _tenants.Object, _certManager.Object, _encoding.Object, _cache.Object,
            new CryptoService(),
            HttpFactoryStub.Unreachable(),
            sender ?? _notifications);

        [Fact]
        public async Task ConfigureProjectAsync_Failure_TellsTheCreatorAfterSavingTheError()
        {
            using var _ = new BlocksTestContext();
            var saved = false;
            _repo.Setup(r => r.GetOwnerUserIdAsync(It.IsAny<string>())).ThrowsAsync(new System.InvalidOperationException("internal detail"));
            _repo.Setup(r => r.SaveStatusTracerAsync(It.IsAny<ProjectStatusTracer>())).Callback(() => saved = true).Returns(Task.CompletedTask);
            var project = NewTenantForConfigure();
            project.TenantGroupId = "grp";

            await ServiceWithNotifications().ConfigureProjectAsync(project);

            saved.Should().BeTrue();
            var sent = _notifications.Single(BuiltInNotificationNames.ProjectSetupFailed);
            RecordingSender.Recipients(sent).Should().Equal("creator");
            sent.IsSuccess.Should().BeFalse();
            sent.Ids["projectKey"].Should().Be("t1");
            sent.Ids["projectId"].Should().Be("item-1");
            sent.Ids["tenantGroupId"].Should().Be("grp");
            sent.Description.Should().NotContain("internal detail");
            sent.Ids.Values.Should().NotContain("internal detail");
        }

        [Fact]
        public async Task ConfigureProjectAsync_Success_SendsNothing()
        {
            using var _ = new BlocksTestContext();
            SetupCertificatePipeline();

            await ServiceWithNotifications().ConfigureProjectAsync(NewTenantForConfigure());

            _notifications.Sent.Should().BeEmpty();
        }

        [Fact]
        public async Task ConfigureProjectAsync_FailingNotifier_StillSavesTheError()
        {
            using var _ = new BlocksTestContext();
            _repo.Setup(r => r.GetOwnerUserIdAsync(It.IsAny<string>())).ThrowsAsync(new System.InvalidOperationException("x"));

            var act = () => ServiceWithNotifications(FailingNotifier.Sender()).ConfigureProjectAsync(NewTenantForConfigure());

            await act.Should().NotThrowAsync();
            _repo.Verify(r => r.SaveStatusTracerAsync(It.Is<ProjectStatusTracer>(t => t.ErrorMessage == "x")), Times.Once);
        }

        [Fact]
        public async Task DisableProjectAsync_TellsTheOwnerReadBeforeTheMembersAreRemoved_AndTheCaller()
        {
            using var _ = new BlocksTestContext(userId: "caller");
            var tenant = TenantWith();
            tenant.TenantGroupId = "grp";
            _tenants.Setup(t => t.GetTenantByID("t1")).Returns(tenant);
            _tenants.Setup(t => t.UpdateTenantVersionAsync(It.IsAny<TenantCacheUpdateMessage>())).Returns(Task.CompletedTask);

            var deleted = false;
            _repo.Setup(r => r.DeletePrjectPeopleAsync("t1")).Callback(() => deleted = true).Returns(Task.CompletedTask);
            _repo.Setup(r => r.GetOwnerUserIdAsync("t1")).ReturnsAsync(() => deleted ? null : "owner");

            var response = await ServiceWithNotifications().DisableProjectAsync("t1");

            response.IsSuccess.Should().BeTrue();
            var sent = _notifications.Single(BuiltInNotificationNames.ProjectDisabledOrDeleted);
            RecordingSender.Recipients(sent).Should().BeEquivalentTo("owner", "caller");
            sent.Ids["projectKey"].Should().Be("t1");
            sent.Ids["tenantGroupId"].Should().Be("grp");
            sent.Title.Should().Be("Environment deleted");
        }

        // One disable call removes one environment, so the text names the environment, not the project.
        [Theory]
        [InlineData("dev", "Shop", "An environment you belong to (dev of Shop) was deleted.")]
        [InlineData("dev", null, "An environment you belong to (dev) was deleted.")]
        [InlineData("dev", "  ", "An environment you belong to (dev) was deleted.")]
        [InlineData("", "Shop", "An environment you belong to was deleted.")]
        public async Task DisableProjectAsync_DescribesTheDeletedEnvironment(string environment, string? name, string expected)
        {
            using var _ = new BlocksTestContext(userId: "caller");
            var tenant = TenantWith();
            tenant.Environment = environment;
            tenant.Name = name;
            _tenants.Setup(t => t.GetTenantByID("t1")).Returns(tenant);
            _tenants.Setup(t => t.UpdateTenantVersionAsync(It.IsAny<TenantCacheUpdateMessage>())).Returns(Task.CompletedTask);

            await ServiceWithNotifications().DisableProjectAsync("t1");

            var sent = _notifications.Single(BuiltInNotificationNames.ProjectDisabledOrDeleted);
            sent.Title.Should().Be("Environment deleted");
            sent.Description.Should().Be(expected);
        }

        [Fact]
        public async Task DisableProjectAsync_OwnerLookupFails_StillDisablesAndTellsTheCaller()
        {
            using var _ = new BlocksTestContext(userId: "caller");
            _tenants.Setup(t => t.GetTenantByID("t1")).Returns(TenantWith());
            _tenants.Setup(t => t.UpdateTenantVersionAsync(It.IsAny<TenantCacheUpdateMessage>())).Returns(Task.CompletedTask);
            _repo.Setup(r => r.GetOwnerUserIdAsync("t1")).ThrowsAsync(new System.InvalidOperationException("db"));

            var response = await ServiceWithNotifications().DisableProjectAsync("t1");

            response.IsSuccess.Should().BeTrue();
            _repo.Verify(r => r.DeletePrjectPeopleAsync("t1"), Times.Once);
            RecordingSender.Recipients(_notifications.Sent.Single()).Should().Equal("caller");
        }

        [Fact]
        public async Task DisableProjectAsync_UnknownProject_SendsNothing()
        {
            using var _ = new BlocksTestContext();
            _tenants.Setup(t => t.GetTenantByID(It.IsAny<string>())).Returns((Tenant?)null);

            await ServiceWithNotifications().DisableProjectAsync("missing");

            _notifications.Sent.Should().BeEmpty();
        }
    }
}
