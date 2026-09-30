namespace DomainService.Catalogue.Models;

/// <summary>
/// How a kind behaves, resolved at runtime rather than switched on.
/// <para>
/// A catalogue may introduce a kind this build has never seen. Rather than throwing or guessing,
/// an unknown kind falls back to the most conservative behaviour: counted like a counter, resetting
/// each period, not purchasable until somebody says otherwise. That way a newer catalogue served to
/// an older service degrades instead of breaking, and adding a kind is a data change plus one entry
/// here when its behaviour genuinely differs.
/// </para>
/// </summary>
public sealed record MeterKindBehaviour(
    string Kind,
    bool Counts,
    bool ResetsEachPeriod,
    bool GoesDownAgain,
    bool Purchasable)
{
    public static readonly MeterKindBehaviour Counter =
        new("counter", Counts: true, ResetsEachPeriod: true, GoesDownAgain: false, Purchasable: true);

    public static readonly MeterKindBehaviour Resource =
        new("resource", Counts: true, ResetsEachPeriod: false, GoesDownAgain: true, Purchasable: true);

    public static readonly MeterKindBehaviour Policy =
        new("policy", Counts: false, ResetsEachPeriod: false, GoesDownAgain: false, Purchasable: false);

    private static readonly Dictionary<string, MeterKindBehaviour> Known =
        new(StringComparer.OrdinalIgnoreCase)
        {
            [Counter.Kind] = Counter,
            [Resource.Kind] = Resource,
            [Policy.Kind] = Policy
        };

    /// <summary>Every kind this build understands. Unknown kinds are not an error.</summary>
    public static IReadOnlyCollection<string> KnownKinds => Known.Keys;

    public static bool IsKnown(string? kind) => kind is not null && Known.ContainsKey(kind);

    public static MeterKindBehaviour For(string? kind) =>
        kind is not null && Known.TryGetValue(kind, out var behaviour)
            ? behaviour
            : Conservative(kind ?? "unknown");

    private static MeterKindBehaviour Conservative(string kind) =>
        new(kind, Counts: true, ResetsEachPeriod: true, GoesDownAgain: false, Purchasable: false);
}
