using Azure.Core;
using Azure.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Blocks.Secrets;

/// <summary>
/// The vault URL and the credential to reach it with, resolved from configuration.
/// </summary>
/// <param name="VaultUri">Value of <c>KeyVault:KeyVaultUrl</c>.</param>
/// <param name="Credential">Credential to hand to a Key Vault client.</param>
/// <param name="UsesClientSecretFallback">
/// True when explicit client credentials were configured and chained behind the default chain.
/// </param>
public sealed record KeyVaultConnection(Uri VaultUri, TokenCredential Credential, bool UsesClientSecretFallback);

/// <summary>
/// Resolves how this host authenticates to Azure Key Vault.
/// </summary>
/// <remarks>
/// Reads the <c>KeyVault</c> environment section, matching the keys <c>Blocks.Genesis</c> already
/// uses so a deployment configured for Genesis needs no extra variables:
/// <list type="bullet">
///   <item><description><c>KeyVault__KeyVaultUrl</c> — required.</description></item>
///   <item><description><c>KeyVault__ClientId</c>, <c>KeyVault__ClientSecret</c>, <c>KeyVault__TenantId</c> —
///   optional; all three together enable the service-principal fallback.</description></item>
/// </list>
/// <para>
/// Without the fallback a host has to be logged in through the Azure CLI, Visual Studio, or a
/// managed identity — none of which exist on, say, a plain container or an on-prem box. With it,
/// such a host can authenticate with a client id and secret instead.
/// </para>
/// </remarks>
public static class KeyVaultCredentialFactory
{
    /// <summary>Environment section holding the Key Vault settings.</summary>
    public const string ConfigSection = "KeyVault";

    /// <summary>Resolves the connection from process environment variables.</summary>
    public static KeyVaultConnection Create(ILogger? logger = null)
        => Create(new ConfigurationBuilder().AddEnvironmentVariables().Build(), logger);

    /// <summary>Resolves the connection from an explicit configuration source.</summary>
    /// <exception cref="InvalidOperationException">The vault URL is missing or unusable.</exception>
    public static KeyVaultConnection Create(IConfiguration configuration, ILogger? logger = null)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        var cloudConfig = new Dictionary<string, string>();
        configuration.GetSection(ConfigSection).Bind(cloudConfig);

        cloudConfig.TryGetValue("KeyVaultUrl", out var keyVaultUrl);

        if (string.IsNullOrWhiteSpace(keyVaultUrl))
        {
            logger?.LogError("KeyVault:KeyVaultUrl is missing. Secret management cannot start without it.");
            throw new InvalidOperationException(
                "Required Azure config value 'KeyVault:KeyVaultUrl' is missing. Please check your environment configuration.");
        }

        if (!Uri.TryCreate(keyVaultUrl, UriKind.Absolute, out var vaultUri))
        {
            logger?.LogError("KeyVault:KeyVaultUrl is not an absolute URL.");
            throw new InvalidOperationException(
                "Azure config value 'KeyVault:KeyVaultUrl' is not an absolute URL. Please check your environment configuration.");
        }

        cloudConfig.TryGetValue("ClientId", out var clientId);
        cloudConfig.TryGetValue("ClientSecret", out var clientSecret);
        cloudConfig.TryGetValue("TenantId", out var tenantId);

        var usesClientSecret = HasClientSecretConfig(clientId, clientSecret, tenantId);
        var credential = CreateCredential(clientId, clientSecret, tenantId);

        logger?.LogInformation(
            "Key Vault credential resolved: {CredentialMode}.",
            usesClientSecret ? "default chain with client-credentials fallback" : "default chain");

        return new KeyVaultConnection(vaultUri, credential, usesClientSecret);
    }

    /// <summary>
    /// Builds the credential chain. Falls back to a service principal only when the client id,
    /// secret, and tenant id are all present — a half-filled set is ignored rather than used to
    /// build a credential guaranteed to fail.
    /// </summary>
    internal static TokenCredential CreateCredential(string? clientId, string? clientSecret, string? tenantId)
    {
        var defaultCredential = new DefaultAzureCredential(BuildDefaultOptions());

        if (!HasClientSecretConfig(clientId, clientSecret, tenantId))
        {
            return defaultCredential;
        }

        // Chained rather than probed up front: this runs inside a DI singleton constructor, which
        // is synchronous, so an eager GetTokenAsync would mean blocking the container build on a
        // network round trip and crashing the host on a transient AAD blip. ChainedTokenCredential
        // gives the same fallback lazily — it advances to the next credential on
        // CredentialUnavailableException, which is exactly what DefaultAzureCredential throws when
        // no CLI login, Visual Studio account, or managed identity is available.
        return new ChainedTokenCredential(defaultCredential, new ClientSecretCredential(tenantId, clientId, clientSecret));
    }

    private static DefaultAzureCredentialOptions BuildDefaultOptions()
    {
        var options = new DefaultAzureCredentialOptions();

        // A developer machine has no IMDS endpoint, so the managed-identity probe burns six
        // retries against an unreachable link-local address (169.254.169.254) before the chain
        // moves on — every vault call stalls for seconds first. Azure hosts keep it enabled;
        // only Development opts out.
        if (string.Equals(
                Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"),
                "Development",
                StringComparison.OrdinalIgnoreCase))
        {
            options.ExcludeManagedIdentityCredential = true;
        }

        return options;
    }

    private static bool HasClientSecretConfig(string? clientId, string? clientSecret, string? tenantId)
        => !string.IsNullOrWhiteSpace(clientId)
           && !string.IsNullOrWhiteSpace(clientSecret)
           && !string.IsNullOrWhiteSpace(tenantId);
}
