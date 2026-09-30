using System.Text.Json;
using System.Text.Json.Nodes;
using DomainService.Catalogue.Entities;
using DomainService.Catalogue.Models;
using DomainService.Catalogue.Services;
using Microsoft.Extensions.Logging.Abstractions;

namespace XUnitTest.Catalogue;

/// <summary>
/// The catalogue is meant to be extended by editing JSON. These tests add things to a copy of the
/// real files and assert that everything downstream picks them up without a line of code changing.
/// </summary>
public class CatalogueExtensibilityTests : IDisposable
{
    private readonly string _dir;

    public CatalogueExtensibilityTests()
    {
        _dir = Path.Combine(Path.GetTempPath(), "blocks-catalogue-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_dir);

        foreach (var name in new[] { CatalogueProvider.CatalogueFileName, CatalogueProvider.PriceBookFileName })
        {
            File.Copy(Path.Combine(SourceDirectory(), name), Path.Combine(_dir, name));
        }
    }

    public void Dispose()
    {
        if (Directory.Exists(_dir)) Directory.Delete(_dir, recursive: true);
        GC.SuppressFinalize(this);
    }

    private static string SourceDirectory() => Path.Combine(AppContext.BaseDirectory, "Catalogue", "Data");

    /// <summary>
    /// Publishing goes through the same validator the real store uses, then the provider loads what
    /// was published — the database path, with the files standing in for a publish.
    /// </summary>
    private CatalogueProvider Load()
    {
        var store = new FakeCatalogueStore(
            File.Exists(Path.Combine(_dir, CatalogueProvider.CatalogueFileName))
                ? File.ReadAllText(Path.Combine(_dir, CatalogueProvider.CatalogueFileName))
                : string.Empty,
            File.ReadAllText(Path.Combine(_dir, CatalogueProvider.PriceBookFileName)));

        var provider = new CatalogueProvider(store, NullLogger<CatalogueProvider>.Instance);
        provider.ReloadAsync().GetAwaiter().GetResult();
        return provider;
    }

    private sealed class FakeCatalogueStore : ICatalogueStore
    {
        private readonly string _catalogueJson;
        private readonly string _priceBookJson;

        public FakeCatalogueStore(string catalogueJson, string priceBookJson)
        {
            _catalogueJson = catalogueJson;
            _priceBookJson = priceBookJson;
        }

        public Task<CatalogueDocument?> GetActiveAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<CatalogueDocument?>(string.IsNullOrEmpty(_catalogueJson)
                ? null
                : new CatalogueDocument { CatalogueJson = _catalogueJson, PriceBookJson = _priceBookJson, IsActive = true });

        public Task<IReadOnlyList<CatalogueDocument>> GetHistoryAsync(int limit = 20, CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<CatalogueDocument>>([]);

        public Task<PublishResult> PublishAsync(string catalogueJson, string priceBookJson, string publishedBy, bool allowProblems = false, CancellationToken cancellationToken = default) =>
            Task.FromResult(new PublishResult(true, string.Empty, []));

        public Task<bool> BootstrapAsync(string dataDirectory, string publishedBy, CancellationToken cancellationToken = default) =>
            Task.FromResult(true);
    }

    private JsonNode Read(string file) => JsonNode.Parse(File.ReadAllText(Path.Combine(_dir, file)))!;

    private void Write(string file, JsonNode node) =>
        File.WriteAllText(Path.Combine(_dir, file), node.ToJsonString(new JsonSerializerOptions { WriteIndented = true }));

    [Fact]
    public void TheShippedCatalogue_HasNothingWrongWithIt()
    {
        var provider = Load();

        Assert.Empty(provider.Problems);
        Assert.NotEmpty(provider.Catalogue.CatalogueVersion);
        Assert.NotEmpty(provider.Catalogue.AllMeters());
    }

    [Fact]
    public void AddingAWholeService_NeedsNoCodeChange()
    {
        var before = Load().Catalogue.AllMeters().Count();

        var catalogue = Read(CatalogueProvider.CatalogueFileName);
        catalogue["services"]!["search"] = new JsonObject
        {
            ["label"] = "Search",
            ["meters"] = new JsonObject
            {
                ["queries"] = new JsonObject
                {
                    ["label"] = "Search queries",
                    ["unit"] = "query",
                    ["scope"] = "environment",
                    ["kind"] = "counter",
                    ["reset"] = "period"
                }
            }
        };

        // every limit set must carry the new meter, and it needs a step and a price
        foreach (var set in catalogue["limitSets"]!.AsObject())
        {
            set.Value!["search"] = new JsonObject { ["queries"] = 1000 };
        }

        catalogue["topUpSteps"]!["search"] = new JsonObject { ["queries"] = 500 };
        Write(CatalogueProvider.CatalogueFileName, catalogue);

        var prices = Read(CatalogueProvider.PriceBookFileName);
        prices["topUpSteps"]!["search"] = new JsonObject
        {
            ["queries"] = new JsonObject
            {
                ["kind"] = "counter",
                ["step"] = 500,
                ["billing"] = "oneOffCarries",
                ["price"] = new JsonObject { ["CHF"] = 10, ["USD"] = 11, ["BDT"] = 900 }
            }
        };
        Write(CatalogueProvider.PriceBookFileName, prices);

        var provider = Load();

        Assert.Empty(provider.Problems);
        Assert.Equal(before + 1, provider.Catalogue.AllMeters().Count());
        Assert.NotNull(provider.Catalogue.FindMeter("search.queries"));
        Assert.Equal(500, provider.Catalogue.StepFor("search.queries"));
        Assert.Equal(10m, provider.PriceBook.StepPriceFor("search.queries")!.Price["CHF"]);

        // and it reaches every environment's limits, including the free tier
        Assert.Equal(1000, provider.Catalogue.LimitsFor("prod")["search.queries"]);
        Assert.Equal(1000, provider.Catalogue.LimitsFor("dev", freeTier: true)["search.queries"]);
    }

    [Fact]
    public void AKindThisBuildHasNeverSeen_LoadsAndIsHandledConservatively()
    {
        var catalogue = Read(CatalogueProvider.CatalogueFileName);
        catalogue["services"]!["api"]!["meters"]!["concurrency"] = new JsonObject
        {
            ["label"] = "Peak concurrency",
            ["unit"] = "request",
            ["scope"] = "environment",
            ["kind"] = "gauge",          // a kind that does not exist in this build
            ["reset"] = "period",
            ["purchasable"] = false
        };

        foreach (var set in catalogue["limitSets"]!.AsObject())
        {
            set.Value!["api"]!["concurrency"] = 50;
        }

        Write(CatalogueProvider.CatalogueFileName, catalogue);

        var provider = Load();
        var meter = provider.Catalogue.FindMeter("api.concurrency");

        Assert.NotNull(meter);
        Assert.Equal("gauge", meter!.Kind);
        Assert.Equal(50, provider.Catalogue.LimitsFor("prod")["api.concurrency"]);

        var behaviour = MeterKindBehaviour.For(meter.Kind);
        Assert.False(behaviour.Purchasable);
        Assert.True(behaviour.Counts);

        // It loads and is usable; the only complaint is that this build does not know the kind.
        Assert.Contains(provider.Problems, p => p.Contains("api.concurrency") && p.Contains("gauge"));
    }

    [Fact]
    public void AMeterMissingFromOneLimitSet_IsCaughtRatherThanSilentlyZero()
    {
        var catalogue = Read(CatalogueProvider.CatalogueFileName);
        catalogue["limitSets"]!["prod"]!["data"]!.AsObject().Remove("schemas");
        Write(CatalogueProvider.CatalogueFileName, catalogue);

        var provider = Load();

        Assert.Contains(provider.Problems, p => p.Contains("prod") && p.Contains("data.schemas"));
    }

    [Fact]
    public void APurchasableMeterWithNoPrice_IsCaught()
    {
        var prices = Read(CatalogueProvider.PriceBookFileName);
        prices["topUpSteps"]!["api"]!.AsObject().Remove("calls");
        Write(CatalogueProvider.PriceBookFileName, prices);

        var provider = Load();

        Assert.Contains(provider.Problems, p => p.Contains("api.calls") && p.Contains("price book"));
    }

    [Fact]
    public void AStepThatDisagreesBetweenTheTwoFiles_IsCaught()
    {
        var prices = Read(CatalogueProvider.PriceBookFileName);
        prices["topUpSteps"]!["api"]!["calls"]!["step"] = 12345;
        Write(CatalogueProvider.PriceBookFileName, prices);

        var provider = Load();

        Assert.Contains(provider.Problems, p => p.Contains("api.calls") && p.Contains("12345"));
    }

    [Fact]
    public void AnEnvironmentOverride_BeatsTheSharedLimitSet()
    {
        var catalogue = Read(CatalogueProvider.CatalogueFileName);
        catalogue["environments"]!["uat"]!["overrides"] = new JsonObject { ["ai.agents"] = 999 };
        Write(CatalogueProvider.CatalogueFileName, catalogue);

        var provider = Load();

        Assert.Empty(provider.Problems);
        Assert.Equal(999, provider.Catalogue.LimitsFor("uat")["ai.agents"]);
        // iat shares the same limit set and must be untouched by uat's override
        Assert.NotEqual(999, provider.Catalogue.LimitsFor("iat")["ai.agents"]);
    }

    [Fact]
    public void ACounterThatNeverResets_IsCaught()
    {
        var catalogue = Read(CatalogueProvider.CatalogueFileName);
        catalogue["services"]!["api"]!["meters"]!["calls"]!["reset"] = "never";
        Write(CatalogueProvider.CatalogueFileName, catalogue);

        var provider = Load();

        Assert.Contains(provider.Problems, p => p.Contains("api.calls") && p.Contains("lifetime allowance"));
    }

    [Fact]
    public void NothingPublished_DoesNotTakeTheProcessDown()
    {
        File.Delete(Path.Combine(_dir, CatalogueProvider.CatalogueFileName));

        var provider = Load();

        Assert.Empty(provider.Catalogue.AllMeters());
        Assert.NotEmpty(provider.Problems);
    }
}
