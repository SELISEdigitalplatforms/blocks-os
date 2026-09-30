using System.Text.Json.Serialization;

namespace DomainService.Catalogue.Models;

/// <summary>
/// The catalogue, exactly as <c>plan-catalogue.json</c> states it.
/// <para>
/// Everything here is data. Adding a meter, a service, an environment or a whole new meter kind is
/// an edit to that file — nothing in this assembly switches on a known meter name, and nothing
/// enumerates the kinds it expects. Deserialisation keeps unknown members so a newer catalogue
/// served to an older build degrades rather than throws.
/// </para>
/// </summary>
public sealed class PlanCatalogue
{
    public int SchemaVersion { get; set; }
    public string CatalogueVersion { get; set; } = string.Empty;

    /// <summary>The value that means "no ceiling". Read from the file rather than assumed to be -1.</summary>
    public long Unlimited { get; set; } = -1;

    public UsagePeriodDefinition UsagePeriod { get; set; } = new();
    public BillingDefinition Billing { get; set; } = new();
    public CatalogueDefaults Defaults { get; set; } = new();

    /// <summary>Environment name aliases, e.g. <c>staging</c> → <c>stg</c>.</summary>
    public Dictionary<string, string> Aliases { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    public Dictionary<string, ServiceDefinition> Services { get; set; } = new(StringComparer.Ordinal);

    /// <summary>Named limit sets. Several environments may share one.</summary>
    public Dictionary<string, Dictionary<string, Dictionary<string, long>>> LimitSets { get; set; } = new(StringComparer.Ordinal);

    public Dictionary<string, EnvironmentDefinition> Environments { get; set; } = new(StringComparer.Ordinal);

    /// <summary>How many units one top-up step buys, per service, per meter.</summary>
    public Dictionary<string, Dictionary<string, long>> TopUpSteps { get; set; } = new(StringComparer.Ordinal);

    [JsonExtensionData]
    public Dictionary<string, object>? Extra { get; set; }

    /// <summary>Every meter in the catalogue, flattened to its <c>service.meter</c> id.</summary>
    public IEnumerable<(string Id, string Service, string Name, MeterDefinition Meter)> AllMeters()
    {
        foreach (var (serviceKey, service) in Services)
        {
            foreach (var (meterKey, meter) in service.Meters)
            {
                yield return ($"{serviceKey}.{meterKey}", serviceKey, meterKey, meter);
            }
        }
    }

    public MeterDefinition? FindMeter(string meterId)
    {
        var split = meterId.Split('.', 2);
        return split.Length == 2
            && Services.TryGetValue(split[0], out var service)
            && service.Meters.TryGetValue(split[1], out var meter)
            ? meter
            : null;
    }

    /// <summary>
    /// The limits an environment grants, with its own overrides applied over the shared set.
    /// </summary>
    public IReadOnlyDictionary<string, long> LimitsFor(string environmentKey, bool freeTier = false)
    {
        if (!Environments.TryGetValue(environmentKey, out var environment))
        {
            return new Dictionary<string, long>(StringComparer.Ordinal);
        }

        var setName = freeTier && !string.IsNullOrEmpty(environment.FreeLimitSet)
            ? environment.FreeLimitSet!
            : environment.LimitSet;

        var limits = new Dictionary<string, long>(StringComparer.Ordinal);

        if (LimitSets.TryGetValue(setName, out var set))
        {
            foreach (var (serviceKey, meters) in set)
            {
                foreach (var (meterKey, value) in meters)
                {
                    limits[$"{serviceKey}.{meterKey}"] = value;
                }
            }
        }

        foreach (var (meterId, value) in environment.Overrides)
        {
            limits[meterId] = value;
        }

        return limits;
    }

    public long? StepFor(string meterId)
    {
        var split = meterId.Split('.', 2);
        return split.Length == 2
            && TopUpSteps.TryGetValue(split[0], out var service)
            && service.TryGetValue(split[1], out var step)
            ? step
            : null;
    }
}

public sealed class ServiceDefinition
{
    public string Label { get; set; } = string.Empty;
    public Dictionary<string, MeterDefinition> Meters { get; set; } = new(StringComparer.Ordinal);

    [JsonExtensionData] public Dictionary<string, object>? Extra { get; set; }
}

/// <summary>
/// One meter. <see cref="Kind"/> is a string on purpose: a catalogue that introduces a kind this
/// build has never heard of must still load, and the behaviour for it is resolved at runtime.
/// </summary>
public sealed class MeterDefinition
{
    public string Label { get; set; } = string.Empty;
    public string Unit { get; set; } = string.Empty;
    public string Scope { get; set; } = "environment";
    public string Kind { get; set; } = "counter";
    public string Reset { get; set; } = "period";

    /// <summary>Decimal places. Absent means whole units.</summary>
    public int Scale { get; set; }

    /// <summary>Whether units may be bought. Absent means yes.</summary>
    public bool Purchasable { get; set; } = true;

    /// <summary>What happens when the counter is unreachable — <c>open</c> or <c>closed</c>.</summary>
    public string? FailMode { get; set; }

    [JsonExtensionData] public Dictionary<string, object>? Extra { get; set; }
}

public sealed class EnvironmentDefinition
{
    public string Label { get; set; } = string.Empty;
    public int Rank { get; set; }
    public string LimitSet { get; set; } = string.Empty;

    /// <summary>Set only where a free tier exists — today, <c>dev</c> alone.</summary>
    public string? FreeLimitSet { get; set; }

    public bool FreeTierAvailable { get; set; }
    public int MaxFreePerProject { get; set; }

    /// <summary>No ceiling on top-ups. True for <c>prod</c>, which has nothing above it to move to.</summary>
    public bool TopUpUncapped { get; set; }

    /// <summary>Per-meter deviations from the shared limit set, keyed by <c>service.meter</c>.</summary>
    public Dictionary<string, long> Overrides { get; set; } = new(StringComparer.Ordinal);

    [JsonExtensionData] public Dictionary<string, object>? Extra { get; set; }
}

public sealed class UsagePeriodDefinition
{
    public int Days { get; set; } = 30;
    public string Anchor { get; set; } = "subscribedAtUtc";
}

public sealed class BillingDefinition
{
    public List<string> Cycles { get; set; } = ["monthly"];
    public string DefaultCycle { get; set; } = "monthly";
    public string OnAdd { get; set; } = "prorateAndChargeNow";
    public string OnRemove { get; set; } = "atUsagePeriodEnd";
    public bool RefundOnRemove { get; set; }
    public bool ReanchorOnChange { get; set; }
}

public sealed class CatalogueDefaults
{
    public List<int> AlertAtPercent { get; set; } = [80, 100];
    public TopUpDefaults TopUp { get; set; } = new();

    [JsonExtensionData] public Dictionary<string, object>? Extra { get; set; }
}

public sealed class TopUpDefaults
{
    public bool RequiresPaidEnvironment { get; set; } = true;
    public int MaxMultipleOfIncluded { get; set; } = 2;
    public bool RoundDownToWholeStep { get; set; } = true;
    public bool CounterUnitsCarry { get; set; } = true;
    public List<string> DrainOrder { get; set; } = ["allowance", "purchased"];
    public bool ResourceUnitsRecurring { get; set; } = true;
    public string ResourceDecreaseAt { get; set; } = "usagePeriodEnd";
}
