using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis.Entities.Data;
using Configuration.DomainService.Storage.Repositories;
using DomainService.Configuration;
using FluentAssertions;
using MongoDB.Driver;
using Moq;

namespace XUnitTest.Integration
{
    /// <summary>Old <c>StorageConfigurations</c> documents (real Mongo) next to the driver store rows (fake).</summary>
    [Collection(MongoIntegrationCollection.Name)]
    public class StorageConfigurationRepositoryTests
    {
        private readonly MongoIntegrationFixture _fixture;
        private readonly Mock<IStorageConfigurationStore> _store = new();

        public StorageConfigurationRepositoryTests(MongoIntegrationFixture fixture)
        {
            _fixture = fixture;
        }

        private StorageConfigurationRepository Repository() => new(_store.Object, _fixture.DbContextProvider);

        private IMongoCollection<StorageConfiguration> Legacy() =>
            _fixture.Collection<StorageConfiguration>(StorageConfigurationKeys.LegacyCollectionName);

        private void StoreRows(params StorageSettings[] rows) =>
            _store.Setup(s => s.GetAllSettingsAsync(It.IsAny<StorageConfigScope?>(), It.IsAny<CancellationToken>()))
                  .ReturnsAsync(rows);

        [Fact]
        public async Task GetAll_ARowHidesTheOldDocumentWithTheSameName()
        {
            var tag = Guid.NewGuid().ToString("N");
            await Legacy().InsertManyAsync(new[]
            {
                new StorageConfiguration { ItemId = "old-" + tag, Name = "migrated-" + tag, ConnectionString = "old-value" },
                new StorageConfiguration { ItemId = "legacy-" + tag, Name = "legacy-" + tag, ConnectionString = "legacy-value" },
            });
            StoreRows(new StorageSettings { ItemId = "row-" + tag, Name = "migrated-" + tag });

            var all = (await Repository().GetAllAsync()).Where(c => c.Settings.Name.EndsWith(tag, StringComparison.Ordinal)).ToList();

            all.Select(c => c.Settings.ItemId).Should().BeEquivalentTo("row-" + tag, "legacy-" + tag);
            all.Single(c => c.Settings.ItemId == "legacy-" + tag).IsLegacy.Should().BeTrue();
        }

        [Fact]
        public async Task Delete_RemovesTheRowAndTheOldDocument()
        {
            // Else the old document would come back through the reader's fallback.
            var tag = Guid.NewGuid().ToString("N");
            await Legacy().InsertOneAsync(new StorageConfiguration { ItemId = "d-" + tag, Name = "del-" + tag });

            await Repository().DeleteAsync(" del-" + tag + " ");

            _store.Verify(s => s.DeleteAsync("del-" + tag, It.IsAny<StorageConfigScope?>(), It.IsAny<CancellationToken>()), Times.Once);
            (await Legacy().CountDocumentsAsync(d => d.Name == "del-" + tag)).Should().Be(0);
        }

        [Fact]
        public async Task SecretStatus_OfAnOldDocument_IsComputedWithoutTheStore()
        {
            var stored = new StoredStorageConfiguration(new StorageSettings { Name = "x" }, new StorageSecretValues { Password = "p" });

            var status = await Repository().GetSecretStatusAsync(stored);

            status["Password"].Should().Be(StorageSecretStatus.Active);
            status["ConnectionString"].Should().Be(StorageSecretStatus.None);
            _store.Verify(s => s.GetSecretStatusAsync(It.IsAny<StorageSettings>(), It.IsAny<StorageConfigScope?>(), It.IsAny<CancellationToken>()), Times.Never);
        }
    }
}
