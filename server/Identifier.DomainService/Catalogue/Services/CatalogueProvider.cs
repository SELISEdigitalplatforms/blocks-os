using System.Text.Json;
using DomainService.Catalogue.Models;
using Microsoft.Extensions.Logging;

namespace DomainService.Catalogue.Services;

/// <summary>
/// The active catalogue, held in memory and refreshed from the database.
/// <para>
/// The database is the source. The JSON that ships with the build is only a bootstrap for a fresh
/// install, and once something is published the files are never read again. A catalogue that fails
/// validation is still served with its problems recorded — refusing to start over a price-book typo
/// would turn a data mistake into an outage, and publishing is where a bad catalogue is stopped.
/// </para>
/// </summary>
public sealed class CatalogueProvider : ICatalogueProvider
{
    public const string CatalogueFileName = "plan-catalogue.json";
    public const string PriceBookFileName = "price-book.json";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true
    };

    private readonly ICatalogueStore _store;
    private readonly ILogger<CatalogueProvider> _logger;
    private readonly Lock _gate = new();

    private PlanCatalogue _catalogue = new();
    private PriceBook _priceBook = new();
    private IReadOnlyList<string> _problems = ["The catalogue has not been loaded yet."];

    public CatalogueProvider(ICatalogueStore store, ILogger<CatalogueProvider> logger)
    {
        _store = store ?? throw new ArgumentNullException(nameof(store));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public PlanCatalogue Catalogue { get { lock (_gate) { return _catalogue; } } }
    public PriceBook PriceBook { get { lock (_gate) { return _priceBook; } } }
    public IReadOnlyList<string> Problems { get { lock (_gate) { return _problems; } } }

    public async Task ReloadAsync(CancellationToken cancellationToken = default)
    {
        var active = await _store.GetActiveAsync(cancellationToken).ConfigureAwait(false);

        if (active is null)
        {
            lock (_gate)
            {
                _problems = ["No catalogue is published. Nothing can be provisioned or priced until one is."];
            }

            _logger.LogError("No active catalogue in the database.");
            return;
        }

        var catalogue = Parse<PlanCatalogue>(active.CatalogueJson) ?? new PlanCatalogue();
        var priceBook = Parse<PriceBook>(active.PriceBookJson) ?? new PriceBook();
        var problems = CatalogueValidator.Validate(catalogue, priceBook);

        lock (_gate)
        {
            _catalogue = catalogue;
            _priceBook = priceBook;
            _problems = problems;
        }

        if (problems.Count > 0)
        {
            _logger.LogWarning("Catalogue {Version} is active with {Count} problem(s): {Problems}",
                catalogue.CatalogueVersion, problems.Count, string.Join(" | ", problems));
        }
        else
        {
            _logger.LogInformation("Catalogue {Version} active: {Services} services, {Meters} meters, {Environments} environments.",
                catalogue.CatalogueVersion, catalogue.Services.Count, catalogue.AllMeters().Count(), catalogue.Environments.Count);
        }
    }

    private T? Parse<T>(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return default;
        }

        try
        {
            return JsonSerializer.Deserialize<T>(json, JsonOptions);
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "A published {Type} could not be parsed.", typeof(T).Name);
            return default;
        }
    }
}
