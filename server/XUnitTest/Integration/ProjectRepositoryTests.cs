using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Blocks.Genesis;
using DomainService.Dtos;
using DomainService.Entities;
using DomainService.Projects;
using DomainService.Shared;
using DomainService.Shared.Entities;
using DomainService.Shared.Services;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using MongoDB.Driver;
using Moq;

namespace XUnitTest.Integration
{
    [Collection(MongoIntegrationCollection.Name)]
    public class ProjectRepositoryTests
    {
        private readonly MongoIntegrationFixture _fixture;

        public ProjectRepositoryTests(MongoIntegrationFixture fixture)
        {
            _fixture = fixture;
        }

        private ProjectRepository NewRepository()
        {
            var secret = new Mock<IBlocksSecret>();
            secret.SetupGet(s => s.DatabaseConnectionString).Returns("mongodb://localhost:27017");
            var config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?> { { "KbtclIdentifier", ".blocks.dev" } })
                .Build();
            var encoding = new Mock<IEncodingService>();
            encoding.Setup(e => e.EncodeToBase26Async(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int>()))
                    .ReturnsAsync("abcde");
            return new ProjectRepository(_fixture.DbContextProvider, config, secret.Object, encoding.Object);
        }

        private static string UserOf(string tenant) => "user-" + tenant;

        private static Tenant NewTenant(string itemId, string group, string createdBy,
            string? tenantId = null, string? domain = null, string name = "Proj")
            => new()
            {
                ItemId = itemId,
                TenantId = tenantId ?? itemId,
                TenantGroupId = group,
                CreatedBy = createdBy,
                Name = name,
                Environment = "dev",
                DbConnectionString = "mongodb://x",
                IsDisabled = false,
                JwtTokenParameters = new JwtTokenParameters
                {
                    IssueDate = DateTime.UtcNow,
                    PrivateCertificatePassword = "pwd"
                },
                Applications = domain == null
                    ? new List<Applications>()
                    : new List<Applications> { new() { Domain = domain } }
            };

        private Task InsertTenantsAsync(params Tenant[] tenants)
            => _fixture.Collection<Tenant>("Tenants").InsertManyAsync(tenants);

        private Task InsertProjectsAsync(params Project[] projects)
            => _fixture.Collection<Project>("Tenants").InsertManyAsync(projects);

        [Fact]
        public async Task InsertAndGetById_RoundTrips()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            using var _ = new IntegrationContext(tenant);
            var repo = NewRepository();
            var project = NewTenant("proj-" + tenant, "grp-" + tenant, UserOf(tenant));

            await repo.InsertProjectAsync(project);
            var loaded = await repo.GetByIdAsync(project.ItemId);

            loaded.Should().NotBeNull();
            loaded.ItemId.Should().Be(project.ItemId);
        }

        [Fact]
        public async Task GetByGroupIdAsync_ReturnsAllInGroup()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            var group = "grp-" + tenant;
            using var _ = new IntegrationContext(tenant);
            var repo = NewRepository();
            await repo.InsertProjectAsync(NewTenant("a-" + tenant, group, UserOf(tenant)));
            await repo.InsertProjectAsync(NewTenant("b-" + tenant, group, UserOf(tenant)));

            var result = await repo.GetByGroupIdAsync(group);

            result.Should().HaveCount(2);
        }

        [Fact]
        public async Task GetByDomainAsync_MatchesApplicationDomain()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            var domain = "app-" + tenant + ".example.com";
            using var _ = new IntegrationContext(tenant);
            var repo = NewRepository();
            await repo.InsertProjectAsync(NewTenant("d-" + tenant, "grp-" + tenant, UserOf(tenant), domain: domain));

            var result = await repo.GetByDomainAsync(domain);

            result.Should().NotBeNull();
            result.Applications.Should().Contain(a => a.Domain == domain);
        }

        [Fact]
        public async Task UpdateProjectAsync_ReplacesDocument()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            using var _ = new IntegrationContext(tenant);
            var repo = NewRepository();
            var project = NewTenant("u-" + tenant, "grp-" + tenant, UserOf(tenant), name: "Before");
            await repo.InsertProjectAsync(project);

            project.Name = "After";
            await repo.UpdateProjectAsync(project);

            var loaded = await repo.GetByIdAsync(project.ItemId);
            loaded.Name.Should().Be("After");
        }

        [Fact]
        public async Task GetByTenantIdAsync_ReturnsNonDisabledTenant()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            using var _ = new IntegrationContext(tenant);
            var repo = NewRepository();
            var project = NewTenant("t-" + tenant, "grp-" + tenant, UserOf(tenant), tenantId: "tid-" + tenant);
            await repo.InsertProjectAsync(project);

            var loaded = await repo.GetByTenantIdAsync("tid-" + tenant);

            loaded.Should().NotBeNull();
            loaded.TenantId.Should().Be("tid-" + tenant);
        }

        [Fact]
        public async Task StatusTracer_SaveUpsertAndQueries()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            using var _ = new IntegrationContext(tenant);
            var repo = NewRepository();
            var pid = "proj-" + tenant;
            var tracer = new ProjectStatusTracer { ProjectId = pid, IsProjectCreationSuccess = false };

            await repo.SaveStatusTracerAsync(tracer);
            var byId = await repo.GetUnfinishedProjectByIdAsync(pid);
            var all = await repo.GetAllUnfinishedProjectAsync();

            byId.Should().NotBeNull();
            all.Should().Contain(t => t.ProjectId == pid);

            // Upsert flips it to success and it should no longer be unfinished.
            await repo.SaveStatusTracerAsync(new ProjectStatusTracer { ProjectId = pid, IsProjectCreationSuccess = true });
            var afterAll = await repo.GetAllUnfinishedProjectAsync();
            afterAll.Should().NotContain(t => t.ProjectId == pid);
        }

        [Fact]
        public async Task GetProjectCountAsync_CountsOwnNonDisabledProjects()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            var user = UserOf(tenant);
            using var _ = new IntegrationContext(tenant);
            var repo = NewRepository();
            await InsertProjectsAsync(
                new Project { ItemId = "p1-" + tenant, CreatedBy = user, IsDisabled = false, TenantGroupId = "g", TenantId = "t1" },
                new Project { ItemId = "p2-" + tenant, CreatedBy = user, IsDisabled = false, TenantGroupId = "g", TenantId = "t2" },
                new Project { ItemId = "p3-" + tenant, CreatedBy = user, IsDisabled = true, TenantGroupId = "g", TenantId = "t3" });

            var count = await repo.GetProjectCountAsync();

            count.Should().Be(2);
        }

        [Fact]
        public async Task IsExistingEnviroment_DetectsMatchingEnvironment()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            var group = "grp-" + tenant;
            using var _ = new IntegrationContext(tenant);
            var repo = NewRepository();
            await InsertProjectsAsync(new Project
            {
                ItemId = "e-" + tenant,
                CreatedBy = UserOf(tenant),
                IsDisabled = false,
                TenantGroupId = group,
                TenantId = "t",
                Environment = "prod"
            });

            (await repo.IsExistingEnviroment(new List<string> { "prod" }, group)).Should().BeTrue();
            (await repo.IsExistingEnviroment(new List<string> { "staging" }, group)).Should().BeFalse();
        }

        [Fact]
        public async Task ProjectPeople_InsertAndGetProjectPeoples()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            var user = UserOf(tenant);
            var group = "grp-" + tenant;
            using var _ = new IntegrationContext(tenant);
            var repo = NewRepository();

            await repo.InsertPeopleAsync(new ProjectPeople
            {
                ItemId = "pp-" + tenant,
                UserId = user,
                TenantId = "tid-" + tenant,
                IsInvitationConfirmed = true
            });
            await InsertProjectsAsync(new Project
            {
                ItemId = "pj-" + tenant,
                CreatedBy = user,
                IsDisabled = false,
                TenantGroupId = group,
                TenantId = "tid-" + tenant
            });

            var projects = await repo.GetProjectPeoplesAsync(group);

            projects.Should().ContainSingle(p => p.TenantId == "tid-" + tenant);
        }

        [Fact]
        public async Task GetTenantAssetAsync_ReturnsFilteredPagedResources()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            var user = UserOf(tenant);
            var group = "grp-" + tenant;
            using var _ = new IntegrationContext(tenant);
            var repo = NewRepository();

            // GetProjectPeoplesAsync must find a shared project first.
            await repo.InsertPeopleAsync(new ProjectPeople
            {
                ItemId = "pp-" + tenant,
                UserId = user,
                TenantId = "tid-" + tenant,
                IsInvitationConfirmed = true
            });
            await InsertProjectsAsync(new Project
            {
                ItemId = "pj-" + tenant,
                CreatedBy = user,
                IsDisabled = false,
                TenantGroupId = group,
                TenantId = "tid-" + tenant
            });
            await _fixture.Collection<TenantAsset>("TenantAssets").InsertOneAsync(new TenantAsset
            {
                ItemId = "ta-" + tenant,
                TenantGroupId = group,
                Resources = new List<Resource>
                {
                    new() { ResourceId = "r1", Name = "Alpha repo", Link = "https://x/alpha" },
                    new() { ResourceId = "r2", Name = "Beta repo", Link = "https://x/beta" }
                }
            });

            var (asset, total) = await repo.GetTenantAssetAsync(new GetAssetRequest
            {
                TenantGroupId = group,
                Page = 0,
                PageSize = 10,
                Filter = new GetAssetFilter { Name = "Alpha" }
            });

            total.Should().Be(1);
            asset!.Resources.Should().ContainSingle(r => r.Name == "Alpha repo");
        }

        [Fact]
        public async Task GetTenantAssetAsync_NoSharedProjects_ReturnsNull()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            using var _ = new IntegrationContext(tenant);
            var repo = NewRepository();

            var (asset, total) = await repo.GetTenantAssetAsync(new GetAssetRequest
            {
                TenantGroupId = "grp-" + tenant,
                Page = 0,
                PageSize = 10
            });

            asset.Should().BeNull();
            total.Should().Be(0);
        }

        [Fact]
        public async Task SaveTenantAssetAsync_UpsertsByGroup()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            var group = "grp-" + tenant;
            using var _ = new IntegrationContext(tenant);
            var repo = NewRepository();

            var assetId = "a-" + tenant;
            await repo.SaveTenantAssetAsync(new TenantAsset { ItemId = assetId, TenantGroupId = group, Resources = new List<Resource>() });
            await repo.SaveTenantAssetAsync(new TenantAsset { ItemId = assetId, TenantGroupId = group, Resources = new List<Resource> { new() { ResourceId = "r" } } });

            var stored = await _fixture.Collection<TenantAsset>("TenantAssets")
                .Find(Builders<TenantAsset>.Filter.Eq(x => x.TenantGroupId, group)).ToListAsync();
            stored.Should().ContainSingle();
            stored.Single().Resources.Should().ContainSingle();
        }

        [Fact]
        public async Task GetBlocksGuidAsync_ReturnsByGroup()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            var group = "grp-" + tenant;
            using var _ = new IntegrationContext(tenant);
            var repo = NewRepository();
            await _fixture.Collection<BlocksGuid>("BlocksGuids").InsertOneAsync(new BlocksGuid
            {
                ItemId = "bg-" + tenant,
                TenantGroupId = group,
                EncodedValue = "enc"
            });

            var result = await repo.GetBlocksGuidAsync(group);

            result.EncodedValue.Should().Be("enc");
        }

        [Fact]
        public async Task GetSsoInfoAsync_ReturnsNonDisabled()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            using var _ = new IntegrationContext(tenant);
            var repo = NewRepository();
            await _fixture.Collection<SsoInfo>("SocialLoginCredentials").InsertOneAsync(new SsoInfo
            {
                ItemId = "sso-" + tenant,
                IsDisabled = false,
                Provider = "google-" + tenant
            });

            var result = await repo.GetSsoInfoAsync();

            result.Should().Contain(s => s.Provider == "google-" + tenant);
        }

        [Fact]
        public async Task SaveTenantCertificateAsync_UpsertsByItemId()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            using var _ = new IntegrationContext(tenant);
            var repo = NewRepository();
            var cert = new TenantCertificate { ItemId = "cert-" + tenant, Key = "k", Value = "v1" };

            (await repo.SaveTenantCertificateAsync(cert)).Should().BeTrue();
            cert.Value = "v2";
            await repo.SaveTenantCertificateAsync(cert);

            var stored = await _fixture.Collection<TenantCertificate>("TenantCertificates")
                .Find(Builders<TenantCertificate>.Filter.Eq(x => x.ItemId, cert.ItemId)).ToListAsync();
            stored.Should().ContainSingle();
            stored.Single().Value.Should().Be("v2");
        }

        [Fact]
        public async Task JWTClaims_SaveAndGet()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            using var _ = new IntegrationContext(tenant);
            var repo = NewRepository();
            var claims = new ThirdPartyJWTClaims { ItemId = "jc-" + tenant, UserId = "u", Email = "e@x.com" };

            var save = await repo.SaveJWTClaimsAsync(claims);
            var loaded = await repo.GetThirdPartyJWTClaimsAsync(claims.ItemId);

            save.IsSuccess.Should().BeTrue();
            loaded.Email.Should().Be("e@x.com");
        }

        [Fact]
        public async Task GetProjectIdsByGroupId_And_UpdateTenantGroup()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            var group = "grp-" + tenant;
            using var _ = new IntegrationContext(tenant);
            var repo = NewRepository();
            await repo.InsertProjectAsync(NewTenant("g1-" + tenant, group, UserOf(tenant), tenantId: "tg1-" + tenant, name: "Old"));
            await repo.InsertProjectAsync(NewTenant("g2-" + tenant, group, UserOf(tenant), tenantId: "tg2-" + tenant, name: "Old"));

            var ids = await repo.GetProjectIdsByGroupId(group);
            ids.Should().BeEquivalentTo(new[] { "tg1-" + tenant, "tg2-" + tenant });

            await repo.UpdateTenantGroupAsync(new UpdateTenantGroupRequest { TenantGroupId = group, Name = "Renamed" });

            var renamed = await repo.GetByGroupIdAsync(group);
            renamed.Should().OnlyContain(t => t.Name == "Renamed");
        }

        [Fact]
        public async Task DeletePrjectPeopleAsync_RemovesByTenant()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            using var _ = new IntegrationContext(tenant);
            var repo = NewRepository();
            await repo.InsertPeopleAsync(new ProjectPeople { ItemId = "d-" + tenant, TenantId = "tid-" + tenant, UserId = UserOf(tenant) });

            await repo.DeletePrjectPeopleAsync("tid-" + tenant);

            var remaining = await _fixture.Collection<ProjectPeople>("ProjectPeoples")
                .Find(Builders<ProjectPeople>.Filter.Eq(x => x.TenantId, "tid-" + tenant)).ToListAsync();
            remaining.Should().BeEmpty();
        }

        [Fact]
        public async Task GetAllByLastModifiedDateAsync_GroupsSelfProjects()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            var user = UserOf(tenant);
            var group = "grp-" + tenant;
            using var _ = new IntegrationContext(tenant);
            var repo = NewRepository();
            await InsertProjectsAsync(
                new Project { ItemId = "s1-" + tenant, CreatedBy = user, IsDisabled = false, TenantGroupId = group, TenantId = "st1-" + tenant },
                new Project { ItemId = "s2-" + tenant, CreatedBy = user, IsDisabled = false, TenantGroupId = group, TenantId = "st2-" + tenant });

            var grouped = await repo.GetAllByLastModifiedDateAsync(new GetProjectsRequest
            {
                TenantGroupId = group,
                Page = 0,
                PageSize = 10
            });

            grouped.Should().Contain(g => g.TenantGroupId == group && !g.IsShared);
            grouped.First(g => g.TenantGroupId == group && !g.IsShared).Projects.Should().HaveCount(2);
        }

        [Fact]
        public async Task GetAllByLastModifiedDateAsync_IncludesSharedProjectsFromOtherOwners()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            var user = UserOf(tenant);
            var group = "shared-grp-" + tenant;
            using var _ = new IntegrationContext(tenant);
            var repo = NewRepository();

            // A project owned by someone else, that this user has a confirmed
            // membership in, so it surfaces as a shared (not self) project.
            await InsertProjectsAsync(new Project
            {
                ItemId = "sp-" + tenant,
                CreatedBy = "another-owner",
                IsDisabled = false,
                TenantGroupId = group,
                TenantId = "shared-tid-" + tenant
            });
            await repo.InsertPeopleAsync(new ProjectPeople
            {
                ItemId = "spp-" + tenant,
                UserId = user,
                TenantId = "shared-tid-" + tenant,
                IsInvitationConfirmed = true
            });

            var grouped = await repo.GetAllByLastModifiedDateAsync(new GetProjectsRequest
            {
                TenantGroupId = group,
                Page = 0,
                PageSize = 10
            });

            grouped.Should().Contain(g => g.TenantGroupId == group && g.IsShared);
        }

        [Fact]
        public async Task GetSharedProjectsAsync_ReturnsProjectsSharedWithCurrentUser()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            var user = UserOf(tenant);
            var group = "gs-" + tenant;
            using var _ = new IntegrationContext(tenant);
            var repo = NewRepository();

            await InsertProjectsAsync(new Project
            {
                ItemId = "gsp-" + tenant,
                CreatedBy = "owner-else",
                IsDisabled = false,
                TenantGroupId = group,
                TenantId = "gs-tid-" + tenant
            });
            await repo.InsertPeopleAsync(new ProjectPeople
            {
                ItemId = "gspp-" + tenant,
                UserId = user,
                TenantId = "gs-tid-" + tenant,
                IsInvitationConfirmed = true
            });

            var shared = await repo.GetSharedProjectsAsync(group);

            shared.Should().Contain(p => p.TenantId == "gs-tid-" + tenant);
        }
    }
}
