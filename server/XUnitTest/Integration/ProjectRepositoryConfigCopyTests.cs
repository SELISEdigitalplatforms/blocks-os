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
            secret.SetupGet(s => s.RootDatabaseName).Returns("BlocksRootDb");
            var config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?> { { "KbtclIdentifier", ".blocks.dev" } })
                .Build();
            var encoding = new Mock<IEncodingService>();
            encoding.Setup(e => e.EncodeToBase26Async(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int>()))
                    .ReturnsAsync("abcde");
            return new ProjectRepository(_fixture.DbContextProvider, config, secret.Object, encoding.Object, Mock.Of<IDataGatewayRootProvisioner>(), new XUnitTest.TestHelpers.PassThroughOsDataAccess(), Mock.Of<IStorageConfigurationSeedCopier>());
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

        [Fact]
        public async Task CreateDefaultConfigurationAsync_CopiesOnlyLiveSystemSchemasUnchanged()
        {
            var suffix = Guid.NewGuid().ToString("N");
            using var _ = new IntegrationContext(suffix);
            var project = NewProject(suffix);
            await SourceDb().GetCollection<BsonDocument>("SchemaDefinitions").InsertManyAsync(new[]
            {
                new BsonDocument { { "_id", "sys-" + suffix }, { "SchemaName", "User" }, { "IsSystemEntity", true }, { "IsDeleted", false }, { "CreatedBy", "system" } },
                new BsonDocument { { "_id", "sysdel-" + suffix }, { "SchemaName", "Old" }, { "IsSystemEntity", true }, { "IsDeleted", true } },
                new BsonDocument { { "_id", "app-" + suffix }, { "SchemaName", "Student" }, { "IsSystemEntity", false }, { "IsDeleted", false } }
            });

            await NewRepository().CreateDefaultConfigurationAsync(new ProjectStatusTracer { ProjectId = project.ItemId }, project);

            var copied = await TargetDb(project).GetCollection<BsonDocument>("SchemaDefinitions")
                .Find(Builders<BsonDocument>.Filter.In("_id", new[] { "sys-" + suffix, "sysdel-" + suffix, "app-" + suffix })).ToListAsync();
            copied.Should().ContainSingle();
            copied[0]["_id"].AsString.Should().Be("sys-" + suffix);
            copied[0]["CreatedBy"].AsString.Should().Be("system");
        }

        [Fact]
        public async Task CreateDefaultConfigurationAsync_RetryAfterPartialSchemaCopy_AddsMissingAndKeepsExisting()
        {
            var suffix = Guid.NewGuid().ToString("N");
            using var _ = new IntegrationContext(suffix);
            var project = NewProject(suffix);
            await SourceDb().GetCollection<BsonDocument>("SchemaDefinitions").InsertManyAsync(new[]
            {
                new BsonDocument { { "_id", "sysa-" + suffix }, { "SchemaName", "A" }, { "IsSystemEntity", true }, { "ReadAccessLevel", 1 } },
                new BsonDocument { { "_id", "sysb-" + suffix }, { "SchemaName", "B" }, { "IsSystemEntity", true }, { "ReadAccessLevel", 1 } }
            });
            // An interrupted run already wrote one schema, and an admin changed it.
            await TargetDb(project).GetCollection<BsonDocument>("SchemaDefinitions")
                .InsertOneAsync(new BsonDocument { { "_id", "sysa-" + suffix }, { "SchemaName", "A" }, { "IsSystemEntity", true }, { "ReadAccessLevel", 3 } });

            await NewRepository().CreateDefaultConfigurationAsync(new ProjectStatusTracer { ProjectId = project.ItemId }, project);

            var copied = await TargetDb(project).GetCollection<BsonDocument>("SchemaDefinitions")
                .Find(Builders<BsonDocument>.Filter.In("_id", new[] { "sysa-" + suffix, "sysb-" + suffix })).ToListAsync();
            copied.Should().HaveCount(2);
            copied.Single(d => d["_id"] == "sysa-" + suffix)["ReadAccessLevel"].AsInt32.Should().Be(3);
        }

        // The data-source root doc comes from IDataGatewayRootProvisioner, never from a copy of the seed tenant doc.
        private const string Dsc = "DataServiceConfigurations";

        [Fact]
        public async Task CreateDefaultConfigurationAsync_DoesNotCopySeedDataSourceDoc_AndStillCopiesOtherSeedData()
        {
            var suffix = Guid.NewGuid().ToString("N");
            using var _ = new IntegrationContext(suffix);
            var project = NewProject(suffix);
            var source = SourceDb();
            await source.GetCollection<BsonDocument>(Dsc)
                .InsertOneAsync(new BsonDocument { { "_id", "seed-dsc-" + suffix }, { "IsDeleted", false } });
            await source.GetCollection<BsonDocument>("EmailTemplates")
                .InsertOneAsync(new BsonDocument { { "_id", "tpl-mfa-" + suffix }, { "Name", "MfaViaEmail" } });

            await NewRepository().CreateDefaultConfigurationAsync(new ProjectStatusTracer { ProjectId = project.ItemId }, project);

            var target = TargetDb(project);
            (await target.GetCollection<BsonDocument>(Dsc).CountDocumentsAsync(FilterDefinition<BsonDocument>.Empty)).Should().Be(0);
            (await _fixture.Database.GetCollection<BsonDocument>(Dsc).CountDocumentsAsync(new BsonDocument("_id", project.TenantId))).Should().Be(0);
            (await target.GetCollection<BsonDocument>("EmailTemplates").CountDocumentsAsync(new BsonDocument("Name", "MfaViaEmail"))).Should().BeGreaterThan(0);
        }

        [Fact]
        public async Task CreateDefaultConfigurationAsync_EmbedsSeedTenantConfigurationInIdentityConfiguration_AndCreatesNoTenantConfigurationsCollection()
        {
            var suffix = Guid.NewGuid().ToString("N");
            using var _ = new IntegrationContext(suffix);
            var project = NewProject(suffix);
            var source = SourceDb();
            var seedTenantConfigurations = source.GetCollection<BsonDocument>(TenantConfigurationEmbedding.LegacyCollection);
            if (await seedTenantConfigurations.CountDocumentsAsync(FilterDefinition<BsonDocument>.Empty) == 0)
                await seedTenantConfigurations.InsertOneAsync(new BsonDocument { { "_id", "tc-seed" }, { "DefaultRoles", new BsonArray { "clouduser" } } });
            var seedIdentity = source.GetCollection<BsonDocument>("IdentityConfigurations");
            if (await seedIdentity.CountDocumentsAsync(FilterDefinition<BsonDocument>.Empty) == 0)
                await seedIdentity.InsertOneAsync(new BsonDocument { { "_id", "idc-" + suffix }, { "AccountActionBaseUrl", "old" } });
            // The seed is shared by every test in the run: compare with whichever document the copy picks.
            var seedTenantConfiguration = await seedTenantConfigurations.Find(FilterDefinition<BsonDocument>.Empty).FirstAsync();

            await NewRepository().CreateDefaultConfigurationAsync(new ProjectStatusTracer { ProjectId = project.ItemId }, project);

            var target = TargetDb(project);
            var identity = await target.GetCollection<BsonDocument>("IdentityConfigurations")
                .Find(FilterDefinition<BsonDocument>.Empty).FirstAsync();
            var embedded = identity[TenantConfigurationEmbedding.FieldName].AsBsonDocument;
            embedded["_id"].Should().Be(seedTenantConfiguration["_id"]);
            embedded["CreatedBy"].AsString.Should().Be(project.CreatedBy);
            // Neither the document copy nor the seed schema step creates the old collection, not even empty.
            (await (await target.ListCollectionNamesAsync()).ToListAsync())
                .Should().NotContain(TenantConfigurationEmbedding.LegacyCollection);
        }

        private static BsonDocument KeyValueRow(string key, string value) =>
            new() { { "_id", Guid.NewGuid().ToString("N") }, { "Key", key }, { "Value", value }, { "Tags", new BsonArray() } };

        private static async Task<List<string>> KeysIn(IMongoDatabase db, string suffix) =>
            (await db.GetCollection<BsonDocument>(KeyValueSeedCopier.CollectionName)
                .Find(Builders<BsonDocument>.Filter.Regex("Key", new BsonRegularExpression(suffix + "$")))
                .ToListAsync())
            .Select(d => d["Key"].AsString).ToList();

        [Fact]
        public async Task CreateDefaultConfigurationAsync_GivesTheProjectTheSeedNotificationConfigs_AndNoOtherKeyValueRows()
        {
            var suffix = Guid.NewGuid().ToString("N");
            using var _ = new IntegrationContext(suffix);
            var project = NewProject(suffix);
            await SourceDb().GetCollection<BsonDocument>(KeyValueSeedCopier.CollectionName).InsertManyAsync(new[]
            {
                KeyValueRow("notification-config:built-in-" + suffix, "seed"),
                KeyValueRow("storage-config:files-" + suffix, "seed"),
                KeyValueRow("oidcUiTemplate-" + suffix, "seed branding"),
            });

            await NewRepository().CreateDefaultConfigurationAsync(new ProjectStatusTracer { ProjectId = project.ItemId }, project);

            (await KeysIn(TargetDb(project), suffix)).Should().BeEquivalentTo("notification-config:built-in-" + suffix);
        }

        [Fact]
        public async Task KeyValueSeedCopier_CopiesMfaConfig_AndKeepsTheProjectsOwnValue()
        {
            var suffix = Guid.NewGuid().ToString("N");
            var seed = _fixture.DbContextProvider.GetDatabase("", "kvseed-" + suffix[..8]);
            var projectDb = _fixture.DbContextProvider.GetDatabase("", "kvproj-" + suffix[..8]);
            var notificationKey = "notification-config:built-in-" + suffix;
            await seed.GetCollection<BsonDocument>(KeyValueSeedCopier.CollectionName)
                .InsertManyAsync(new[] { KeyValueRow("mfa-config", "seed"), KeyValueRow(notificationKey, "seed") });
            await projectDb.GetCollection<BsonDocument>(KeyValueSeedCopier.CollectionName)
                .InsertOneAsync(KeyValueRow(notificationKey, "changed by the project"));

            var inserted = await KeyValueSeedCopier.CopyAsync(seed, projectDb, "creator");
            var retried = await KeyValueSeedCopier.CopyAsync(seed, projectDb, "creator");

            inserted.Should().Be(1);
            retried.Should().Be(0);
            var rows = await projectDb.GetCollection<BsonDocument>(KeyValueSeedCopier.CollectionName)
                .Find(FilterDefinition<BsonDocument>.Empty).ToListAsync();
            rows.Should().HaveCount(2);
            rows.Single(r => r["Key"] == "mfa-config")["CreatedBy"].AsString.Should().Be("creator");
            rows.Single(r => r["Key"] == notificationKey)["Value"].AsString.Should().Be("changed by the project");
        }
    }
}
