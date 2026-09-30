using Blocks.Genesis;
using DomainService.Catalogue.Entities;
using DomainService.Catalogue.Models;
using DomainService.Catalogue.Services;
using Microsoft.AspNetCore.Mvc;

namespace BlocksOs.Api.Controllers;

/// <summary>
/// Serves the catalogue and the price book to the console.
/// </summary>
/// <remarks>
/// The screens render from this rather than from anything compiled in, so a meter added to
/// <c>plan-catalogue.json</c> appears in the create flow, the limits panel and the top-up grid with
/// no front-end change. Nothing here filters by a known meter name.
/// </remarks>
[ApiController]
[Route("[controller]")]
public class CatalogueController : ControllerBase
{
    private readonly ICatalogueProvider _catalogue;
    private readonly ICatalogueStore _store;

    public CatalogueController(ICatalogueProvider catalogue, ICatalogueStore store)
    {
        _catalogue = catalogue;
        _store = store;
    }

    /// <summary>Everything the console needs to draw the environment picker and the limits.</summary>
    [HttpGet]
    [ProtectedEndPoint("blocks-os::catalogue::read")]
    public CatalogueResponse Get([FromQuery] string? market = null)
    {
        var catalogue = _catalogue.Catalogue;
        var priceBook = _catalogue.PriceBook;
        var chosen = string.IsNullOrWhiteSpace(market) ? priceBook.DefaultMarket : market!;

        return new CatalogueResponse
        {
            CatalogueVersion = catalogue.CatalogueVersion,
            PriceBookVersion = priceBook.PriceBookVersion,
            Market = chosen,
            Markets = priceBook.Markets,
            UsagePeriodDays = catalogue.UsagePeriod.Days,
            TopUp = catalogue.Defaults.TopUp,
            Services = catalogue.Services,
            Environments = catalogue.Environments.ToDictionary(
                pair => pair.Key,
                pair => new EnvironmentView
                {
                    Label = pair.Value.Label,
                    Rank = pair.Value.Rank,
                    FreeTierAvailable = pair.Value.FreeTierAvailable,
                    TopUpUncapped = pair.Value.TopUpUncapped,
                    Price = priceBook.PriceFor(pair.Key, chosen),
                    FreePrice = pair.Value.FreeTierAvailable ? priceBook.PriceFor(pair.Key, chosen, freeTier: true) : null,
                    Limits = catalogue.LimitsFor(pair.Key),
                    FreeLimits = pair.Value.FreeTierAvailable ? catalogue.LimitsFor(pair.Key, freeTier: true) : null
                },
                StringComparer.Ordinal),
            TopUpSteps = catalogue.AllMeters()
                .Where(m => m.Meter.Purchasable && MeterKindBehaviour.For(m.Meter.Kind).Purchasable)
                .Select(m => new { m.Id, Step = catalogue.StepFor(m.Id), Price = priceBook.StepPriceFor(m.Id) })
                .Where(x => x.Step is not null && x.Price is not null)
                .ToDictionary(
                    x => x.Id,
                    x => new TopUpStepView
                    {
                        Step = x.Step!.Value,
                        Billing = x.Price!.Billing,
                        Price = x.Price.Price.TryGetValue(chosen, out var amount) ? amount : null
                    },
                    StringComparer.Ordinal),
            Problems = _catalogue.Problems
        };
    }

    /// <summary>
    /// Publishes a new catalogue. Validated first: one that would leave a meter without a limit is
    /// refused rather than provisioned silently wrong across every tenant.
    /// </summary>
    [HttpPost("publish")]
    [ProtectedEndPoint("blocks-os::catalogue::save")]
    public async Task<PublishCatalogueResponse> Publish([FromBody] PublishCatalogueRequest request, CancellationToken cancellationToken)
    {
        var who = BlocksContext.GetContext()?.UserId ?? "unknown";
        var result = await _store.PublishAsync(request.CatalogueJson, request.PriceBookJson, who, request.AllowProblems, cancellationToken);

        if (result.Published)
        {
            await _catalogue.ReloadAsync(cancellationToken);
        }

        return new PublishCatalogueResponse
        {
            IsSuccess = result.Published,
            CatalogueVersion = result.CatalogueVersion,
            Problems = result.Problems,
            MeterCount = result.Published ? _catalogue.Catalogue.AllMeters().Count() : 0
        };
    }

    /// <summary>Pulls the active version from the database again, so a publish elsewhere goes live here.</summary>
    [HttpPost("reload")]
    [ProtectedEndPoint("blocks-os::catalogue::save")]
    public async Task<ReloadCatalogueResponse> Reload(CancellationToken cancellationToken)
    {
        await _catalogue.ReloadAsync(cancellationToken);
        return new ReloadCatalogueResponse
        {
            CatalogueVersion = _catalogue.Catalogue.CatalogueVersion,
            MeterCount = _catalogue.Catalogue.AllMeters().Count(),
            Problems = _catalogue.Problems
        };
    }

    /// <summary>What has been published, newest first. An old invoice is read against the catalogue that produced it.</summary>
    [HttpGet("history")]
    [ProtectedEndPoint("blocks-os::catalogue::read")]
    public async Task<CatalogueHistoryResponse> History([FromQuery] int limit, CancellationToken cancellationToken)
    {
        var history = await _store.GetHistoryAsync(limit <= 0 ? 20 : limit, cancellationToken);
        return new CatalogueHistoryResponse
        {
            Versions = [.. history.Select(d => new CatalogueVersionView
            {
                CatalogueVersion = d.CatalogueVersion,
                PriceBookVersion = d.PriceBookVersion,
                IsActive = d.IsActive,
                PublishedAtUtc = d.PublishedAtUtc,
                PublishedBy = d.PublishedBy,
                ProblemCount = d.Problems.Count
            })]
        };
    }
}

public sealed class CatalogueResponse : BaseResponse
{
    public string CatalogueVersion { get; set; } = string.Empty;
    public string PriceBookVersion { get; set; } = string.Empty;
    public string Market { get; set; } = string.Empty;
    public List<string> Markets { get; set; } = [];
    public int UsagePeriodDays { get; set; }
    public TopUpDefaults TopUp { get; set; } = new();
    public Dictionary<string, ServiceDefinition> Services { get; set; } = new(StringComparer.Ordinal);
    public Dictionary<string, EnvironmentView> Environments { get; set; } = new(StringComparer.Ordinal);
    public Dictionary<string, TopUpStepView> TopUpSteps { get; set; } = new(StringComparer.Ordinal);

    /// <summary>Anything wrong with the catalogue as loaded. Empty is the healthy case.</summary>
    public IReadOnlyList<string> Problems { get; set; } = [];
}

public sealed class EnvironmentView
{
    public string Label { get; set; } = string.Empty;
    public int Rank { get; set; }
    public bool FreeTierAvailable { get; set; }
    public bool TopUpUncapped { get; set; }
    public decimal? Price { get; set; }
    public decimal? FreePrice { get; set; }
    public IReadOnlyDictionary<string, long> Limits { get; set; } = new Dictionary<string, long>();
    public IReadOnlyDictionary<string, long>? FreeLimits { get; set; }
}

public sealed class TopUpStepView
{
    public long Step { get; set; }
    public string Billing { get; set; } = string.Empty;
    public decimal? Price { get; set; }
}

public sealed class PublishCatalogueRequest
{
    public string CatalogueJson { get; set; } = string.Empty;
    public string PriceBookJson { get; set; } = string.Empty;

    /// <summary>Publish even though the validator objected. Deliberate, and recorded on the document.</summary>
    public bool AllowProblems { get; set; }
}

public sealed class PublishCatalogueResponse : BaseResponse
{
    public string CatalogueVersion { get; set; } = string.Empty;
    public int MeterCount { get; set; }
    public IReadOnlyList<string> Problems { get; set; } = [];
}

public sealed class CatalogueHistoryResponse : BaseResponse
{
    public List<CatalogueVersionView> Versions { get; set; } = [];
}

public sealed class CatalogueVersionView
{
    public string CatalogueVersion { get; set; } = string.Empty;
    public string PriceBookVersion { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public DateTime PublishedAtUtc { get; set; }
    public string PublishedBy { get; set; } = string.Empty;
    public int ProblemCount { get; set; }
}

public sealed class ReloadCatalogueResponse : BaseResponse
{
    public string CatalogueVersion { get; set; } = string.Empty;
    public int MeterCount { get; set; }
    public IReadOnlyList<string> Problems { get; set; } = [];
}
