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
}
