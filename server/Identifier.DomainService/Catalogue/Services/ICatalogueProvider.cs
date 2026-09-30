using DomainService.Catalogue.Models;

namespace DomainService.Catalogue.Services;

/// <summary>
/// The active catalogue and price book, as blocks-os holds them. Genesis never sees either —
/// it is handed limits, not the rules that produced them.
/// </summary>
public interface ICatalogueProvider
{
    PlanCatalogue Catalogue { get; }
    PriceBook PriceBook { get; }

    /// <summary>Anything wrong with the active catalogue. Empty means it is sound.</summary>
    IReadOnlyList<string> Problems { get; }

    /// <summary>Pulls the active version from the database again, so a publish goes live without a release.</summary>
    Task ReloadAsync(CancellationToken cancellationToken = default);
}
