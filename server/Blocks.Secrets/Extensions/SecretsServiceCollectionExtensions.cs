using Blocks.Genesis;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Blocks.Secrets;

public static class SecretsServiceCollectionExtensions
{
    /// <summary>
    /// Registers secret management: metadata and audit in the <c>SecretStore</c> database,
    /// values in Azure Key Vault.
    /// </summary>
    /// <remarks>
    /// Everything except the value store is <b>scoped</b>: these services read the
    /// request-scoped <see cref="BlocksContext"/>, so a singleton would capture whichever
    /// tenant resolved it first and serve that identity to every later caller. The value store
    /// is a singleton because its Key Vault client pools connections and caches tokens
    /// internally.
    /// </remarks>
    public static IServiceCollection AddBlocksSecrets(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.TryAddScoped<SecretStoreContext>();
        services.TryAddScoped<ISecretRepository, SecretRepository>();
        services.TryAddScoped<ISecretAuditRepository, SecretAuditRepository>();
        services.TryAddScoped<ISecretAuthorizationService, SecretAuthorizationService>();
        services.TryAddScoped<ISecretAuditService, SecretAuditService>();
        services.TryAddScoped<ISecretService, SecretService>();

        services.TryAddSingleton<ISecretValueStore, KeyVaultSecretValueStore>();

        return services;
    }
}
