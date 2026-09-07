namespace Blocks.Secrets;

/// <summary>
/// The kinds of secret the platform manages.
/// </summary>
/// <remarks>
/// The type is fixed at creation and never changes. Converting one in place would silently
/// move an existing credential between access models — a <see cref="Service"/> secret turned
/// <see cref="Both"/> would become visible to every user in the tenant without anyone
/// re-approving it — so there is no operation that rewrites it.
/// </remarks>
public static class SecretTypes
{
    /// <summary>
    /// A user-facing secret. Reading its value additionally requires membership of
    /// <see cref="SecretAccess"/>.
    /// </summary>
    public const string Api = "api";

    /// <summary>
    /// A backend credential consumed by a Blocks service. Reading its value requires only a
    /// valid tenant context — there is no per-user access list.
    /// </summary>
    public const string Service = "service";

    /// <summary>
    /// A credential that is both consumed by a Blocks service and managed by people.
    /// </summary>
    /// <remarks>
    /// Reads exactly like <see cref="Service"/> — a valid tenant context is the whole check,
    /// and there is no access list. What it adds is that the UI surfaces it: reveal, copy,
    /// edit and rotate are all offered, where for a <see cref="Service"/> secret they are
    /// hidden. That difference is presentational, and deliberately so; the API has always let
    /// any authenticated caller in the tenant read a service value, so this type makes the
    /// existing capability visible rather than granting a new one.
    /// </remarks>
    public const string Both = "both";

    public static bool IsValid(string? type) =>
        type is Api or Service or Both;

    /// <summary>
    /// Whether a type carries a per-user <see cref="SecretAccess"/> list.
    /// </summary>
    /// <remarks>
    /// The single place that answers it. Four rules depend on the distinction — whether a
    /// create stores an access list, whether <c>UpdateAccessAsync</c> is applicable, whether a
    /// value read consults the list, and whether a metadata mutation does — and having them
    /// each test the type inline is how one of them ends up disagreeing with the others.
    /// </remarks>
    public static bool HasAccessList(string? type) =>
        string.Equals(type, Api, StringComparison.Ordinal);
}
