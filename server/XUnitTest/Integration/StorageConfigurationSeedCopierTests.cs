using System;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis.Entities.Data;
using DomainService.Configuration;
using DomainService.Projects;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Driver;
using Moq;

namespace XUnitTest.Integration
{
    /// <summary>New project: seed storage configurations copied through the driver store (fake), seed docs in real Mongo.</summary>
    [Collection(MongoIntegrationCollection.Name)]
    public class StorageConfigurationSeedCopierTests
    {
        private const string ProjectTenant = "project-tenant";

        private readonly MongoIntegrationFixture _fixture;
        private readonly Mock<IStorageConfigurationStore> _store = new();

        public StorageConfigurationSeedCopierTests(MongoIntegrationFixture fixture)
        {
            _fixture = fixture;
        }

        private StorageConfigurationSeedCopier Copier() => new(_store.Object, NullLogger<StorageConfigurationSeedCopier>.Instance);

        private async Task<IMongoDatabase> SeedWithOldDocumentAsync(string tag)
        {
            var seed = _fixture.DbContextProvider.GetDatabase("", "seed-" + tag);
            await seed.GetCollection<StorageConfiguration>(StorageConfigurationKeys.LegacyCollectionName)
                .InsertOneAsync(new StorageConfiguration { ItemId = "seed-item", Name = "Default", StorageStrategy = "Azure", ConnectionString = "seed-conn" });
            return seed;
        }

        private void SeedRows(params string[] names)
        {
            var result = new StorageCopyResult();
            result.Copied.AddRange(names);
            _store.Setup(s => s.CopyAllAsync(It.IsAny<StorageConfigScope>(), It.IsAny<StorageConfigScope>(), It.IsAny<CancellationToken>()))
                  .ReturnsAsync(result);
        }

        [Fact]
        public async Task SeedNotMigratedYet_OldDocumentIsCopiedWithItsValuesAsSecretsOfTheProject()
        {
            var tag = Guid.NewGuid().ToString("N");
            var seed = await SeedWithOldDocumentAsync(tag);
            SeedRows();
            StorageSettings? settings = null;
            StorageSecretValues? secrets = null;
            StorageConfigScope? scope = null;
            _store.Setup(s => s.CreateIfAbsentAsync(It.IsAny<StorageSettings>(), It.IsAny<StorageSecretValues?>(), It.IsAny<StorageConfigScope?>(), It.IsAny<CancellationToken>()))
                  .Callback<StorageSettings, StorageSecretValues?, StorageConfigScope?, CancellationToken>((s, v, c, _) => (settings, secrets, scope) = (s, v, c))
                  .ReturnsAsync((StorageSettings s, StorageSecretValues? _, StorageConfigScope? _, CancellationToken _) => new StorageCreateResult(true, s));

            await Copier().CopyAsync(seed, _fixture.Database, "root-tenant", ProjectTenant);

            settings!.Name.Should().Be("Default");
            settings.ItemId.Should().NotBe("seed-item");
            secrets!.ConnectionString.Should().Be("seed-conn");
            scope!.SecretTenantId.Should().Be(ProjectTenant);
        }

        [Fact]
        public async Task SeedRowExists_TheOldDocumentWithTheSameNameIsNotCopiedAgain()
        {
            var tag = Guid.NewGuid().ToString("N");
            var seed = await SeedWithOldDocumentAsync(tag);
            SeedRows("Default");

            await Copier().CopyAsync(seed, _fixture.Database, "root-tenant", ProjectTenant);

            _store.Verify(s => s.CreateIfAbsentAsync(It.IsAny<StorageSettings>(), It.IsAny<StorageSecretValues?>(), It.IsAny<StorageConfigScope?>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task NoRootTenantConfigured_SeedRowsAreSkippedAndTheProjectIsStillCreated()
        {
            var tag = Guid.NewGuid().ToString("N");
            var seed = _fixture.DbContextProvider.GetDatabase("", "seed-" + tag);

            var copy = () => Copier().CopyAsync(seed, _fixture.Database, null, ProjectTenant);

            await copy.Should().NotThrowAsync();
            _store.Verify(s => s.CopyAllAsync(It.IsAny<StorageConfigScope>(), It.IsAny<StorageConfigScope>(), It.IsAny<CancellationToken>()), Times.Never);
        }
    }
}
