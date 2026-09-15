using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace Blocks.Secrets;

public sealed class SecretRepository : ISecretRepository
{
    // The store is a single database, so indexes need ensuring once per process rather than
    // once per tenant.
    private static int _indexesEnsured;

    private readonly SecretStoreContext _store;
    private readonly ILogger<SecretRepository> _logger;

    public SecretRepository(SecretStoreContext store, ILogger<SecretRepository> logger)
    {
        _store = store;
        _logger = logger;
    }

    public async Task InsertAsync(Secret secret, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(secret);

        var collection = await GetCollectionAsync().ConfigureAwait(false);
        await collection.InsertOneAsync(secret, cancellationToken: cancellationToken).ConfigureAwait(false);
    }

    public async Task ReplaceAsync(Secret secret, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(secret);

        var collection = await GetCollectionAsync().ConfigureAwait(false);

        // TenantId is part of the filter, not just the document. Every tenant shares this
        // collection, so a mismatched tenant must update nothing rather than rewrite another
        // tenant's row.
        var filter = Builders<Secret>.Filter.And(
            Builders<Secret>.Filter.Eq(s => s.TenantId, secret.TenantId),
            Builders<Secret>.Filter.Eq(s => s.ItemId, secret.ItemId));

        await collection.ReplaceOneAsync(filter, secret, cancellationToken: cancellationToken).ConfigureAwait(false);
    }

    public async Task<Secret?> GetAsync(string tenantId, string secretId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(secretId) || string.IsNullOrWhiteSpace(tenantId))
        {
            return null;
        }

        var collection = await GetCollectionAsync().ConfigureAwait(false);

        var filter = Builders<Secret>.Filter.And(
            Builders<Secret>.Filter.Eq(s => s.TenantId, tenantId),
            Builders<Secret>.Filter.Eq(s => s.ItemId, secretId));

        return await collection.Find(filter).FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
    }

    public async Task<(IReadOnlyList<Secret> Items, long TotalCount)> FindAsync(
        string tenantId,
        SecretFilter filter,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(filter);
        ArgumentException.ThrowIfNullOrWhiteSpace(tenantId);

        var collection = await GetCollectionAsync().ConfigureAwait(false);
        var builder = Builders<Secret>.Filter;
        var conditions = new List<FilterDefinition<Secret>> { builder.Eq(s => s.TenantId, tenantId) };

        if (!string.IsNullOrWhiteSpace(filter.OrganizationId))
        {
            conditions.Add(builder.Eq(s => s.OrganizationId, filter.OrganizationId));
        }

        // Normalized here as well as in the service: this is the only choke point every
        // caller of the repository goes through, and an unnormalized tag would silently match
        // nothing rather than fail.
        var tags = SecretTag.NormalizeAll(filter.Tags);
        if (tags.Count > 0)
        {
            // AnyIn is an $in, which the multikey tag index serves. A $regex or an $elemMatch
            // over the array would not be.
            conditions.Add(builder.AnyIn(s => s.Tags, tags));
        }

        if (!string.IsNullOrWhiteSpace(filter.Type))
        {
            conditions.Add(builder.Eq(s => s.Type, filter.Type));
        }

        if (!string.IsNullOrWhiteSpace(filter.Status))
        {
            conditions.Add(builder.Eq(s => s.Status, filter.Status));
        }
        else if (!filter.IncludeDeleted)
        {
            conditions.Add(builder.Ne(s => s.Status, SecretStatuses.Deleted));
        }

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            // Escaped: an unescaped user string would let a caller inject a regex that scans
            // the whole collection, or one that never terminates.
            var escaped = System.Text.RegularExpressions.Regex.Escape(filter.Search);
            var pattern = new MongoDB.Bson.BsonRegularExpression(escaped, "i");
            conditions.Add(builder.Or(
                builder.Regex(s => s.Name, pattern),
                builder.Regex(s => s.Description, pattern)));
        }

        var query = builder.And(conditions);
        var skip = Math.Max(0, filter.PageNumber - 1) * filter.PageSize;

        var countTask = collection.CountDocumentsAsync(query, cancellationToken: cancellationToken);
        var itemsTask = collection.Find(query)
            .SortByDescending(s => s.LastUpdatedDate)
            .Skip(skip)
            .Limit(filter.PageSize)
            .ToListAsync(cancellationToken);

        await Task.WhenAll(countTask, itemsTask).ConfigureAwait(false);

        return (await itemsTask.ConfigureAwait(false), await countTask.ConfigureAwait(false));
    }

    public async Task HardDeleteAsync(string tenantId, string secretId, CancellationToken cancellationToken = default)
    {
        var collection = await GetCollectionAsync().ConfigureAwait(false);

        var filter = Builders<Secret>.Filter.And(
            Builders<Secret>.Filter.Eq(s => s.TenantId, tenantId),
            Builders<Secret>.Filter.Eq(s => s.ItemId, secretId));

        await collection.DeleteOneAsync(filter, cancellationToken).ConfigureAwait(false);
    }

    private async Task<IMongoCollection<Secret>> GetCollectionAsync()
    {
        var collection = _store.Secrets;
        await EnsureIndexesAsync(collection).ConfigureAwait(false);
        return collection;
    }

    private async Task EnsureIndexesAsync(IMongoCollection<Secret> collection)
    {
        if (Interlocked.Exchange(ref _indexesEnsured, 1) == 1)
        {
            return;
        }

        try
        {
            var keys = Builders<Secret>.IndexKeys;

            await collection.Indexes.CreateManyAsync(
            [
                new CreateIndexModel<Secret>(
                    keys.Ascending(s => s.TenantId).Ascending(s => s.ItemId),
                    new CreateIndexOptions { Name = "ix_tenant_item", Unique = true }),

                new CreateIndexModel<Secret>(
                    keys.Ascending(s => s.TenantId).Ascending(s => s.Type).Ascending(s => s.Status),
                    new CreateIndexOptions { Name = "ix_tenant_type_status" }),

                new CreateIndexModel<Secret>(
                    keys.Ascending(s => s.TenantId).Descending(s => s.LastUpdatedDate),
                    new CreateIndexOptions { Name = "ix_tenant_updated" }),

                // Multikey over the Tags array. Sparse, because most secrets carry no tags and
                // an entry for every untagged document would only grow the index.
                new CreateIndexModel<Secret>(
                    keys.Ascending(s => s.TenantId).Ascending(s => s.Tags),
                    new CreateIndexOptions { Name = "ix_tenant_tags", Sparse = true })
            ]).ConfigureAwait(false);
        }
        catch (MongoCommandException ex)
        {
            // Losing a creation race, or meeting an existing index declared with different
            // options, must not fail whichever request happened to trigger this.
            _logger.LogWarning(ex, "Could not ensure indexes on the secret store.");
        }
    }
}
