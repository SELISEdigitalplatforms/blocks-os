using System;
using System.Linq;
using System.Threading.Tasks;
using Blocks.Genesis;
using Configuration.DomainService.Notification.RequestModel;
using Configuration.DomainService.Shared.Services;
using Configuration.DomainService.Storage.Entities;
using FluentAssertions;
using MongoDB.Bson;
using MongoDB.Driver;
using XUnitTest.TestHelpers;
using Blocks.Genesis.Entities.Os;
using Blocks.Genesis.Entities.Data;

namespace XUnitTest.Integration
{
    [Collection(MongoIntegrationCollection.Name)]
    public class ConfigurationRepositoryTests
    {
        private readonly MongoIntegrationFixture _fixture;

        public ConfigurationRepositoryTests(MongoIntegrationFixture fixture)
        {
            _fixture = fixture;
        }

        private ConfigurationRepository NewRepository() => new(_fixture.DbContextProvider, new InMemoryKeyValueStore(), DataGatewayTestSupport.RootSecret(), DataGatewayTestSupport.Mode(false));

        [Fact]
        public async Task Notification_SaveGetByIdByNameListAndDelete()
        {
            var tag = Guid.NewGuid().ToString("N");
            var repo = NewRepository();
            var config = new NotificationConfiguration
            {
                ItemId = "n-" + tag,
                Name = "notif-" + tag,
                NotifyMethod = "email",
                EnablePersistence = true
            };

            await repo.SaveNotificationConfigurationAsync(config);

            (await repo.GetNotificationConfigurationByIdAsync("n-" + tag))!.Name.Should().Be("notif-" + tag);
            (await repo.GetNotificationConfigurationByNameAsync("notif-" + tag))!.ItemId.Should().Be("n-" + tag);

            var list = await repo.GetNotificationConfigurationsAsync(
                new GetNotificationConfigurationsRequest { Page = 0, PageSize = 100 });
            list.IsSuccess.Should().BeTrue();
            list.TotalCount.Should().BeGreaterThanOrEqualTo(1);
            list.Configurations.Should().Contain(c => c.ItemId == "n-" + tag);

            var delete = await repo.DeleteNotificationConfigurationAsync(
                new DeleteNotificationConfigurationRequest { ItemId = "n-" + tag });
            delete.IsSuccess.Should().BeTrue();
            (await repo.GetNotificationConfigurationByIdAsync("n-" + tag)).Should().BeNull();
        }

        private const string LegacyCollection = "NotificationConfigurations";

        private sealed class TenantDb : IDisposable
        {
            private readonly SplitDatabaseContextProvider _provider;
            public TenantDb(MongoIntegrationFixture fixture)
            {
                var name = "tenantdb_nc_" + Guid.NewGuid().ToString("N")[..12];
                _provider = new SplitDatabaseContextProvider(fixture.Client, fixture.Database, name);
                Db = fixture.Client.GetDatabase(name);
            }
            public IMongoDatabase Db { get; }
            public IDbContextProvider Provider => _provider;
            public async Task CreateLegacyAsync() => await Db.CreateCollectionAsync(LegacyCollection);
            public async Task<bool> LegacyExistsAsync() =>
                (await (await Db.ListCollectionNamesAsync()).ToListAsync()).Contains(LegacyCollection);
            public IMongoCollection<NotificationConfiguration> Legacy => Db.GetCollection<NotificationConfiguration>(LegacyCollection);
            public void Dispose() => _provider.Drop();
        }

        private static NotificationConfiguration Config(string id, string name, DateTime? created = null) => new()
        {
            ItemId = id,
            Name = name,
            NotifyMethod = "email",
            CreatedDate = created ?? DateTime.UtcNow
        };

        [Fact]
        public async Task Notification_LegacyExists_SaveWritesOldCollectionAndKv_ReadsComeFromOldCollection()
        {
            using var db = new TenantDb(_fixture);
            await db.CreateLegacyAsync();
            var kv = new InMemoryKeyValueStore();
            var repo = new ConfigurationRepository(db.Provider, kv, DataGatewayTestSupport.RootSecret(), DataGatewayTestSupport.Mode(false));

            await repo.SaveNotificationConfigurationAsync(Config("n1", "alpha"));

            (await db.Legacy.CountDocumentsAsync(c => c.ItemId == "n1")).Should().Be(1);
            kv.Rows.Should().ContainKey("notification-config:alpha");
            ((NotificationConfiguration)kv.Rows["notification-config:alpha"]).ItemId.Should().Be("n1");

            // reads are today's code: a KV-only row is invisible while the old collection exists
            kv.Rows["notification-config:ghost"] = Config("g1", "ghost");
            (await repo.GetNotificationConfigurationByNameAsync("ghost")).Should().BeNull();
            (await repo.GetNotificationConfigurationByIdAsync("g1")).Should().BeNull();
            (await repo.GetNotificationConfigurationByIdAsync("n1"))!.Name.Should().Be("alpha");
            var list = await repo.GetNotificationConfigurationsAsync(new GetNotificationConfigurationsRequest { Page = 0, PageSize = 10 });
            list.TotalCount.Should().Be(1);
        }

        [Fact]
        public async Task Notification_LegacyExists_DeleteRemovesFromBothStores()
        {
            using var db = new TenantDb(_fixture);
            await db.CreateLegacyAsync();
            var kv = new InMemoryKeyValueStore();
            var repo = new ConfigurationRepository(db.Provider, kv, DataGatewayTestSupport.RootSecret(), DataGatewayTestSupport.Mode(false));
            await repo.SaveNotificationConfigurationAsync(Config("n1", "alpha"));
            await repo.SaveNotificationConfigurationAsync(Config("n2", "beta"));

            var result = await repo.DeleteNotificationConfigurationAsync(new DeleteNotificationConfigurationRequest { ItemId = "n1" });

            result.IsSuccess.Should().BeTrue();
            (await db.Legacy.CountDocumentsAsync(c => c.ItemId == "n1")).Should().Be(0);
            kv.Rows.Keys.Should().BeEquivalentTo("notification-config:beta");
        }

        [Fact]
        public async Task Notification_LegacyExists_KvWriteFails_ThrowsButOldCollectionAlreadyHasTheChange()
        {
            using var db = new TenantDb(_fixture);
            await db.CreateLegacyAsync();
            var kv = new InMemoryKeyValueStore { FailOnSet = true };
            var repo = new ConfigurationRepository(db.Provider, kv, DataGatewayTestSupport.RootSecret(), DataGatewayTestSupport.Mode(false));

            var act = async () => await repo.SaveNotificationConfigurationAsync(Config("n1", "alpha"));

            await act.Should().ThrowAsync<InvalidOperationException>();
            (await db.Legacy.CountDocumentsAsync(c => c.ItemId == "n1")).Should().Be(1);
        }

        [Fact]
        public async Task Notification_LegacyGone_UsesKvOnly_AndNeverRecreatesTheCollection()
        {
            using var db = new TenantDb(_fixture);
            var kv = new InMemoryKeyValueStore();
            var repo = new ConfigurationRepository(db.Provider, kv, DataGatewayTestSupport.RootSecret(), DataGatewayTestSupport.Mode(false));

            await repo.SaveNotificationConfigurationAsync(Config("n1", "alpha"));
            await repo.SaveNotificationConfigurationAsync(Config("n1", "alpha")); // upsert, same key

            kv.Rows.Keys.Should().BeEquivalentTo("notification-config:alpha");
            (await repo.GetNotificationConfigurationByIdAsync("n1"))!.Name.Should().Be("alpha");
            (await repo.GetNotificationConfigurationByNameAsync("alpha"))!.ItemId.Should().Be("n1");
            (await repo.GetNotificationConfigurationByNameAsync("nope")).Should().BeNull();
            (await repo.GetNotificationConfigurationByIdAsync("nope")).Should().BeNull();

            await repo.DeleteNotificationConfigurationAsync(new DeleteNotificationConfigurationRequest { ItemId = "n1" });
            kv.Rows.Should().BeEmpty();
            (await repo.DeleteNotificationConfigurationAsync(new DeleteNotificationConfigurationRequest { ItemId = "missing" })).IsSuccess.Should().BeTrue();

            (await db.LegacyExistsAsync()).Should().BeFalse();
        }

        [Fact]
        public async Task Notification_LegacyGone_ListSortsByCreatedDateDescPagesAndCountsAll()
        {
            using var db = new TenantDb(_fixture);
            var kv = new InMemoryKeyValueStore();
            var repo = new ConfigurationRepository(db.Provider, kv, DataGatewayTestSupport.RootSecret(), DataGatewayTestSupport.Mode(false));
            var t0 = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            for (var i = 0; i < 5; i++)
            {
                await repo.SaveNotificationConfigurationAsync(Config("n" + i, "name" + i, t0.AddDays(i)));
            }

            var page0 = await repo.GetNotificationConfigurationsAsync(new GetNotificationConfigurationsRequest { Page = 0, PageSize = 2 });
            var page2 = await repo.GetNotificationConfigurationsAsync(new GetNotificationConfigurationsRequest { Page = 2, PageSize = 2 });

            page0.IsSuccess.Should().BeTrue();
            page0.TotalCount.Should().Be(5);
            page0.Configurations.Select(c => c.ItemId).Should().Equal("n4", "n3");
            page2.Configurations.Select(c => c.ItemId).Should().Equal("n0");
            page2.TotalCount.Should().Be(5);
            (await db.LegacyExistsAsync()).Should().BeFalse();
        }

        [Fact]
        public async Task Notification_LegacyGone_PageSizeZeroReturnsAllRows_LikeMongoLimitZero()
        {
            using var db = new TenantDb(_fixture);
            var repo = new ConfigurationRepository(db.Provider, new InMemoryKeyValueStore(), DataGatewayTestSupport.RootSecret(), DataGatewayTestSupport.Mode(false));
            for (var i = 0; i < 3; i++) await repo.SaveNotificationConfigurationAsync(Config("n" + i, "name" + i));

            var all = await repo.GetNotificationConfigurationsAsync(new GetNotificationConfigurationsRequest { Page = 0, PageSize = 0 });

            all.Configurations.Should().HaveCount(3);
            all.TotalCount.Should().Be(3);
        }

        [Fact]
        public async Task Notification_RealGenesisKeyValueStore_RoundTripsOnTheThrowawayDb()
        {
            using var db = new TenantDb(_fixture);
            var secret = new BlocksSecret { DatabaseConnectionString = "mongodb://localhost:27017", RootDatabaseName = "BlocksRootDb" };
            var kv = new MongoKeyValueStore(db.Provider, secret);
            var repo = new ConfigurationRepository(db.Provider, kv, DataGatewayTestSupport.RootSecret(), DataGatewayTestSupport.Mode(false));
            var created = new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc);

            await repo.SaveNotificationConfigurationAsync(Config("n1", "alpha ", created));
            await repo.SaveNotificationConfigurationAsync(Config("n2", "beta", created.AddDays(1)));

            // stored in the tenant DB under KeyValueStores with the trimmed key
            var stored = await db.Db.GetCollection<BsonDocument>("KeyValueStores").Find(new BsonDocument("Key", "notification-config:alpha")).ToListAsync();
            stored.Should().HaveCount(1);
            (await repo.GetNotificationConfigurationByIdAsync("n1"))!.Name.Should().Be("alpha ");
            (await repo.GetNotificationConfigurationByNameAsync("beta"))!.ItemId.Should().Be("n2");
            var list = await repo.GetNotificationConfigurationsAsync(new GetNotificationConfigurationsRequest { Page = 0, PageSize = 10 });
            list.Configurations.Select(c => c.ItemId).Should().Equal("n2", "n1");
            list.Configurations[1].CreatedDate.Should().Be(created);

            await repo.DeleteNotificationConfigurationAsync(new DeleteNotificationConfigurationRequest { ItemId = "n1" });
            (await repo.GetNotificationConfigurationByIdAsync("n1")).Should().BeNull();
            (await db.LegacyExistsAsync()).Should().BeFalse();
        }

        [Fact]
        public async Task Notification_KeyIsTrimmedName_SoTrailingSpaceNamesShareOneKey()
        {
            using var db = new TenantDb(_fixture);
            var kv = new InMemoryKeyValueStore();
            var repo = new ConfigurationRepository(db.Provider, kv, DataGatewayTestSupport.RootSecret(), DataGatewayTestSupport.Mode(false));

            await repo.SaveNotificationConfigurationAsync(Config("n1", "a"));
            (await repo.GetNotificationConfigurationByNameAsync("a "))!.ItemId.Should().Be("n1");
            kv.Rows.Keys.Should().BeEquivalentTo("notification-config:a");
        }

        [Fact]
        public async Task Notification_SaveUpsertsExistingById()
        {
            var tag = Guid.NewGuid().ToString("N");
            using var db = new TenantDb(_fixture); // own DB: the old collection is created here only
            await db.CreateLegacyAsync();
            var repo = new ConfigurationRepository(db.Provider, new InMemoryKeyValueStore(), DataGatewayTestSupport.RootSecret(), DataGatewayTestSupport.Mode(false));
            await repo.SaveNotificationConfigurationAsync(new NotificationConfiguration { ItemId = "u-" + tag, Name = "before-" + tag });
            await repo.SaveNotificationConfigurationAsync(new NotificationConfiguration { ItemId = "u-" + tag, Name = "after-" + tag });

            (await repo.GetNotificationConfigurationByIdAsync("u-" + tag))!.Name.Should().Be("after-" + tag);
        }

        [Fact]
        public async Task Storage_SaveGetByIdByNameByStrategyAllAndDelete()
        {
            var tag = Guid.NewGuid().ToString("N");
            var repo = NewRepository();
            var strategy = "strat-" + tag;
            var config = new StorageConfiguration
            {
                ItemId = "s-" + tag,
                Name = "storage-" + tag,
                StorageStrategy = strategy
            };

            await repo.SaveStorageConfigurationAsync(config);

            (await repo.GetStorageConfigurationByIdAsync("s-" + tag))!.Name.Should().Be("storage-" + tag);
            (await repo.GetStorageConfigurationByNameAsync("storage-" + tag))!.ItemId.Should().Be("s-" + tag);
            (await repo.GetStorageConfigurationStrategyAsync(strategy))!.ItemId.Should().Be("s-" + tag);
            (await repo.GetAllStorageConfigurationsByDateAsync()).Should().Contain(c => c.ItemId == "s-" + tag);

            await repo.DeleteStorageConfigurationByNameAsync("storage-" + tag);
            (await repo.GetStorageConfigurationByIdAsync("s-" + tag)).Should().BeNull();
        }

        [Fact]
        public async Task Mail_SaveGetByIdAllAndDelete()
        {
            var tag = Guid.NewGuid().ToString("N");
            var repo = NewRepository();
            var config = new MailServerConfiguration
            {
                ItemId = "m-" + tag,
                Name = "mail-" + tag,
                Host = "smtp.example.com",
                Port = 587,
                IsDefault = true
            };

            await repo.SaveMailConfigurationAsync(config);

            (await repo.GetMailConfigurationByIdAsync("m-" + tag))!.Name.Should().Be("mail-" + tag);
            (await repo.GetAllMailConfigurationsAsync()).Should().Contain(c => c.ItemId == "m-" + tag);

            await repo.DeleteMailConfigurationAsync("m-" + tag);
            (await repo.GetMailConfigurationByIdAsync("m-" + tag)).Should().BeNull();
        }

        [Fact]
        public async Task Mail_UpdateSenderName_ChangesOnlyThatFieldAndKeepsUnmappedOnes()
        {
            var tag = Guid.NewGuid().ToString("N");
            var repo = NewRepository();
            var collection = _fixture.Collection<BsonDocument>("MailServerConfigurations");

            // Written raw so the document can carry a field the entity does not map, as a
            // provisioned default may. A read-then-replace would silently drop it.
            await collection.InsertOneAsync(new BsonDocument
            {
                { "_id", "d-" + tag },
                { "Name", "Default" },
                { "Host", "email-smtp.eu-central-1.amazonaws.com" },
                { "Port", 587 },
                { "SenderName", "Selise Blocks" },
                { "SenderAddress", "blocks@selise.io" },
                { "SenderUserName", "ses-user" },
                { "AccountPassword", "ses-password" },
                { "IsDefault", true },
                { "ProvisionedOnly", "keep-me" }
            });

            var updatedAt = new DateTime(2026, 9, 25, 0, 0, 0, DateTimeKind.Utc);
            await repo.UpdateMailSenderNameAsync("d-" + tag, "Contoso Mailer", updatedAt, "user-1");

            var stored = await collection.Find(Builders<BsonDocument>.Filter.Eq("_id", "d-" + tag)).FirstAsync();
            stored["SenderName"].AsString.Should().Be("Contoso Mailer");
            stored["LastUpdatedBy"].AsString.Should().Be("user-1");
            stored["Host"].AsString.Should().Be("email-smtp.eu-central-1.amazonaws.com");
            stored["SenderAddress"].AsString.Should().Be("blocks@selise.io");
            stored["SenderUserName"].AsString.Should().Be("ses-user");
            stored["AccountPassword"].AsString.Should().Be("ses-password");
            stored["IsDefault"].AsBoolean.Should().BeTrue();
            stored["ProvisionedOnly"].AsString.Should().Be("keep-me");

            await repo.DeleteMailConfigurationAsync("d-" + tag);
        }

        [Fact]
        public async Task UpsertAsync_Generic_WritesToDefaultCollectionName()
        {
            var tag = Guid.NewGuid().ToString("N");
            var repo = NewRepository();
            var config = new StorageConfiguration { ItemId = "g-" + tag, Name = "generic-" + tag, StorageStrategy = "s" };

            await repo.UpsertAsync(config, c => c.ItemId == "g-" + tag, "StorageConfigurations");

            (await repo.GetStorageConfigurationByIdAsync("g-" + tag))!.Name.Should().Be("generic-" + tag);
        }
    }
}
