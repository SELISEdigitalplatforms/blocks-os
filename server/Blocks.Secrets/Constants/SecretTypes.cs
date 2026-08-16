namespace Blocks.Secrets;

/// <summary>
/// The kinds of secret the platform manages.
/// </summary>
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

    public static bool IsValid(string? type) =>
        type is Api or Service;
}
