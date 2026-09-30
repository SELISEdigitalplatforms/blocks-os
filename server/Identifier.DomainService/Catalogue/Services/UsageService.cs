using Blocks.Genesis;
using DomainService.Catalogue.Models;
using DomainService.Entities;
using MongoDB.Driver;

namespace DomainService.Catalogue.Services;

public interface IUsageService
{
    /// <summary>
    /// Everything a project is using, one block per environment, joined with what the catalogue
    /// says each meter is.
    /// </summary>
    /// <param name="tenantIds">
    /// The environments of one project group, as resolved by <c>ProjectPolicyFilter</c>. The
    /// caller has already been authorised against the group; this reads only what is listed here
    /// and never widens it.
    /// </param>
    Task<ProjectUsage> GetAsync(
        string tenantGroupId,
        IReadOnlyCollection<string> tenantIds,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Reads a project's limit rows from the ROOT database and dresses them with the catalogue's
/// labels, units and kinds.
/// <para>
/// A tenant is an environment and a project is a group of them, so a project's usage is the rows
/// of every tenant in its group — read in one query and split per environment, which is how the
/// console shows it: a column each, nothing pooled.
/// </para>
/// <para>
/// The rows live in the platform database, never inside the environment they describe. They are
/// billing records, and an environment must not be able to read or rewrite its own ceiling. The
/// console renders whatever comes back, so a meter added to the catalogue appears the moment the
/// tenant is synced; no screen knows a meter by name.
/// </para>
/// </summary>
public sealed class UsageService : IUsageService
{
    private const string CollectionName = "ResourceLimits";

    private readonly IMongoCollection<ResourceLimit> _collection;
    private readonly ICatalogueProvider _catalogue;

    public UsageService(IDbContextProvider dbContextProvider, IBlocksSecret blocksSecret, ICatalogueProvider catalogue)
    {
        ArgumentNullException.ThrowIfNull(dbContextProvider);
        ArgumentNullException.ThrowIfNull(blocksSecret);

        _catalogue = catalogue ?? throw new ArgumentNullException(nameof(catalogue));
        _collection = dbContextProvider
            .GetDatabase(blocksSecret.DatabaseConnectionString, blocksSecret.RootDatabaseName)
            .GetCollection<ResourceLimit>(CollectionName);
    }

    public async Task<ProjectUsage> GetAsync(
        string tenantGroupId,
        IReadOnlyCollection<string> tenantIds,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(tenantGroupId);
        ArgumentNullException.ThrowIfNull(tenantIds);

        var catalogue = _catalogue.Catalogue;

        var result = new ProjectUsage
        {
            TenantGroupId = tenantGroupId,
            CatalogueVersion = catalogue.CatalogueVersion
        };

        // A group with no environments is a real state — a project mid-creation — not an error.
        if (tenantIds.Count == 0)
        {
            return result;
        }

        var rows = await _collection
            .Find(Builders<ResourceLimit>.Filter.In(r => r.TenantId, tenantIds))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        var byTenant = rows
            .Where(r => !string.IsNullOrEmpty(r.Resource))
            .GroupBy(r => r.TenantId ?? string.Empty, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.ToList(), StringComparer.Ordinal);

        // Driven by the authorised list, not by what happens to have rows, so an environment that
        // has never been synced still appears — empty, and honestly so.
        foreach (var tenantId in tenantIds)
        {
            result.Environments.Add(BuildEnvironment(
                tenantId,
                byTenant.TryGetValue(tenantId, out var owned) ? owned : [],
                catalogue));
        }

        result.Environments.Sort((a, b) => string.CompareOrdinal(a.Environment, b.Environment));

        return result;
    }

    private static EnvironmentUsage BuildEnvironment(
        string tenantId,
        List<ResourceLimit> rows,
        PlanCatalogue catalogue)
    {
        var byService = new Dictionary<string, ServiceUsage>(StringComparer.Ordinal);
        var result = new EnvironmentUsage
        {
            TenantId = tenantId,
            CatalogueVersion = catalogue.CatalogueVersion,
            PeriodKey = rows.FirstOrDefault()?.PeriodKey ?? string.Empty,
            Environment = rows.FirstOrDefault()?.Environment ?? string.Empty
        };

        foreach (var row in rows)
        {
            var definition = catalogue.FindMeter(row.Resource);
            var serviceKey = row.Service ?? row.Resource.Split('.')[0];

            if (!byService.TryGetValue(serviceKey, out var service))
            {
                service = new ServiceUsage
                {
                    Service = serviceKey,
                    Label = catalogue.Services.TryGetValue(serviceKey, out var s) ? s.Label : serviceKey
                };
                byService[serviceKey] = service;
                result.Services.Add(service);
            }

            var behaviour = MeterKindBehaviour.For(row.Kind ?? definition?.Kind);
            var ceiling = row.Limit < 0 ? -1 : row.Limit + row.Purchased;
            var remaining = ceiling < 0 ? -1 : Math.Max(0, ceiling - row.Usage);

            service.Meters.Add(new MeterUsage
            {
                Meter = row.Resource,
                Label = definition?.Label ?? row.Resource,
                Unit = definition?.Unit ?? row.ResourceType ?? string.Empty,
                Kind = row.Kind ?? definition?.Kind ?? "counter",
                Counts = behaviour.Counts,
                Included = row.Limit,
                Purchased = row.Purchased,
                Used = row.Usage,
                Remaining = remaining,
                PercentUsed = row.Limit > 0 ? Math.Min(100, Math.Round(row.Usage * 100d / row.Limit, 1)) : 0,
                Enforcement = row.Enforcement ?? "enforced",
                // The catalogue can grow past what a tenant was seeded with; saying so is better
                // than showing a meter with no definition behind it.
                InCatalogue = definition is not null
            });
        }

        // Anything the catalogue has that this tenant has never been seeded with.
        var seeded = rows.Select(r => r.Resource).ToHashSet(StringComparer.Ordinal);
        result.NotYetSeeded = [.. catalogue.AllMeters().Select(m => m.Id).Where(id => !seeded.Contains(id))];

        return result;
    }
}

/// <summary>One project's usage, one entry per environment in its group.</summary>
public sealed class ProjectUsage
{
    public string TenantGroupId { get; set; } = string.Empty;
    public string CatalogueVersion { get; set; } = string.Empty;
    public List<EnvironmentUsage> Environments { get; set; } = [];
}

public sealed class EnvironmentUsage
{
    public string TenantId { get; set; } = string.Empty;
    public string Environment { get; set; } = string.Empty;
    public string PeriodKey { get; set; } = string.Empty;
    public string CatalogueVersion { get; set; } = string.Empty;
    public List<ServiceUsage> Services { get; set; } = [];

    /// <summary>Meters in the catalogue this tenant has no row for yet — run a sync to create them.</summary>
    public List<string> NotYetSeeded { get; set; } = [];
}

public sealed class ServiceUsage
{
    public string Service { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public List<MeterUsage> Meters { get; set; } = [];
}

public sealed class MeterUsage
{
    public string Meter { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string Unit { get; set; } = string.Empty;
    public string Kind { get; set; } = string.Empty;
    public bool Counts { get; set; }
    public long Included { get; set; }
    public long Purchased { get; set; }
    public long Used { get; set; }
    public long Remaining { get; set; }
    public double PercentUsed { get; set; }
    public string Enforcement { get; set; } = string.Empty;
    public bool InCatalogue { get; set; }
}
