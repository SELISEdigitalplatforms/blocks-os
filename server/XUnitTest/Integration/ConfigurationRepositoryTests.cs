using System;
using System.Linq;
using System.Threading.Tasks;
using Configuration.DomainService.Mail.Entities;
using Configuration.DomainService.Notification.Entities;
using Configuration.DomainService.Notification.RequestModel;
using Configuration.DomainService.Shared.Services;
using Configuration.DomainService.Storage.Entities;
using FluentAssertions;
using MongoDB.Bson;
using MongoDB.Driver;

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

        private ConfigurationRepository NewRepository() => new(_fixture.DbContextProvider);

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

        [Fact]
        public async Task Notification_SaveUpsertsExistingById()
        {
            var tag = Guid.NewGuid().ToString("N");
            var repo = NewRepository();
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
