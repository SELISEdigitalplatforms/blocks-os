using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Blocks.Genesis;
using Blocks.Genesis.Entities.Os;
using Configuration.DomainService.Notification.Propagation;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;
using Moq;
using XUnitTest.TestSupport;

namespace XUnitTest.Integration
{
    /// <summary>
    /// Root built-in notification config propagation against a real mongod: every database (root registry, root
    /// tenant, seed, tenants, a tenant "on another cluster") is its own throwaway database, keyed by
    /// (connection string, database name) exactly as the propagator asks for it.
    /// </summary>
    [Collection(MongoIntegrationCollection.Name)]
    public sealed class NotificationConfigurationPropagatorTests : IDisposable
    {
        private const string MainCluster = "mongodb://main-cluster";
        private const string OtherCluster = "mongodb://other-cluster";
        private const string BrokenCluster = "mongodb://user:pw-not-for-logs@broken-cluster";
        private const string RootDbName = "BlocksRootDb";
        private const string Name = "DataImportFailed";

        private readonly MongoIntegrationFixture _fixture;
        private readonly string _run = Guid.NewGuid().ToString("N")[..8];
        private readonly HashSet<string> _created = new();
        private readonly RecordingLogger<NotificationConfigurationPropagator> _logger = new();

        public NotificationConfigurationPropagatorTests(MongoIntegrationFixture fixture)
        {
            _fixture = fixture;
        }

        public void Dispose()
        {
            foreach (var name in _created)
            {
                _fixture.Client.DropDatabase(name);
            }
        }

        // (connection, db) -> one physical throwaway database.
        private IMongoDatabase Db(string connection, string dbName)
        {
            if (connection == BrokenCluster)
            {
                throw new TimeoutException("A timeout occurred after 30000ms selecting a server. " + BrokenCluster);
            }

            var cluster = connection == OtherCluster ? "o" : "m";
            var physical = $"nc_{_run}_{cluster}_{dbName}";
            if (physical.Length > 60) physical = physical[..60];
            _created.Add(physical);
            return _fixture.Client.GetDatabase(physical);
        }

        private sealed class Provider : IDbContextProvider
        {
            private readonly Func<string, string, IMongoDatabase> _resolve;
            public Provider(Func<string, string, IMongoDatabase> resolve) => _resolve = resolve;
            public IMongoDatabase GetDatabase(string tenantId) => throw new NotSupportedException();
            public IMongoDatabase? GetDatabase() => throw new NotSupportedException();
            public IMongoDatabase GetDatabase(string connectionString, string databaseName, bool isCacheRefreshed = false) =>
                _resolve(connectionString, databaseName);
            public IMongoCollection<T> GetCollection<T>(string collectionName) => throw new NotSupportedException();
            public IMongoCollection<T> GetCollection<T>(string tenantId, string collectionName) => throw new NotSupportedException();
        }

        /// <summary>Points the Genesis key-value store at one database, to read back what the propagator wrote.</summary>
        private sealed class FixedProvider : IDbContextProvider
        {
            private readonly IMongoDatabase _db;
            public FixedProvider(IMongoDatabase db) => _db = db;
            public IMongoDatabase GetDatabase(string tenantId) => _db;
            public IMongoDatabase? GetDatabase() => _db;
            public IMongoDatabase GetDatabase(string connectionString, string databaseName, bool isCacheRefreshed = false) => _db;
            public IMongoCollection<T> GetCollection<T>(string collectionName) => _db.GetCollection<T>(collectionName);
            public IMongoCollection<T> GetCollection<T>(string tenantId, string collectionName) => _db.GetCollection<T>(collectionName);
        }

        private IBlocksSecret Secret()
        {
            var secret = new Mock<IBlocksSecret>();
            secret.SetupGet(s => s.DatabaseConnectionString).Returns(MainCluster);
            secret.SetupGet(s => s.RootDatabaseName).Returns(RootDbName);
            return secret.Object;
        }

        private NotificationConfigurationPropagator Propagator() => new(new Provider(Db), Secret(), _logger);

        private IMongoDatabase RootTenantDb => Db(MainCluster, "root_tenant");
        private IMongoDatabase SeedDb => Db(MainCluster, NotificationConfigurationPropagator.SeedDatabaseName);
        private IMongoDatabase TenantA => Db(MainCluster, "tenant_a");
        private IMongoDatabase TenantB => Db(OtherCluster, "tenant_b");
        private IMongoDatabase TenantDisabled => Db(MainCluster, "tenant_off");

        private async Task SeedRegistryAsync(bool withBroken = false)
        {
            var tenants = Db(MainCluster, RootDbName).GetCollection<BsonDocument>("Tenants");
            var docs = new List<BsonDocument>
            {
                Tenant("ROOT", "root_tenant", MainCluster, isRoot: true),
                Tenant("A", "tenant_a", MainCluster),
                Tenant("B", "tenant_b", OtherCluster),
                Tenant("OFF", "tenant_off", MainCluster, disabled: true),
            };
            if (withBroken)
            {
                docs.Add(Tenant("BROKEN", "tenant_broken", BrokenCluster));
            }
            await tenants.InsertManyAsync(docs);
        }

        private static BsonDocument Tenant(string id, string db, string conn, bool isRoot = false, bool disabled = false) => new()
        {
            { "_id", id }, { "TenantId", id }, { "DBName", db }, { "DbConnectionString", conn },
            { "IsRootTenant", isRoot }, { "IsDisabled", disabled }, { "TenantSalt", "salt-not-read" }
        };

        private static NotificationConfiguration BuiltIn(string description = "v1") => new()
        {
            ItemId = "root-item",
            Name = Name,
            NotifyMethod = Name,
            EnablePersistence = true,
            NotificationType = NotificationReceiverTypes.UserSpecificReceiverType,
            IsBuiltIn = true,
            Kind = NotificationKind.Alert,
            Importance = NotificationImportance.High,
            Description = description,
            SourceService = "blocks-data",
            CreatedBy = "root-user",
            LastUpdatedBy = "root-user",
            CreatedDate = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            LastUpdatedDate = DateTime.UtcNow
        };

        private static Task PutKvAsync(IMongoDatabase db, NotificationConfiguration config) =>
            new MongoKeyValueStore(new FixedProvider(db), new Mock<IBlocksSecret>().Object)
                .SetAsync(NotificationConfigurationPropagator.KeyFor(config.Name), config);

        private static Task<NotificationConfiguration?> GetKvAsync(IMongoDatabase db, string name = Name) =>
            new MongoKeyValueStore(new FixedProvider(db), new Mock<IBlocksSecret>().Object)
                .GetAsync<NotificationConfiguration>(NotificationConfigurationPropagator.KeyFor(name));

        private static async Task<long> KvCountAsync(IMongoDatabase db, string name = Name) =>
            await db.GetCollection<BsonDocument>("KeyValueStores").CountDocumentsAsync(new BsonDocument("Key", NotificationConfigurationPropagator.KeyFor(name)));

        private static BuiltInNotificationConfigurationChangedEvent Event(
            NotificationConfigurationChangeAction action = NotificationConfigurationChangeAction.Upsert, string source = "ROOT") => new()
        {
            Action = action, Name = Name, SourceTenantId = source, Snapshot = BuiltIn()
        };

        [Fact]
        public async Task Upsert_InsertsEnabledCopyIntoSeedAndEveryOtherTenant_InGenesisKvShape()
        {
            await SeedRegistryAsync();
            await PutKvAsync(RootTenantDb, BuiltIn());

            var summary = await Propagator().PropagateAsync(Event());

            summary.SkippedReason.Should().BeNull();
            summary.Count(NotificationPropagationOutcome.Inserted).Should().Be(4, "seed, A, B (other cluster) and the disabled tenant");
            foreach (var db in new[] { SeedDb, TenantA, TenantB, TenantDisabled })
            {
                var copy = await GetKvAsync(db);
                copy.Should().NotBeNull();
                copy!.IsBuiltIn.Should().BeTrue();
                copy.IsDisabled.Should().BeFalse();
                copy.Description.Should().Be("v1");
                copy.Kind.Should().Be(NotificationKind.Alert);

                var entry = await db.GetCollection<BsonDocument>("KeyValueStores").Find(new BsonDocument("Key", "notification-config:" + Name)).SingleAsync();
                entry["OrganizationId"].AsString.Should().Be("default");
                entry["Tags"].AsBsonArray.Should().BeEmpty();
                entry["_id"].IsString.Should().BeTrue();
                entry.Contains("CreatedDate").Should().BeTrue();
            }

            (await KvCountAsync(RootTenantDb)).Should().Be(1, "the source database is never written back");
        }

        [Fact]
        public async Task Upsert_OverwritesExistingBuiltIn_ButKeepsTenantIsDisabledAndIdentity()
        {
            await SeedRegistryAsync();
            await PutKvAsync(RootTenantDb, BuiltIn("v2"));
            var tenantCopy = BuiltIn("v1");
            tenantCopy.ItemId = "tenant-item";
            tenantCopy.CreatedBy = "tenant-seed";
            tenantCopy.IsDisabled = true;
            await PutKvAsync(TenantA, tenantCopy);

            var summary = await Propagator().PropagateAsync(Event());

            summary.Results.Single(r => r.TargetId == "A").Outcome.Should().Be(NotificationPropagationOutcome.Updated);
            var copy = await GetKvAsync(TenantA);
            copy!.Description.Should().Be("v2");
            copy.IsDisabled.Should().BeTrue();
            copy.ItemId.Should().Be("tenant-item");
            copy.CreatedBy.Should().Be("tenant-seed");
            (await KvCountAsync(TenantA)).Should().Be(1);
        }

        [Fact]
        public async Task Upsert_TenantCustomWithSameName_IsSkippedAsConflict()
        {
            await SeedRegistryAsync();
            await PutKvAsync(RootTenantDb, BuiltIn());
            await PutKvAsync(TenantA, new NotificationConfiguration { ItemId = "mine", Name = Name, NotifyMethod = "custom-method" });
            // Custom only in the old collection on tenant B.
            await TenantB.GetCollection<NotificationConfiguration>("NotificationConfigurations")
                .InsertOneAsync(new NotificationConfiguration { ItemId = "old", Name = Name, NotifyMethod = "old-method" });

            var summary = await Propagator().PropagateAsync(Event());

            summary.Results.Single(r => r.TargetId == "A").Outcome.Should().Be(NotificationPropagationOutcome.Conflict);
            summary.Results.Single(r => r.TargetId == "B").Outcome.Should().Be(NotificationPropagationOutcome.Conflict);
            (await GetKvAsync(TenantA))!.NotifyMethod.Should().Be("custom-method");
            (await KvCountAsync(TenantB)).Should().Be(0);
            _logger.Entries.Should().Contain(e => e.Message.Contains("Conflicts=2") && e.Message.Contains("ConflictTargets=A,B"));
        }

        [Fact]
        public async Task Upsert_TargetWithOldCollection_WritesBothStores()
        {
            await SeedRegistryAsync();
            await PutKvAsync(RootTenantDb, BuiltIn("v2"));
            var legacy = BuiltIn("v1");
            legacy.ItemId = "legacy-item";
            await TenantA.GetCollection<NotificationConfiguration>("NotificationConfigurations").InsertOneAsync(legacy);

            await Propagator().PropagateAsync(Event());

            var oldCopy = await TenantA.GetCollection<NotificationConfiguration>("NotificationConfigurations").Find(c => c.Name == Name).SingleAsync();
            oldCopy.Description.Should().Be("v2");
            oldCopy.ItemId.Should().Be("legacy-item");
            (await GetKvAsync(TenantA))!.ItemId.Should().Be("legacy-item");
        }

        [Fact]
        public async Task Upsert_RunTwice_IsIdempotent()
        {
            await SeedRegistryAsync();
            await PutKvAsync(RootTenantDb, BuiltIn());

            await Propagator().PropagateAsync(Event());
            var second = await Propagator().PropagateAsync(Event());

            second.Count(NotificationPropagationOutcome.Updated).Should().Be(4);
            second.Count(NotificationPropagationOutcome.Inserted).Should().Be(0);
            foreach (var db in new[] { SeedDb, TenantA, TenantB, TenantDisabled })
            {
                (await KvCountAsync(db)).Should().Be(1);
            }
        }

        [Fact]
        public async Task Delete_RemovesBuiltInCopiesOnly()
        {
            await SeedRegistryAsync();
            await PutKvAsync(TenantA, BuiltIn());
            await PutKvAsync(TenantB, new NotificationConfiguration { ItemId = "mine", Name = Name, NotifyMethod = "custom" });
            var legacy = BuiltIn();
            await TenantDisabled.GetCollection<NotificationConfiguration>("NotificationConfigurations").InsertOneAsync(legacy);
            // Root no longer has the config: it was deleted.

            var summary = await Propagator().PropagateAsync(Event(NotificationConfigurationChangeAction.Delete));

            summary.Action.Should().Be(NotificationConfigurationChangeAction.Delete);
            summary.Results.Single(r => r.TargetId == "A").Outcome.Should().Be(NotificationPropagationOutcome.Deleted);
            summary.Results.Single(r => r.TargetId == "B").Outcome.Should().Be(NotificationPropagationOutcome.Conflict);
            summary.Results.Single(r => r.TargetId == "OFF").Outcome.Should().Be(NotificationPropagationOutcome.Deleted);
            summary.Results.Single(r => r.TargetId == NotificationConfigurationPropagator.SeedTargetId).Outcome.Should().Be(NotificationPropagationOutcome.NotPresent);
            (await GetKvAsync(TenantA)).Should().BeNull();
            (await GetKvAsync(TenantB))!.NotifyMethod.Should().Be("custom");
            (await TenantDisabled.GetCollection<NotificationConfiguration>("NotificationConfigurations").CountDocumentsAsync(FilterDefinition<NotificationConfiguration>.Empty)).Should().Be(0);
        }

        [Fact]
        public async Task OutOfOrderDelete_WhileRootStillHasConfig_AppliesCurrentRootState()
        {
            await SeedRegistryAsync();
            await PutKvAsync(RootTenantDb, BuiltIn());

            var summary = await Propagator().PropagateAsync(Event(NotificationConfigurationChangeAction.Delete));

            summary.Action.Should().Be(NotificationConfigurationChangeAction.Upsert);
            (await GetKvAsync(TenantA)).Should().NotBeNull();
        }

        [Fact]
        public async Task OneTenantFailing_DoesNotStopOthers_AndLogsNoConnectionString()
        {
            await SeedRegistryAsync(withBroken: true);
            await PutKvAsync(RootTenantDb, BuiltIn());

            var summary = await Propagator().PropagateAsync(Event());

            var broken = summary.Results.Single(r => r.TargetId == "BROKEN");
            broken.Outcome.Should().Be(NotificationPropagationOutcome.Failed);
            broken.ErrorType.Should().Be(nameof(TimeoutException));
            summary.Count(NotificationPropagationOutcome.Inserted).Should().Be(4);
            _logger.Entries.Should().Contain(e => e.Message.Contains("Failed=1") && e.Message.Contains("FailedTargets=BROKEN"));
            _logger.Entries.Should().NotContain(e => e.Message.Contains("pw-not-for-logs") || e.Message.Contains("broken-cluster"));
        }

        [Fact]
        public async Task SourceNotRoot_ChangesNothing()
        {
            await SeedRegistryAsync();
            await PutKvAsync(TenantA, BuiltIn());

            var summary = await Propagator().PropagateAsync(Event(source: "A"));

            summary.SkippedReason.Should().Be("source is not the root tenant");
            summary.Results.Should().BeEmpty();
            (await KvCountAsync(TenantB)).Should().Be(0);
        }

        [Fact]
        public async Task RootRecordNoLongerBuiltIn_LeavesTenantCopiesUnchanged()
        {
            await SeedRegistryAsync();
            var custom = BuiltIn("now-custom");
            custom.IsBuiltIn = false;
            await PutKvAsync(RootTenantDb, custom);
            await PutKvAsync(TenantA, BuiltIn("v1"));

            var summary = await Propagator().PropagateAsync(Event());

            summary.SkippedReason.Should().Be("source config is not built-in");
            (await GetKvAsync(TenantA))!.Description.Should().Be("v1");
        }

        [Fact]
        public async Task RootRecordOnlyInOldCollection_IsUsedAsSource()
        {
            await SeedRegistryAsync();
            await RootTenantDb.GetCollection<NotificationConfiguration>("NotificationConfigurations").InsertOneAsync(BuiltIn("legacy-root"));

            await Propagator().PropagateAsync(Event());

            (await GetKvAsync(TenantA))!.Description.Should().Be("legacy-root");
        }

        [Fact]
        public async Task IncompleteEvent_ChangesNothing()
        {
            var summary = await Propagator().PropagateAsync(new BuiltInNotificationConfigurationChangedEvent { Name = "", SourceTenantId = "ROOT" });

            summary.SkippedReason.Should().Be("incomplete event");
        }

        [Fact]
        public async Task RegistryUnreachable_Throws()
        {
            var secret = new Mock<IBlocksSecret>();
            secret.SetupGet(s => s.DatabaseConnectionString).Returns(BrokenCluster);
            secret.SetupGet(s => s.RootDatabaseName).Returns(RootDbName);
            var propagator = new NotificationConfigurationPropagator(new Provider(Db), secret.Object, _logger);

            var act = () => propagator.PropagateAsync(Event());

            await act.Should().ThrowAsync<TimeoutException>();
        }
    }
}
