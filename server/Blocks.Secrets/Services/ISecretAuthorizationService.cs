using Blocks.Genesis;

namespace Blocks.Secrets;

/// <summary>
/// The calling identity, resolved and validated once per operation.
/// </summary>
public sealed record SecretCallerContext
{
    public required string TenantId { get; init; }

    public required string OrganizationId { get; init; }

    public required string UserId { get; init; }

    public required IReadOnlyList<string> Roles { get; init; }

    /// <summary>True when the caller is on the root tenant, directly or by impersonation.</summary>
    public required bool IsRoot { get; init; }

    public required bool Impersonated { get; init; }

    public string? ImpersonationSessionId { get; init; }

    public string? OriginalTenantId { get; init; }

    public string? RequestUri { get; init; }
}

public interface ISecretAuthorizationService
{
    /// <summary>
    /// Resolves and validates the ambient <see cref="BlocksContext"/>.
    /// </summary>
    /// <exception cref="SecretAccessDeniedException">
    /// There is no context, it is unauthenticated, or it carries no tenant.
    /// </exception>
    SecretCallerContext ResolveContext();

    /// <summary>
    /// Whether <paramref name="caller"/> may read <paramref name="secret"/>'s plaintext value.
    /// </summary>
    /// <returns>Null when allowed; otherwise a reason code from <see cref="SecretAuditReasons"/>.</returns>
    string? CheckValueRead(SecretCallerContext caller, Secret secret);

    /// <summary>
    /// Throws unless <paramref name="caller"/> may read <paramref name="secret"/>'s value.
    /// </summary>
    void EnsureValueRead(SecretCallerContext caller, Secret secret);
}
