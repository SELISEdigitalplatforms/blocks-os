using DomainService.Catalogue.Entities;

namespace DomainService.Catalogue.Services;

/// <summary>
/// Where published catalogue versions live. The platform database, not a file.
/// </summary>
public interface ICatalogueStore
{
    Task<CatalogueDocument?> GetActiveAsync(CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CatalogueDocument>> GetHistoryAsync(int limit = 20, CancellationToken cancellationToken = default);

    /// <summary>
    /// Publishes a new version and retires the previous one. Validation happens first: a catalogue
    /// that would leave a meter without a limit is refused rather than quietly provisioned.
    /// </summary>
    Task<PublishResult> PublishAsync(string catalogueJson, string priceBookJson, string publishedBy, bool allowProblems = false, CancellationToken cancellationToken = default);

    /// <summary>
    /// Inserts the JSON that shipped with the build as version 1, but only if nothing is published
    /// yet. Idempotent, so it is safe on every start.
    /// </summary>
    Task<bool> BootstrapAsync(string dataDirectory, string publishedBy, CancellationToken cancellationToken = default);
}

public sealed record PublishResult(bool Published, string CatalogueVersion, IReadOnlyList<string> Problems);
