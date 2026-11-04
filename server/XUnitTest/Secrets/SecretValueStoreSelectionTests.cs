using System;
using Blocks.Secrets;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace XUnitTest.Secrets
{
    /// <summary>
    /// <c>AddBlocksSecrets()</c> keeps values in Key Vault only. There is no database value store
    /// and no setting that switches to one.
    /// </summary>
    public class SecretValueStoreSelectionTests
    {
        private const string LegacyStoreKey = "Secrets__ValueStore";
        private const string VaultKey = "KeyVault__KeyVaultUrl";

        /// <summary>
        /// Restores both variables afterwards. They are process-wide, so a test that leaves one set
        /// changes what every later test resolves.
        /// </summary>
        private sealed class EnvScope : IDisposable
        {
            private readonly string? _store = Environment.GetEnvironmentVariable(LegacyStoreKey);
            private readonly string? _vault = Environment.GetEnvironmentVariable(VaultKey);

            public EnvScope(string? store, string? vault)
            {
                Environment.SetEnvironmentVariable(LegacyStoreKey, store);
                Environment.SetEnvironmentVariable(VaultKey, vault);
            }

            public void Dispose()
            {
                Environment.SetEnvironmentVariable(LegacyStoreKey, _store);
                Environment.SetEnvironmentVariable(VaultKey, _vault);
            }
        }

        private static ServiceDescriptor ValueStoreDescriptor()
        {
            var services = new ServiceCollection();
            services.AddBlocksSecrets();
            return services.Single(d => d.ServiceType == typeof(ISecretValueStore));
        }

        [Fact]
        public void KeyVaultStore_IsRegisteredAsSingleton()
        {
            var descriptor = ValueStoreDescriptor();

            descriptor.ImplementationType.Should().Be(typeof(KeyVaultSecretValueStore));
            descriptor.Lifetime.Should().Be(ServiceLifetime.Singleton);
        }

        [Theory]
        [InlineData(null, null)]
        [InlineData("Database", null)]
        [InlineData("database", "https://example-vault.vault.azure.net/")]
        public void NoSettingOrMissingVault_NeverSelectsAnotherStore(string? store, string? vault)
        {
            // Values must never land in the database: no vault URL and the old switch both still
            // resolve to Key Vault.
            using var _ = new EnvScope(store, vault);

            ValueStoreDescriptor().ImplementationType.Should().Be(typeof(KeyVaultSecretValueStore));
        }

        [Fact]
        public void Registration_DoesNotBuildTheVaultClient()
        {
            // A host without a vault must still start: the vault store is only built on first use.
            using var _ = new EnvScope(store: null, vault: null);

            var act = () => new ServiceCollection().AddBlocksSecrets().BuildServiceProvider();

            act.Should().NotThrow();
        }

        [Fact]
        public void AssemblyHasNoDatabaseValueStore()
        {
            var stores = typeof(ISecretValueStore).Assembly.GetTypes()
                .Where(t => typeof(ISecretValueStore).IsAssignableFrom(t) && !t.IsInterface && !t.IsAbstract);

            stores.Should().ContainSingle().Which.Should().Be(typeof(KeyVaultSecretValueStore));
        }

        [Fact]
        public void SecretService_StaysScoped()
        {
            var services = new ServiceCollection();
            services.AddBlocksSecrets();

            services.Should().Contain(d => d.ServiceType == typeof(ISecretService) && d.Lifetime == ServiceLifetime.Scoped);
        }
    }
}
