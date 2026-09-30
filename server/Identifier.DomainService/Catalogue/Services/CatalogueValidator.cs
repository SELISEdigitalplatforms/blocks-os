using DomainService.Catalogue.Models;

namespace DomainService.Catalogue.Services;

/// <summary>
/// The rules a catalogue must satisfy before anything is allowed to load it.
/// <para>
/// This exists because the catalogue is edited by hand. Every rule here is one that, if broken,
/// fails silently at runtime — a meter with no limit in one set, a limit set that forgot a meter, a
/// step price for something nobody can buy. Finding those at startup is the difference between a
/// typo and a customer denied a call they paid for.
/// </para>
/// </summary>
public static class CatalogueValidator
{
    public static IReadOnlyList<string> Validate(PlanCatalogue catalogue, PriceBook? priceBook = null)
    {
        var problems = new List<string>();
        var meters = catalogue.AllMeters().ToList();

        if (meters.Count == 0)
        {
            problems.Add("The catalogue defines no meters.");
            return problems;
        }

        foreach (var (id, _, _, meter) in meters)
        {
            var behaviour = MeterKindBehaviour.For(meter.Kind);

            if (!MeterKindBehaviour.IsKnown(meter.Kind))
            {
                // Not fatal: an unknown kind is handled conservatively. Still worth saying out loud.
                problems.Add($"{id}: kind '{meter.Kind}' is not one this build knows ({string.Join(", ", MeterKindBehaviour.KnownKinds)}); it will be treated conservatively and cannot be bought.");
            }

            if (!string.Equals(meter.Scope, "environment", StringComparison.OrdinalIgnoreCase))
            {
                problems.Add($"{id}: scope is '{meter.Scope}'. Every meter is environment-scoped — a project is the sum of its environments.");
            }

            var resetMatches = behaviour.Kind switch
            {
                "counter" => meter.Reset == "period",
                "resource" => meter.Reset == "never",
                "policy" => meter.Reset == "none",
                _ => true
            };

            if (!resetMatches)
            {
                problems.Add($"{id}: kind '{meter.Kind}' with reset '{meter.Reset}'. A counter that never resets is a lifetime allowance nobody sold, and a resource that resets hands out free storage every period.");
            }

            var step = catalogue.StepFor(id);
            var purchasable = meter.Purchasable && behaviour.Purchasable;

            if (purchasable && step is null)
            {
                problems.Add($"{id}: purchasable but has no top-up step, so nobody can buy any of it.");
            }

            if (!purchasable && step is not null)
            {
                problems.Add($"{id}: has a top-up step but is not purchasable.");
            }

            if (step is <= 0)
            {
                problems.Add($"{id}: top-up step must be greater than zero.");
            }

            if (priceBook is not null)
            {
                var price = priceBook.StepPriceFor(id);

                if (purchasable && price is null)
                {
                    problems.Add($"{id}: purchasable but the price book has no step price.");
                }

                if (price is not null && step is not null && price.Step != step)
                {
                    problems.Add($"{id}: step is {step} in the catalogue and {price.Step} in the price book.");
                }
            }
        }

        // Every limit set must cover every meter, or an environment silently grants nothing.
        foreach (var (setName, set) in catalogue.LimitSets)
        {
            foreach (var (id, service, name, _) in meters)
            {
                if (!set.TryGetValue(service, out var serviceLimits) || !serviceLimits.ContainsKey(name))
                {
                    problems.Add($"limit set '{setName}' has no value for {id}.");
                }
            }
        }

        foreach (var (envKey, environment) in catalogue.Environments)
        {
            if (!catalogue.LimitSets.ContainsKey(environment.LimitSet))
            {
                problems.Add($"environment '{envKey}' points at limit set '{environment.LimitSet}', which does not exist.");
            }

            if (!string.IsNullOrEmpty(environment.FreeLimitSet) && !catalogue.LimitSets.ContainsKey(environment.FreeLimitSet!))
            {
                problems.Add($"environment '{envKey}' points at free limit set '{environment.FreeLimitSet}', which does not exist.");
            }

            foreach (var overridden in environment.Overrides.Keys)
            {
                if (catalogue.FindMeter(overridden) is null)
                {
                    problems.Add($"environment '{envKey}' overrides '{overridden}', which is not a meter.");
                }
            }

            if (priceBook is not null && !priceBook.Environments.ContainsKey(envKey))
            {
                problems.Add($"environment '{envKey}' has no price.");
            }
        }

        foreach (var (target, _) in catalogue.Aliases.Select(a => (a.Value, a.Key)))
        {
            if (!catalogue.Environments.ContainsKey(target))
            {
                problems.Add($"alias points at environment '{target}', which does not exist.");
            }
        }

        if (priceBook is not null && !string.IsNullOrEmpty(priceBook.CatalogueVersion)
            && priceBook.CatalogueVersion != catalogue.CatalogueVersion)
        {
            problems.Add($"the price book was written for catalogue {priceBook.CatalogueVersion} but this is {catalogue.CatalogueVersion}.");
        }

        return problems;
    }
}
