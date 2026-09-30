using Blocks.Genesis;
using DomainService.Catalogue.Models;
using DomainService.Entities;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace DomainService.Catalogue.Services;

public interface IResourceLimitSeeder
{
    /// <summary>
    /// Brings one environment's limit rows in line with the catalogue. Safe to run repeatedly.
    /// </summary>
    Task<SeedOutcome> SyncAsync(string tenantId, string environmentKey, string periodKey, bool freeTier = false, CancellationToken cancellationToken = default);
}

/// <param name="Added">Meters that had no row and now do — this is how a new catalogue entry reaches a live tenant.</param>
/// <param name="Updated">Rows whose ceiling or metadata changed.</param>
/// <param name="Unchanged">Rows already correct.</param>
public readonly record struct SeedOutcome(int Added, int Updated, int Unchanged)
{
    public int Total => Added + Updated + Unchanged;
}

/// <summary>
/// Writes the catalogue into a tenant's database, one row per meter.
/// <para>
/// This is what makes adding a meter a data change. A new entry in <c>plan-catalogue.json</c> has no
/// row anywhere; the next sync creates it for every environment, and from that moment Genesis can
/// count it. Nothing here enumerates meters it expects, so a service or a kind that did not exist
/// when this was written provisions exactly the same way.
/// </para>
/// <para>
/// It never writes <c>Usage</c>. That field belongs to Genesis, and the whole design rests on the
/// two sides never touching the same field.
/// </para>
/// <para>
/// Rows live in the ROOT database, never in a tenant's own. Subscription state is a billing record:
/// it belongs to the platform, it outlives the environment it describes, and an environment must
/// not be able to read or rewrite its own ceiling. <c>TenantId</c> on every row and every filter is
/// what keeps it environment-scoped without putting it inside the environment.
/// </para>
/// </summary>
public sealed class ResourceLimitSeeder : IResourceLimitSeeder
{
    private const string CollectionName = "ResourceLimits";

    private readonly IMongoCollection<ResourceLimit> _collection;
    private readonly ICatalogueProvider _catalogue;
    private readonly ILogger<ResourceLimitSeeder> _logger;

    public ResourceLimitSeeder(
        IDbContextProvider dbContextProvider,
        IBlocksSecret blocksSecret,
        ICatalogueProvider catalogue,
        ILogger<ResourceLimitSeeder> logger)
    {
        ArgumentNullException.ThrowIfNull(dbContextProvider);
        ArgumentNullException.ThrowIfNull(blocksSecret);

        _catalogue = catalogue ?? throw new ArgumentNullException(nameof(catalogue));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _collection = dbContextProvider
            .GetDatabase(blocksSecret.DatabaseConnectionString, blocksSecret.RootDatabaseName)
            .GetCollection<ResourceLimit>(CollectionName);
    }

    private static FilterDefinition<ResourceLimit> Row(string tenantId, string meter) =>
        Builders<ResourceLimit>.Filter.And(
            Builders<ResourceLimit>.Filter.Eq(r => r.TenantId, tenantId),
            Builders<ResourceLimit>.Filter.Eq(r => r.Resource, meter));

    public async Task<SeedOutcome> SyncAsync(string tenantId, string environmentKey, string periodKey, bool freeTier = false, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(tenantId);
        ArgumentException.ThrowIfNullOrWhiteSpace(environmentKey);
        ArgumentException.ThrowIfNullOrWhiteSpace(periodKey);

        var catalogue = _catalogue.Catalogue;
        var limits = catalogue.LimitsFor(environmentKey, freeTier);

        if (limits.Count == 0)
        {
            _logger.LogError("Environment '{Environment}' grants no limits in catalogue {Version}; nothing was seeded for {TenantId}.",
                environmentKey, catalogue.CatalogueVersion, tenantId);
            return default;
        }

        var existing = (await _collection
                .Find(Builders<ResourceLimit>.Filter.Eq(r => r.TenantId, tenantId))
                .ToListAsync(cancellationToken).ConfigureAwait(false))
            .Where(row => row.Resource is not null)
            .ToDictionary(row => row.Resource, StringComparer.Ordinal);

        var toInsert = new List<ResourceLimit>();
        var writes = new List<WriteModel<ResourceLimit>>();
        var unchanged = 0;

        foreach (var (id, serviceKey, _, meter) in catalogue.AllMeters())
        {
            if (!limits.TryGetValue(id, out var limit))
            {
                // The validator already reports this; skipping keeps one gap from stopping the rest.
                continue;
            }

            var behaviour = MeterKindBehaviour.For(meter.Kind);
            var failMode = meter.FailMode ?? "open";

            if (!existing.TryGetValue(id, out var row))
            {
                toInsert.Add(new ResourceLimit
                {
                    ItemId = Guid.NewGuid().ToString("N"),
                    Resource = id,
                    Service = serviceKey,
                    Environment = environmentKey,
                    PeriodKey = periodKey,
                    Kind = meter.Kind,
                    Limit = limit,
                    Usage = 0,
                    Purchased = 0,
                    FailMode = failMode,
                    Enforcement = "enforced",
                    ResourceType = meter.Unit,
                    IsActive = true,
                    TenantId = tenantId,
                    CreatedDate = DateTime.UtcNow,
                    LastUpdatedDate = DateTime.UtcNow
                });
                continue;
            }

            var needsUpdate = row.Limit != limit
                || row.Service != serviceKey
                || row.Environment != environmentKey
                || row.Kind != meter.Kind
                || row.FailMode != failMode
                || row.PeriodKey != periodKey;

            if (!needsUpdate)
            {
                unchanged++;
                continue;
            }

            // A period rollover resets the allowance. Purchased units are not touched: they were
            // paid for, and they carry until spent.
            var update = Builders<ResourceLimit>.Update
                .Set(r => r.Limit, limit)
                .Set(r => r.Service, serviceKey)
                .Set(r => r.Environment, environmentKey)
                .Set(r => r.Kind, meter.Kind)
                .Set(r => r.FailMode, failMode)
                .Set(r => r.LastUpdatedDate, DateTime.UtcNow);

            if (row.PeriodKey != periodKey && behaviour.ResetsEachPeriod)
            {
                update = update
                    .Set(r => r.PeriodKey, periodKey)
                    .Set(r => r.Usage, 0)
                    .Set(r => r.Purchased, RemainingPurchased(row));
            }
            else if (row.PeriodKey != periodKey)
            {
                update = update.Set(r => r.PeriodKey, periodKey);
            }

            writes.Add(new UpdateOneModel<ResourceLimit>(Row(tenantId, id), update));
        }

        if (toInsert.Count > 0)
        {
            await _collection.InsertManyAsync(toInsert, cancellationToken: cancellationToken).ConfigureAwait(false);
        }

        if (writes.Count > 0)
        {
            await _collection.BulkWriteAsync(writes, new BulkWriteOptions { IsOrdered = false }, cancellationToken).ConfigureAwait(false);
        }

        var outcome = new SeedOutcome(toInsert.Count, writes.Count, unchanged);

        if (outcome.Added > 0)
        {
            _logger.LogInformation("Catalogue {Version} added {Added} new meter(s) to {TenantId}/{Environment}.",
                catalogue.CatalogueVersion, outcome.Added, tenantId, environmentKey);
        }

        return outcome;
    }

    /// <summary>
    /// What is left of the purchased units once the allowance has been drained first. Spending
    /// counts against the allowance before it touches anything bought, so only the overshoot came
    /// out of the purchased balance.
    /// </summary>
    internal static long RemainingPurchased(ResourceLimit row)
    {
        if (row.Purchased <= 0)
        {
            return 0;
        }

        var spentFromPurchased = row.Limit >= 0 ? Math.Max(0, row.Usage - row.Limit) : 0;
        return Math.Max(0, row.Purchased - spentFromPurchased);
    }
}
