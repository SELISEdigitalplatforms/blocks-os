using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Blocks.Genesis;
using DomainService.Entities;
using DomainService.Projects;
using DomainService.Shared.Services;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using MongoDB.Bson;
using MongoDB.Driver;
using Moq;

namespace XUnitTest.Integration
{
    [Collection(MongoIntegrationCollection.Name)]
    public class ProjectRepositoryConfigCopyTests
    {
        private readonly MongoIntegrationFixture _fixture;

        public ProjectRepositoryConfigCopyTests(MongoIntegrationFixture fixture)
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

        private static Tenant NewProject(string suffix)
            => new()
            {
                ItemId = "proj-" + suffix,
                TenantId = "tid-" + suffix,
                TenantGroupId = "grp-" + suffix,
                CreatedBy = "creator-" + suffix,
                Name = "Proj",
                Environment = "dev",
                DBName = "projdb-" + suffix,
                DbConnectionString = "mongodb://x",
                Applications = new List<Applications> { new() { Domain = "app-" + suffix + ".example.com" } },
                JwtTokenParameters = new JwtTokenParameters { IssueDate = DateTime.UtcNow, PrivateCertificatePassword = "p" }
            };

        private IMongoDatabase SourceDb() => _fixture.DbContextProvider.GetDatabase("", "BlocksConfiguration");

        private IMongoDatabase TargetDb(Tenant project) => _fixture.DbContextProvider.GetDatabase("", project.DBName);

        [Fact]
        public async Task CreateDefaultConfigurationAsync_CopiesSourceCollectionsIntoProjectDb()
        {
            var suffix = Guid.NewGuid().ToString("N");
            using var _ = new IntegrationContext(suffix);
            var project = NewProject(suffix);

            // Seed source (BlocksConfiguration) collections that the copy pipeline reads.
            var source = SourceDb();
            await source.GetCollection<BsonDocument>("MailServerConfigurations")
                .InsertOneAsync(new BsonDocument { { "_id", "mail-" + suffix }, { "Name", "smtp" } });
            await source.GetCollection<BsonDocument>("EmailTemplates")
                .InsertOneAsync(new BsonDocument { { "_id", "tpl-" + suffix }, { "Name", "welcome" } });
            await source.GetCollection<BsonDocument>("IdentityConfigurations")
                .InsertOneAsync(new BsonDocument { { "_id", "idc-" + suffix }, { "AccountActionBaseUrl", "old" } });

            var tracer = new ProjectStatusTracer { ProjectId = project.ItemId };
            await NewRepository().CreateDefaultConfigurationAsync(tracer, project);

            tracer.IsDefaultConfigurationCopied.Should().BeTrue();

            var target = TargetDb(project);
            var copiedMail = await target.GetCollection<BsonDocument>("MailServerConfigurations")
                .Find(FilterDefinition<BsonDocument>.Empty).ToListAsync();
            copiedMail.Should().ContainSingle();
            copiedMail[0]["CreatedBy"].AsString.Should().Be(project.CreatedBy);

            var copiedIdentity = await target.GetCollection<BsonDocument>("IdentityConfigurations")
                .Find(FilterDefinition<BsonDocument>.Empty).FirstOrDefaultAsync();
            copiedIdentity.Should().NotBeNull();
            copiedIdentity["AccountActionBaseUrl"].AsString.Should().Be(project.Applications.First().Domain);
        }

        [Fact]
        public async Task CreateDefaultConfigurationAsync_WhenAlreadyCopied_IsNoOp()
        {
            var suffix = Guid.NewGuid().ToString("N");
            using var _ = new IntegrationContext(suffix);
            var project = NewProject(suffix);
            var tracer = new ProjectStatusTracer { ProjectId = project.ItemId, IsDefaultConfigurationCopied = true };

            await NewRepository().CreateDefaultConfigurationAsync(tracer, project);

            var target = TargetDb(project);
            var names = await (await target.ListCollectionNamesAsync()).ToListAsync();
            names.Should().BeEmpty();
        }

        [Fact]
        public async Task SaveRepoInfoAsync_WritesReposWithDeploymentUrl()
        {
            var suffix = Guid.NewGuid().ToString("N");
            using var _ = new IntegrationContext(suffix);
            var project = NewProject(suffix);
            var resources = new List<Resource>
            {
                new() { ResourceId = "r1", Name = "Frontend", Link = "https://git/fe" },
                new() { ResourceId = "r2", Name = "Backend", Link = "https://git/be" }
            };

            await NewRepository().SaveRepoInfoAsync(project, resources);

            var target = TargetDb(project);
            var repos = await target.GetCollection<BsonDocument>("Repos")
                .Find(FilterDefinition<BsonDocument>.Empty).ToListAsync();
            repos.Should().HaveCount(2);
            repos.Should().Contain(r => r["DefaultDeploymentUrl"].AsString == project.Applications.First().Domain);
        }

        [Fact]
        public async Task UpdateRepoResourceAsync_InsertsRepoForEachProjectInGroup()
        {
            var suffix = Guid.NewGuid().ToString("N");
            using var _ = new IntegrationContext(suffix);
            var repo = NewRepository();
            var project = NewProject(suffix);
            await repo.InsertProjectAsync(project);

            await repo.UpdateRepoResourceAsync(new AddAssetRequest
            {
                TenantGroupId = project.TenantGroupId,
                Resource = new Resource { ResourceId = "r1", Name = "Svc", Link = "https://git/svc" }
            });

            // Repos are written to the project tenant database (the main throwaway db).
            var repos = await _fixture.Collection<BsonDocument>("Repos")
                .Find(Builders<BsonDocument>.Filter.Eq("ProjectId", project.TenantId)).ToListAsync();
            repos.Should().ContainSingle();
        }

        [Fact]
        public async Task UpdateIamConfigurationAsync_UpdatesExistingIamConfiguration()
        {
            var suffix = Guid.NewGuid().ToString("N");
            using var _ = new IntegrationContext(suffix);
            var project = NewProject(suffix);
            // IamConfigurations lives in the tenant database (main throwaway db).
            await _fixture.Collection<BsonDocument>("IamConfigurations").InsertOneAsync(new BsonDocument
            {
                { "_id", "iam-" + suffix },
                { "AccountActivationUrl", "old" }
            });

            await NewRepository().UpdateIamConfigurationAsync(project);

            var updated = await _fixture.Collection<BsonDocument>("IamConfigurations")
                .Find(Builders<BsonDocument>.Filter.Eq("_id", "iam-" + suffix)).FirstAsync();
            var domain = project.Applications.First().Domain;
            updated["AccountActivationUrl"].AsString.Should().Be($"{domain}/activate");
        }
    }
}
