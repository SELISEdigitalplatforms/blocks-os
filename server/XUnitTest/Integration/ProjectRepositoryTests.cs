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
using MongoDB.Bson;
using MongoDB.Driver;
using Moq;
using XUnitTest.TestSupport;

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

        private ProjectRepository NewRepository() => NewRepository(_fixture.DbContextProvider);

        private ProjectRepository NewRepository(IDbContextProvider provider)
        {
            var secret = new Mock<IBlocksSecret>();
            secret.SetupGet(s => s.DatabaseConnectionString).Returns("mongodb://localhost:27017");
            var config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?> { { "KbtclIdentifier", ".blocks.dev" } })
                .Build();
            var encoding = new Mock<IEncodingService>();
            encoding.Setup(e => e.EncodeToBase26Async(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int>()))
                    .ReturnsAsync("abcde");
            return new ProjectRepository(provider, config, secret.Object, encoding.Object);
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
                new Project { ItemId = "p1-" + tenant, CreatedBy = user, IsDisabled = false, TenantGroupId = "g", TenantId = "t1-" + tenant },
                new Project { ItemId = "p2-" + tenant, CreatedBy = user, IsDisabled = false, TenantGroupId = "g", TenantId = "t2-" + tenant },
                new Project { ItemId = "p3-" + tenant, CreatedBy = user, IsDisabled = true, TenantGroupId = "g", TenantId = "t3-" + tenant });
            await repo.InsertPeopleAsync(new ProjectPeople { ItemId = "pp1-" + tenant, UserId = user, TenantId = "t1-" + tenant, IsCreator = true });
            await repo.InsertPeopleAsync(new ProjectPeople { ItemId = "pp2-" + tenant, UserId = user, TenantId = "t2-" + tenant, IsCreator = true });
            await repo.InsertPeopleAsync(new ProjectPeople { ItemId = "pp3-" + tenant, UserId = user, TenantId = "t3-" + tenant, IsCreator = true });

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

        // The repositories page has a single search box covering both columns, so Search has to
        // match either one and the count has to describe the whole match, not the page.
        [Fact]
        public async Task GetTenantAssetAsync_SearchMatchesNameOrLinkAndCountsBeyondThePage()
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

            var resources = Enumerable.Range(0, 5)
                .Select(i => new Resource
                {
                    ResourceId = "r" + i,
                    Name = "acme/service-" + i,
                    Link = "https://github.com/acme/service-" + i
                })
                .ToList();
            resources.Add(new Resource
            {
                ResourceId = "r-link",
                Name = "unrelated",
                Link = "https://github.com/acme/hidden"
            });
            await _fixture.Collection<TenantAsset>("TenantAssets").InsertOneAsync(new TenantAsset
            {
                ItemId = "ta-" + tenant,
                TenantGroupId = group,
                Resources = resources
            });

            var (firstPage, total) = await repo.GetTenantAssetAsync(new GetAssetRequest
            {
                TenantGroupId = group,
                Page = 0,
                PageSize = 2,
                Filter = new GetAssetFilter { Search = "acme" }
            });

            // Five by name plus the one that only matches on its link.
            total.Should().Be(6);
            firstPage!.Resources.Should().HaveCount(2);

            var (lastPage, _) = await repo.GetTenantAssetAsync(new GetAssetRequest
            {
                TenantGroupId = group,
                Page = 2,
                PageSize = 2,
                Filter = new GetAssetFilter { Search = "acme" }
            });

            lastPage!.Resources.Should().Contain(r => r.ResourceId == "r-link");
        }

        // Deleting a repository archives its row, and every read has to hide it — including the
        // count the pager is built from.
        [Fact]
        public async Task GetTenantAssetAsync_ExcludesArchivedResources()
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
            await _fixture.Collection<TenantAsset>("TenantAssets").InsertOneAsync(new TenantAsset
            {
                ItemId = "ta-" + tenant,
                TenantGroupId = group,
                Resources = new List<Resource>
                {
                    new() { ResourceId = "live", Name = "acme/live", Link = "https://github.com/acme/live" },
                    new() { ResourceId = "gone", Name = "acme/gone", Link = "https://github.com/acme/gone", IsArchived = true }
                }
            });

            var (asset, total) = await repo.GetTenantAssetAsync(new GetAssetRequest
            {
                TenantGroupId = group,
                Page = 0,
                PageSize = 10
            });

            total.Should().Be(1);
            asset!.Resources.Should().ContainSingle(r => r.ResourceId == "live");

            // Nor should an archived row be reachable by searching for it.
            var (searched, searchTotal) = await repo.GetTenantAssetAsync(new GetAssetRequest
            {
                TenantGroupId = group,
                Page = 0,
                PageSize = 10,
                Filter = new GetAssetFilter { Search = "gone" }
            });

            searchTotal.Should().Be(0);
            searched!.Resources.Should().BeEmpty();
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
        public async Task GetTenantAssetByGroupIdAsync_ReturnsEveryResourceUnpaged()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            var group = "grp-" + tenant;
            using var _ = new IntegrationContext(tenant);
            var repo = NewRepository();

            // More than one default page (10) so truncation would be visible.
            var resources = Enumerable.Range(0, 15)
                .Select(i => new Resource { ResourceId = "r" + i, Name = "repo-" + i, Link = "https://x/" + i })
                .ToList();
            await _fixture.Collection<TenantAsset>("TenantAssets").InsertOneAsync(new TenantAsset
            {
                ItemId = "ta-" + tenant,
                TenantGroupId = group,
                Resources = resources
            });

            var asset = await repo.GetTenantAssetByGroupIdAsync(group);

            asset!.Resources.Should().HaveCount(15);
        }

        [Fact]
        public async Task UpdateRepoResourceInfoAsync_RewritesNameAndLinkForEveryTenantInTheGroup()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            var group = "grp-" + tenant;
            using var _ = new IntegrationContext(tenant);
            var repo = NewRepository();

            await InsertTenantsAsync(
                NewTenant("dev-" + tenant, group, UserOf(tenant), tenantId: "DEV" + tenant),
                NewTenant("prod-" + tenant, group, UserOf(tenant), tenantId: "PROD" + tenant));

            var repos = _fixture.Collection<BsonDocument>("Repos");
            await repos.InsertManyAsync(new[]
            {
                new BsonDocument
                {
                    ["_id"] = "repo-dev-" + tenant,
                    ["SourceRepoId"] = "1271072719",
                    ["RepoName"] = "owner/old-name",
                    ["RepoUrl"] = "https://github.com/owner/old-name",
                    ["ProjectId"] = "DEV" + tenant,
                    ["DefaultDeploymentUrl"] = "https://dev-abcde-abcde.blocks.dev"
                },
                new BsonDocument
                {
                    ["_id"] = "repo-prod-" + tenant,
                    ["SourceRepoId"] = "1271072719",
                    ["RepoName"] = "owner/old-name",
                    ["RepoUrl"] = "https://github.com/owner/old-name",
                    ["ProjectId"] = "PROD" + tenant,
                    ["DefaultDeploymentUrl"] = "https://abcde-abcde.blocks.dev"
                },
                new BsonDocument
                {
                    ["_id"] = "repo-other-" + tenant,
                    ["SourceRepoId"] = "9999",
                    ["RepoName"] = "owner/untouched",
                    ["RepoUrl"] = "https://github.com/owner/untouched",
                    ["ProjectId"] = "DEV" + tenant
                }
            });

            await repo.UpdateRepoResourceInfoAsync(new AddAssetRequest
            {
                TenantGroupId = group,
                Resource = new Resource
                {
                    ResourceId = "1271072719",
                    Name = "owner/new-name",
                    Link = "https://github.com/owner/new-name"
                }
            });

            var renamed = await repos
                .Find(Builders<BsonDocument>.Filter.Eq("SourceRepoId", "1271072719")).ToListAsync();
            renamed.Should().HaveCount(2);
            renamed.Should().OnlyContain(d => d["RepoName"].AsString == "owner/new-name"
                                           && d["RepoUrl"].AsString == "https://github.com/owner/new-name");
            // The deployment url is derived from the resource id, so a rename must not move it.
            renamed.Single(d => d["ProjectId"].AsString == "DEV" + tenant)["DefaultDeploymentUrl"]
                .AsString.Should().Be("https://dev-abcde-abcde.blocks.dev");

            var untouched = await repos
                .Find(Builders<BsonDocument>.Filter.Eq("SourceRepoId", "9999")).FirstAsync();
            untouched["RepoName"].AsString.Should().Be("owner/untouched");
        }

        // Deleting archives the tenant copies instead of dropping them, and re-adding the same
        // repository clears the flag again.
        [Fact]
        public async Task ArchiveRepoResourceAsync_FlagsEveryTenantCopyAndRestoreClearsIt()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            var group = "grp-" + tenant;
            using var _ = new IntegrationContext(tenant);
            var repo = NewRepository();

            await InsertTenantsAsync(
                NewTenant("dev-" + tenant, group, UserOf(tenant), tenantId: "DEV" + tenant),
                NewTenant("prod-" + tenant, group, UserOf(tenant), tenantId: "PROD" + tenant));

            var repos = _fixture.Collection<BsonDocument>("Repos");
            await repos.InsertManyAsync(new[]
            {
                new BsonDocument
                {
                    ["_id"] = "arc-dev-" + tenant,
                    ["SourceRepoId"] = "1210631964",
                    ["RepoName"] = "owner/repo",
                    ["RepoUrl"] = "https://github.com/owner/repo",
                    ["IsArchived"] = false,
                    ["ProjectId"] = "DEV" + tenant
                },
                new BsonDocument
                {
                    ["_id"] = "arc-prod-" + tenant,
                    ["SourceRepoId"] = "1210631964",
                    ["RepoName"] = "owner/repo",
                    ["RepoUrl"] = "https://github.com/owner/repo",
                    ["IsArchived"] = false,
                    ["ProjectId"] = "PROD" + tenant
                },
                // A row that predates the flag: the update has to add the field, not skip it.
                new BsonDocument
                {
                    ["_id"] = "arc-legacy-" + tenant,
                    ["SourceRepoId"] = "1210631964",
                    ["RepoName"] = "owner/repo",
                    ["ProjectId"] = "DEV" + tenant
                },
                new BsonDocument
                {
                    ["_id"] = "arc-other-" + tenant,
                    ["SourceRepoId"] = "8888",
                    ["RepoName"] = "owner/other",
                    ["IsArchived"] = false,
                    ["ProjectId"] = "DEV" + tenant
                }
            });

            await repo.ArchiveRepoResourceAsync(new DeleteAssetRequest
            {
                TenantGroupId = group,
                ResourceId = "1210631964"
            });

            var archived = await repos
                .Find(Builders<BsonDocument>.Filter.Eq("SourceRepoId", "1210631964")).ToListAsync();
            archived.Should().HaveCount(3);
            archived.Should().OnlyContain(d => d["IsArchived"].AsBoolean);

            var other = await repos
                .Find(Builders<BsonDocument>.Filter.Eq("SourceRepoId", "8888")).FirstAsync();
            other["IsArchived"].AsBoolean.Should().BeFalse();

            // Re-adding the repository puts the tenant copies back in play.
            await repo.UpdateRepoResourceInfoAsync(new AddAssetRequest
            {
                TenantGroupId = group,
                Resource = new Resource
                {
                    ResourceId = "1210631964",
                    Name = "owner/repo",
                    Link = "https://github.com/owner/repo"
                }
            });

            var restored = await repos
                .Find(Builders<BsonDocument>.Filter.Eq("SourceRepoId", "1210631964")).ToListAsync();
            restored.Should().OnlyContain(d => !d["IsArchived"].AsBoolean);
        }

        [Fact]
        public async Task UpdateTenantAssetAsync_InsertsAsset()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            var group = "uta-" + tenant;
            using var _ = new IntegrationContext(tenant);
            var repo = NewRepository();

            await repo.UpdateTenantAssetAsync(new TenantAsset
            {
                ItemId = "asset-" + tenant,
                TenantGroupId = group,
                Resources = new List<Resource> { new() { ResourceId = "r1", Name = "Repo" } }
            });

            var stored = await _fixture.Collection<TenantAsset>("TenantAssets")
                .Find(Builders<TenantAsset>.Filter.Eq(x => x.TenantGroupId, group)).ToListAsync();
            stored.Should().ContainSingle();
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
        public async Task DeletePrjectPeopleAsync_WhenImpersonating_RemovesFromTheClientDb()
        {
            // Project/Disable always runs impersonated: the controller hands DisableProjectAsync the
            // impersonated TenantId as the project to disable. `ResolvedClientDb` therefore pins
            // every ProjectPeoples read and write to BlocksRootDb, while the raw
            // `IDbContextProvider.GetCollection` resolves to the impersonated project's own tenant
            // database instead -- a database these rows have never been written to. The delete used
            // the latter, so it matched nothing and still reported success, leaving each disabled
            // project's people behind (they surface in the People list with a blank Environment,
            // because the tenant lookup that fills that column no longer resolves).
            //
            // The shared fixture cannot catch this: its provider resolves BlocksRootDb, every
            // tenant db and every GetCollection call to one throwaway database, so the two handles
            // are indistinguishable there. This provider keeps them apart, which is the only way
            // the regression is visible.
            var tenant = MongoIntegrationFixture.NewTenantId();
            var provider = new SplitDatabaseContextProvider(_fixture.Client, _fixture.Database, "tenantdb_" + tenant);

            // The context has to exist before the repository is built -- `_clientDb` is resolved
            // once, in the constructor.
            using var _ = new BlocksTestContext(tenantId: tenant, impersonated: true, originalTenantId: "root-" + tenant);
            var repo = NewRepository(provider);

            await repo.InsertPeopleAsync(new ProjectPeople { ItemId = "imp-" + tenant, TenantId = "tid-" + tenant, UserId = UserOf(tenant) });

            await repo.DeletePrjectPeopleAsync("tid-" + tenant);

            var remaining = await _fixture.Collection<ProjectPeople>("ProjectPeoples")
                .Find(Builders<ProjectPeople>.Filter.Eq(x => x.TenantId, "tid-" + tenant)).ToListAsync();
            remaining.Should().BeEmpty();

            provider.Drop();
        }

        /// <summary>
        /// Resolves BlocksRootDb to the fixture's database and every tenant-scoped request to a
        /// separate one, so a repository reaching for the wrong handle reads an empty collection.
        /// </summary>
        private sealed class SplitDatabaseContextProvider : IDbContextProvider
        {
            private readonly IMongoClient _client;
            private readonly IMongoDatabase _rootDatabase;
            private readonly IMongoDatabase _tenantDatabase;
            private readonly string _tenantDatabaseName;

            public SplitDatabaseContextProvider(IMongoClient client, IMongoDatabase rootDatabase, string tenantDatabaseName)
            {
                _client = client;
                _rootDatabase = rootDatabase;
                _tenantDatabaseName = tenantDatabaseName;
                _tenantDatabase = client.GetDatabase(tenantDatabaseName);
            }

            public void Drop() => _client.DropDatabase(_tenantDatabaseName);

            public IMongoDatabase GetDatabase(string tenantId) => _tenantDatabase;

            public IMongoDatabase GetDatabase() => _tenantDatabase;

            public IMongoDatabase GetDatabase(string connectionString, string databaseName, bool isCacheRefreshed = false) =>
                databaseName == "BlocksRootDb" ? _rootDatabase : _tenantDatabase;

            public IMongoCollection<T> GetCollection<T>(string collectionName) =>
                _tenantDatabase.GetCollection<T>(collectionName);

            public IMongoCollection<T> GetCollection<T>(string tenantId, string collectionName) =>
                _tenantDatabase.GetCollection<T>(collectionName);
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
            await repo.InsertPeopleAsync(new ProjectPeople { ItemId = "spp1-" + tenant, UserId = user, TenantId = "st1-" + tenant, IsCreator = true });
            await repo.InsertPeopleAsync(new ProjectPeople { ItemId = "spp2-" + tenant, UserId = user, TenantId = "st2-" + tenant, IsCreator = true });

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
