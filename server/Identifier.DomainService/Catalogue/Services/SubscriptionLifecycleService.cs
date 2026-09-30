using Blocks.Genesis;
using DomainService.Catalogue.Models;
using DomainService.Entities;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace DomainService.Catalogue.Services;

/// <summary>
/// The period boundary: allowances reset, purchased units carry.
/// </summary>
/// <remarks>
/// This once also added environments, scheduled removals and sold top-ups. Those are gone — the
/// order flow does all three now, through payment and idempotency, and a second way in that
/// skipped both was a liability rather than a convenience.
/// </remarks>
public interface ISubscriptionLifecycleService
{
    Task<RolloverResult> RolloverAsync(string tenantId, string environmentKey, string newPeriodKey, bool freeTier, CancellationToken cancellationToken = default);
}

public readonly record struct RolloverResult(int MetersReset, long PurchasedCarried);

/// <summary>
/// What happens to a subscription when somebody adds, removes, buys or crosses a boundary.
/// <para>
/// Everything here works from the catalogue, so a meter or an environment published tomorrow is
/// handled by the same code. Nothing is stored in a tenant database: these are billing records and
/// they live in the platform database, scoped by <c>TenantId</c>.
/// </para>
/// </summary>
public sealed class SubscriptionLifecycleService : ISubscriptionLifecycleService
{
    private const string CollectionName = "ResourceLimits";

    private readonly IMongoCollection<ResourceLimit> _collection;
    private readonly ICatalogueProvider _catalogue;
    private readonly IResourceLimitSeeder _seeder;
    private readonly ILogger<SubscriptionLifecycleService> _logger;

    public SubscriptionLifecycleService(
        IDbContextProvider dbContextProvider,
        IBlocksSecret blocksSecret,
        ICatalogueProvider catalogue,
        IResourceLimitSeeder seeder,
        ILogger<SubscriptionLifecycleService> logger)
    {
        ArgumentNullException.ThrowIfNull(dbContextProvider);
        ArgumentNullException.ThrowIfNull(blocksSecret);

        _catalogue = catalogue ?? throw new ArgumentNullException(nameof(catalogue));
        _seeder = seeder ?? throw new ArgumentNullException(nameof(seeder));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _collection = dbContextProvider
            .GetDatabase(blocksSecret.DatabaseConnectionString, blocksSecret.RootDatabaseName)
            .GetCollection<ResourceLimit>(CollectionName);
    }

    private static FilterDefinition<ResourceLimit> Row(string tenantId, string meter) =>
        Builders<ResourceLimit>.Filter.And(
            Builders<ResourceLimit>.Filter.Eq(r => r.TenantId, tenantId),
            Builders<ResourceLimit>.Filter.Eq(r => r.Resource, meter));

    /// <summary>
    /// Adds an environment. It is live at once and charged only for the days left in the period —
    /// anything that grows applies immediately, because there is nobody to strand and nothing to
    /// game by growing.
    /// </summary>
    /// <summary>
    /// Schedules a removal for the period boundary. Never immediate: an environment cut off mid-period
    /// is in violation of a rule it did not break, and there is no refund for the remainder.
    /// </summary>
    /// <summary>
    /// Buys units. A counter's units are bought once and carry; a resource's ceiling is rent, charged
    /// every period while it is held. The catalogue decides which, so a new meter needs no code here.
    /// </summary>
    /// <summary>
    /// Crosses the period boundary. The included allowance resets; purchased units carry, less
    /// whatever of them was actually spent once the allowance ran out.
    /// </summary>
    public async Task<RolloverResult> RolloverAsync(string tenantId, string environmentKey, string newPeriodKey, bool freeTier, CancellationToken cancellationToken = default)
    {
        var rows = await _collection
            .Find(Builders<ResourceLimit>.Filter.Eq(r => r.TenantId, tenantId))
            .ToListAsync(cancellationToken).ConfigureAwait(false);

        var writes = new List<WriteModel<ResourceLimit>>();
        long carried = 0;

        foreach (var row in rows.Where(r => !string.IsNullOrEmpty(r.Resource)))
        {
            var meter = _catalogue.Catalogue.FindMeter(row.Resource);
            if (!MeterKindBehaviour.For(row.Kind ?? meter?.Kind).ResetsEachPeriod)
            {
                continue;
            }

            var remaining = ResourceLimitSeeder.RemainingPurchased(row);
            carried += remaining;

            writes.Add(new UpdateOneModel<ResourceLimit>(
                Row(tenantId, row.Resource),
                Builders<ResourceLimit>.Update
                    .Set(r => r.Usage, 0)
                    .Set(r => r.Purchased, remaining)
                    .Set(r => r.PeriodKey, newPeriodKey)
                    .Set(r => r.LastUpdatedDate, DateTime.UtcNow)));
        }

        if (writes.Count > 0)
        {
            await _collection.BulkWriteAsync(writes, new BulkWriteOptions { IsOrdered = false }, cancellationToken).ConfigureAwait(false);
        }

        // A rollover is also the moment to pick up anything newly published.
        await _seeder.SyncAsync(tenantId, environmentKey, newPeriodKey, freeTier, cancellationToken).ConfigureAwait(false);

        return new RolloverResult(writes.Count, carried);
    }
}
