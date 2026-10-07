using System;
using System.Linq;
using System.Threading.Tasks;
using DomainService.Projects;
using FluentAssertions;
using MongoDB.Bson;
using MongoDB.Driver;

namespace XUnitTest.Integration
{
    [Collection(MongoIntegrationCollection.Name)]
    public class SeedSchemaReplicatorTests
    {
        private readonly MongoIntegrationFixture _fixture;

        public SeedSchemaReplicatorTests(MongoIntegrationFixture fixture)
        {
            _fixture = fixture;
        }

        private (IMongoDatabase seed, IMongoDatabase target) NewDbs()
        {
            var tag = Guid.NewGuid().ToString("N")[..8];
            return (_fixture.DbContextProvider.GetDatabase("", "seed" + tag), _fixture.DbContextProvider.GetDatabase("", "proj" + tag));
        }

        private static async Task<string[]> IndexNames(IMongoDatabase db, string coll) =>
            (await (await db.GetCollection<BsonDocument>(coll).Indexes.ListAsync()).ToListAsync()).Select(i => i["name"].AsString).OrderBy(n => n).ToArray();

        [Fact]
        public async Task ApplyAsync_CreatesMissingCollectionsAndCopiesIndexOptions()
        {
            var (seed, target) = NewDbs();
            var users = seed.GetCollection<BsonDocument>("Users");
            await users.Indexes.CreateOneAsync(new CreateIndexModel<BsonDocument>(
                new BsonDocument("Email", 1),
                new CreateIndexOptions<BsonDocument>
                {
                    Name = "blk_users_email_ci",
                    Unique = true,
                    Collation = new Collation("en", strength: CollationStrength.Secondary),
                    PartialFilterExpression = new BsonDocument("Email", new BsonDocument("$gt", ""))
                }));
            await seed.GetCollection<BsonDocument>("IdpSessions").Indexes.CreateOneAsync(new CreateIndexModel<BsonDocument>(
                new BsonDocument("ExpiresAt", 1), new CreateIndexOptions { Name = "ttl_exp", ExpireAfter = TimeSpan.Zero }));

            var result = await SeedSchemaReplicator.ApplyAsync(seed, target);

            result.Errors.Should().BeEmpty();
            result.CollectionsCreated.Should().BeEquivalentTo("Users", "IdpSessions");
            var copied = (await (await target.GetCollection<BsonDocument>("Users").Indexes.ListAsync()).ToListAsync())
                .Single(i => i["name"] == "blk_users_email_ci");
            copied["unique"].AsBoolean.Should().BeTrue();
            copied["collation"]["strength"].ToInt32().Should().Be(2);
            copied["partialFilterExpression"].Should().Be(new BsonDocument("Email", new BsonDocument("$gt", "")));
            var ttl = (await (await target.GetCollection<BsonDocument>("IdpSessions").Indexes.ListAsync()).ToListAsync())
                .Single(i => i["name"] == "ttl_exp");
            ttl["expireAfterSeconds"].ToInt32().Should().Be(0);
        }

        [Fact]
        public async Task ApplyAsync_LeavesExistingIndexesAndDataAlone()
        {
            var (seed, target) = NewDbs();
            await seed.GetCollection<BsonDocument>("Roles").Indexes.CreateOneAsync(new CreateIndexModel<BsonDocument>(
                new BsonDocument { { "Slug", 1 }, { "OrganizationId", 1 } }, new CreateIndexOptions { Name = "blk_roles_slug_org" }));
            await seed.GetCollection<BsonDocument>("Files").Indexes.CreateOneAsync(new CreateIndexModel<BsonDocument>(
                new BsonDocument("DirectoryId", 1), new CreateIndexOptions { Name = "blk_files_dir" }));

            // Target already has the same keys under its own name, plus data and an extra index.
            var roles = target.GetCollection<BsonDocument>("Roles");
            await roles.InsertOneAsync(new BsonDocument { { "_id", "r1" }, { "Slug", "admin" } });
            await roles.Indexes.CreateOneAsync(new CreateIndexModel<BsonDocument>(
                new BsonDocument { { "Slug", 1 }, { "OrganizationId", 1 } }, new CreateIndexOptions { Name = "code_made" }));
            await roles.Indexes.CreateOneAsync(new CreateIndexModel<BsonDocument>(
                new BsonDocument("Name", 1), new CreateIndexOptions { Name = "extra" }));

            var result = await SeedSchemaReplicator.ApplyAsync(seed, target);

            result.Errors.Should().BeEmpty();
            result.CollectionsCreated.Should().Equal("Files");
            result.IndexesCreated.Should().Equal("Files.blk_files_dir");
            (await IndexNames(target, "Roles")).Should().Equal("_id_", "code_made", "extra");
            (await roles.CountDocumentsAsync(FilterDefinition<BsonDocument>.Empty)).Should().Be(1);

            // Second run changes nothing.
            var again = await SeedSchemaReplicator.ApplyAsync(seed, target);
            again.CollectionsCreated.Should().BeEmpty();
            again.IndexesCreated.Should().BeEmpty();
        }

        [Fact]
        public async Task ApplyAsync_ReportsAnIndexTheTargetDataBreaksAndKeepsGoing()
        {
            var (seed, target) = NewDbs();
            await seed.GetCollection<BsonDocument>("Sequence").Indexes.CreateOneAsync(new CreateIndexModel<BsonDocument>(
                new BsonDocument("Context", 1), new CreateIndexOptions { Name = "ux_sequence_context", Unique = true }));
            await seed.GetCollection<BsonDocument>("Tags").Indexes.CreateOneAsync(new CreateIndexModel<BsonDocument>(
                new BsonDocument("Name", 1), new CreateIndexOptions { Name = "blk_tags_name" }));
            await target.GetCollection<BsonDocument>("Sequence").InsertManyAsync(new[]
            {
                new BsonDocument { { "_id", "a" }, { "Context", "inv" } },
                new BsonDocument { { "_id", "b" }, { "Context", "inv" } }
            });

            var result = await SeedSchemaReplicator.ApplyAsync(seed, target);

            result.Errors.Should().ContainSingle().Which.Should().StartWith("Sequence.ux_sequence_context:");
            result.IndexesCreated.Should().Contain("Tags.blk_tags_name");
        }

        [Fact]
        public async Task ApplyAsync_SkipsSeedOnlyCollections()
        {
            var (seed, target) = NewDbs();
            await seed.GetCollection<BsonDocument>("IntegrationTemplates").InsertOneAsync(new BsonDocument("_id", "t1"));

            var result = await SeedSchemaReplicator.ApplyAsync(seed, target);

            result.CollectionsCreated.Should().NotContain("IntegrationTemplates");
            (await (await target.ListCollectionNamesAsync()).ToListAsync()).Should().NotContain("IntegrationTemplates");
        }
    }
}
