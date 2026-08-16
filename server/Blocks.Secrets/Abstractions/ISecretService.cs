namespace Blocks.Secrets;

/// <summary>
/// The single entry point for secret management. Owns every domain rule: validation, tenant
/// and root scoping, access checks, status handling, rotation, lifecycle and audit.
/// </summary>
/// <remarks>
/// <para>
/// Callers must have a resolvable <see cref="Blocks.Genesis.BlocksContext"/>. In an API that
/// comes from the authenticated request; in a worker, wrap the call in
/// <c>BlocksContext.ExecuteInContext(...)</c>. A null context is a hard failure by design —
/// there is no ambient "system" identity that bypasses the access rules.
/// </para>
/// <para>
/// <see cref="GetValueAsync"/> and <see cref="GetValuesAsync"/> are the only methods that
/// return plaintext, and both are always audited. There is deliberately no <c>RevealAsync</c>
/// or <c>CopyAsync</c>: a UI reveal and a UI copy are the same privileged read, and giving
/// them separate methods would mean separate audit stories for the same act.
/// </para>
/// </remarks>
public interface ISecretService
{
    /// <summary>Creates a secret and returns its id.</summary>
    /// <exception cref="SecretValidationException">The request is invalid or the name is taken.</exception>
    /// <exception cref="SecretVaultException">The vault write failed; no metadata was written.</exception>
    Task<string> SetAsync(SetSecretRequest request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Creates several secrets, all-or-nothing, and returns a name-to-id map.
    /// </summary>
    /// <remarks>
    /// On any failure every secret already created in this call is compensated (vault delete
    /// plus metadata delete) before the exception propagates.
    /// </remarks>
    Task<IReadOnlyDictionary<string, string>> SetManyAsync(IReadOnlyCollection<SetSecretRequest> requests, CancellationToken cancellationToken = default);

    /// <summary>Reads metadata. Returns null when the secret does not exist in this tenant.</summary>
    Task<SecretResult?> GetAsync(string secretId, CancellationToken cancellationToken = default);

    /// <summary>Lists metadata for the calling tenant.</summary>
    Task<SecretListResult> FindAsync(SecretFilter filter, CancellationToken cancellationToken = default);

    /// <summary>Reads a plaintext value. Always audited.</summary>
    /// <exception cref="SecretNotFoundException">No such secret in this tenant, or its value is gone from the vault.</exception>
    /// <exception cref="SecretAccessDeniedException">The caller is not permitted to read this value.</exception>
    /// <exception cref="SecretStateException">The secret is locked or deleted.</exception>
    Task<string> GetValueAsync(string secretId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Reads several plaintext values. Each id is authorized independently; any denial fails
    /// the whole call.
    /// </summary>
    Task<IReadOnlyDictionary<string, string>> GetValuesAsync(IReadOnlyCollection<string> secretIds, CancellationToken cancellationToken = default);

    /// <summary>Updates name and description. Does not touch the value — use <see cref="RotateAsync"/>.</summary>
    Task UpdateAsync(string secretId, UpdateSecretRequest request, CancellationToken cancellationToken = default);

    /// <summary>Replaces the stored value.</summary>
    Task RotateAsync(string secretId, RotateSecretRequest request, CancellationToken cancellationToken = default);

    /// <summary>Makes the value unreadable while keeping the secret and its metadata.</summary>
    Task LockAsync(string secretId, CancellationToken cancellationToken = default);

    /// <summary>Returns a locked secret to active.</summary>
    Task UnlockAsync(string secretId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Soft-deletes the secret. The vault value is retained so <see cref="RestoreAsync"/> can
    /// work; reads are refused on status.
    /// </summary>
    Task DeleteAsync(string secretId, CancellationToken cancellationToken = default);

    /// <summary>Restores a soft-deleted secret, re-checking name uniqueness.</summary>
    Task RestoreAsync(string secretId, CancellationToken cancellationToken = default);

    /// <summary>Replaces the access list of an <see cref="SecretTypes.Api"/> secret.</summary>
    /// <exception cref="SecretValidationException">The secret is a Service secret, which has no access list.</exception>
    Task UpdateAccessAsync(string secretId, SecretAccess access, CancellationToken cancellationToken = default);

    /// <summary>Reads the audit trail for the calling tenant.</summary>
    Task<SecretAuditListResult> GetAuditLogsAsync(SecretAuditFilter filter, CancellationToken cancellationToken = default);
}
