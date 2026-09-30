using System.Text.Json;
using Blocks.Genesis;
using DomainService.Catalogue.Entities;
using DomainService.Catalogue.Models;
using Microsoft.Extensions.Logging;
namespace DomainService.Catalogue.Services;

/// <summary>
/// The published catalogue, in the platform key-value store.
/// </summary>
/// <remarks>
/// Genuinely key-shaped and the lowest-traffic thing the subscription work stores: written only
/// when someone publishes, read by key. A collection of its own bought nothing that
/// <c>GetByPrefixAsync</c> does not already give.
/// <para>
/// Two kinds of key. <c>catalogue:active</c> names the version every tenant is seeded from;
/// <c>catalogue:version:&lt;version&gt;</c> holds each published version, kept forever so an
/// invoice raised last month can still be read against the catalogue that produced it.
/// </para>
/// <para>
/// Always <c>impersonated: false</c>, which is what puts this in the root database. The catalogue
/// is platform data — a tenant must never be able to rewrite the prices it is billed against.
/// </para>
/// </remarks>
public sealed class MongoCatalogueStore : ICatalogueStore
{
    /// <summary>Points at the active version. One small document, overwritten on publish.</summary>
    private const string ActiveKey = "catalogue:active";

    /// <summary>Prefix for the versions themselves. The history listing scans it.</summary>
    private const string VersionPrefix = "catalogue:version:";

    private static string VersionKey(string version) => $"{VersionPrefix}{version}";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true
    };

    private readonly IKeyValueStore _store;
    private readonly ILogger<MongoCatalogueStore> _logger;

    public MongoCatalogueStore(IKeyValueStore store, ILogger<MongoCatalogueStore> logger)
    {
        _store = store ?? throw new ArgumentNullException(nameof(store));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<CatalogueDocument?> GetActiveAsync(CancellationToken cancellationToken = default)
    {
        var pointer = await _store
            .GetAsync<ActivePointer>(ActiveKey, impersonated: false, cancellationToken)
            .ConfigureAwait(false);

        if (pointer is null || string.IsNullOrWhiteSpace(pointer.CatalogueVersion))
        {
            return null;
        }

        return await _store
            .GetAsync<CatalogueDocument>(VersionKey(pointer.CatalogueVersion), impersonated: false, cancellationToken)
            .ConfigureAwait(false);
    }

    public async Task<IReadOnlyList<CatalogueDocument>> GetHistoryAsync(int limit = 20, CancellationToken cancellationToken = default)
    {
        var all = await _store
            .GetByPrefixAsync<CatalogueDocument>(VersionPrefix, impersonated: false, cancellationToken)
            .ConfigureAwait(false);

        // The store has no sort, so ordering happens here. Publishes are rare and each document is
        // small, which is what makes reading them all and sorting in memory reasonable.
        return [.. all.OrderByDescending(d => d.PublishedAtUtc).Take(limit)];
    }

    public async Task<PublishResult> PublishAsync(string catalogueJson, string priceBookJson, string publishedBy, bool allowProblems = false, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(catalogueJson);

        PlanCatalogue catalogue;
        PriceBook priceBook;

        try
        {
            catalogue = JsonSerializer.Deserialize<PlanCatalogue>(catalogueJson, JsonOptions) ?? new PlanCatalogue();
            priceBook = string.IsNullOrWhiteSpace(priceBookJson)
                ? new PriceBook()
                : JsonSerializer.Deserialize<PriceBook>(priceBookJson, JsonOptions) ?? new PriceBook();
        }
        catch (JsonException ex)
        {
            return new PublishResult(false, string.Empty, [$"The catalogue is not valid JSON: {ex.Message}"]);
        }

        var problems = CatalogueValidator.Validate(catalogue, priceBook);

        // A catalogue that leaves a meter without a limit provisions silently wrong rows for every
        // tenant, so it is refused unless somebody explicitly overrides.
        if (problems.Count > 0 && !allowProblems)
        {
            return new PublishResult(false, catalogue.CatalogueVersion, problems);
        }

        // The version first, then the pointer. In that order a failure between the two leaves a
        // stored version nothing points at, which is invisible; the reverse would point at a
        // version that does not exist, which breaks every read.
        await _store
            .SetAsync(
                VersionKey(catalogue.CatalogueVersion),
                new CatalogueDocument
                {
                    ItemId = Guid.NewGuid().ToString("N"),
                    CatalogueVersion = catalogue.CatalogueVersion,
                    PriceBookVersion = priceBook.PriceBookVersion,
                    IsActive = true,
                    CatalogueJson = catalogueJson,
                    PriceBookJson = priceBookJson ?? string.Empty,
                    Problems = [.. problems],
                    PublishedAtUtc = DateTime.UtcNow,
                    PublishedBy = publishedBy,
                    CreatedDate = DateTime.UtcNow,
                    LastUpdatedDate = DateTime.UtcNow
                },
                impersonated: false,
                cancellationToken)
            .ConfigureAwait(false);

        await _store
            .SetAsync(
                ActiveKey,
                new ActivePointer { CatalogueVersion = catalogue.CatalogueVersion },
                impersonated: false,
                cancellationToken)
            .ConfigureAwait(false);

        _logger.LogInformation("Catalogue {Version} published by {By} with {Count} problem(s).",
            catalogue.CatalogueVersion, publishedBy, problems.Count);

        return new PublishResult(true, catalogue.CatalogueVersion, problems);
    }

    public async Task<bool> BootstrapAsync(string dataDirectory, string publishedBy, CancellationToken cancellationToken = default)
    {
        if (await GetActiveAsync(cancellationToken).ConfigureAwait(false) is not null)
        {
            return false;
        }

        var cataloguePath = Path.Combine(dataDirectory, CatalogueProvider.CatalogueFileName);
        var priceBookPath = Path.Combine(dataDirectory, CatalogueProvider.PriceBookFileName);

        if (!File.Exists(cataloguePath))
        {
            _logger.LogError("Nothing is published and the bootstrap file {Path} is missing; no tenant can be provisioned.", cataloguePath);
            return false;
        }

        var result = await PublishAsync(
            await File.ReadAllTextAsync(cataloguePath, cancellationToken).ConfigureAwait(false),
            File.Exists(priceBookPath) ? await File.ReadAllTextAsync(priceBookPath, cancellationToken).ConfigureAwait(false) : string.Empty,
            publishedBy,
            allowProblems: true,
            cancellationToken).ConfigureAwait(false);

        if (result.Published)
        {
            _logger.LogInformation("Catalogue {Version} bootstrapped from the shipped files.", result.CatalogueVersion);
        }

        return result.Published;
    }
}

/// <summary>Which version is live. A pointer rather than a flag, because the store cannot query one.</summary>
public sealed class ActivePointer
{
    public string CatalogueVersion { get; set; } = string.Empty;
}
