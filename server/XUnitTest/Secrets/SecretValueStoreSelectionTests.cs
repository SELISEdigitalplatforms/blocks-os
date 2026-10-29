using System;
using Blocks.Secrets;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace XUnitTest.Secrets
{
    /// <summary>
    /// Which value store <c>AddBlocksSecrets()</c> picks, and that swapping it is a configuration
    /// change rather than a code change.
    /// </summary>
    public class SecretValueStoreSelectionTests
    {
        private const string StoreKey = "Secrets__ValueStore";
        private const string VaultKey = "KeyVault__KeyVaultUrl";

        /// <summary>
        /// Restores both variables afterwards. They are process-wide, so a test that leaves one set
        /// changes what every later test resolves.
        /// </summary>
        private sealed class EnvScope : IDisposable
        {
            private readonly string? _store = Environment.GetEnvironmentVariable(StoreKey);
            private readonly string? _vault = Environment.GetEnvironmentVariable(VaultKey);

            public EnvScope(string? store, string? vault)
            {
                Environment.SetEnvironmentVariable(StoreKey, store);
                Environment.SetEnvironmentVariable(VaultKey, vault);
            }

            public void Dispose()
            {
                Environment.SetEnvironmentVariable(StoreKey, _store);
                Environment.SetEnvironmentVariable(VaultKey, _vault);
            }
        }

        [Fact]
        public void NoVaultConfigured_FallsBackToTheDatabaseStore()
        {
            // The point of the fallback: an environment with no vault gets a working store instead
            // of a startup failure, and had nothing in a vault to lose.
            using var _ = new EnvScope(store: null, vault: null);

            SecretsServiceCollectionExtensions.ResolveValueStoreType()
                .Should().Be(SecretValueStoreType.Database);
        }

        [Fact]
        public void VaultConfigured_KeepsUsingKeyVault()
        {
            // No existing environment changes behaviour, and values already in a vault stay
            // readable, because the two stores keep their bytes in different places.
            using var _ = new EnvScope(store: null, vault: "https://example-vault.vault.azure.net/");

            SecretsServiceCollectionExtensions.ResolveValueStoreType()
                .Should().Be(SecretValueStoreType.KeyVault);
        }

        [Theory]
        [InlineData("Database", SecretValueStoreType.Database)]
        [InlineData("database", SecretValueStoreType.Database)]
        [InlineData("KeyVault", SecretValueStoreType.KeyVault)]
        [InlineData("keyvault", SecretValueStoreType.KeyVault)]
        public void ExplicitSetting_OverridesTheVaultInference(string configured, SecretValueStoreType expected)
        {
            using var _ = new EnvScope(store: configured, vault: "https://example-vault.vault.azure.net/");

            SecretsServiceCollectionExtensions.ResolveValueStoreType().Should().Be(expected);
        }

        [Fact]
        public void UnrecognisedSetting_FallsBackToTheVaultInference()
        {
            using var _ = new EnvScope(store: "nonsense", vault: "https://example-vault.vault.azure.net/");

            SecretsServiceCollectionExtensions.ResolveValueStoreType()
                .Should().Be(SecretValueStoreType.KeyVault);
        }

        [Fact]
        public void DatabaseStore_IsRegisteredScoped()
        {
            var services = new ServiceCollection();
            services.AddBlocksSecrets(SecretValueStoreType.Database);

            var descriptor = services.Single(d => d.ServiceType == typeof(ISecretValueStore));

            descriptor.ImplementationType.Should().Be(typeof(MongoSecretValueStore));

            // Scoped, not singleton: it reaches Mongo through the scoped SecretStoreContext, so a
            // singleton would capture the first caller's store context.
            descriptor.Lifetime.Should().Be(ServiceLifetime.Scoped);
        }

        [Fact]
        public void KeyVaultStore_StaysSingleton()
        {
            var services = new ServiceCollection();
            services.AddBlocksSecrets(SecretValueStoreType.KeyVault);

            var descriptor = services.Single(d => d.ServiceType == typeof(ISecretValueStore));

            descriptor.ImplementationType.Should().Be(typeof(KeyVaultSecretValueStore));
            descriptor.Lifetime.Should().Be(ServiceLifetime.Singleton);
        }

        [Fact]
        public void EitherStore_LeavesTheRestOfTheContractUnchanged()
        {
            // The swap is the value store and nothing else — ISecretService and its dependencies
            // are identical either way, which is what makes this a configuration change.
            var database = new ServiceCollection();
            database.AddBlocksSecrets(SecretValueStoreType.Database);

            var vault = new ServiceCollection();
            vault.AddBlocksSecrets(SecretValueStoreType.KeyVault);

            static IEnumerable<(Type Service, ServiceLifetime Lifetime)> Shape(ServiceCollection services) =>
                services
                    .Where(d => d.ServiceType != typeof(ISecretValueStore))
                    .Select(d => (d.ServiceType, d.Lifetime))
                    .OrderBy(d => d.ServiceType.FullName);

            Shape(database).Should().BeEquivalentTo(Shape(vault));

            database.Should().Contain(d => d.ServiceType == typeof(ISecretService) && d.Lifetime == ServiceLifetime.Scoped);
        }
    }
}
