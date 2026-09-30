using Blocks.Genesis;
using DomainService.Billing.Entities;
using DomainService.Billing.Services;
using DomainService.Catalogue.Services;
using DomainService.Dtos;
using DomainService.Projects;
using DomainService.Shared;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace XUnitTest.Billing;

/// <summary>
/// The join between a paid order and the environments it bought.
/// </summary>
public class ProvisioningStepRunnerTests
{
    private const string Group = "grp1";
    private const string User = "usr_1";

    private readonly Mock<IProjectRepository> _projects = new();
    private readonly Mock<IProjectManagementService> _projectManagement = new();
    private readonly Mock<IResourceLimitSeeder> _seeder = new();
    private readonly Mock<ICatalogueProvider> _catalogue = new();

    private ProvisioningStepRunner Runner() =>
        new(_projects.Object, _projectManagement.Object, _seeder.Object, _catalogue.Object,
            NullLogger<ProvisioningStepRunner>.Instance);

    private static SubscriptionOrder Order() => new()
    {
        ItemId = "ord_1",
        TenantGroupId = Group,
        CreatedByUserId = User,
        Lines = [new OrderLine { Kind = "environment", Environment = "dev", Amount = 50m, Billing = "rent" }],
    };

    private static OrderEnvironmentProgress Dev() => new() { Environment = "dev" };

    /// <summary>The id SaveProjectAsync would give it, computed the same way the runner does.</summary>
    private static string ExpectedId(string environment) =>
        IdentifierHelper.EnvironmentMapper(environment).ToUpperInvariant() + Group;

    /// <summary>A Tenant with its required members filled in; none of them matter here.</summary>
    private static Tenant TenantRow(string tenantId) => new()
    {
        TenantId = tenantId,
        TenantGroupId = Group,
        DbConnectionString = string.Empty,
        JwtTokenParameters = new JwtTokenParameters { PrivateCertificatePassword = string.Empty, IssueDate = DateTime.UtcNow },
    };

    private void GroupHas(params string[] tenantIds) =>
        _projects
            .Setup(p => p.GetByGroupIdAsync(Group))
            .ReturnsAsync([.. tenantIds.Select(TenantRow)]);

    [Fact]
    public async Task An_absent_environment_is_created_through_the_existing_project_flow()
    {
        var queue = new Queue<List<Tenant>>();
        queue.Enqueue([]);                                                     // before
        queue.Enqueue([TenantRow(ExpectedId("dev"))]);                          // after
        _projects.Setup(p => p.GetByGroupIdAsync(Group)).ReturnsAsync(queue.Dequeue);

        _projectManagement
            .Setup(m => m.SaveProjectAsync(It.IsAny<CreateProjectRequest>()))
            .ReturnsAsync(new CreateProjectResponse { IsSuccess = true, TenantGroupId = Group });

        var outcome = await Runner().RunAsync(Order(), Dev(), ProvisioningSteps.CreateTenant);

        Assert.True(outcome.Succeeded);
        Assert.Equal(ExpectedId("dev"), outcome.TenantId);

        // Naming the existing group is what makes this an added environment, not a new project.
        _projectManagement.Verify(
            m => m.SaveProjectAsync(It.Is<CreateProjectRequest>(r =>
                r.TenantGroupId == Group
                && r.applicationContexts.Count == 1
                && r.applicationContexts[0].Environment == "dev")),
            Times.Once);
    }

    [Fact]
    public async Task An_environment_that_already_exists_is_adopted_rather_than_created_twice()
    {
        GroupHas(ExpectedId("dev"));

        var outcome = await Runner().RunAsync(Order(), Dev(), ProvisioningSteps.CreateTenant);

        Assert.True(outcome.Succeeded);
        Assert.Equal(ExpectedId("dev"), outcome.TenantId);
        // Idempotence is the whole reason a paid order can be retried without fear.
        _projectManagement.Verify(m => m.SaveProjectAsync(It.IsAny<CreateProjectRequest>()), Times.Never);
    }

    [Fact]
    public async Task A_refused_creation_fails_the_step_rather_than_pretending_it_worked()
    {
        GroupHas();
        _projectManagement
            .Setup(m => m.SaveProjectAsync(It.IsAny<CreateProjectRequest>()))
            .ReturnsAsync(new CreateProjectResponse
            {
                IsSuccess = false,
                Errors = new Dictionary<string, string> { ["database_configuration"] = "no placement" },
            });

        var outcome = await Runner().RunAsync(Order(), Dev(), ProvisioningSteps.CreateTenant);

        Assert.False(outcome.Succeeded);
        Assert.Equal("no placement", outcome.Error);
    }

    [Fact]
    public async Task A_tenant_created_but_not_yet_readable_is_transient_not_fatal()
    {
        // Created, but the read that follows does not see it yet. The retry adopts it.
        GroupHas();
        _projectManagement
            .Setup(m => m.SaveProjectAsync(It.IsAny<CreateProjectRequest>()))
            .ReturnsAsync(new CreateProjectResponse { IsSuccess = true, TenantGroupId = Group });

        var outcome = await Runner().RunAsync(Order(), Dev(), ProvisioningSteps.CreateTenant);

        Assert.False(outcome.Succeeded);
        Assert.Equal("tenant_not_ready", outcome.Error);
    }

    [Fact]
    public async Task The_acting_user_comes_from_the_order_because_a_worker_has_no_request()
    {
        GroupHas();
        string? seenUser = null;
        _projectManagement
            .Setup(m => m.SaveProjectAsync(It.IsAny<CreateProjectRequest>()))
            .Callback(() => seenUser = BlocksContext.GetContext()?.UserId)
            .ReturnsAsync(new CreateProjectResponse { IsSuccess = true });

        await Runner().RunAsync(Order(), Dev(), ProvisioningSteps.CreateTenant);

        Assert.Equal(User, seenUser);
        // And it is put back, so nothing leaks into whatever the worker does next.
        Assert.NotEqual(User, BlocksContext.GetContext()?.UserId);
    }

    [Fact]
    public async Task Seeding_quota_needs_a_tenant_and_says_so()
    {
        var outcome = await Runner().RunAsync(Order(), Dev(), ProvisioningSteps.SeedQuota);

        Assert.False(outcome.Succeeded);
        Assert.Equal("tenant_unknown", outcome.Error);
    }

    [Fact]
    public async Task A_free_environment_is_seeded_with_its_free_tier_limits()
    {
        var order = Order();
        order.Lines[0].Amount = 0m;
        var environment = Dev();
        environment.TenantId = ExpectedId("dev");

        await Runner().RunAsync(order, environment, ProvisioningSteps.SeedQuota);

        _seeder.Verify(
            s => s.SyncAsync(environment.TenantId, "dev", It.IsAny<string>(), true, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task A_configuration_step_reports_what_the_tracer_recorded()
    {
        var environment = Dev();
        environment.TenantId = ExpectedId("dev");

        _projects
            .Setup(p => p.GetUnfinishedProjectByIdAsync(environment.TenantId))
            .ReturnsAsync(new DomainService.Entities.ProjectStatusTracer
            {
                ProjectId = environment.TenantId,
                IsCertificatesUploaded = true,
                IsDefaultConfigurationCopied = false,
                ErrorMessage = "still copying",
            });

        var done = await Runner().RunAsync(Order(), environment, ProvisioningSteps.UploadCertificates);
        var notDone = await Runner().RunAsync(Order(), environment, ProvisioningSteps.CopyConfiguration);

        Assert.True(done.Succeeded);
        Assert.False(notDone.Succeeded);
        Assert.Equal("still copying", notDone.Error);
    }

    [Fact]
    public async Task No_unfinished_record_means_configuration_completed()
    {
        var environment = Dev();
        environment.TenantId = ExpectedId("dev");
        _projects
            .Setup(p => p.GetUnfinishedProjectByIdAsync(environment.TenantId))
            .ReturnsAsync((DomainService.Entities.ProjectStatusTracer?)null);

        var outcome = await Runner().RunAsync(Order(), environment, ProvisioningSteps.ApplySettings);

        Assert.True(outcome.Succeeded);
    }
}
