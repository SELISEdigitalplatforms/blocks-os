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

        private ProjectRepository NewRepository(bool? dataGatewayRootOn = null)
        {
            var secret = new Mock<IBlocksSecret>();
            secret.SetupGet(s => s.DatabaseConnectionString).Returns("mongodb://localhost:27017");
            secret.SetupGet(s => s.RootDatabaseName).Returns("BlocksRootDb");
            var config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?> { { "KbtclIdentifier", ".blocks.dev" } })
                .AddInMemoryCollection(dataGatewayRootOn.HasValue
                    ? new Dictionary<string, string?> { { "DataGateway:RootConfigEnabled", dataGatewayRootOn.Value ? "true" : "false" } }
                    : new Dictionary<string, string?>())
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
        public async Task CreateDefaultConfigurationAsync_KeepsOnlyCloudUserDefaultRole()
        {
            var suffix = Guid.NewGuid().ToString("N");
            using var _ = new IntegrationContext(suffix);
            var project = NewProject(suffix);

            var source = SourceDb();
            await source.GetCollection<BsonDocument>("Roles")
                .InsertManyAsync(new[]
                {
                    new BsonDocument
                    {
                        { "_id", "role-user-" + suffix },
                        { "Name", "User" },
                        { "Slug", "user" },
                        { "fid", "user" },
                        { "ParentRoleSlug", "user" },
                        { "AncestorRoleSlugs", new BsonArray { "user" } },
                        { "Metadata", new BsonDocument { { "DefaultRole", "user" } } }
                    },
                    new BsonDocument
                    {
                        { "_id", "role-clouduser-" + suffix },
                        { "Name", "Cloud User" },
                        { "Slug", "clouduser" },
                        { "fid", "clouduser" }
                    }
                });

            var tracer = new ProjectStatusTracer { ProjectId = project.ItemId };
            await NewRepository().CreateDefaultConfigurationAsync(tracer, project);

            var copiedRoles = await TargetDb(project).GetCollection<BsonDocument>("Roles")
                .Find(Builders<BsonDocument>.Filter.In("_id", new[] { "role-user-" + suffix, "role-clouduser-" + suffix }))
                .ToListAsync();

            copiedRoles.Should().ContainSingle();
            copiedRoles[0]["Name"].AsString.Should().Be("clouduser");
            copiedRoles[0]["Slug"].AsString.Should().Be("clouduser");
            copiedRoles[0]["fid"].AsString.Should().Be("clouduser");
            copiedRoles[0]["ParentRoleSlug"].AsString.Should().Be("clouduser");
            copiedRoles[0]["AncestorRoleSlugs"].AsBsonArray[0].AsString.Should().Be("clouduser");
            copiedRoles[0]["Metadata"].AsBsonDocument["DefaultRole"].AsString.Should().Be("clouduser");
        }

        [Fact]
        public async Task CreateDefaultConfigurationAsync_WhenAlreadyCopied_IsNoOp()
        {
            var suffix = Guid.NewGuid().ToString("N");
            using var _ = new IntegrationContext(suffix);
            var project = NewProject(suffix);
            var tracer = new ProjectStatusTracer { ProjectId = project.ItemId, IsDefaultConfigurationCopied = true, IsSeedSchemaApplied = true };

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

        [Fact]
        public async Task CreateDefaultConfigurationAsync_CopiesSeedDocumentsThenSeedCollectionsAndIndexes()
        {
            var suffix = Guid.NewGuid().ToString("N");
            using var _ = new IntegrationContext(suffix);
            var project = NewProject(suffix);
            var source = SourceDb();
            await source.GetCollection<BsonDocument>("EmailTemplates")
                .InsertOneAsync(new BsonDocument { { "_id", "tpl-idx-" + suffix }, { "Name", "welcome" }, { "Language", "en" } });
            await source.GetCollection<BsonDocument>("EmailTemplates").Indexes.CreateOneAsync(new CreateIndexModel<BsonDocument>(
                new BsonDocument { { "Name", 1 }, { "Language", 1 } }, new CreateIndexOptions { Name = "blk_emailtpl_name_lang" }));
            await source.GetCollection<BsonDocument>("WorkflowItemExecutions").Indexes.CreateOneAsync(new CreateIndexModel<BsonDocument>(
                new BsonDocument { { "WorkflowExecutionId", 1 }, { "NodeId", 1 }, { "Branch", 1 } }, new CreateIndexOptions { Name = "blk_wfitem_exec_node_branch" }));

            var tracer = new ProjectStatusTracer { ProjectId = project.ItemId };
            await NewRepository().CreateDefaultConfigurationAsync(tracer, project);

            tracer.IsDefaultConfigurationCopied.Should().BeTrue();
            tracer.IsSeedSchemaApplied.Should().BeTrue();
            tracer.SeedSchemaErrors.Should().BeEmpty();
            var target = TargetDb(project);
            // Documents were still copied: the collections are created only after the copy.
            (await target.GetCollection<BsonDocument>("EmailTemplates").CountDocumentsAsync(FilterDefinition<BsonDocument>.Empty)).Should().BeGreaterThan(0);
            var templateIndexes = await (await target.GetCollection<BsonDocument>("EmailTemplates").Indexes.ListAsync()).ToListAsync();
            templateIndexes.Select(i => i["name"].AsString).Should().Contain("blk_emailtpl_name_lang");
            var itemIndexes = await (await target.GetCollection<BsonDocument>("WorkflowItemExecutions").Indexes.ListAsync()).ToListAsync();
            itemIndexes.Select(i => i["name"].AsString).Should().Contain("blk_wfitem_exec_node_branch");
        }

        [Fact]
        public async Task CreateDefaultConfigurationAsync_ResumedRunAppliesSeedSchemaWithoutRecopying()
        {
            var suffix = Guid.NewGuid().ToString("N");
            using var _ = new IntegrationContext(suffix);
            var project = NewProject(suffix);
            // A seed collection only this test uses: the seed DB is shared by every test in the run.
            var probe = "ResumeProbe" + suffix[..8];
            await SourceDb().CreateCollectionAsync(probe);

            // An older run copied the documents before this step existed.
            var tracer = new ProjectStatusTracer { ProjectId = project.ItemId, IsDefaultConfigurationCopied = true };
            await NewRepository().CreateDefaultConfigurationAsync(tracer, project);

            tracer.IsSeedSchemaApplied.Should().BeTrue();
            var target = TargetDb(project);
            (await (await target.ListCollectionNamesAsync()).ToListAsync()).Should().Contain(probe);
            // No document copy ran: the documents-copied flag was already set.
            (await target.GetCollection<BsonDocument>("MailServerConfigurations").CountDocumentsAsync(FilterDefinition<BsonDocument>.Empty)).Should().Be(0);
        }
    
        // ---------- os SPEC2 X-5 (R-X-PROJECT-CREATE, R-X-RESTORE-EXISTING, H9, H12, H13, C11, C24) ----------

        private const string Dsc = "DataServiceConfigurations";

        private IMongoCollection<BsonDocument> RootDsc() => _fixture.Database.GetCollection<BsonDocument>(Dsc);

        private async Task SeedDscAsync(string suffix)
        {
            // The seed collection is shared by every test of the run; one seed doc is enough.
            var seed = SourceDb().GetCollection<BsonDocument>(Dsc);
            if (await seed.CountDocumentsAsync(FilterDefinition<BsonDocument>.Empty) == 0)
            {
                await seed.InsertOneAsync(new BsonDocument
                {
                    { "_id", "seed-dsc" }, { "DbConnectionString", Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes("default")) },
                    { "DatabaseName", "" }, { "IsCollectionNameEditable", false }, { "CollectionNamePattern", "sb_{SchemaName}s" },
                    { "IsDeleted", false }
                });
            }
        }

        [Theory]
        [InlineData(null)]
        [InlineData(false)]
        public async Task CreateDefaultConfigurationAsync_SwitchOffOrUnset_CopiesSeedDscDoc_NoRootDoc(bool? on)
        {
            var suffix = Guid.NewGuid().ToString("N");
            using var _ = new IntegrationContext(suffix);
            var project = NewProject(suffix);
            await SeedDscAsync(suffix);

            await NewRepository(on).CreateDefaultConfigurationAsync(new ProjectStatusTracer { ProjectId = project.ItemId }, project);

            (await TargetDb(project).GetCollection<BsonDocument>(Dsc).CountDocumentsAsync(FilterDefinition<BsonDocument>.Empty)).Should().BeGreaterThan(0);
            (await RootDsc().CountDocumentsAsync(new BsonDocument("_id", project.TenantId))).Should().Be(0);
        }

        [Fact]
        public async Task CreateDefaultConfigurationAsync_SwitchOn_InsertsRootDefaultDoc_NoTenantDocNoFlag()
        {
            var suffix = Guid.NewGuid().ToString("N");
            using var _ = new IntegrationContext(suffix);
            var project = NewProject(suffix);
            await SeedDscAsync(suffix);

            var tracer = new ProjectStatusTracer { ProjectId = project.ItemId };
            await NewRepository(true).CreateDefaultConfigurationAsync(tracer, project);

            tracer.IsDefaultConfigurationCopied.Should().BeTrue();
            var root = await RootDsc().Find(new BsonDocument("_id", project.TenantId)).FirstOrDefaultAsync();
            root.Should().NotBeNull();
            root["ConfigItemId"].AsString.Should().Be(DataGatewayRootDefaults.ConfigItemId);
            root["DbConnectionSecretId"].AsString.Should().Be("default");
            root["CollectionNamePattern"].AsString.Should().Be(DataGatewayRootDefaults.CollectionNamePattern);
            root["CreatedBy"].AsString.Should().Be(project.CreatedBy);
            root["LastUpdatedBy"].AsString.Should().Be(project.CreatedBy);
            root["IsDeleted"].AsBoolean.Should().BeFalse();
            root.Contains("ValueChangedAfterDeploy").Should().BeFalse();
            root.Contains("DbConnectionString").Should().BeFalse();
            root.Contains("MigratedFrom").Should().BeFalse();
            // An empty collection from SeedSchemaReplicator is expected until D36; no document.
            (await TargetDb(project).GetCollection<BsonDocument>(Dsc).CountDocumentsAsync(FilterDefinition<BsonDocument>.Empty)).Should().Be(0);
        }

        [Fact]
        public async Task CreateDefaultConfigurationAsync_SwitchOn_ResumedRun_KeepsExistingRootDoc()
        {
            var suffix = Guid.NewGuid().ToString("N");
            using var _ = new IntegrationContext(suffix);
            var project = NewProject(suffix);
            var existing = new BsonDocument { { "_id", project.TenantId }, { "ConfigItemId", "worker-made" }, { "DbConnectionSecretId", "abc" }, { "IsDeleted", false } };
            await RootDsc().InsertOneAsync(existing);

            await NewRepository(true).CreateDefaultConfigurationAsync(new ProjectStatusTracer { ProjectId = project.ItemId }, project);

            (await RootDsc().Find(new BsonDocument("_id", project.TenantId)).FirstAsync()).Should().BeEquivalentTo(existing);
        }

        [Fact]
        public async Task CreateDefaultConfigurationAsync_SwitchOn_ExistingLiveTenantDoc_SkipsRootInsert_TenantDocUnchanged()
        {
            var suffix = Guid.NewGuid().ToString("N");
            using var _ = new IntegrationContext(suffix);
            var project = NewProject(suffix);
            var byo = new BsonDocument { { "_id", "byo-" + suffix }, { "DbConnectionString", "Y3VzdG9t" }, { "DatabaseName", "crm" }, { "IsDeleted", false } };
            await TargetDb(project).GetCollection<BsonDocument>(Dsc).InsertOneAsync(byo);

            // Api Project/Restore of an existing project with no tracer: a fresh tracer re-runs the defaults.
            await NewRepository(true).CreateDefaultConfigurationAsync(new ProjectStatusTracer { ProjectId = project.ItemId }, project);

            (await RootDsc().CountDocumentsAsync(new BsonDocument("_id", project.TenantId))).Should().Be(0);
            (await TargetDb(project).GetCollection<BsonDocument>(Dsc).Find(new BsonDocument("_id", "byo-" + suffix)).FirstAsync())
                .Should().BeEquivalentTo(byo);
        }

        [Fact]
        public async Task CreateDefaultConfigurationAsync_SwitchOn_OnlySoftDeletedTenantDoc_InsertsRootDefault()
        {
            var suffix = Guid.NewGuid().ToString("N");
            using var _ = new IntegrationContext(suffix);
            var project = NewProject(suffix);
            await TargetDb(project).GetCollection<BsonDocument>(Dsc)
                .InsertOneAsync(new BsonDocument { { "_id", "old-" + suffix }, { "IsDeleted", true } });

            await NewRepository(true).CreateDefaultConfigurationAsync(new ProjectStatusTracer { ProjectId = project.ItemId }, project);

            (await RootDsc().CountDocumentsAsync(new BsonDocument("_id", project.TenantId))).Should().Be(1);
        }

        [Fact]
        public async Task CreateDefaultConfigurationAsync_SwitchOn_StillCopiesTenantConfigurationsAndEmailTemplates()
        {
            var suffix = Guid.NewGuid().ToString("N");
            using var _ = new IntegrationContext(suffix);
            var project = NewProject(suffix);
            var source = SourceDb();
            if (await source.GetCollection<BsonDocument>("TenantConfigurations").CountDocumentsAsync(FilterDefinition<BsonDocument>.Empty) == 0)
                await source.GetCollection<BsonDocument>("TenantConfigurations").InsertOneAsync(new BsonDocument { { "_id", "tc-seed" }, { "DefaultRoles", new BsonArray { "clouduser" } } });
            await source.GetCollection<BsonDocument>("EmailTemplates")
                .InsertOneAsync(new BsonDocument { { "_id", "tpl-mfa-" + suffix }, { "Name", "MfaViaEmail" } });

            await NewRepository(true).CreateDefaultConfigurationAsync(new ProjectStatusTracer { ProjectId = project.ItemId }, project);

            var target = TargetDb(project);
            // SPEC2 branch keeps the TenantConfigurations copy (X-7 is a separate PR after iam I15).
            (await target.GetCollection<BsonDocument>("TenantConfigurations").CountDocumentsAsync(FilterDefinition<BsonDocument>.Empty)).Should().BeGreaterThan(0);
            (await target.GetCollection<BsonDocument>("EmailTemplates").CountDocumentsAsync(new BsonDocument("Name", "MfaViaEmail"))).Should().BeGreaterThan(0);
        }

        [Fact]
        public void DataGatewayRootDefaults_Build_HasTheRootContractFields_AndNoValue()
        {
            var now = DateTime.UtcNow;
            var doc = DataGatewayRootDefaults.Build("t1", "creator", now);

            doc["_id"].AsString.Should().Be("t1");
            doc["ConfigItemId"].AsString.Should().Be(DataGatewayRootDefaults.ConfigItemId);
            doc["DbConnectionSecretId"].AsString.Should().Be("default");
            doc.Names.Should().NotContain(new[] { "DbConnectionString", "ValueChangedAfterDeploy", "MigratedFrom" });
            doc.Names.Should().Contain(new[] { "DatabaseName", "IsCollectionNameEditable", "CollectionNamePattern", "ProjectKey", "ProjectShortKey", "CreatedDate", "LastUpdatedDate", "CreatedBy", "LastUpdatedBy", "IsDeleted" });
        }
    }
}
