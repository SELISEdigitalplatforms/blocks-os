using System.Collections.Concurrent;
using MongoDB.Driver;

namespace Blocks.Secrets;

/// <summary>
/// Gates the one-off index creation each secret-store collection needs.
/// </summary>
/// <remarks>
/// <para>
/// There is a <c>SecretStore</c> database on every Mongo connection a tenant can be placed on,
/// so "ensure the indexes once" has to mean once per cluster. A single process-wide flag would
/// index whichever cluster a request happened to reach first and leave the others bare — and
/// <c>ix_tenant_item</c> is unique, so the cluster that missed out would quietly accept a
/// duplicate secret id.
/// </para>
/// <para>
/// Keyed by the <see cref="IMongoClient"/> instance because Genesis reuses exactly one client
/// per connection string, which makes reference identity a faithful stand-in for cluster
/// identity — and, unlike a key built from the connection string, one that cannot leak
/// credentials into a diagnostic. Bounded by the number of configured connections.
/// </para>
/// </remarks>
internal static class SecretStoreIndexes
{
    private static readonly ConcurrentDictionary<IMongoClient, ConcurrentDictionary<string, byte>> _ensured =
        new(ReferenceEqualityComparer.Instance);

    /// <summary>
    /// True for the first caller to reach this collection on this cluster, false for every
    /// caller after it.
    /// </summary>
    /// <remarks>
    /// Claims the slot before the indexes are built, matching the flag it replaces: a failed
    /// creation is logged and not retried, so one unreachable cluster cannot turn every later
    /// request into another index attempt.
    /// </remarks>
    public static bool ShouldEnsure<TDocument>(IMongoCollection<TDocument> collection)
    {
        ArgumentNullException.ThrowIfNull(collection);

        var perCluster = _ensured.GetOrAdd(
            collection.Database.Client,
            _ => new ConcurrentDictionary<string, byte>(StringComparer.Ordinal));

        return perCluster.TryAdd(collection.CollectionNamespace.FullName, 0);
    }
}
