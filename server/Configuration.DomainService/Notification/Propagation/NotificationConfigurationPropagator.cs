using System.Collections.Concurrent;
using Blocks.Genesis;
using Blocks.Genesis.Entities.Os;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Driver;

namespace Configuration.DomainService.Notification.Propagation
{
    /// <summary>
    /// Copies a built-in notification config from the root tenant to the seed database and every other tenant
    /// database (disabled tenants included). Each target is written in the same shape the Genesis key-value
    /// store uses (<c>KeyValueStores</c>, key <c>notification-config:&lt;name&gt;</c>), and also to the old
    /// <c>NotificationConfigurations</c> collection while that collection still exists in the target.
    /// </summary>
    /// <remarks>
    /// Rules per target:
    /// <list type="bullet">
    /// <item><description>Missing: insert a copy, enabled, with no audience.</description></item>
    /// <item><description>Existing built-in: overwrite every field except <c>IsDisabled</c>, <c>Audience</c>,
    /// <c>ItemId</c>, <c>CreatedDate</c> and <c>CreatedBy</c>.</description></item>
    /// <item><description>Console scope: the seed database gets it like any other row; a tenant database never gets
    /// an insert, and loses its existing built-in copy unless the tenant disabled it or set an audience.</description></item>
    /// <item><description>Existing custom config with that name: leave it, count a conflict.</description></item>
    /// <item><description>Delete: remove the target only when it is built-in.</description></item>
    /// </list>
    /// Every step is safe to repeat. One target failing does not stop the others.
    /// </remarks>
    public class NotificationConfigurationPropagator : INotificationConfigurationPropagator
    {
        public const string KeyValueCollectionName = "KeyValueStores";
        public const string LegacyCollectionName = "NotificationConfigurations";
        public const string TenantsCollectionName = "Tenants";
        public const string SeedDatabaseName = "BlocksConfiguration";
        public const string SeedTargetId = "seed:" + SeedDatabaseName;
        public const string KeyPrefix = "notification-config:";

        private const int MaxConcurrentTargets = 8;

        private readonly IDbContextProvider _dbContextProvider;
        private readonly IBlocksSecret _blocksSecret;
        private readonly ILogger<NotificationConfigurationPropagator> _logger;

        public NotificationConfigurationPropagator(
            IDbContextProvider dbContextProvider,
            IBlocksSecret blocksSecret,
            ILogger<NotificationConfigurationPropagator> logger)
        {
            _dbContextProvider = dbContextProvider;
            _blocksSecret = blocksSecret;
            _logger = logger;
        }

        public static string KeyFor(string name) => KeyPrefix + (name ?? string.Empty).Trim();

        public async Task<NotificationPropagationSummary> PropagateAsync(BuiltInNotificationConfigurationChangedEvent change)
        {
            var summary = new NotificationPropagationSummary
            {
                Name = change?.Name?.Trim() ?? string.Empty,
                Action = change?.Action ?? NotificationConfigurationChangeAction.Upsert
            };

            if (change is null || string.IsNullOrWhiteSpace(change.Name) || string.IsNullOrWhiteSpace(change.SourceTenantId))
            {
                summary.SkippedReason = "incomplete event";
                _logger.LogWarning("Notification config propagation skipped: incomplete event. Name={Name}", summary.Name);
                return summary;
            }

            // A registry outage is not an empty propagation: let it surface to the consumer.
            var registry = await ReadTenantRegistryAsync();

            var source = registry.FirstOrDefault(t => t.TenantId == change.SourceTenantId);
            if (source is null || !source.IsRootTenant)
            {
                summary.SkippedReason = "source is not the root tenant";
                _logger.LogWarning(
                    "Notification config propagation skipped: source tenant is not the root tenant. Name={Name} SourceTenantId={TenantId}",
                    summary.Name, change.SourceTenantId);
                return summary;
            }

            var sourceDatabase = OpenDatabase(source.DbConnectionString, source.DbName);
            var current = await ReadAsync(sourceDatabase, summary.Name);

            NotificationConfiguration? desired;
            if (current is null)
            {
                desired = null;
            }
            else if (current.IsBuiltIn)
            {
                desired = current;
            }
            else
            {
                summary.SkippedReason = "source config is not built-in";
                _logger.LogInformation(
                    "Notification config propagation skipped: the root record is not built-in, tenant copies are left unchanged. Name={Name}",
                    summary.Name);
                return summary;
            }

            var effectiveAction = desired is null ? NotificationConfigurationChangeAction.Delete : NotificationConfigurationChangeAction.Upsert;
            if (effectiveAction != change.Action)
            {
                _logger.LogInformation(
                    "Notification config propagation follows the current root state. Name={Name} EventAction={EventAction} AppliedAction={AppliedAction}",
                    summary.Name, change.Action, effectiveAction);
            }
            summary.Action = effectiveAction;

            var targets = BuildTargets(registry, source);
            var results = new ConcurrentBag<NotificationPropagationResult>();
            using var semaphore = new SemaphoreSlim(MaxConcurrentTargets);
            await Task.WhenAll(targets.Select(target => ProcessTargetAsync(target, summary.Name, desired, semaphore, results)));
            summary.Results = results.OrderBy(r => r.TargetId, StringComparer.Ordinal).ToList();

            _logger.LogInformation(
                "Notification config propagation complete. Name={Name} Action={Action} Targets={Targets} Inserted={Inserted} Updated={Updated} Deleted={Deleted} NotPresent={NotPresent} Conflicts={Conflicts} Failed={Failed} ConflictTargets={ConflictTargets} FailedTargets={FailedTargets}",
                summary.Name,
                summary.Action,
                summary.Results.Count,
                summary.Count(NotificationPropagationOutcome.Inserted),
                summary.Count(NotificationPropagationOutcome.Updated),
                summary.Count(NotificationPropagationOutcome.Deleted),
                summary.Count(NotificationPropagationOutcome.NotPresent),
                summary.Count(NotificationPropagationOutcome.Conflict),
                summary.Count(NotificationPropagationOutcome.Failed),
                string.Join(",", summary.Results.Where(r => r.Outcome == NotificationPropagationOutcome.Conflict).Select(r => r.TargetId)),
                string.Join(",", summary.Results.Where(r => r.Outcome == NotificationPropagationOutcome.Failed).Select(r => r.TargetId)));

            return summary;
        }

        private sealed record TenantEntry(string TenantId, string DbName, string DbConnectionString, bool IsRootTenant);

        private sealed record Target(string TargetId, string DbName, string DbConnectionString);

        private async Task<List<TenantEntry>> ReadTenantRegistryAsync()
        {
            var collection = _dbContextProvider
                .GetDatabase(_blocksSecret.DatabaseConnectionString, _blocksSecret.RootDatabaseName)
                .GetCollection<BsonDocument>(TenantsCollectionName);

            // Only the routing fields; the rest of a tenant document (keys, salts) is never read here.
            var projection = Builders<BsonDocument>.Projection
                .Include("TenantId").Include("DBName").Include("DbConnectionString").Include("IsRootTenant");

            var documents = await collection.Find(FilterDefinition<BsonDocument>.Empty).Project(projection).ToListAsync();

            return documents
                .Select(d => new TenantEntry(
                    StringOf(d, "TenantId"),
                    StringOf(d, "DBName"),
                    StringOf(d, "DbConnectionString"),
                    d.TryGetValue("IsRootTenant", out var root) && root.IsBoolean && root.AsBoolean))
                .Where(t => !string.IsNullOrWhiteSpace(t.TenantId))
                .ToList();
        }

        private static string StringOf(BsonDocument document, string field) =>
            document.TryGetValue(field, out var value) && value.IsString ? value.AsString : string.Empty;

        private List<Target> BuildTargets(List<TenantEntry> registry, TenantEntry source)
        {
            var targets = new List<Target>
            {
                new(SeedTargetId, SeedDatabaseName, _blocksSecret.DatabaseConnectionString)
            };

            targets.AddRange(registry
                .Where(t => !t.IsRootTenant && t.TenantId != source.TenantId)
                .Select(t => new Target(t.TenantId, t.DbName, t.DbConnectionString)));

            // Never write back into the source database, and write each database once.
            return targets
                .Where(t => !(t.DbName == source.DbName && t.DbConnectionString == source.DbConnectionString))
                .GroupBy(t => (t.DbConnectionString, t.DbName))
                .Select(g => g.First())
                .ToList();
        }

        private async Task ProcessTargetAsync(
            Target target,
            string name,
            NotificationConfiguration? desired,
            SemaphoreSlim semaphore,
            ConcurrentBag<NotificationPropagationResult> results)
        {
            await semaphore.WaitAsync();
            try
            {
                var database = OpenDatabase(target.DbConnectionString, target.DbName);
                var outcome = desired is null
                    ? await ApplyDeleteAsync(database, name)
                    : await ApplyUpsertAsync(database, desired, target.TargetId == SeedTargetId);

                results.Add(new NotificationPropagationResult { TargetId = target.TargetId, Outcome = outcome });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "Notification config propagation failed for a target. TargetId={TargetId} Name={Name} ErrorType={ErrorType}",
                    target.TargetId, name, ex.GetType().Name);
                results.Add(new NotificationPropagationResult
                {
                    TargetId = target.TargetId,
                    Outcome = NotificationPropagationOutcome.Failed,
                    ErrorType = ex.GetType().Name
                });
            }
            finally
            {
                semaphore.Release();
            }
        }

        private IMongoDatabase OpenDatabase(string connectionString, string databaseName)
        {
            if (string.IsNullOrWhiteSpace(connectionString) || string.IsNullOrWhiteSpace(databaseName))
            {
                throw new InvalidOperationException("The tenant has no database settings.");
            }

            return _dbContextProvider.GetDatabase(connectionString, databaseName);
        }

        /// <summary>Reads a config the way the readers do: key-value store first, then the old collection.</summary>
        public static async Task<NotificationConfiguration?> ReadAsync(IMongoDatabase database, string name)
        {
            var (kv, _) = await ReadKeyValueAsync(database, name);
            if (kv is not null)
            {
                return kv;
            }

            return await LegacyExistsAsync(database) ? await ReadLegacyAsync(database, name) : null;
        }

        private static async Task<(NotificationConfiguration? Value, bool EntryExists)> ReadKeyValueAsync(IMongoDatabase database, string name)
        {
            var entry = await database.GetCollection<KeyValueEntry>(KeyValueCollectionName)
                .Find(Builders<KeyValueEntry>.Filter.Eq(e => e.Key, KeyFor(name)))
                .FirstOrDefaultAsync();

            if (entry is null || entry.Value is null || !entry.Value.IsBsonDocument)
            {
                return (null, entry is not null);
            }

            return (BsonSerializer.Deserialize<NotificationConfiguration>(entry.Value.AsBsonDocument), true);
        }

        private static async Task<bool> LegacyExistsAsync(IMongoDatabase database)
        {
            var names = await database.ListCollectionNamesAsync(new ListCollectionNamesOptions
            {
                Filter = new BsonDocument("name", LegacyCollectionName)
            });
            return await names.AnyAsync();
        }

        private static async Task<NotificationConfiguration?> ReadLegacyAsync(IMongoDatabase database, string name) =>
            await database.GetCollection<NotificationConfiguration>(LegacyCollectionName)
                .Find(Builders<NotificationConfiguration>.Filter.Eq(c => c.Name, name))
                .FirstOrDefaultAsync();

        private static async Task<NotificationPropagationOutcome> ApplyUpsertAsync(IMongoDatabase database, NotificationConfiguration source, bool isSeedTarget)
        {
            var (kv, _) = await ReadKeyValueAsync(database, source.Name);
            var legacyExists = await LegacyExistsAsync(database);
            var legacy = legacyExists ? await ReadLegacyAsync(database, source.Name) : null;

            // A tenant's own config with this name wins: it is never overwritten or adopted here.
            if ((kv is not null && !kv.IsBuiltIn) || (legacy is not null && !legacy.IsBuiltIn))
            {
                return NotificationPropagationOutcome.Conflict;
            }

            var existing = kv ?? legacy;

            // Console configs stay in the root tenant and the seed. A tenant that disabled one or set its own audience keeps it.
            if (source.Scope == NotificationScope.Console && !isSeedTarget && !KeepsConsoleCopy(existing))
            {
                return existing is null
                    ? NotificationPropagationOutcome.NotPresent
                    : await ApplyDeleteAsync(database, source.Name);
            }

            var copy = Clone(source);
            if (existing is not null)
            {
                copy.ItemId = existing.ItemId;
                copy.CreatedDate = existing.CreatedDate;
                copy.CreatedBy = existing.CreatedBy;
                copy.IsDisabled = existing.IsDisabled;
                copy.Audience = existing.Audience;
            }
            else
            {
                copy.IsDisabled = false;
                copy.Audience = null;
            }

            if (legacyExists)
            {
                var filter = legacy is not null
                    ? Builders<NotificationConfiguration>.Filter.Eq(c => c.ItemId, legacy.ItemId)
                    : Builders<NotificationConfiguration>.Filter.Eq(c => c.ItemId, copy.ItemId);
                await database.GetCollection<NotificationConfiguration>(LegacyCollectionName)
                    .ReplaceOneAsync(filter, copy, new ReplaceOptions { IsUpsert = true });
            }

            await WriteKeyValueAsync(database, copy);

            return existing is null ? NotificationPropagationOutcome.Inserted : NotificationPropagationOutcome.Updated;
        }

        private static bool KeepsConsoleCopy(NotificationConfiguration? existing) =>
            existing is not null && (existing.IsDisabled || existing.Audience?.IsSet() == true);

        private static async Task<NotificationPropagationOutcome> ApplyDeleteAsync(IMongoDatabase database, string name)
        {
            var (kv, _) = await ReadKeyValueAsync(database, name);
            var legacyExists = await LegacyExistsAsync(database);
            var legacy = legacyExists ? await ReadLegacyAsync(database, name) : null;

            if ((kv is not null && !kv.IsBuiltIn) || (legacy is not null && !legacy.IsBuiltIn))
            {
                return NotificationPropagationOutcome.Conflict;
            }

            if (kv is null && legacy is null)
            {
                return NotificationPropagationOutcome.NotPresent;
            }

            if (legacy is not null)
            {
                await database.GetCollection<NotificationConfiguration>(LegacyCollectionName)
                    .DeleteOneAsync(Builders<NotificationConfiguration>.Filter.Eq(c => c.ItemId, legacy.ItemId));
            }

            if (kv is not null)
            {
                await database.GetCollection<KeyValueEntry>(KeyValueCollectionName)
                    .DeleteManyAsync(Builders<KeyValueEntry>.Filter.Eq(e => e.Key, KeyFor(name)));
            }

            return NotificationPropagationOutcome.Deleted;
        }

        /// <summary>Same document shape and upsert as <c>MongoKeyValueStore.SetAsync</c>.</summary>
        private static async Task WriteKeyValueAsync(IMongoDatabase database, NotificationConfiguration value)
        {
            var collection = database.GetCollection<KeyValueEntry>(KeyValueCollectionName);
            var key = KeyFor(value.Name);
            var now = DateTime.UtcNow;
            var userId = string.IsNullOrWhiteSpace(value.LastUpdatedBy) ? null : value.LastUpdatedBy;
            var bsonValue = value.ToBsonDocument();

            var filter = Builders<KeyValueEntry>.Filter.Eq(e => e.Key, key);
            var update = Builders<KeyValueEntry>.Update
                .SetOnInsert(e => e.ItemId, ObjectId.GenerateNewId().ToString())
                .SetOnInsert(e => e.Key, key)
                .SetOnInsert(e => e.CreatedDate, now)
                .SetOnInsert(e => e.CreatedBy, userId)
                .SetOnInsert(e => e.OrganizationId, "default")
                .SetOnInsert(e => e.Tags, new List<string>())
                .Set(e => e.Value, bsonValue)
                .Set(e => e.LastUpdatedDate, now)
                .Set(e => e.LastUpdatedBy, userId);

            try
            {
                await collection.UpdateOneAsync(filter, update, new UpdateOptions { IsUpsert = true });
            }
            catch (MongoWriteException ex) when (ex.WriteError?.Category == ServerErrorCategory.DuplicateKey)
            {
                // A database that still carries the old unique Key index, or an insert/insert race.
                await collection.UpdateOneAsync(filter, Builders<KeyValueEntry>.Update
                    .Set(e => e.Value, bsonValue)
                    .Set(e => e.LastUpdatedDate, now)
                    .Set(e => e.LastUpdatedBy, userId));
            }
        }

        private static NotificationConfiguration Clone(NotificationConfiguration source) =>
            BsonSerializer.Deserialize<NotificationConfiguration>(source.ToBsonDocument());
    }
}
