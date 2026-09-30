using Blocks.Genesis;
using DomainService.Billing.Entities;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace DomainService.Billing.Services;

/// <param name="IsWinner">
/// False when the insert lost the race on the unique index — meaning another call already owns
/// this purchase, and <see cref="Order"/> is that one rather than a new one.
/// </param>
public readonly record struct OrderClaim(bool IsWinner, SubscriptionOrder Order);

public interface ISubscriptionOrderStore
{
    /// <summary>
    /// Inserts the order, or returns the one that already holds this idempotency key.
    /// </summary>
    /// <remarks>
    /// Never check-then-insert: the gap between the two is wide enough for a double-click to pass
    /// through both. The unique index decides, and the loser reads back the winner.
    /// </remarks>
    Task<OrderClaim> ClaimAsync(SubscriptionOrder order, CancellationToken cancellationToken = default);

    Task<SubscriptionOrder?> GetAsync(string tenantGroupId, string orderId, CancellationToken cancellationToken = default);

    Task<SubscriptionOrder?> GetByKeyAsync(string tenantGroupId, string idempotencyKey, CancellationToken cancellationToken = default);

    /// <summary>
    /// Finds an order by its id alone, with no project to scope by.
    /// </summary>
    /// <remarks>
    /// For the payment provider's notifications only. Adyen knows the order reference we sent and
    /// nothing about project groups, so this is the one read that cannot be scoped — which is why
    /// it is not reachable from any authenticated endpoint.
    /// </remarks>
    Task<SubscriptionOrder?> FindByReferenceAsync(string orderId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<SubscriptionOrder>> ListAsync(string tenantGroupId, CancellationToken cancellationToken = default);

    /// <summary>Orders still owed work, oldest first. What the sweeper re-enqueues.</summary>
    Task<IReadOnlyList<SubscriptionOrder>> FindUnfinishedAsync(DateTime olderThanUtc, int limit, CancellationToken cancellationToken = default);

    Task UpdateAsync(SubscriptionOrder order, CancellationToken cancellationToken = default);

    /// <summary>
    /// Marks pending orders past their expiry as expired, and says how many.
    /// </summary>
    /// <remarks>
    /// Marked, never deleted: the row keeps its idempotency key, so a duplicate arriving long
    /// afterwards still collides instead of charging.
    /// </remarks>
    Task<long> ExpireAbandonedAsync(DateTime utcNow, int limit, CancellationToken cancellationToken = default);

    /// <summary>
    /// Pending orders we charged for and never got an answer about.
    /// </summary>
    /// <remarks>
    /// The queue a person works through against the provider's dashboard. These are deliberately
    /// never resolved automatically after the fact: the provider's idempotency window is short,
    /// and a replay past it charges a second time instead of reporting the first.
    /// </remarks>
    Task<IReadOnlyList<SubscriptionOrder>> FindUnresolvedChargesAsync(
        DateTime olderThanUtc,
        int limit,
        CancellationToken cancellationToken = default);

    Task EnsureIndexesAsync(CancellationToken cancellationToken = default);
}

/// <summary>Orders in the root database, one collection for every project.</summary>
public sealed class SubscriptionOrderStore : ISubscriptionOrderStore
{
    public const string CollectionName = "SubscriptionOrders";
    public const string IdempotencyIndexName = "ux_group_idempotency";

    private readonly IMongoCollection<SubscriptionOrder> _collection;
    private readonly ILogger<SubscriptionOrderStore> _logger;

    public SubscriptionOrderStore(
        IDbContextProvider dbContextProvider,
        IBlocksSecret blocksSecret,
        ILogger<SubscriptionOrderStore> logger)
    {
        ArgumentNullException.ThrowIfNull(dbContextProvider);
        ArgumentNullException.ThrowIfNull(blocksSecret);

        _logger = logger;
        _collection = dbContextProvider
            .GetDatabase(blocksSecret.DatabaseConnectionString, blocksSecret.RootDatabaseName)
            .GetCollection<SubscriptionOrder>(CollectionName);
    }

    public async Task EnsureIndexesAsync(CancellationToken cancellationToken = default)
    {
        var keys = Builders<SubscriptionOrder>.IndexKeys
            .Ascending(o => o.TenantGroupId)
            .Ascending(o => o.IdempotencyKey);

        await _collection.Indexes
            .CreateOneAsync(
                new CreateIndexModel<SubscriptionOrder>(
                    keys,
                    new CreateIndexOptions { Unique = true, Name = IdempotencyIndexName }),
                cancellationToken: cancellationToken)
            .ConfigureAwait(false);

        // Notification ids, so a redelivered event is a no-op rather than a second charge.
        await _collection.Database
            .GetCollection<ProcessedNotification>(ProcessedNotificationStore.CollectionName)
            .Indexes
            .CreateOneAsync(
                new CreateIndexModel<ProcessedNotification>(
                    Builders<ProcessedNotification>.IndexKeys.Ascending(n => n.PspReference),
                    new CreateIndexOptions { Unique = true, Name = "ux_psp_reference" }),
                cancellationToken: cancellationToken)
            .ConfigureAwait(false);

        // These rows exist only to make a redelivered notification a no-op, and Adyen stops
        // retrying long before this. Without an expiry the collection grows for the life of the
        // platform holding bookkeeping nobody will ever read.
        await _collection.Database
            .GetCollection<ProcessedNotification>(ProcessedNotificationStore.CollectionName)
            .Indexes
            .CreateOneAsync(
                new CreateIndexModel<ProcessedNotification>(
                    Builders<ProcessedNotification>.IndexKeys.Ascending(n => n.HandledAtUtc),
                    new CreateIndexOptions
                    {
                        Name = "ttl_handled",
                        ExpireAfter = TimeSpan.FromDays(90),
                    }),
                cancellationToken: cancellationToken)
            .ConfigureAwait(false);

        // One invoice number, one invoice. A collision becomes a write error rather than two
        // documents claiming the same number.
        await _collection.Database
            .GetCollection<Invoice>(InvoiceStore.CollectionName)
            .Indexes
            .CreateOneAsync(
                new CreateIndexModel<Invoice>(
                    Builders<Invoice>.IndexKeys.Ascending(i => i.Number),
                    new CreateIndexOptions { Unique = true, Name = "ux_invoice_number" }),
                cancellationToken: cancellationToken)
            .ConfigureAwait(false);

        // Sweeper reads: unfinished orders by age.
        await _collection.Indexes
            .CreateOneAsync(
                new CreateIndexModel<SubscriptionOrder>(
                    Builders<SubscriptionOrder>.IndexKeys.Ascending(o => o.State).Ascending(o => o.UpdatedAtUtc),
                    new CreateIndexOptions { Name = "ix_state_updated" }),
                cancellationToken: cancellationToken)
            .ConfigureAwait(false);
    }

    public async Task<OrderClaim> ClaimAsync(SubscriptionOrder order, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(order);

        try
        {
            await _collection.InsertOneAsync(order, cancellationToken: cancellationToken).ConfigureAwait(false);
            return new OrderClaim(true, order);
        }
        catch (MongoWriteException exception)
            when (exception.WriteError?.Category == ServerErrorCategory.DuplicateKey)
        {
            // Someone else got here first. Their order is the answer to this call too.
            var existing = await GetByKeyAsync(order.TenantGroupId, order.IdempotencyKey, cancellationToken)
                .ConfigureAwait(false);

            if (existing is null)
            {
                // The index refused it but nothing is readable: a partial write, or a key reused
                // across groups. Surfacing beats guessing, because the alternative is charging.
                _logger.LogError(
                    "Duplicate key on order for {TenantGroupId} but no existing order could be read.",
                    order.TenantGroupId);
                throw;
            }

            return new OrderClaim(false, existing);
        }
    }

    public async Task<SubscriptionOrder?> GetAsync(string tenantGroupId, string orderId, CancellationToken cancellationToken = default) =>
        await _collection
            .Find(Builders<SubscriptionOrder>.Filter.And(
                Builders<SubscriptionOrder>.Filter.Eq(o => o.TenantGroupId, tenantGroupId),
                Builders<SubscriptionOrder>.Filter.Eq(o => o.ItemId, orderId)))
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

    public async Task<SubscriptionOrder?> GetByKeyAsync(string tenantGroupId, string idempotencyKey, CancellationToken cancellationToken = default) =>
        await _collection
            .Find(Builders<SubscriptionOrder>.Filter.And(
                Builders<SubscriptionOrder>.Filter.Eq(o => o.TenantGroupId, tenantGroupId),
                Builders<SubscriptionOrder>.Filter.Eq(o => o.IdempotencyKey, idempotencyKey)))
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

    public async Task<SubscriptionOrder?> FindByReferenceAsync(string orderId, CancellationToken cancellationToken = default) =>
        string.IsNullOrWhiteSpace(orderId)
            ? null
            : await _collection
                .Find(Builders<SubscriptionOrder>.Filter.Eq(o => o.ItemId, orderId))
                .FirstOrDefaultAsync(cancellationToken)
                .ConfigureAwait(false);

    public async Task<IReadOnlyList<SubscriptionOrder>> ListAsync(string tenantGroupId, CancellationToken cancellationToken = default) =>
        await _collection
            .Find(Builders<SubscriptionOrder>.Filter.Eq(o => o.TenantGroupId, tenantGroupId))
            .SortByDescending(o => o.CreatedAtUtc)
            .Limit(50)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

    public async Task<IReadOnlyList<SubscriptionOrder>> FindUnfinishedAsync(
        DateTime olderThanUtc,
        int limit,
        CancellationToken cancellationToken = default) =>
        await _collection
            .Find(Builders<SubscriptionOrder>.Filter.And(
                Builders<SubscriptionOrder>.Filter.In(o => o.State, new[] { OrderStates.Paid, OrderStates.Creating }),
                Builders<SubscriptionOrder>.Filter.Lt(o => o.UpdatedAtUtc, olderThanUtc)))
            .SortBy(o => o.UpdatedAtUtc)
            .Limit(limit)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

    public async Task<long> ExpireAbandonedAsync(DateTime utcNow, int limit, CancellationToken cancellationToken = default)
    {
        var result = await _collection
            .UpdateManyAsync(
                Builders<SubscriptionOrder>.Filter.And(
                    Builders<SubscriptionOrder>.Filter.Eq(o => o.State, OrderStates.Pending),
                    Builders<SubscriptionOrder>.Filter.Lt(o => o.ExpiresAtUtc, utcNow),
                    // Never an order we called the provider about. Money may have moved, and a
                    // timer is not allowed to decide that it did not.
                    Builders<SubscriptionOrder>.Filter.Eq(o => o.ChargeAttemptedAtUtc, (DateTime?)null)),
                Builders<SubscriptionOrder>.Update
                    .Set(o => o.State, OrderStates.Expired)
                    .Set(o => o.UpdatedAtUtc, utcNow),
                cancellationToken: cancellationToken)
            .ConfigureAwait(false);

        return result.ModifiedCount;
    }

    public async Task<IReadOnlyList<SubscriptionOrder>> FindUnresolvedChargesAsync(
        DateTime olderThanUtc,
        int limit,
        CancellationToken cancellationToken = default) =>
        await _collection
            .Find(Builders<SubscriptionOrder>.Filter.And(
                Builders<SubscriptionOrder>.Filter.Eq(o => o.State, OrderStates.Pending),
                Builders<SubscriptionOrder>.Filter.Ne(o => o.ChargeAttemptedAtUtc, (DateTime?)null),
                Builders<SubscriptionOrder>.Filter.Lt(o => o.ChargeAttemptedAtUtc, olderThanUtc)))
            .SortBy(o => o.ChargeAttemptedAtUtc)
            .Limit(limit)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

    public async Task UpdateAsync(SubscriptionOrder order, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(order);

        await _collection
            .ReplaceOneAsync(
                Builders<SubscriptionOrder>.Filter.And(
                    Builders<SubscriptionOrder>.Filter.Eq(o => o.TenantGroupId, order.TenantGroupId),
                    Builders<SubscriptionOrder>.Filter.Eq(o => o.ItemId, order.ItemId)),
                order,
                cancellationToken: cancellationToken)
            .ConfigureAwait(false);
    }
}
