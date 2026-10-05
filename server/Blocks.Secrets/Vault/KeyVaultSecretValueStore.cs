using Azure;
using Azure.Security.KeyVault.Secrets;
using Microsoft.Extensions.Logging;

namespace Blocks.Secrets;

/// <summary>
/// Azure Key Vault backed value store.
/// </summary>
/// <remarks>
/// Binds the <c>KeyVault</c> environment section and authenticates with whatever
/// <see cref="KeyVaultCredentialFactory"/> resolves — the default Azure credential chain, with a
/// service-principal fallback when <c>ClientId</c>, <c>ClientSecret</c>, and <c>TenantId</c> are
/// configured.
/// <para>
/// Registered as a singleton — <see cref="SecretClient"/> is thread-safe and pools connections
/// and tokens internally, so building one per request would throw away that caching.
/// </para>
/// <para>
/// One vault per host, for every tenant the host serves. Metadata follows the tenant's Mongo
/// placement; a value kept here does not, so a deployment serving tenants across several
/// clusters puts all their values in the same vault. That is safe — vault keys are derived from
/// the globally unique secret id, so two tenants cannot collide — but it does mean the vault,
/// not the cluster, is the blast radius for values. An environment that needs values separated
/// per placement needs its own host and its own <c>KeyVault__KeyVaultUrl</c>, not a code change.
/// </para>
/// </remarks>
public sealed class KeyVaultSecretValueStore : ISecretValueStore
{
    private readonly ILogger<KeyVaultSecretValueStore> _logger;
    private readonly SecretClient _secretClient;

    public KeyVaultSecretValueStore(ILogger<KeyVaultSecretValueStore> logger)
    {
        _logger = logger;
        _secretClient = CreateClient(logger);
    }

    internal KeyVaultSecretValueStore(SecretClient secretClient, ILogger<KeyVaultSecretValueStore> logger)
    {
        _secretClient = secretClient;
        _logger = logger;
    }

    public async Task SetAsync(string secretId, string value, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(secretId);
        ArgumentNullException.ThrowIfNull(value);

        var key = ToVaultKey(secretId);

        try
        {
            await _secretClient.SetSecretAsync(new KeyVaultSecret(key, value), cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Failed to write secret {SecretId} to Key Vault.", secretId);
            throw new SecretVaultException("Failed to write the secret value to the vault.", "Set", secretId, ex);
        }
    }

    public async Task<string?> GetAsync(string secretId, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(secretId);

        var key = ToVaultKey(secretId);

        try
        {
            var response = await _secretClient.GetSecretAsync(key, cancellationToken: cancellationToken).ConfigureAwait(false);
            return response.Value.Value;
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
            // A missing value is a legitimate answer, not a transport failure.
            return null;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Deliberately not returning null or empty here: an empty string is a valid secret
            // value, so swallowing the error would let a caller authenticate with blank
            // credentials during a vault outage and never learn the read had failed.
            _logger.LogError(ex, "Failed to read secret {SecretId} from Key Vault.", secretId);
            throw new SecretVaultException("Failed to read the secret value from the vault.", "Get", secretId, ex);
        }
    }

    public async Task DeleteAsync(string secretId, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(secretId);

        var key = ToVaultKey(secretId);

        try
        {
            // Starts a soft-delete without purging. Purging would hold the name hostage for the
            // retention window, and the domain relies on being able to re-create ids freely.
            await _secretClient.StartDeleteSecretAsync(key, cancellationToken).ConfigureAwait(false);
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
            // Already gone.
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Failed to delete secret {SecretId} from Key Vault.", secretId);
            throw new SecretVaultException("Failed to delete the secret value from the vault.", "Delete", secretId, ex);
        }
    }

    /// <summary>
    /// Deletes the value, waits for Key Vault to finish, then purges it.
    /// </summary>
    /// <remarks>
    /// Key Vault only ever soft-deletes, and a purge issued while the delete is still in flight
    /// is refused with a conflict — hence the wait. A 404 on the delete is not the end of it: the
    /// value may already sit in the deleted state (a compensated create, or an earlier purge that
    /// stopped half way), so the purge still runs. A refused purge — purge protection, or no
    /// Purge permission — is reported as <see cref="SecretVaultOperations.Purge"/> so the caller
    /// can tell "deleted but still recoverable in the vault" from "not deleted at all".
    /// </remarks>
    public async Task PurgeAsync(string secretId, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(secretId);

        var key = ToVaultKey(secretId);

        try
        {
            var operation = await _secretClient.StartDeleteSecretAsync(key, cancellationToken).ConfigureAwait(false);
            await operation.WaitForCompletionAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
            // Not live. It may still be in the deleted state, so fall through to the purge.
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Failed to delete secret {SecretId} from Key Vault before purging.", secretId);
            throw new SecretVaultException("Failed to delete the secret value from the vault.", SecretVaultOperations.Delete, secretId, ex);
        }

        try
        {
            await _secretClient.PurgeDeletedSecretAsync(key, cancellationToken).ConfigureAwait(false);
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
            // Nothing in the deleted state either: already purged.
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex,
                "Secret {SecretId} was deleted from Key Vault but the purge failed; it stays recoverable in the vault " +
                "until its retention period ends. Check purge protection and the Purge permission.", secretId);
            throw new SecretVaultException("The secret value was deleted but could not be purged from the vault.", SecretVaultOperations.Purge, secretId, ex);
        }
    }

    /// <summary>
    /// Derives the vault key from a secret id. Never stored — recomputed on every call, so
    /// there is no vault coordinate in Mongo to leak.
    /// </summary>
    private static string ToVaultKey(string secretId) => $"{SecretDefaults.VaultKeyPrefix}-{secretId}";

    private static SecretClient CreateClient(ILogger logger)
    {
        var connection = KeyVaultCredentialFactory.Create(logger);

        return new SecretClient(connection.VaultUri, connection.Credential);
    }
}
