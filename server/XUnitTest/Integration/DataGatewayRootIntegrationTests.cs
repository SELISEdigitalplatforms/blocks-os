using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Blocks.Secrets;
using Configuration.DomainService.DataGateway.Entities;
using Configuration.DomainService.DataGateway.RequestModel;
using Configuration.DomainService.DataGateway.Services;
using Configuration.DomainService.DataGateway.Validators;
using Configuration.DomainService.Shared.Services;
using FluentAssertions;
using MongoDB.Bson;
using MongoDB.Driver;
using Moq;
using StackExchange.Redis;
using XUnitTest.TestHelpers;
using XUnitTest.TestSupport;

namespace XUnitTest.Integration
{
    /// <summary>
    /// os SPEC2 X-1..X-3 against a throwaway Mongo: real ConfigurationRepository + real validator, fake secrets and
    /// redis. Rows R-X-OFF-ROOTGUARD, R-X-GET-ROOTTENANT, R-X-GET-SOFTDELETED, R-X-UPDATE-SAME/NEW/DEFAULT,
    /// R-X-CONCURRENT, R-X-FLAG-FIRST (integration part), C9, C18, C21.
    /// </summary>
    [Collection(MongoIntegrationCollection.Name)]
    public class DataGatewayRootIntegrationTests
    {
        private const string Collection = "DataServiceConfigurations";
        private const string Value = "mongodb://u:IT-SECRET-PW@cust-host/custdb";
        private const string NewValue = "mongodb://u:IT-NEW-SECRET-PW@cust-host2/custdb";

        private readonly MongoIntegrationFixture _fixture;

        public DataGatewayRootIntegrationTests(MongoIntegrationFixture fixture) => _fixture = fixture;

        /// <summary>Fresh root DB + tenant DB (the same DB for the root tenant), dropped on dispose.</summary>
        private sealed class Dbs : IDisposable
        {
            private readonly IMongoClient _client;
            private readonly string _rootName;
            private readonly string _tenantName;

            public Dbs(IMongoClient client, bool rootTenant)
            {
                _client = client;
                _rootName = "dgw_root_" + Guid.NewGuid().ToString("N")[..12];
                _tenantName = rootTenant ? _rootName : "dgw_ten_" + Guid.NewGuid().ToString("N")[..12];
                Root = client.GetDatabase(_rootName);
                Tenant = client.GetDatabase(_tenantName);
                Provider = new SplitDatabaseContextProvider(client, Root, _tenantName);
            }

            public IMongoDatabase Root { get; }
            public IMongoDatabase Tenant { get; }
            public IDbContextProvider Provider { get; }
            public IMongoCollection<BsonDocument> RootDsc => Root.GetCollection<BsonDocument>(Collection);
            public IMongoCollection<BsonDocument> TenantDsc => Tenant.GetCollection<BsonDocument>(Collection);

            public void Dispose()
            {
                _client.DropDatabase(_rootName);
                if (_tenantName != _rootName) _client.DropDatabase(_tenantName);
            }
        }

        private static ConfigurationRepository Repo(Dbs dbs, bool on) =>
            new(dbs.Provider, new InMemoryKeyValueStore(), DataGatewayTestSupport.RootSecret(), DataGatewayTestSupport.Mode(on));

        private static DataGatewayConfigurationService Service(IConfigurationRepository repo, bool on, FakeSecretService secrets, FakeRedis redis,
            RecordingLogger<DataGatewayConfigurationService>? logger = null) =>
            new(repo, new DataGatewayConfigurationValidator(repo), secrets, redis.Client(), DataGatewayTestSupport.Mode(on),
                logger ?? new RecordingLogger<DataGatewayConfigurationService>());

        private static string B64(string s) => Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(s));

        private static BsonDocument RootDoc(string tenantId, string configItemId, string? secretId, bool migrated = true) =>
            new()
            {
                { "_id", tenantId }, { "ConfigItemId", configItemId },
                { "DbConnectionSecretId", (BsonValue?)secretId ?? BsonNull.Value },
                { "DatabaseName", "db-" + tenantId }, { "IsCollectionNameEditable", false },
                { "CollectionNamePattern", "sb_{SchemaName}s" }, { "ProjectKey", tenantId }, { "ProjectShortKey", "" },
                { "IsDeleted", false }, { "LastUpdatedDate", DateTime.UtcNow.AddDays(-1) },
                { "MigratedFrom", migrated ? (BsonValue)"DataServiceConfigurations" : BsonNull.Value }
            };

        private static BsonDocument LegacyDoc(string id, string value, string db = "legacydb", bool deleted = false) =>
            new()
            {
                { "_id", id }, { "DbConnectionString", B64(value) }, { "DatabaseName", db },
                { "IsCollectionNameEditable", false }, { "CollectionNamePattern", "sb_{SchemaName}s" },
                { "ProjectKey", "" }, { "ProjectShortKey", "" }, { "IsDeleted", deleted },
                { "LastUpdatedDate", DateTime.UtcNow.AddDays(-2) }
            };

        private static Task<BsonDocument> Find(IMongoCollection<BsonDocument> c, string id) =>
            c.Find(new BsonDocument("_id", id)).FirstOrDefaultAsync();

        private static SaveDataGatewayConfigurationRequest Update(string itemId, string value, string db) => new()
        {
            UpdateRequest = true, ItemId = itemId, ConnectionString = value, DatabaseName = db, ProjectKey = "x"
        };

        // ---------- R-X-OFF-ROOTGUARD (C18) ----------

        [Fact]
        public async Task Off_RootTenant_WithRootDocsPresent_GetsOwnLegacyDoc_AndCannotOverwriteARootDoc()
        {
            var r = "R" + Guid.NewGuid().ToString("N")[..8];
            using var dbs = new Dbs(_fixture.Client, rootTenant: true);
            using var ctx = new BlocksTestContext(r);
            // Root docs first, so "first live doc" today would be another tenant's.
            await dbs.RootDsc.InsertManyAsync(new[] { RootDoc("T1", "old-T1", "s1"), RootDoc("T2", "old-T2", "default") });
            var repo = Repo(dbs, on: false);
            var secrets = new FakeSecretService();
            var redis = new FakeRedis();
            var service = Service(repo, on: false, secrets, redis);

            (await service.GetDataGatewayConfigurationAsync()).Should().BeNull("no legacy doc yet: create form, never T1/T2");

            await dbs.RootDsc.InsertOneAsync(LegacyDoc("legacy-R", "default", "rdb"));
            var get = await service.GetDataGatewayConfigurationAsync();
            get!.ItemId.Should().Be("legacy-R");
            get.DbConnectionString.Should().Be("default");

            var t1Before = await Find(dbs.RootDsc, "T1");
            var refused = await service.SaveDataGatewayConfigurationAsync(Update("T1", Value, "hacked"));
            refused.IsSuccess.Should().BeFalse();
            refused.Errors.Should().Contain("ItemId", DataGatewayConfigurationService.NotFoundMessage);
            (await Find(dbs.RootDsc, "T1")).Should().BeEquivalentTo(t1Before);

            // Second line of defence: the repository save itself cannot replace a root doc.
            var direct = new DataGatewayConfiguration { ItemId = "T1", DbConnectionString = B64(Value), DatabaseName = "hacked" };
            var ex = await FluentActions.Awaiting(() => repo.SaveDataGatewayConfigurationAsync(direct))
                .Should().ThrowAsync<MongoWriteException>();
            ex.Which.WriteError.Category.Should().Be(ServerErrorCategory.DuplicateKey);
            (await Find(dbs.RootDsc, "T1")).Should().BeEquivalentTo(t1Before);

            // The service turns that DuplicateKey into the same refusal (race: the doc appeared after the read).
            var racing = new Mock<IConfigurationRepository>();
            racing.Setup(x => x.GetDataGatewayConfigurationByIdAsync("legacy-R")).ReturnsAsync(new DataGatewayConfiguration { ItemId = "legacy-R" });
            racing.Setup(x => x.SaveDataGatewayConfigurationAsync(It.IsAny<DataGatewayConfiguration>())).ThrowsAsync(ex.Which);
            var logger = new RecordingLogger<DataGatewayConfigurationService>();
            var raced = await new DataGatewayConfigurationService(racing.Object, new DataGatewayConfigurationValidator(racing.Object), secrets,
                redis.Client(), DataGatewayTestSupport.Mode(false), logger).SaveDataGatewayConfigurationAsync(Update("legacy-R", Value, "x"));
            raced.Errors.Should().Contain("ItemId", DataGatewayConfigurationService.NotFoundMessage);
            logger.Entries.Should().Contain(e => e.Message.Contains("step=off-save error=DuplicateKey"));

            // Own legacy doc still saves as today.
            var ok = await service.SaveDataGatewayConfigurationAsync(Update("legacy-R", Value, "rdb2"));
            ok.IsSuccess.Should().BeTrue();
            (await Find(dbs.RootDsc, "legacy-R"))["DbConnectionString"].AsString.Should().Be(B64(Value));
            secrets.Calls.Should().BeEmpty();
            redis.Transactions.Should().Be(0);
        }

        [Fact]
        public async Task Off_NormalTenant_SameAsToday_CreateThenGetThenUpdate()
        {
            var t = "N" + Guid.NewGuid().ToString("N")[..8];
            using var dbs = new Dbs(_fixture.Client, rootTenant: false);
            using var ctx = new BlocksTestContext(t);
            var repo = Repo(dbs, on: false);
            var service = Service(repo, on: false, new FakeSecretService(), new FakeRedis());

            var created = await service.SaveDataGatewayConfigurationAsync(new SaveDataGatewayConfigurationRequest
            { ConnectionString = Value, DatabaseName = "d1", ProjectKey = t });
            created.IsSuccess.Should().BeTrue();
            (await service.SaveDataGatewayConfigurationAsync(new SaveDataGatewayConfigurationRequest
            { ConnectionString = Value, DatabaseName = "d1", ProjectKey = t })).Errors.Should().ContainKey("ItemId");

            var get = await service.GetDataGatewayConfigurationAsync();
            get!.ItemId.Should().Be(created.ItemId);
            get.DbConnectionString.Should().Be(Value);

            (await service.SaveDataGatewayConfigurationAsync(Update(created.ItemId!, NewValue, "d2"))).IsSuccess.Should().BeTrue();
            var doc = await Find(dbs.TenantDsc, created.ItemId!);
            doc["DbConnectionString"].AsString.Should().Be(B64(NewValue));
            doc.Contains("ConfigItemId").Should().BeFalse();
            doc.Contains("DbConnectionSecretId").Should().BeFalse();
            (await dbs.RootDsc.CountDocumentsAsync(FilterDefinition<BsonDocument>.Empty)).Should().Be(0, "switch off never touches the root DB");
        }

        // ---------- R-X-GET-ROOTTENANT (H10, C9) ----------

        [Fact]
        public async Task On_RootTenant_GetsOwnLegacyDoc_ThenOwnRootDoc_NeverAnotherTenant()
        {
            var r = "R" + Guid.NewGuid().ToString("N")[..8];
            using var dbs = new Dbs(_fixture.Client, rootTenant: true);
            using var ctx = new BlocksTestContext(r);
            await dbs.RootDsc.InsertManyAsync(new[] { RootDoc("T1", "old-T1", "s1"), RootDoc("T2", "old-T2", "default"), LegacyDoc("legacy-R", "default", "rdb") });
            var secrets = new FakeSecretService();
            var service = Service(Repo(dbs, on: true), on: true, secrets, new FakeRedis());

            var get = await service.GetDataGatewayConfigurationAsync();
            get!.ItemId.Should().Be("legacy-R");
            get.DatabaseName.Should().Be("rdb");

            await dbs.RootDsc.InsertOneAsync(RootDoc(r, "legacy-R", "default"));
            get = await service.GetDataGatewayConfigurationAsync();
            get!.ItemId.Should().Be("legacy-R");
            get.DatabaseName.Should().Be("db-" + r);
            get.DbConnectionString.Should().Be("default");
            secrets.Calls.Should().BeEmpty();

            // Save from the root tenant updates its own root doc + its own legacy copy; T1/T2 untouched.
            var t1 = await Find(dbs.RootDsc, "T1");
            (await service.SaveDataGatewayConfigurationAsync(Update("legacy-R", "default", "rdb3"))).IsSuccess.Should().BeTrue();
            (await Find(dbs.RootDsc, r))["DatabaseName"].AsString.Should().Be("rdb3");
            (await Find(dbs.RootDsc, "legacy-R"))["DatabaseName"].AsString.Should().Be("rdb3");
            (await Find(dbs.RootDsc, "T1")).Should().BeEquivalentTo(t1);
        }

        // ---------- R-X-GET-SOFTDELETED (C21) ----------

        [Fact]
        public async Task On_SoftDeletedRootDoc_IsNoRootDoc_NeverUndeletedOrReplaced()
        {
            var t = "S" + Guid.NewGuid().ToString("N")[..8];
            using var dbs = new Dbs(_fixture.Client, rootTenant: false);
            using var ctx = new BlocksTestContext(t);
            var root = RootDoc(t, "cfg-" + t, "default");
            root["IsDeleted"] = true;
            await dbs.RootDsc.InsertOneAsync(root);
            var secrets = new FakeSecretService();
            var redis = new FakeRedis();
            var service = Service(Repo(dbs, on: true), on: true, secrets, redis);

            (await service.GetDataGatewayConfigurationAsync()).Should().BeNull("no tenant copy: 204");
            (await service.SaveDataGatewayConfigurationAsync(Update("cfg-" + t, Value, "x")))
                .Errors.Should().Contain("ItemId", DataGatewayConfigurationService.NotMigratedMessage);

            var create = await service.SaveDataGatewayConfigurationAsync(new SaveDataGatewayConfigurationRequest
            { ConnectionString = Value, DatabaseName = "x", ProjectKey = t });
            create.Errors.Should().Contain("ItemId", DataGatewayConfigurationService.AlreadyExistsMessage);
            secrets.Calls.Should().Contain("secret.Set").And.NotContain("secret.Delete");
            (await Find(dbs.RootDsc, t)).Should().BeEquivalentTo(root);
            redis.Transactions.Should().Be(0);

            await dbs.TenantDsc.InsertOneAsync(LegacyDoc("cfg-" + t, Value, "copydb"));
            var get = await service.GetDataGatewayConfigurationAsync();
            get!.ItemId.Should().Be("cfg-" + t);
            get.DbConnectionString.Should().Be(Value);
        }

        // ---------- validator sees the root doc ----------

        [Fact]
        public async Task On_Create_WhenRootDocExists_RefusedByValidator_NoSecret()
        {
            var t = "V" + Guid.NewGuid().ToString("N")[..8];
            using var dbs = new Dbs(_fixture.Client, rootTenant: false);
            using var ctx = new BlocksTestContext(t);
            await dbs.RootDsc.InsertOneAsync(RootDoc(t, "cfg-" + t, "default"));
            var secrets = new FakeSecretService();
            var service = Service(Repo(dbs, on: true), on: true, secrets, new FakeRedis());

            var create = await service.SaveDataGatewayConfigurationAsync(new SaveDataGatewayConfigurationRequest
            { ConnectionString = Value, DatabaseName = "x", ProjectKey = t, ItemId = "cfg-" + t });

            create.Errors.Should().Contain("ItemId", DataGatewayConfigurationService.AlreadyExistsMessage);
            secrets.Calls.Should().BeEmpty();
        }

        [Fact]
        public async Task On_Create_FreshTenant_InsertsRootDocWithoutValue()
        {
            var t = "C" + Guid.NewGuid().ToString("N")[..8];
            using var dbs = new Dbs(_fixture.Client, rootTenant: false);
            using var ctx = new BlocksTestContext(t);
            var secrets = new FakeSecretService();
            var redis = new FakeRedis();
            var service = Service(Repo(dbs, on: true), on: true, secrets, redis);

            var create = await service.SaveDataGatewayConfigurationAsync(new SaveDataGatewayConfigurationRequest
            { ConnectionString = Value, DatabaseName = "crm", ProjectKey = t });

            create.IsSuccess.Should().BeTrue();
            var doc = await Find(dbs.RootDsc, t);
            doc["ConfigItemId"].AsString.Should().Be(create.ItemId);
            doc["DbConnectionSecretId"].AsString.Should().Be(secrets.Secrets.Keys.Single());
            doc["ValueChangedAfterDeploy"].AsBoolean.Should().BeTrue();
            doc.Contains("DbConnectionString").Should().BeFalse();
            doc.ToJson().Should().NotContain("IT-SECRET-PW");
            (await dbs.TenantDsc.CountDocumentsAsync(FilterDefinition<BsonDocument>.Empty)).Should().Be(0);
            redis.HasAnyValueField().Should().BeFalse();

            var get = await service.GetDataGatewayConfigurationAsync();
            get!.ItemId.Should().Be(create.ItemId);
            get.DbConnectionString.Should().Be(Value);
        }

        // ---------- R-X-UPDATE-SAME / NEW / DEFAULT (H5–H8, C12) ----------

        [Fact]
        public async Task On_Updates_KeepMigratedFrom_TenantCopyValueUnchanged_FlagOnlyOnValueChange()
        {
            var t = "U" + Guid.NewGuid().ToString("N")[..8];
            var cfg = "cfg-" + t;
            using var dbs = new Dbs(_fixture.Client, rootTenant: false);
            using var ctx = new BlocksTestContext(t, userId: "admin");
            var secrets = new FakeSecretService();
            var id = secrets.Add(Value);
            await dbs.RootDsc.InsertOneAsync(RootDoc(t, cfg, id));
            await dbs.TenantDsc.InsertOneAsync(LegacyDoc(cfg, Value, "crm"));
            var redis = new FakeRedis();
            var service = Service(Repo(dbs, on: true), on: true, secrets, redis);

            // Same value, new DB name.
            (await service.SaveDataGatewayConfigurationAsync(Update(cfg, Value, "crm2"))).IsSuccess.Should().BeTrue();
            var root = await Find(dbs.RootDsc, t);
            root["DatabaseName"].AsString.Should().Be("crm2");
            root["DbConnectionSecretId"].AsString.Should().Be(id);
            root["MigratedFrom"].AsString.Should().Be("DataServiceConfigurations");
            root["ProjectKey"].AsString.Should().Be(t);
            root.Contains("ValueChangedAfterDeploy").Should().BeFalse();
            root.Contains("DbConnectionString").Should().BeFalse();
            var copy = await Find(dbs.TenantDsc, cfg);
            copy["DatabaseName"].AsString.Should().Be("crm2");
            copy["DbConnectionString"].AsString.Should().Be(B64(Value));
            copy["LastUpdatedDate"].ToUniversalTime().Should().Be(root["LastUpdatedDate"].ToUniversalTime());
            secrets.Calls.Should().NotContain("secret.Rotate");
            var v1 = long.Parse(redis.Hashes[t]["Version"]);

            // New value: rotate same id, flag set, Version bumped, tenant copy value still the old one.
            await Task.Delay(5);
            (await service.SaveDataGatewayConfigurationAsync(Update(cfg, NewValue, "crm2"))).IsSuccess.Should().BeTrue();
            root = await Find(dbs.RootDsc, t);
            root["ValueChangedAfterDeploy"].AsBoolean.Should().BeTrue();
            root["DbConnectionSecretId"].AsString.Should().Be(id);
            root["MigratedFrom"].AsString.Should().Be("DataServiceConfigurations");
            secrets.Secrets[id].Value.Should().Be(NewValue);
            (await Find(dbs.TenantDsc, cfg))["DbConnectionString"].AsString.Should().Be(B64(Value));
            long.Parse(redis.Hashes[t]["Version"]).Should().BeGreaterThan(v1);

            // To default: no delete, old secret status unchanged.
            (await service.SaveDataGatewayConfigurationAsync(Update(cfg, "default", "crm2"))).IsSuccess.Should().BeTrue();
            root = await Find(dbs.RootDsc, t);
            root["DbConnectionSecretId"].AsString.Should().Be("default");
            secrets.Secrets[id].Status.Should().Be(SecretStatuses.Active);
            secrets.Calls.Should().NotContain("secret.Delete");
            redis.Hashes[t]["DbConnectionSecretId"].Should().Be("default");
            (await Find(dbs.TenantDsc, cfg))["DbConnectionString"].AsString.Should().Be(B64(Value));
            redis.HasAnyValueField().Should().BeFalse();
            redis.Calls.Should().NotContain("redis.KeyDelete");
        }

        [Fact]
        public async Task On_Update_UnmigratedTenant_Refused_TenantCopyUntouched()
        {
            var t = "M" + Guid.NewGuid().ToString("N")[..8];
            using var dbs = new Dbs(_fixture.Client, rootTenant: false);
            using var ctx = new BlocksTestContext(t);
            await dbs.TenantDsc.InsertOneAsync(LegacyDoc("cfg-" + t, Value, "crm"));
            var before = await Find(dbs.TenantDsc, "cfg-" + t);
            var secrets = new FakeSecretService();
            var service = Service(Repo(dbs, on: true), on: true, secrets, new FakeRedis());

            (await service.GetDataGatewayConfigurationAsync())!.DbConnectionString.Should().Be(Value);
            var response = await service.SaveDataGatewayConfigurationAsync(Update("cfg-" + t, NewValue, "crm2"));

            response.Errors.Should().Contain("ItemId", DataGatewayConfigurationService.NotMigratedMessage);
            (await Find(dbs.TenantDsc, "cfg-" + t)).Should().BeEquivalentTo(before);
            (await dbs.RootDsc.CountDocumentsAsync(FilterDefinition<BsonDocument>.Empty)).Should().Be(0);
            secrets.Calls.Should().BeEmpty();
        }

        // ---------- R-X-FLAG-FIRST (integration): rotate ok, root fields fail, re-save ----------

        [Fact]
        public async Task On_RotateThenRootWriteFails_FlagIsOnDoc_ResaveSameValueNoSecondRotate()
        {
            var t = "F" + Guid.NewGuid().ToString("N")[..8];
            var cfg = "cfg-" + t;
            using var dbs = new Dbs(_fixture.Client, rootTenant: false);
            using var ctx = new BlocksTestContext(t);
            var secrets = new FakeSecretService();
            var id = secrets.Add(Value);
            await dbs.RootDsc.InsertOneAsync(RootDoc(t, cfg, id));
            var real = Repo(dbs, on: true);
            var failOnce = true;
            var repo = new Mock<IConfigurationRepository>();
            repo.Setup(x => x.GetDataGatewayRootAsync(It.IsAny<string>())).Returns<string>(real.GetDataGatewayRootAsync);
            repo.Setup(x => x.SetDataGatewayTenantCopyNonSecretAsync(It.IsAny<string>(), It.IsAny<BsonDocument>()))
                .Returns<string, BsonDocument>(real.SetDataGatewayTenantCopyNonSecretAsync);
            repo.Setup(x => x.SetDataGatewayRootFieldsAsync(It.IsAny<string>(), It.IsAny<BsonDocument>(), It.IsAny<IEnumerable<string>?>()))
                .Returns<string, BsonDocument, IEnumerable<string>?>((tenant, set, unset) =>
                {
                    if (set.Contains("DatabaseName") && failOnce) { failOnce = false; throw new TimeoutException("root write timeout"); }
                    return real.SetDataGatewayRootFieldsAsync(tenant, set, unset);
                });
            var redis = new FakeRedis();
            var service = new DataGatewayConfigurationService(repo.Object, new DataGatewayConfigurationValidator(repo.Object), secrets,
                redis.Client(), DataGatewayTestSupport.Mode(true), new RecordingLogger<DataGatewayConfigurationService>());

            await FluentActions.Awaiting(() => service.SaveDataGatewayConfigurationAsync(Update(cfg, NewValue, "crm2")))
                .Should().ThrowAsync<TimeoutException>();
            var root = await Find(dbs.RootDsc, t);
            root["ValueChangedAfterDeploy"].AsBoolean.Should().BeTrue();
            root["DatabaseName"].AsString.Should().Be("db-" + t);
            secrets.Secrets[id].Value.Should().Be(NewValue);

            var rotates = secrets.Calls.Count(c => c == "secret.Rotate");
            (await service.SaveDataGatewayConfigurationAsync(Update(cfg, NewValue, "crm2"))).IsSuccess.Should().BeTrue();
            secrets.Calls.Count(c => c == "secret.Rotate").Should().Be(rotates);
            (await Find(dbs.RootDsc, t))["DatabaseName"].AsString.Should().Be("crm2");
            redis.Hashes[t]["DatabaseName"].Should().Be("crm2");
        }

        // ---------- R-X-CONCURRENT (C22) ----------

        [Fact]
        public async Task On_TwoParallelUpdates_BothAnswered_OneRootDoc_LiveSecret_Flagged()
        {
            var t = "P" + Guid.NewGuid().ToString("N")[..8];
            var cfg = "cfg-" + t;
            using var dbs = new Dbs(_fixture.Client, rootTenant: false);
            using var ctx = new BlocksTestContext(t);
            var secrets = new FakeSecretService();
            var id = secrets.Add(Value);
            await dbs.RootDsc.InsertOneAsync(RootDoc(t, cfg, id));
            var redis = new FakeRedis();
            var a = Service(Repo(dbs, on: true), on: true, secrets, redis);
            var b = Service(Repo(dbs, on: true), on: true, secrets, redis);

            var results = await Task.WhenAll(
                Task.Run(() => a.SaveDataGatewayConfigurationAsync(Update(cfg, NewValue, "db-" + t))),
                Task.Run(() => b.SaveDataGatewayConfigurationAsync(Update(cfg, Value, "other-db"))));

            results.Should().OnlyContain(x => x.IsSuccess);
            (await dbs.RootDsc.CountDocumentsAsync(new BsonDocument("_id", t))).Should().Be(1);
            var root = await Find(dbs.RootDsc, t);
            root["ValueChangedAfterDeploy"].AsBoolean.Should().BeTrue();
            secrets.Secrets[root["DbConnectionSecretId"].AsString].Status.Should().Be(SecretStatuses.Active);
            new[] { "db-" + t, "other-db" }.Should().Contain(root["DatabaseName"].AsString);
        }

        [Fact]
        public async Task Repo_TenantCopyWrite_RefusesTheValueField_AndNeverUpserts()
        {
            using var dbs = new Dbs(_fixture.Client, rootTenant: false);
            var repo = Repo(dbs, on: true);

            await FluentActions.Awaiting(() => repo.SetDataGatewayTenantCopyNonSecretAsync("cfg", new BsonDocument("DbConnectionString", "x")))
                .Should().ThrowAsync<ArgumentException>();
            (await repo.SetDataGatewayTenantCopyNonSecretAsync("missing", new BsonDocument("DatabaseName", "x"))).Should().Be(0);
            (await dbs.TenantDsc.CountDocumentsAsync(FilterDefinition<BsonDocument>.Empty)).Should().Be(0);
            (await repo.SetDataGatewayRootFieldsAsync("missing", new BsonDocument("DatabaseName", "x"))).Should().Be(0);
            (await dbs.RootDsc.CountDocumentsAsync(FilterDefinition<BsonDocument>.Empty)).Should().Be(0);
        }
    }
}
