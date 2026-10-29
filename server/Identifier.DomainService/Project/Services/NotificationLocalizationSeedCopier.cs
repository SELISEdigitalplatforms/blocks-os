using MongoDB.Bson;
using MongoDB.Driver;

namespace DomainService.Projects
{
    /// <summary>
    /// Gives a new project the Localization module <c>notifications</c> and its keys (the texts of the built-in
    /// push messages) from the seed (<c>BlocksConfiguration</c>). Insert-only: a module or key the project already
    /// has keeps what is there, so a retry makes no duplicate and an edited text is never changed.
    /// </summary>
    public static class NotificationLocalizationSeedCopier
    {
        public const string ModuleName = "notifications";
        public const string ModulesCollection = "BlocksLanguageModules";
        public const string KeysCollection = "BlocksLanguageKeys";
        private const string ModuleNameField = "ModuleName";
        private const string ModuleIdField = "ModuleId";
        private const string KeyNameField = "KeyName";

        /// <returns>The number of keys inserted.</returns>
        public static Task<int> CopyAsync(IMongoDatabase seedDb, IMongoDatabase projectDb, string tenantId, string? createdBy, CancellationToken cancellationToken = default)
        {
            ArgumentNullException.ThrowIfNull(seedDb);
            ArgumentNullException.ThrowIfNull(projectDb);
            return CopyCoreAsync(seedDb, projectDb, tenantId, createdBy, cancellationToken);
        }

        private static async Task<int> CopyCoreAsync(IMongoDatabase seedDb, IMongoDatabase projectDb, string tenantId, string? createdBy, CancellationToken cancellationToken)
        {
            var seedModule = await seedDb.GetCollection<BsonDocument>(ModulesCollection)
                .Find(Builders<BsonDocument>.Filter.Eq(ModuleNameField, ModuleName))
                .FirstOrDefaultAsync(cancellationToken);
            if (seedModule is null)
            {
                return 0;
            }

            var seedKeys = await seedDb.GetCollection<BsonDocument>(KeysCollection)
                .Find(Builders<BsonDocument>.Filter.Eq(ModuleIdField, seedModule["_id"]))
                .ToListAsync(cancellationToken);
            if (seedKeys.Count == 0)
            {
                return 0;
            }

            var moduleId = await EnsureModuleAsync(seedModule, projectDb, tenantId, createdBy, cancellationToken);
            var target = projectDb.GetCollection<BsonDocument>(KeysCollection);
            var inserted = 0;
            foreach (var key in seedKeys.Where(k => k.TryGetValue(KeyNameField, out var name) && name.IsString))
            {
                var filter = Builders<BsonDocument>.Filter.Eq(ModuleIdField, moduleId) & Builders<BsonDocument>.Filter.Eq(KeyNameField, key[KeyNameField]);
                var result = await target.UpdateOneAsync(filter, NewRowFrom(key, tenantId, createdBy, ModuleIdField, KeyNameField), new UpdateOptions { IsUpsert = true }, cancellationToken);
                if (result.UpsertedId is not null) inserted++;
            }

            return inserted;
        }

        private static async Task<BsonValue> EnsureModuleAsync(BsonDocument seedModule, IMongoDatabase projectDb, string tenantId, string? createdBy, CancellationToken cancellationToken)
        {
            var modules = projectDb.GetCollection<BsonDocument>(ModulesCollection);
            var filter = Builders<BsonDocument>.Filter.Eq(ModuleNameField, ModuleName);
            await modules.UpdateOneAsync(filter, NewRowFrom(seedModule, tenantId, createdBy, ModuleNameField), new UpdateOptions { IsUpsert = true }, cancellationToken);

            var module = await modules.Find(filter).FirstAsync(cancellationToken);
            return module["_id"];
        }

        /// <summary>The project's own row: the seed's fields with a new id, the project's tenant and new dates. The upsert filter fields are not repeated.</summary>
        private static UpdateDefinition<BsonDocument> NewRowFrom(BsonDocument seedRow, string tenantId, string? createdBy, params string[] filterFields)
        {
            var now = DateTime.UtcNow;
            var update = Builders<BsonDocument>.Update.SetOnInsert("_id", Guid.NewGuid().ToString());
            var skipped = new HashSet<string>(["_id", "TenantId", "CreatedBy", "LastUpdatedBy", "CreateDate", "LastUpdateDate", .. filterFields], StringComparer.Ordinal);

            foreach (var element in seedRow.Elements.Where(e => !skipped.Contains(e.Name)))
            {
                update = update.SetOnInsert(element.Name, element.Value);
            }

            return update
                .SetOnInsert("TenantId", tenantId)
                .SetOnInsert("CreatedBy", createdBy)
                .SetOnInsert("LastUpdatedBy", createdBy)
                .SetOnInsert("CreateDate", now)
                .SetOnInsert("LastUpdateDate", now);
        }
    }
}
