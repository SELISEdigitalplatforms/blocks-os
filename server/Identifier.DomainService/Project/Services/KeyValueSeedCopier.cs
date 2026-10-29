using Blocks.Genesis;
using Blocks.Genesis.Entities.Os;
using MongoDB.Bson;
using MongoDB.Driver;
using Os.DataAccess.Notifications;

namespace DomainService.Projects
{
    /// <summary>
    /// Gives a new project the seed's (<c>BlocksConfiguration</c>) key-value rows that every project needs:
    /// the built-in notification configs for project users (scope App or Both; Console-only ones and dropped
    /// names stay in the root tenant) and the MFA config. Other keys are never copied: storage configs have
    /// their own copier (new secrets per project), and the OIDC UI template would carry the seed's branding.
    /// Insert-only: a key the project already has keeps its value, so a retry makes no duplicate.
    /// </summary>
    public static class KeyValueSeedCopier
    {
        public const string CollectionName = "KeyValueStores";

        public const string NotificationKeyPrefix = "notification-config:";

        public static readonly IReadOnlyList<string> CopiedKeyPrefixes = [NotificationKeyPrefix];

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
            seedRows = [.. seedRows.Where(IsCopiedToProjects)];

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

        /// <summary>A notification config goes to a project only when project users can receive it and it was not dropped.</summary>
        private static bool IsCopiedToProjects(KeyValueEntry row)
        {
            if (!row.Key.StartsWith(NotificationKeyPrefix, StringComparison.Ordinal))
            {
                return true;
            }

            var name = row.Key[NotificationKeyPrefix.Length..];
            var scope = row.Value is { IsBsonDocument: true } && row.Value.AsBsonDocument.TryGetValue("Scope", out var value) && value.IsNumeric
                ? value.ToInt32()
                : (int)NotificationScope.App; // left out of the stored document while App (the default)
            return scope != (int)NotificationScope.Console && !RetiredNotificationNames.Contains(name);
        }

        private static FilterDefinition<KeyValueEntry> CopiedRowsFilter()
        {
            var filter = Builders<KeyValueEntry>.Filter;
            var byPrefix = CopiedKeyPrefixes.Select(prefix =>
                filter.Regex(e => e.Key, new BsonRegularExpression("^" + System.Text.RegularExpressions.Regex.Escape(prefix))));
            return filter.Or(byPrefix.Append(filter.In(e => e.Key, CopiedKeys)));
        }

        /// <summary>The project starts without the root tenant's own receivers and with the notification on.</summary>
        private static BsonValue? ProjectCopyOf(KeyValueEntry row)
        {
            if (!row.Key.StartsWith(NotificationKeyPrefix, StringComparison.Ordinal) || row.Value is not { IsBsonDocument: true })
            {
                return row.Value;
            }

            var value = row.Value.AsBsonDocument.DeepClone().AsBsonDocument;
            value.Remove("Audience");
            value.Remove("IsDisabled");
            return value;
        }

        /// <summary>The project's own row: the seed's key, value and tags with a new id and dates.</summary>
        private static UpdateDefinition<KeyValueEntry> NewRowFrom(KeyValueEntry row, string? createdBy)
        {
            var now = DateTime.UtcNow;
            return Builders<KeyValueEntry>.Update
                .SetOnInsert(e => e.ItemId, ObjectId.GenerateNewId().ToString())
                .SetOnInsert(e => e.Key, row.Key)
                .SetOnInsert(e => e.Value, ProjectCopyOf(row))
                .SetOnInsert(e => e.Tags, row.Tags)
                .SetOnInsert(e => e.CreatedDate, now)
                .SetOnInsert(e => e.LastUpdatedDate, now)
                .SetOnInsert(e => e.CreatedBy, createdBy)
                .SetOnInsert(e => e.LastUpdatedBy, createdBy);
        }
    }
}
