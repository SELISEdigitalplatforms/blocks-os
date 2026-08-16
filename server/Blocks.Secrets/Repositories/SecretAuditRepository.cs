using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace Blocks.Secrets;

public sealed class SecretAuditRepository : ISecretAuditRepository
{
    private static int _indexesEnsured;

    private readonly SecretStoreContext _store;
    private readonly ILogger<SecretAuditRepository> _logger;

    public SecretAuditRepository(SecretStoreContext store, ILogger<SecretAuditRepository> logger)
    {
        _store = store;
        _logger = logger;
    }

    public async Task InsertAsync(SecretAuditLog log, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(log);

        var collection = await GetCollectionAsync().ConfigureAwait(false);
        await collection.InsertOneAsync(log, cancellationToken: cancellationToken).ConfigureAwait(false);
    }

    public async Task<(IReadOnlyList<SecretAuditLog> Items, long TotalCount)> FindAsync(
        string tenantId,
        SecretAuditFilter filter,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(filter);
        ArgumentException.ThrowIfNullOrWhiteSpace(tenantId);

        var collection = await GetCollectionAsync().ConfigureAwait(false);
        var builder = Builders<SecretAuditLog>.Filter;

        // Every tenant shares this collection, so the tenant filter is what separates them.
        var conditions = new List<FilterDefinition<SecretAuditLog>> { builder.Eq(l => l.TenantId, tenantId) };

        if (!string.IsNullOrWhiteSpace(filter.SecretId))
        {
            conditions.Add(builder.Eq(l => l.SecretId, filter.SecretId));
        }

        if (!string.IsNullOrWhiteSpace(filter.Action))
        {
            conditions.Add(builder.Eq(l => l.Action, filter.Action));
        }

        if (!string.IsNullOrWhiteSpace(filter.ActorUserId))
        {
            conditions.Add(builder.Eq(l => l.ActorUserId, filter.ActorUserId));
        }

        if (filter.FromDate.HasValue)
        {
            conditions.Add(builder.Gte(l => l.CreatedDate, filter.FromDate.Value));
        }

        if (filter.ToDate.HasValue)
        {
            conditions.Add(builder.Lte(l => l.CreatedDate, filter.ToDate.Value));
        }

        var query = builder.And(conditions);
        var skip = Math.Max(0, filter.PageNumber - 1) * filter.PageSize;

        var countTask = collection.CountDocumentsAsync(query, cancellationToken: cancellationToken);
        var itemsTask = collection.Find(query)
            .SortByDescending(l => l.CreatedDate)
            .Skip(skip)
            .Limit(filter.PageSize)
            .ToListAsync(cancellationToken);

        await Task.WhenAll(countTask, itemsTask).ConfigureAwait(false);

        return (await itemsTask.ConfigureAwait(false), await countTask.ConfigureAwait(false));
    }

    private async Task<IMongoCollection<SecretAuditLog>> GetCollectionAsync()
    {
        var collection = _store.AuditLogs;
        await EnsureIndexesAsync(collection).ConfigureAwait(false);
        return collection;
    }

    private async Task EnsureIndexesAsync(IMongoCollection<SecretAuditLog> collection)
    {
        if (Interlocked.Exchange(ref _indexesEnsured, 1) == 1)
        {
            return;
        }

        try
        {
            var keys = Builders<SecretAuditLog>.IndexKeys;
            var models = new List<CreateIndexModel<SecretAuditLog>>
            {
                new(keys.Ascending(l => l.TenantId).Ascending(l => l.SecretId).Descending(l => l.CreatedDate),
                    new CreateIndexOptions { Name = "ix_tenant_secret_created" }),

                new(keys.Ascending(l => l.TenantId).Descending(l => l.CreatedDate),
                    new CreateIndexOptions { Name = "ix_tenant_created" })
            };

            models.Add(new CreateIndexModel<SecretAuditLog>(
                keys.Ascending(l => l.CreatedDate),
                new CreateIndexOptions
                {
                    Name = "ttl_created",
                    ExpireAfter = TimeSpan.FromDays(SecretDefaults.AuditRetentionDays)
                }));

            await collection.Indexes.CreateManyAsync(models).ConfigureAwait(false);
        }
        catch (MongoCommandException ex)
        {
            // Includes the case where the retention window changed: Mongo refuses to redefine an
            // existing index with different options. A warning is right — changing retention is
            // an explicit migration, not something to fail an audit write over.
            _logger.LogWarning(ex, "Could not ensure indexes on the secret audit log.");
        }
    }
}
