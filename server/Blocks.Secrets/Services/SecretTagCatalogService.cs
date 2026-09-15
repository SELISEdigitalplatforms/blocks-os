using System.Globalization;
using Blocks.Genesis;
using Microsoft.Extensions.Logging;

namespace Blocks.Secrets;

/// <inheritdoc cref="ISecretTagCatalogService"/>
public sealed class SecretTagCatalogService : ISecretTagCatalogService
{
    /// <summary>
    /// Resolves the store against the acting tenant, which under impersonation is the
    /// impersonated one.
    /// </summary>
    /// <remarks>
    /// Has to match where the secrets themselves live: <c>SecretCallerContext.TenantId</c> is
    /// the impersonated tenant, so a catalogue read from the original tenant would offer
    /// labels for tags no secret in view carries.
    /// </remarks>
    private const bool Impersonated = true;

    private readonly IKeyValueStore _store;
    private readonly ILogger<SecretTagCatalogService> _logger;

    public SecretTagCatalogService(IKeyValueStore store, ILogger<SecretTagCatalogService> logger)
    {
        _store = store;
        _logger = logger;
    }

    public async Task<IReadOnlyList<SecretTagEntry>> GetAsync(CancellationToken cancellationToken = default)
    {
        var entries = await ReadAsync(cancellationToken).ConfigureAwait(false);

        return entries
            .Where(entry => entry.Key.Length > 0)
            .OrderBy(entry => entry.Label, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    public async Task RegisterAsync(IEnumerable<string> tagKeys, CancellationToken cancellationToken = default)
    {
        var keys = SecretTag.NormalizeAll(tagKeys);

        if (keys.Count == 0)
        {
            return;
        }

        try
        {
            var entries = await ReadAsync(cancellationToken).ConfigureAwait(false);
            var known = entries.Select(entry => entry.Key).ToHashSet(StringComparer.Ordinal);
            var added = keys.Where(key => known.Add(key)).ToList();

            if (added.Count == 0)
            {
                return;
            }

            // Read-modify-write, so two creates landing together can lose one of the new
            // entries. Left as is deliberately: the tag is already stored on its secret, and
            // the next write of that tag puts it back in the catalogue.
            entries.AddRange(added.Select(key => new SecretTagEntry { Key = key, Label = Humanize(key) }));

            await _store.SetAsync(ISecretTagCatalogService.StoreKey, entries, Impersonated, cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "Could not add {Count} tag(s) to the tag catalogue. The tags are stored on their secret; only the suggestion list is behind.",
                keys.Count);
        }
    }

    /// <summary>
    /// Reads the raw catalogue. Returns an empty, mutable list when the document is absent or
    /// cannot be read.
    /// </summary>
    private async Task<List<SecretTagEntry>> ReadAsync(CancellationToken cancellationToken)
    {
        try
        {
            var stored = await _store
                .GetAsync<List<SecretTagEntry>>(ISecretTagCatalogService.StoreKey, Impersonated, cancellationToken)
                .ConfigureAwait(false);

            return stored ?? [];
        }
        catch (Exception ex)
        {
            // A tag picker with no suggestions still works — the field is free text. Failing
            // the request instead would take the whole secret list down with it.
            _logger.LogWarning(ex, "Could not read the tag catalogue. Continuing with no suggestions.");
            return [];
        }
    }

    /// <summary>
    /// Derives a display label from a key: <c>payments-team</c> becomes "Payments Team".
    /// </summary>
    /// <remarks>
    /// Only ever applied to a key the catalogue has not seen. A hand-seeded entry keeps the
    /// label it was given, because an existing key is never rewritten.
    /// </remarks>
    private static string Humanize(string key)
    {
        var words = key
            .Split(['-', '_', '.', ':'], StringSplitOptions.RemoveEmptyEntries)
            .Select(word => char.ToUpper(word[0], CultureInfo.InvariantCulture) + word[1..]);

        var label = string.Join(' ', words);

        return label.Length == 0 ? key : label;
    }
}
