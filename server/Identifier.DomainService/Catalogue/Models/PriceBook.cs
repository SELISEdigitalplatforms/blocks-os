using System.Text.Json.Serialization;

namespace DomainService.Catalogue.Models;

/// <summary>
/// Money, kept entirely out of the catalogue. A new market is a new column here and no change to
/// the model; amounts are set per market rather than converted from a base currency, because
/// purchasing power differs by more than exchange rates do.
/// </summary>
public sealed class PriceBook
{
    public int SchemaVersion { get; set; }
    public string PriceBookVersion { get; set; } = string.Empty;
    public string CatalogueVersion { get; set; } = string.Empty;

    public List<string> Markets { get; set; } = [];
    public string DefaultMarket { get; set; } = "CHF";

    /// <summary>Environment key → tier (<c>free</c> / <c>paid</c>) → market → amount.</summary>
    public Dictionary<string, Dictionary<string, Dictionary<string, decimal>>> Environments { get; set; } = new(StringComparer.Ordinal);

    /// <summary>Service → meter → one step's definition and price.</summary>
    public Dictionary<string, Dictionary<string, TopUpStepPrice>> TopUpSteps { get; set; } = new(StringComparer.Ordinal);

    [JsonExtensionData] public Dictionary<string, object>? Extra { get; set; }

    public decimal? PriceFor(string environmentKey, string market, bool freeTier = false)
    {
        var tier = freeTier ? "free" : "paid";
        return Environments.TryGetValue(environmentKey, out var tiers)
            && tiers.TryGetValue(tier, out var byMarket)
            && byMarket.TryGetValue(market, out var amount)
            ? amount
            : null;
    }

    public TopUpStepPrice? StepPriceFor(string meterId)
    {
        var split = meterId.Split('.', 2);
        return split.Length == 2
            && TopUpSteps.TryGetValue(split[0], out var service)
            && service.TryGetValue(split[1], out var step)
            ? step
            : null;
    }
}

public sealed class TopUpStepPrice
{
    public string Kind { get; set; } = "counter";
    public long Step { get; set; }

    /// <summary><c>oneOffCarries</c> or <c>recurringWhileHeld</c> — how the charge behaves after the fact.</summary>
    public string Billing { get; set; } = "oneOffCarries";

    public Dictionary<string, decimal> Price { get; set; } = new(StringComparer.Ordinal);

    [JsonExtensionData] public Dictionary<string, object>? Extra { get; set; }
}
