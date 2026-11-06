using Blocks.Genesis;
using Blocks.Genesis.Entities.Data;
using DomainService.Configuration;
using MongoDB.Driver;

namespace Configuration.DomainService.Storage.Repositories
{
    public sealed class StorageConfigurationRepository : IStorageConfigurationRepository
    {
        private readonly IStorageConfigurationStore _store;
        private readonly IDbContextProvider _dbContextProvider;

        public StorageConfigurationRepository(IStorageConfigurationStore store, IDbContextProvider dbContextProvider)
        {
            _store = store;
            _dbContextProvider = dbContextProvider;
        }

        /// <summary>The old collection of the caller's tenant (read and delete only).</summary>
        private IMongoCollection<StorageConfiguration> LegacyCollection =>
            _dbContextProvider.GetCollection<StorageConfiguration>(StorageConfigurationKeys.LegacyCollectionName);

        public async Task<StoredStorageConfiguration?> GetByNameAsync(string name)
        {
            var trimmed = StorageConfigurationKeys.NormalizeName(name);
            if (trimmed.Length == 0)
                return null;

            var row = await _store.GetSettingsAsync(trimmed);
            if (row is not null)
                return new StoredStorageConfiguration(row, null);

            var document = await LegacyCollection.Find(d => d.Name == trimmed).FirstOrDefaultAsync();
            return FromLegacy(document);
        }

        public async Task<StoredStorageConfiguration?> GetByItemIdAsync(string itemId)
        {
            if (string.IsNullOrWhiteSpace(itemId))
                return null;

            var all = await GetAllAsync();
            return all.FirstOrDefault(c => string.Equals(c.Settings.ItemId, itemId, StringComparison.Ordinal));
        }

        public async Task<IReadOnlyList<StoredStorageConfiguration>> GetAllAsync()
        {
            var rows = await _store.GetAllSettingsAsync();
            var names = rows.Select(r => StorageConfigurationKeys.NormalizeName(r.Name)).ToHashSet(StringComparer.Ordinal);
            var documents = await LegacyCollection.Find(Builders<StorageConfiguration>.Filter.Empty).ToListAsync();

            // A row is the truth for its name: an old document with the same name is never shown.
            return rows.Select(r => new StoredStorageConfiguration(r, null))
                .Concat(documents
                    .Where(d => !names.Contains(StorageConfigurationKeys.NormalizeName(d.Name)))
                    .Select(d => FromLegacy(d)!))
                .OrderBy(c => c.Settings.LastUpdatedDate)
                .ToList();
        }

        public async Task<StorageSettings?> CreateAsync(StorageSettings settings, StorageSecretValues secrets)
        {
            var result = await _store.CreateIfAbsentAsync(settings, secrets);
            return result.Created ? result.Settings : null;
        }

        public Task<StorageSettings> SaveAsync(StorageSettings settings, StorageSecretValues? secrets) =>
            _store.SaveAsync(settings, secrets);

        public Task<IReadOnlyDictionary<string, string>> GetSecretStatusAsync(StoredStorageConfiguration configuration)
        {
            ArgumentNullException.ThrowIfNull(configuration);
            if (configuration.LegacySecrets is null)
                return _store.GetSecretStatusAsync(configuration.Settings);

            // An old document holds its values itself: "active" when set, "none" when empty.
            IReadOnlyDictionary<string, string> status = StorageSecretFields.All.ToDictionary(
                f => f.Name,
                f => string.IsNullOrEmpty(f.GetValue(configuration.LegacySecrets)) ? StorageSecretStatus.None : StorageSecretStatus.Active,
                StringComparer.Ordinal);
            return Task.FromResult(status);
        }

        public async Task DeleteAsync(string name)
        {
            var trimmed = StorageConfigurationKeys.NormalizeName(name);
            if (trimmed.Length == 0)
                return;

            await _store.DeleteAsync(trimmed);
            // Else the old document would come back through the reader's fallback.
            await LegacyCollection.DeleteManyAsync(d => d.Name == trimmed);
        }

        private static StoredStorageConfiguration? FromLegacy(StorageConfiguration? document) =>
            document is null
                ? null
                : new StoredStorageConfiguration(StorageSettings.FromConfiguration(document), StorageSecretValues.FromConfiguration(document));
    }
}
