namespace Blocks.Secrets;

/// <summary>
/// The tenant's tag catalogue — the list a UI offers when someone tags a secret.
/// </summary>
/// <remarks>
/// <para>
/// Held in the tenant database's <c>keyValueStores</c> collection under
/// <see cref="StoreKey"/>, read and written through Genesis's <c>IKeyValueStore</c>. The
/// document is seed data: entries put there by hand keep the labels they were given, and the
/// platform only ever <i>adds</i> keys it has not seen. Nothing here removes an entry, so a
/// tag stays offered even after the last secret using it is deleted.
/// </para>
/// <para>
/// This is a convenience list, not an authority. A secret's tags are whatever is stored on the
/// secret; the catalogue neither constrains them nor is consulted to validate them. A missing
/// document therefore means "no suggestions", never an error.
/// </para>
/// </remarks>
public interface ISecretTagCatalogService
{
    /// <summary>
    /// Single-value key. Never mix the store's multi-value API onto it — doing so leaves reads
    /// returning an arbitrary document.
    /// </summary>
    const string StoreKey = "my-secret-tags";

    /// <summary>Every tag on offer, ordered by label. Empty when the document is absent.</summary>
    Task<IReadOnlyList<SecretTagEntry>> GetAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Adds any of <paramref name="tagKeys"/> the catalogue does not already hold.
    /// </summary>
    /// <remarks>
    /// Never throws. This runs after a secret has already been written, and a suggestion list
    /// that missed an entry is not worth failing a completed create or update over — the tag
    /// is on the secret either way, and the next write of the same tag adds it.
    /// </remarks>
    Task RegisterAsync(IEnumerable<string> tagKeys, CancellationToken cancellationToken = default);
}
