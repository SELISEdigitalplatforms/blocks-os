namespace Blocks.Secrets;

public interface ISecretRepository
{
    Task InsertAsync(Secret secret, CancellationToken cancellationToken = default);

    Task ReplaceAsync(Secret secret, CancellationToken cancellationToken = default);

    /// <summary>Loads a secret scoped to the tenant. Returns null when it does not exist there.</summary>
    Task<Secret?> GetAsync(string tenantId, string secretId, CancellationToken cancellationToken = default);

    Task<(IReadOnlyList<Secret> Items, long TotalCount)> FindAsync(string tenantId, SecretFilter filter, CancellationToken cancellationToken = default);

    /// <summary>
    /// Whether a non-deleted secret already uses this name in the tenant/organization.
    /// </summary>
    /// <param name="excludeSecretId">Ignore this secret, so renaming to its own name is allowed.</param>
    Task<bool> NameExistsAsync(string tenantId, string organizationId, string name, string? excludeSecretId = null, CancellationToken cancellationToken = default);

    /// <summary>Hard-deletes metadata. Used only to compensate a failed create.</summary>
    Task HardDeleteAsync(string tenantId, string secretId, CancellationToken cancellationToken = default);
}
