namespace Blocks.Secrets;

/// <summary>
/// Storage for plaintext secret values, keyed by secret id.
/// </summary>
/// <remarks>
/// The only seam through which a value ever leaves or enters the domain. Tests substitute this
/// rather than reaching for a live vault.
/// </remarks>
public interface ISecretValueStore
{
    Task SetAsync(string secretId, string value, CancellationToken cancellationToken = default);

    /// <summary>Returns the current value, or null when no value is stored under this id.</summary>
    Task<string?> GetAsync(string secretId, CancellationToken cancellationToken = default);

    /// <summary>Deletes the value. Deleting an absent value is a no-op.</summary>
    Task DeleteAsync(string secretId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes the value permanently, leaving nothing a vault-side recovery could bring back.
    /// Purging an absent value is a no-op.
    /// </summary>
    /// <exception cref="SecretVaultException">
    /// The value could not be removed. <see cref="SecretVaultException.Operation"/> is
    /// <see cref="SecretVaultOperations.Purge"/> when the value was deleted but the vault refused
    /// the final purge — it is unreadable, and the vault discards it when its retention ends.
    /// </exception>
    Task PurgeAsync(string secretId, CancellationToken cancellationToken = default);
}

/// <summary>Operation names carried on <see cref="SecretVaultException.Operation"/>.</summary>
public static class SecretVaultOperations
{
    public const string Delete = "Delete";

    /// <summary>The value is deleted but the vault's final purge step failed.</summary>
    public const string Purge = "Purge";
}
