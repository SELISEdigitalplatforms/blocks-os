using Blocks.Genesis;
using DomainService.Billing.Entities;
using MongoDB.Driver;

namespace DomainService.Billing.Services;

public interface ITenantPaymentMethodRepository
{
    Task<IReadOnlyList<TenantPaymentMethod>> ListAsync(
        string tenantGroupId,
        CancellationToken cancellationToken = default);

    Task<TenantPaymentMethod?> GetAsync(
        string tenantGroupId,
        string itemId,
        CancellationToken cancellationToken = default);

    /// <summary>The card a renewal should charge, or null when the tenant has none.</summary>
    Task<TenantPaymentMethod?> GetDefaultAsync(
        string tenantGroupId,
        CancellationToken cancellationToken = default);

    Task InsertAsync(
        TenantPaymentMethod method,
        CancellationToken cancellationToken = default);

    /// <summary>Makes one card the default and clears the flag from every other card.</summary>
    Task<bool> SetDefaultAsync(
        string tenantGroupId,
        string itemId,
        DateTime utcNow,
        CancellationToken cancellationToken = default);

    Task<bool> MarkRemovedAsync(
        string tenantGroupId,
        string itemId,
        DateTime utcNow,
        CancellationToken cancellationToken = default);

    Task MarkChargedAsync(
        string tenantGroupId,
        string itemId,
        DateTime utcNow,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Reads and writes cards in the root database.
/// </summary>
/// <remarks>
/// Subscription data never lives in a tenant database, so the collection is resolved from
/// <see cref="IBlocksSecret.RootDatabaseName"/> and every filter starts with the project group.
/// There is deliberately no method that reads a card without one.
/// </remarks>
public sealed class TenantPaymentMethodRepository : ITenantPaymentMethodRepository
{
    public const string CollectionName = "TenantPaymentMethods";

    private readonly IMongoCollection<TenantPaymentMethod> _collection;

    public TenantPaymentMethodRepository(
        IDbContextProvider dbContextProvider,
        IBlocksSecret blocksSecret)
    {
        _collection = dbContextProvider
            .GetDatabase(
                blocksSecret.DatabaseConnectionString,
                blocksSecret.RootDatabaseName)
            .GetCollection<TenantPaymentMethod>(CollectionName);
    }

    private static FilterDefinition<TenantPaymentMethod> Active(string tenantGroupId) =>
        Builders<TenantPaymentMethod>.Filter.And(
            Builders<TenantPaymentMethod>.Filter.Eq(x => x.TenantGroupId, tenantGroupId),
            Builders<TenantPaymentMethod>.Filter.Eq(
                x => x.Status,
                PaymentMethodStatuses.Active));

    private static FilterDefinition<TenantPaymentMethod> One(
        string tenantGroupId,
        string itemId) =>
        Builders<TenantPaymentMethod>.Filter.And(
            Active(tenantGroupId),
            Builders<TenantPaymentMethod>.Filter.Eq(x => x.ItemId, itemId));

    public async Task<IReadOnlyList<TenantPaymentMethod>> ListAsync(
        string tenantGroupId,
        CancellationToken cancellationToken = default) =>
        await _collection
            .Find(Active(tenantGroupId))
            .SortByDescending(x => x.IsDefault)
            .ThenByDescending(x => x.CreatedAtUtc)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

    public async Task<TenantPaymentMethod?> GetAsync(
        string tenantGroupId,
        string itemId,
        CancellationToken cancellationToken = default) =>
        await _collection
            .Find(One(tenantGroupId, itemId))
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

    public async Task<TenantPaymentMethod?> GetDefaultAsync(
        string tenantGroupId,
        CancellationToken cancellationToken = default) =>
        await _collection
            .Find(Builders<TenantPaymentMethod>.Filter.And(
                Active(tenantGroupId),
                Builders<TenantPaymentMethod>.Filter.Eq(x => x.IsDefault, true)))
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

    public async Task InsertAsync(
        TenantPaymentMethod method,
        CancellationToken cancellationToken = default) =>
        await _collection
            .InsertOneAsync(method, cancellationToken: cancellationToken)
            .ConfigureAwait(false);

    public async Task<bool> SetDefaultAsync(
        string tenantGroupId,
        string itemId,
        DateTime utcNow,
        CancellationToken cancellationToken = default)
    {
        var promoted = await _collection
            .UpdateOneAsync(
                One(tenantGroupId, itemId),
                Builders<TenantPaymentMethod>.Update
                    .Set(x => x.IsDefault, true)
                    .Set(x => x.UpdatedAtUtc, utcNow),
                cancellationToken: cancellationToken)
            .ConfigureAwait(false);

        if (promoted.MatchedCount == 0)
        {
            return false;
        }

        // Demote afterwards, never before: a failure between the two leaves two defaults, which
        // is visible and harmless, where the other order could leave a tenant with none.
        await _collection
            .UpdateManyAsync(
                Builders<TenantPaymentMethod>.Filter.And(
                    Active(tenantGroupId),
                    Builders<TenantPaymentMethod>.Filter.Ne(x => x.ItemId, itemId),
                    Builders<TenantPaymentMethod>.Filter.Eq(x => x.IsDefault, true)),
                Builders<TenantPaymentMethod>.Update
                    .Set(x => x.IsDefault, false)
                    .Set(x => x.UpdatedAtUtc, utcNow),
                cancellationToken: cancellationToken)
            .ConfigureAwait(false);

        return true;
    }

    public async Task<bool> MarkRemovedAsync(
        string tenantGroupId,
        string itemId,
        DateTime utcNow,
        CancellationToken cancellationToken = default)
    {
        var result = await _collection
            .UpdateOneAsync(
                One(tenantGroupId, itemId),
                Builders<TenantPaymentMethod>.Update
                    .Set(x => x.Status, PaymentMethodStatuses.Removed)
                    .Set(x => x.IsDefault, false)
                    // The vault value is deleted separately; clearing the pointer here keeps a
                    // removed card from looking as though it still has one.
                    .Set(x => x.SecretId, string.Empty)
                    .Set(x => x.UpdatedAtUtc, utcNow),
                cancellationToken: cancellationToken)
            .ConfigureAwait(false);

        return result.MatchedCount > 0;
    }

    public async Task MarkChargedAsync(
        string tenantGroupId,
        string itemId,
        DateTime utcNow,
        CancellationToken cancellationToken = default) =>
        await _collection
            .UpdateOneAsync(
                One(tenantGroupId, itemId),
                Builders<TenantPaymentMethod>.Update
                    .Set(x => x.LastChargedAtUtc, utcNow)
                    .Set(x => x.UpdatedAtUtc, utcNow),
                cancellationToken: cancellationToken)
            .ConfigureAwait(false);
}
