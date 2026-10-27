using Blocks.Genesis;
using Blocks.Genesis.Entities.Os;
using MongoDB.Bson;
using MongoDB.Driver;

namespace DomainService.Projects
{
    /// <summary>
    /// Gives a new project the seed's (<c>BlocksConfiguration</c>) key-value rows that every project needs:
    /// the App-scope built-in notification configs (Console ones are skipped) and the MFA config. Other keys are never copied: storage configs have
    /// their own copier (new secrets per project), and the OIDC UI template would carry the seed's branding.
    /// Insert-only: a key the project already has keeps its value, so a retry makes no duplicate.
    /// </summary>
    public static class KeyValueSeedCopier
    {
        public const string CollectionName = "KeyValueStores";

        public static readonly IReadOnlyList<string> CopiedKeyPrefixes = ["notification-config:"];

        public static readonly IReadOnlyList<string> CopiedKeys = ["mfa-config"];

        public static Task<int> CopyAsync(IMongoDatabase seedDb, IMongoDatabase projectDb, string? createdBy, CancellationToken cancellationToken = default)
        {
            ArgumentNullException.ThrowIfNull(seedDb);
            ArgumentNullException.ThrowIfNull(projectDb);
            return CopyCoreAsync(seedDb, projectDb, createdBy, cancellationToken);
        }

        private static async Task<int> CopyCoreAsync(IMongoDatabase seedDb, IMongoDatabase projectDb, string? createdBy, CancellationToken cancellationToken)
        {
            var seedRows = await seedDb.GetCollection<KeyValueEntry>(CollectionName)
                .Find(CopiedRowsFilter())
                .ToListAsync(cancellationToken);
            seedRows.RemoveAll(IsConsoleScoped);

            var target = projectDb.GetCollection<KeyValueEntry>(CollectionName);
            var inserted = 0;
            foreach (var row in seedRows)
            {
                var result = await target.UpdateOneAsync(
                    Builders<KeyValueEntry>.Filter.Eq(e => e.Key, row.Key),
                    NewRowFrom(row, createdBy),
                    new UpdateOptions { IsUpsert = true },
                    cancellationToken);
                if (result.UpsertedId is not null) inserted++;
            }

            return inserted;
        }

        /// <summary>A Console-scope notification config (Scope = 1) stays in the root tenant and the seed.</summary>
        private static bool IsConsoleScoped(KeyValueEntry row) =>
            row.Value is { IsBsonDocument: true } value
            && value.AsBsonDocument.TryGetValue("Scope", out var scope)
            && scope.IsNumeric
            && scope.ToInt32() == (int)NotificationScope.Console;

        private static FilterDefinition<KeyValueEntry> CopiedRowsFilter()
        {
            var filter = Builders<KeyValueEntry>.Filter;
            var byPrefix = CopiedKeyPrefixes.Select(prefix =>
                filter.Regex(e => e.Key, new BsonRegularExpression("^" + System.Text.RegularExpressions.Regex.Escape(prefix))));
            return filter.Or(byPrefix.Append(filter.In(e => e.Key, CopiedKeys)));
        }

        /// <summary>The project's own row: the seed's key, value and tags with a new id and dates.</summary>
        private static UpdateDefinition<KeyValueEntry> NewRowFrom(KeyValueEntry row, string? createdBy)
        {
            var now = DateTime.UtcNow;
            return Builders<KeyValueEntry>.Update
                .SetOnInsert(e => e.ItemId, ObjectId.GenerateNewId().ToString())
                .SetOnInsert(e => e.Key, row.Key)
                .SetOnInsert(e => e.Value, row.Value)
                .SetOnInsert(e => e.Tags, row.Tags)
                .SetOnInsert(e => e.CreatedDate, now)
                .SetOnInsert(e => e.LastUpdatedDate, now)
                .SetOnInsert(e => e.CreatedBy, createdBy)
                .SetOnInsert(e => e.LastUpdatedBy, createdBy);
        }
    }
}
