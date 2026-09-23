using Blocks.Genesis;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Blocks.Secrets;

/// <summary>Where secret values are kept.</summary>
public enum SecretValueStoreType
{
    /// <summary>Azure Key Vault. The intended production store.</summary>
    KeyVault = 0,

    /// <summary>
    /// The <c>SecretStore</c> database, unencrypted. An interim store for environments with no
    /// vault provisioned yet.
    /// </summary>
    Database = 1,
}

public static class SecretsServiceCollectionExtensions
{
    /// <summary>Environment key that selects the value store: <c>KeyVault</c> or <c>Database</c>.</summary>
    public const string ValueStoreConfigKey = "Secrets__ValueStore";

    /// <summary>
    /// Registers secret management: metadata and audit in the <c>SecretStore</c> database, values
    /// in Azure Key Vault or — where no vault is configured — in that same database.
    /// </summary>
    /// <remarks>
    /// Everything except the Key Vault store is <b>scoped</b>: these services read the
    /// request-scoped <see cref="BlocksContext"/>, so a singleton would capture whichever tenant
    /// resolved it first and serve that identity to every later caller. The Key Vault store is a
    /// singleton because its client pools connections and caches tokens internally; the database
    /// store is scoped because it reaches the store through the scoped
    /// <see cref="SecretStoreContext"/> and holds no connection of its own.
    /// </remarks>
    public static IServiceCollection AddBlocksSecrets(this IServiceCollection services) =>
        services.AddBlocksSecrets(ResolveValueStoreType());

    /// <param name="valueStore">
    /// Which value store to register. Callers normally use the overload without this and let the
    /// environment decide; passing it explicitly is for tests and for a host that has its own
    /// reason to pin the choice.
    /// </param>
    public static IServiceCollection AddBlocksSecrets(this IServiceCollection services, SecretValueStoreType valueStore)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.TryAddScoped<SecretStoreContext>();
        services.TryAddScoped<ISecretRepository, SecretRepository>();
        services.TryAddScoped<ISecretAuditRepository, SecretAuditRepository>();
        services.TryAddScoped<ISecretAuthorizationService, SecretAuthorizationService>();
        services.TryAddScoped<ISecretAuditService, SecretAuditService>();
        services.TryAddScoped<ISecretTagCatalogService, SecretTagCatalogService>();
        services.TryAddScoped<ISecretService, SecretService>();

        if (valueStore == SecretValueStoreType.Database)
        {
            services.TryAddScoped<ISecretValueStore, MongoSecretValueStore>();
        }
        else
        {
            services.TryAddSingleton<ISecretValueStore, KeyVaultSecretValueStore>();
        }

        return services;
    }

    /// <summary>
    /// Key Vault when one is configured, the database otherwise;
    /// <see cref="ValueStoreConfigKey"/> overrides both.
    /// </summary>
    /// <remarks>
    /// Inferring from the vault URL rather than defaulting to one store keeps this from changing
    /// any existing environment's behaviour. An environment with a vault keeps using it, and the
    /// values already in it stay readable; an environment without one gets a working store instead
    /// of a startup failure, and had nothing in a vault to lose. The two stores keep their bytes
    /// in different places, so a value written to one is invisible to the other — switching an
    /// environment that already holds values means re-entering them, not just setting a variable.
    /// <para>
    /// Read from the environment rather than <c>IConfiguration</c> to match
    /// <see cref="KeyVaultCredentialFactory"/>, which the value store itself already reads that
    /// way, so both halves of the decision come from one place.
    /// </para>
    /// </remarks>
    internal static SecretValueStoreType ResolveValueStoreType()
    {
        var configured = Environment.GetEnvironmentVariable(ValueStoreConfigKey);

        if (!string.IsNullOrWhiteSpace(configured)
            && Enum.TryParse<SecretValueStoreType>(configured, ignoreCase: true, out var parsed))
        {
            return parsed;
        }

        var vaultUrl = Environment.GetEnvironmentVariable("KeyVault__KeyVaultUrl");

        return string.IsNullOrWhiteSpace(vaultUrl)
            ? SecretValueStoreType.Database
            : SecretValueStoreType.KeyVault;
    }
}
