using System.Collections.Immutable;
using Configuration.DomainService.Storage.Enums;

namespace Configuration.DomainService.Storage
{
    /// <summary>Storage strategy → category (cloud or local file storage).</summary>
    public static class StorageTypes
    {
        private static readonly ImmutableDictionary<string, StorageStrategyCategory> TypeToCategory =
            ImmutableDictionary.CreateRange(StringComparer.OrdinalIgnoreCase, new[]
            {
                new KeyValuePair<string, StorageStrategyCategory>("azure", StorageStrategyCategory.Cloud),
                new KeyValuePair<string, StorageStrategyCategory>("aws", StorageStrategyCategory.Cloud),
                new KeyValuePair<string, StorageStrategyCategory>("sftpstorage", StorageStrategyCategory.Local)
            });

        /// <summary>Local file storage (SFTP) needs its own generated SftpSecretKey.</summary>
        public static bool IsLocal(string? type) =>
            TypeToCategory.TryGetValue(type ?? string.Empty, out var category) && category == StorageStrategyCategory.Local;
    }
}
