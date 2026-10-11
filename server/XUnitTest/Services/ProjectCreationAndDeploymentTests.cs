using Blocks.Genesis;
using DomainService.Access.Services;
using DomainService.Billing.Models;
using DomainService.Billing.Services;
using DomainService.Catalogue.Models;
using DomainService.Catalogue.Services;
using DomainService.Entities;
using DomainService.People;
using DomainService.Projects;
using DomainService.Shared.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;
using XUnitTest.TestSupport;

namespace XUnitTest.Services;

/// <summary>Catalogue shared by the project-side billing tests: dev free tier, repo limits per environment.</summary>
internal static class RepoCatalogue
{
    public static PlanCatalogue Build() => new()
    {
        Unlimited = -1,
        Aliases = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) { ["staging"] = "stg" },
        LimitSets = new Dictionary<string, Dictionary<string, Dictionary<string, long>>>(StringComparer.Ordinal)
        {
            ["free-dev"] = new(StringComparer.Ordinal) { ["release"] = new(StringComparer.Ordinal) { ["repos"] = 1 } },
            ["dev"] = new(StringComparer.Ordinal) { ["release"] = new(StringComparer.Ordinal) { ["repos"] = 3 } },
            ["stg"] = new(StringComparer.Ordinal) { ["release"] = new(StringComparer.Ordinal) { ["repos"] = 2 } },
            ["prod"] = new(StringComparer.Ordinal) { ["release"] = new(StringComparer.Ordinal) { ["repos"] = -1 } },
        },
        Environments = new Dictionary<string, EnvironmentDefinition>(StringComparer.Ordinal)
        {
            ["dev"] = new() { Rank = 1, LimitSet = "dev", FreeLimitSet = "free-dev", FreeTierAvailable = true, MaxFreePerProject = 1 },
            ["stg"] = new() { Rank = 3, LimitSet = "stg" },
            ["prod"] = new() { Rank = 7, LimitSet = "prod" },
        },
    };
}

/// <summary>B9: Create makes only what is free; everything else goes through checkout.</summary>
public class ProjectCreationGuardTests
{
    private readonly Mock<IProjectInventory> _inventory = new();
    private readonly Mock<ICatalogueProvider> _catalogue = new();
    private readonly Mock<IResourceLimitSeeder> _seeder = new();
    private readonly Mock<IProjectRepository> _projects = new();
    private readonly Mock<IUsageService> _usage = new();
    private ProjectInventorySnapshot _held = new();

    public ProjectCreationGuardTests()
    {
        _catalogue.SetupGet(c => c.Catalogue).Returns(RepoCatalogue.Build());
        _inventory.Setup(i => i.GetAsync(It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => _held);
    }

    private ProjectCreationGuard Guard(bool? requirePaid = null)
    {
        var settings = new Dictionary<string, string?>();
        if (requirePaid is not null)
        {
            settings[ProjectCreationGuard.RequirePaidEnvironmentsKey] = requirePaid.Value ? "true" : "false";
        }

        var deployments = new RepositoryDeploymentService(_projects.Object, _catalogue.Object, _inventory.Object, _usage.Object);

        return new ProjectCreationGuard(
            _inventory.Object,
            _catalogue.Object,
            _seeder.Object,
            deployments,
            new ConfigurationBuilder().AddInMemoryCollection(settings).Build(),
            NullLogger<ProjectCreationGuard>.Instance);
    }

    private static CreateProjectRequest Request(string? group, params string[] environments) => new()
    {
        Name = "Proj",
        TenantGroupId = group,
        applicationContexts = [.. environments.Select(e => new ApplicationContext { Environment = e, Domain = "https://x.example.com" })],
    };

    [Fact]
    public async Task By_default_a_paid_environment_is_refused_even_with_the_key_absent()
    {
        var refused = await Guard().CheckAsync(Request(null, "stg"));

        Assert.Equal(ProjectCreationGuard.RequiresCheckout, refused!["Environments"]);
    }

    [Fact]
    public async Task Free_dev_alongside_a_paid_environment_is_refused()
    {
        var refused = await Guard().CheckAsync(Request(null, "dev", "prod"));

        Assert.Equal(ProjectCreationGuard.RequiresCheckout, refused!["Environments"]);
    }

    [Fact]
    public async Task Free_dev_on_a_new_project_is_allowed()
    {
        Assert.Null(await Guard().CheckAsync(Request(null, "dev")));
    }

    [Fact]
    public async Task A_project_with_no_environment_is_allowed()
    {
        Assert.Null(await Guard().CheckAsync(Request(null)));
    }

    [Fact]
    public async Task Free_dev_is_refused_once_the_free_tier_is_taken()
    {
        _held.FreeCount["dev"] = 1;

        var refused = await Guard().CheckAsync(Request("grp_1", "dev"));

        Assert.Equal(CheckoutFailures.FreeTierTaken, refused!["Environments"]);
    }

    [Fact]
    public async Task Free_dev_is_refused_while_an_order_is_creating_dev()
    {
        _held.InFlight.Add("dev");

        var refused = await Guard().CheckAsync(Request("grp_1", "dev"));

        Assert.Equal(CheckoutFailures.EnvironmentExists, refused!["Environments"]);
    }

    [Fact]
    public async Task Turned_off_it_lets_any_environment_through()
    {
        Assert.Null(await Guard(requirePaid: false).CheckAsync(Request(null, "stg", "prod")));
    }

    [Fact]
    public async Task A_plan_over_the_free_dev_repo_limit_is_refused_at_create()
    {
        var request = Request(null, "dev");
        request.Resources = [new Resource { ResourceId = "r1" }, new Resource { ResourceId = "r2" }];
        request.RepositoryDeployments =
        [
            new RepositoryDeployment { ResourceId = "r1", Environments = ["dev"] },
            new RepositoryDeployment { ResourceId = "r2", Environments = ["dev"] },
        ];

        var refused = await Guard().CheckAsync(request);

        // Free dev holds one repository; the paid dev set would have held three.
        Assert.Equal("repos_limit_exceeded:dev", refused!["Deployments"]);
    }

    [Fact]
    public async Task A_valid_plan_at_create_is_cleaned_up_for_storage()
    {
        var request = Request(null, "dev");
        request.Resources = [new Resource { ResourceId = "r1" }];
        request.RepositoryDeployments = [new RepositoryDeployment { ResourceId = "r1", Environments = ["dev", "staging", "dev"] }];

        Assert.Null(await Guard().CheckAsync(request));
        Assert.Equal(["dev", "stg"], request.RepositoryDeployments![0].Environments);
    }

    [Fact]
    public async Task The_free_dev_just_created_is_seeded_on_the_free_limits()
    {
        await Guard().SeedFreeEnvironmentsAsync(Request(null, "dev"), "abc123");

        _seeder.Verify(s => s.SyncAsync("Dabc123", "dev", It.IsAny<string>(), true, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task A_seeding_failure_does_not_fail_the_created_project()
    {
        _seeder.Setup(s => s.SyncAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new TimeoutException());

        var exception = await Record.ExceptionAsync(() => Guard().SeedFreeEnvironmentsAsync(Request(null, "dev"), "abc123"));

        Assert.Null(exception);
    }
}

/// <summary>B10: the repository → environments plan.</summary>
public class RepositoryDeploymentServiceTests
{
    private const string Group = "grp_1";

    private readonly Mock<IProjectRepository> _projects = new();
    private readonly Mock<ICatalogueProvider> _catalogue = new();
    private readonly Mock<IProjectInventory> _inventory = new();
    private readonly Mock<IUsageService> _usage = new();
    private readonly ProjectInventorySnapshot _held = new();

    public RepositoryDeploymentServiceTests()
    {
        _catalogue.SetupGet(c => c.Catalogue).Returns(RepoCatalogue.Build());
        _inventory.Setup(i => i.GetAsync(Group, It.IsAny<string?>(), It.IsAny<CancellationToken>())).ReturnsAsync(_held);
        _projects.Setup(p => p.GetTenantAssetByGroupIdAsync(Group)).ReturnsAsync(new TenantAsset
        {
            TenantGroupId = Group,
            Resources =
            [
                new Resource { ResourceId = "r1" },
                new Resource { ResourceId = "r2" },
                new Resource { ResourceId = "r3" },
                new Resource { ResourceId = "gone", IsArchived = true },
            ],
            RepositoryDeployments =
            [
                new RepositoryDeployment { ResourceId = "r1", Environments = ["dev"] },
                new RepositoryDeployment { ResourceId = "gone", Environments = ["dev"] },
            ],
        });
        _projects.Setup(p => p.UpdateRepositoryDeploymentsAsync(Group, It.IsAny<List<RepositoryDeployment>>())).ReturnsAsync(true);
    }

    private RepositoryDeploymentService Service() => new(_projects.Object, _catalogue.Object, _inventory.Object, _usage.Object);

    private static SaveRepositoryDeploymentsRequest Save(params (string Id, string[] Envs)[] rows) => new()
    {
        TenantGroupId = Group,
        Deployments = [.. rows.Select(r => new RepositoryDeployment { ResourceId = r.Id, Environments = [.. r.Envs] })],
    };

    [Fact]
    public async Task A_valid_plan_is_stored_in_one_targeted_write()
    {
        var response = await Service().SaveAsync(Save(("r1", ["dev", "stg"]), ("r2", ["stg"])));

        Assert.True(response.IsSuccess);
        _projects.Verify(p => p.UpdateRepositoryDeploymentsAsync(Group, It.Is<List<RepositoryDeployment>>(d => d.Count == 2)), Times.Once);
        _projects.Verify(p => p.SaveTenantAssetAsync(It.IsAny<TenantAsset>()), Times.Never);
    }

    [Theory]
    [InlineData("nope", "dev", "unknown_resource:nope")]
    [InlineData("gone", "dev", "unknown_resource:gone")]
    [InlineData("r1", "moon", "unknown_environment:moon")]
    public async Task A_bad_row_is_refused_with_its_reason(string resource, string environment, string reason)
    {
        var response = await Service().SaveAsync(Save((resource, [environment])));

        Assert.False(response.IsSuccess);
        Assert.Equal(reason, response.Errors!["Deployments"]);
        _projects.Verify(p => p.UpdateRepositoryDeploymentsAsync(It.IsAny<string>(), It.IsAny<List<RepositoryDeployment>>()), Times.Never);
    }

    [Fact]
    public async Task The_same_repository_twice_is_refused()
    {
        var response = await Service().SaveAsync(Save(("r1", ["dev"]), ("r1", ["stg"])));

        Assert.Equal("duplicate_resource:r1", response.Errors!["Deployments"]);
    }

    [Fact]
    public async Task More_repositories_than_an_environment_holds_is_refused()
    {
        var response = await Service().SaveAsync(Save(("r1", ["stg"]), ("r2", ["stg"]), ("r3", ["stg"])));

        Assert.Equal("repos_limit_exceeded:stg", response.Errors!["Deployments"]);
    }

    [Fact]
    public async Task Purchased_repo_slots_raise_the_limit()
    {
        _held.Existing.Add("stg");
        _held.TenantIds["stg"] = "Sgrp_1";
        _usage.Setup(u => u.GetAsync(Group, It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ProjectUsage
            {
                Environments =
                [
                    new EnvironmentUsage
                    {
                        TenantId = "Sgrp_1",
                        Environment = "stg",
                        Services = [new ServiceUsage { Meters = [new MeterUsage { Meter = "release.repos", Purchased = 5 }] }],
                    },
                ],
            });

        var response = await Service().SaveAsync(Save(("r1", ["stg"]), ("r2", ["stg"]), ("r3", ["stg"])));

        Assert.True(response.IsSuccess);
    }

    [Fact]
    public async Task An_existing_free_dev_uses_the_free_limit()
    {
        _held.Existing.Add("dev");
        _held.FreeEnvironments.Add("dev");

        var response = await Service().SaveAsync(Save(("r1", ["dev"]), ("r2", ["dev"])));

        Assert.Equal("repos_limit_exceeded:dev", response.Errors!["Deployments"]);
    }

    [Fact]
    public async Task An_unlimited_environment_takes_any_number()
    {
        var response = await Service().SaveAsync(Save(("r1", ["prod"]), ("r2", ["prod"]), ("r3", ["prod"])));

        Assert.True(response.IsSuccess);
    }

    [Fact]
    public async Task Reading_hides_archived_repositories_and_returns_limits()
    {
        var response = await Service().GetAsync(Group);

        Assert.True(response.IsSuccess);
        Assert.Equal("r1", Assert.Single(response.Deployments).ResourceId);
        Assert.Equal(3, response.RepoLimits["dev"]);
        Assert.Equal(-1, response.RepoLimits["prod"]);
    }

    [Fact]
    public async Task An_unknown_project_is_refused()
    {
        var response = await Service().SaveAsync(new SaveRepositoryDeploymentsRequest { TenantGroupId = "other" });

        Assert.False(response.IsSuccess);
        Assert.Equal("project_not_found", response.Errors!["TenantGroupId"]);
    }
}

/// <summary>B9: a project created with no environment is owned by its creator through the group record.</summary>
public class EmptyProjectOwnershipTests
{
    private readonly Mock<IProjectRepository> _projects = new();
    private readonly Mock<IPeopleRepository> _people = new();
    private readonly Mock<IKeyValueStore> _store = new();

    private ProjectAccessService Service() =>
        new(_projects.Object, _people.Object, _store.Object, new HttpContextAccessor());

    [Fact]
    public async Task The_creator_owns_a_group_with_no_environment()
    {
        using var _ = new BlocksTestContext(userId: "creator-1");
        _projects.Setup(p => p.GetProjectIdsByGroupId("g1")).ReturnsAsync([]);
        _projects.Setup(p => p.GetTenantAssetByGroupIdAsync("g1")).ReturnsAsync(new TenantAsset { TenantGroupId = "g1", CreatedBy = "creator-1" });

        var access = await Service().ResolveAsync("g1");

        Assert.True(access.IsOwner);
        Assert.True(access.IsMember);
    }

    [Fact]
    public async Task Someone_else_does_not()
    {
        using var _ = new BlocksTestContext(userId: "stranger");
        _projects.Setup(p => p.GetProjectIdsByGroupId("g1")).ReturnsAsync([]);
        _projects.Setup(p => p.GetTenantAssetByGroupIdAsync("g1")).ReturnsAsync(new TenantAsset { TenantGroupId = "g1", CreatedBy = "creator-1" });

        var access = await Service().ResolveAsync("g1");

        Assert.False(access.IsOwner);
        Assert.False(access.IsMember);
    }

    [Fact]
    public async Task Once_an_environment_exists_the_group_record_no_longer_decides()
    {
        // Ownership may have been transferred since; only creator rows count from here on.
        using var _ = new BlocksTestContext(userId: "creator-1");
        _projects.Setup(p => p.GetProjectIdsByGroupId("g1")).ReturnsAsync(["Dg1"]);
        _people.Setup(p => p.GetProjectPeoplesAsync("creator-1", It.IsAny<List<string>>())).ReturnsAsync([]);
        _projects.Setup(p => p.GetTenantAssetByGroupIdAsync("g1")).ReturnsAsync(new TenantAsset { TenantGroupId = "g1", CreatedBy = "creator-1" });

        var access = await Service().ResolveAsync("g1");

        Assert.False(access.IsOwner);
    }
}
