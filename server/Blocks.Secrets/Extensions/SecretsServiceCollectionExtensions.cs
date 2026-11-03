using Blocks.Genesis;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Blocks.Secrets;

public static class SecretsServiceCollectionExtensions
{
    /// <summary>
    /// Registers secret management: metadata and audit in the <c>SecretStore</c> database, values
    /// in Azure Key Vault.
    /// </summary>
    /// <remarks>
    /// Values are never kept in the database, so a database read, dump or backup cannot expose
    /// them. There is no fallback store: a host without a vault still starts, and its first
    /// secret operation fails instead, because the vault store is built on first use.
    /// <para>
    /// Everything except the Key Vault store is <b>scoped</b>: these services read the
    /// request-scoped <see cref="BlocksContext"/>, so a singleton would capture whichever tenant
    /// resolved it first and serve that identity to every later caller. The Key Vault store is a
    /// singleton because its client pools connections and caches tokens internally.
    /// </para>
    /// </remarks>
    public static IServiceCollection AddBlocksSecrets(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.TryAddScoped<SecretStoreContext>();
        services.TryAddScoped<ISecretRepository, SecretRepository>();
        services.TryAddScoped<ISecretAuditRepository, SecretAuditRepository>();
        services.TryAddScoped<ISecretAuthorizationService, SecretAuthorizationService>();
        services.TryAddScoped<ISecretAuditService, SecretAuditService>();
        services.TryAddScoped<ISecretTagCatalogService, SecretTagCatalogService>();
        services.TryAddScoped<ISecretService, SecretService>();
        services.TryAddSingleton<ISecretValueStore, KeyVaultSecretValueStore>();

        return services;
    }
}
