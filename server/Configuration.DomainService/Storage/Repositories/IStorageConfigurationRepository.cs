using DomainService.Configuration;

namespace Configuration.DomainService.Storage.Repositories
{
    /// <summary>
    /// One storage configuration as stored: a <c>storage-config:&lt;Name&gt;</c> row (secrets in SecretStore), or an old
    /// <c>StorageConfigurations</c> document not migrated yet. <see cref="LegacySecrets"/> is set only for an old document;
    /// it stays in memory and is never returned to a caller.
    /// </summary>
    public sealed record StoredStorageConfiguration(StorageSettings Settings, StorageSecretValues? LegacySecrets)
    {
        public bool IsLegacy => LegacySecrets is not null;
    }

    /// <summary>
    /// Data access for the storage configurations of the caller's tenant. Writes go to the driver store
    /// (<see cref="IStorageConfigurationStore"/>); old documents are only read and deleted, until the migration cleanup
    /// drops the collection. No method returns a secret value.
    /// </summary>
    public interface IStorageConfigurationRepository
    {
        /// <summary>The row named <paramref name="name"/> (trimmed), else the old document, else null.</summary>
        Task<StoredStorageConfiguration?> GetByNameAsync(string name);

        Task<StoredStorageConfiguration?> GetByItemIdAsync(string itemId);

        /// <summary>Every row, then every old document without a row, oldest change first.</summary>
        Task<IReadOnlyList<StoredStorageConfiguration>> GetAllAsync();

        /// <summary>Writes a new row only when none exists with that name: the new row, or null when the name is taken.</summary>
        Task<StorageSettings?> CreateAsync(StorageSettings settings, StorageSecretValues secrets);

        /// <summary>Creates or updates the row; empty secret values leave the stored secrets as they are.</summary>
        Task<StorageSettings> SaveAsync(StorageSettings settings, StorageSecretValues? secrets);

        /// <summary>Field name (e.g. <c>ConnectionString</c>) → status (<see cref="StorageSecretStatus"/>), never a value.</summary>
        Task<IReadOnlyDictionary<string, string>> GetSecretStatusAsync(StoredStorageConfiguration configuration);

        /// <summary>Deletes the row and its secrets, and the old document with that name.</summary>
        Task DeleteAsync(string name);
    }
}
