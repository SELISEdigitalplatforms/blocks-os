using Blocks.Genesis.Entities.Data;
using DomainService.Configuration;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace DomainService.Projects
{
    /// <summary>
    /// Gives a new project the storage configurations of the seed DB (<c>BlocksConfiguration</c>): each
    /// <c>storage-config:*</c> row is copied with new secrets of the project's own tenant holding the seed values. Old seed
    /// documents without a row (seed not migrated yet) are copied the same way. Never overwrites a row the project already
    /// has, so a retry after a crash makes no duplicate.
    /// </summary>
    public interface IStorageConfigurationSeedCopier
    {
        /// <param name="rootTenantId">The tenant that holds the seed's secrets. Missing = the seed rows are not copied (logged as an error).</param>
        Task CopyAsync(IMongoDatabase seedDb, IMongoDatabase projectDb, string? rootTenantId, string projectTenantId);
    }

    public sealed class StorageConfigurationSeedCopier : IStorageConfigurationSeedCopier
    {
        private readonly IStorageConfigurationStore _store;
        private readonly ILogger<StorageConfigurationSeedCopier> _logger;

        public StorageConfigurationSeedCopier(IStorageConfigurationStore store, ILogger<StorageConfigurationSeedCopier> logger)
        {
            _store = store;
            _logger = logger;
        }

        public async Task CopyAsync(IMongoDatabase seedDb, IMongoDatabase projectDb, string? rootTenantId, string projectTenantId)
        {
            var target = StorageConfigScope.ForDatabase(projectTenantId, projectDb);
            var result = await CopySeedRowsAsync(seedDb, target, rootTenantId, projectTenantId);

            var seedRowNames = result.Copied.Concat(result.Skipped).Concat(result.Failed).ToHashSet(StringComparer.Ordinal);
            foreach (var document in await ReadLegacySeedDocumentsAsync(seedDb))
            {
                var name = StorageConfigurationKeys.NormalizeName(document.Name);
                if (name.Length == 0 || seedRowNames.Contains(name))
                    continue;

                var created = await _store.CreateIfAbsentAsync(NewSettingsFrom(document), StorageSecretValues.FromConfiguration(document), target);
                (created.Created ? result.Copied : result.Skipped).Add(name);
            }

            _logger.LogInformation(
                "[storage-config] seed-copy tenant={TenantId} copied={Copied} skipped={Skipped}",
                projectTenantId, string.Join(",", result.Copied), string.Join(",", result.Skipped));
            if (result.Failed.Count > 0)
                _logger.LogError(
                    "[storage-config] seed-copy tenant={TenantId} failed={Failed} (a seed secret is missing, archived or locked)",
                    projectTenantId, string.Join(",", result.Failed));
        }

        private async Task<StorageCopyResult> CopySeedRowsAsync(IMongoDatabase seedDb, StorageConfigScope target, string? rootTenantId, string projectTenantId)
        {
            if (!string.IsNullOrWhiteSpace(rootTenantId))
                return await _store.CopyAllAsync(StorageConfigScope.ForSeed(rootTenantId, seedDb), target);

            _logger.LogError("[storage-config] seed-copy tenant={TenantId} skipped-rows: RootTenantId is not configured", projectTenantId);
            return new StorageCopyResult();
        }

        private static async Task<List<StorageConfiguration>> ReadLegacySeedDocumentsAsync(IMongoDatabase seedDb) =>
            await seedDb.GetCollection<StorageConfiguration>(StorageConfigurationKeys.LegacyCollectionName)
                .Find(Builders<StorageConfiguration>.Filter.Empty)
                .ToListAsync();

        /// <summary>The project's own row: the seed's settings with a new id and dates.</summary>
        private static StorageSettings NewSettingsFrom(StorageConfiguration document)
        {
            var now = DateTime.UtcNow;
            var settings = StorageSettings.FromConfiguration(document);
            settings.ItemId = Guid.NewGuid().ToString();
            settings.CreatedDate = now;
            settings.LastUpdatedDate = now;
            settings.CreatedBy = null;
            settings.LastUpdatedBy = null;
            return settings;
        }
    }
}
