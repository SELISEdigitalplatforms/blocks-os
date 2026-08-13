using Azure;
using Azure.Identity;
using Azure.Security.KeyVault.Secrets;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Blocks.Secrets;

/// <summary>
/// Azure Key Vault backed value store.
/// </summary>
/// <remarks>
/// Follows the same shape as <c>Identifier.DomainService</c>'s certificate upload: bind the
/// <c>KeyVault</c> environment section, take <c>KeyVaultUrl</c>, and authenticate with
/// <see cref="DefaultAzureCredential"/>.
/// <para>
/// Registered as a singleton — <see cref="SecretClient"/> is thread-safe and pools connections
/// and tokens internally, so building one per request would throw away that caching.
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
    /// Derives the vault key from a secret id. Never stored — recomputed on every call, so
    /// there is no vault coordinate in Mongo to leak.
    /// </summary>
    private static string ToVaultKey(string secretId) => $"{SecretDefaults.VaultKeyPrefix}-{secretId}";

    private static SecretClient CreateClient(ILogger logger)
    {
        var configuration = new ConfigurationBuilder().AddEnvironmentVariables().Build();
        var cloudConfig = new Dictionary<string, string>();
        configuration.GetSection("KeyVault").Bind(cloudConfig);
        cloudConfig.TryGetValue("KeyVaultUrl", out var keyVaultUrl);

        if (string.IsNullOrWhiteSpace(keyVaultUrl))
        {
            logger.LogError("KeyVault:KeyVaultUrl is missing. Secret management cannot start without it.");
            throw new InvalidOperationException(
                "Required Azure config value 'KeyVault:KeyVaultUrl' is missing. Please check your environment configuration.");
        }

        var credentialOptions = new DefaultAzureCredentialOptions();

        // A developer machine has no IMDS endpoint, so the managed-identity probe burns six
        // retries against an unreachable link-local address (169.254.169.254) before the chain
        // moves on — every vault write stalls for seconds and then fails outright. Azure hosts
        // keep it enabled; only Development opts out. Blocks.Genesis excludes it for the same
        // reason when reading startup configuration.
        if (string.Equals(
                Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"),
                "Development",
                StringComparison.OrdinalIgnoreCase))
        {
            credentialOptions.ExcludeManagedIdentityCredential = true;
        }

        return new SecretClient(new Uri(keyVaultUrl), new DefaultAzureCredential(credentialOptions));
    }
}
