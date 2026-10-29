using System;
using System.Collections.Generic;
using Azure.Identity;
using Blocks.Secrets;
using FluentAssertions;
using Microsoft.Extensions.Configuration;

namespace XUnitTest.Secrets
{
    /// <summary>
    /// Serialized: the managed-identity rule and the environment-variable overload both read
    /// process-wide state, so these cannot run alongside each other.
    /// </summary>
    [CollectionDefinition(Name, DisableParallelization = true)]
    public class KeyVaultEnvironmentCollection
    {
        public const string Name = "KeyVaultEnvironment";
    }

    [Collection(KeyVaultEnvironmentCollection.Name)]
    public class KeyVaultCredentialFactoryTests
    {
        private const string ValidUrl = "https://unit-test-vault.vault.azure.net/";
        private const string ClientId = "00000000-0000-0000-0000-000000000001";
        private const string TenantId = "00000000-0000-0000-0000-000000000002";
        private const string ClientSecret = "not-a-real-secret-value";

        private static IConfiguration Config(params (string Key, string? Value)[] entries)
        {
            var values = new Dictionary<string, string?>();
            foreach (var (key, value) in entries)
            {
                values[$"KeyVault:{key}"] = value;
            }

            return new ConfigurationBuilder().AddInMemoryCollection(values).Build();
        }

        [Fact]
        public void Create_MissingKeyVaultUrl_Throws()
        {
            var act = () => KeyVaultCredentialFactory.Create(Config(("ClientId", ClientId)));

            act.Should().Throw<InvalidOperationException>().WithMessage("*KeyVault:KeyVaultUrl*");
        }

        [Fact]
        public void Create_BlankKeyVaultUrl_Throws()
        {
            var act = () => KeyVaultCredentialFactory.Create(Config(("KeyVaultUrl", "   ")));

            act.Should().Throw<InvalidOperationException>().WithMessage("*KeyVault:KeyVaultUrl*");
        }

        [Fact]
        public void Create_RelativeKeyVaultUrl_Throws()
        {
            var act = () => KeyVaultCredentialFactory.Create(Config(("KeyVaultUrl", "not-a-url")));

            act.Should().Throw<InvalidOperationException>().WithMessage("*absolute URL*");
        }

        [Fact]
        public void Create_UrlOnly_UsesDefaultChainWithoutFallback()
        {
            var connection = KeyVaultCredentialFactory.Create(Config(("KeyVaultUrl", ValidUrl)));

            connection.VaultUri.Should().Be(new Uri(ValidUrl));
            connection.UsesClientSecretFallback.Should().BeFalse();
            connection.Credential.Should().BeOfType<DefaultAzureCredential>();
        }

        [Fact]
        public void Create_FullClientCredentials_ChainsServicePrincipalBehindDefault()
        {
            var connection = KeyVaultCredentialFactory.Create(Config(
                ("KeyVaultUrl", ValidUrl),
                ("ClientId", ClientId),
                ("ClientSecret", ClientSecret),
                ("TenantId", TenantId)));

            connection.VaultUri.Should().Be(new Uri(ValidUrl));
            connection.UsesClientSecretFallback.Should().BeTrue();
            connection.Credential.Should().BeOfType<ChainedTokenCredential>();
        }

        [Theory]
        // A half-filled set is ignored rather than used to build a credential guaranteed to fail.
        [InlineData(ClientId, null, null)]
        [InlineData(ClientId, ClientSecret, null)]
        [InlineData(ClientId, null, TenantId)]
        [InlineData(null, ClientSecret, TenantId)]
        [InlineData(ClientId, "   ", TenantId)]
        public void Create_PartialClientCredentials_FallsBackToDefaultChainOnly(string? clientId, string? clientSecret, string? tenantId)
        {
            var connection = KeyVaultCredentialFactory.Create(Config(
                ("KeyVaultUrl", ValidUrl),
                ("ClientId", clientId),
                ("ClientSecret", clientSecret),
                ("TenantId", tenantId)));

            connection.UsesClientSecretFallback.Should().BeFalse();
            connection.Credential.Should().BeOfType<DefaultAzureCredential>();
        }

        [Fact]
        public void Create_ReadsFromEnvironmentVariables_WhenNoConfigurationGiven()
        {
            var original = new Dictionary<string, string?>
            {
                ["KeyVault__KeyVaultUrl"] = Environment.GetEnvironmentVariable("KeyVault__KeyVaultUrl"),
                ["KeyVault__ClientId"] = Environment.GetEnvironmentVariable("KeyVault__ClientId"),
                ["KeyVault__ClientSecret"] = Environment.GetEnvironmentVariable("KeyVault__ClientSecret"),
                ["KeyVault__TenantId"] = Environment.GetEnvironmentVariable("KeyVault__TenantId"),
            };

            try
            {
                Environment.SetEnvironmentVariable("KeyVault__KeyVaultUrl", ValidUrl);
                Environment.SetEnvironmentVariable("KeyVault__ClientId", ClientId);
                Environment.SetEnvironmentVariable("KeyVault__ClientSecret", ClientSecret);
                Environment.SetEnvironmentVariable("KeyVault__TenantId", TenantId);

                var connection = KeyVaultCredentialFactory.Create();

                connection.VaultUri.Should().Be(new Uri(ValidUrl));
                connection.UsesClientSecretFallback.Should().BeTrue();
                connection.Credential.Should().BeOfType<ChainedTokenCredential>();
            }
            finally
            {
                foreach (var (key, value) in original)
                {
                    Environment.SetEnvironmentVariable(key, value);
                }
            }
        }

        [Theory]
        [InlineData("Development")]
        [InlineData("Production")]
        [InlineData(null)]
        public void CreateCredential_BuildsDefaultChain_RegardlessOfEnvironment(string? environmentName)
        {
            // The managed-identity exclusion is internal to DefaultAzureCredentialOptions and not
            // observable after construction; what matters here is that neither branch throws.
            var original = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");

            try
            {
                Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", environmentName);

                KeyVaultCredentialFactory.CreateCredential(null, null, null)
                    .Should().BeOfType<DefaultAzureCredential>();

                KeyVaultCredentialFactory.CreateCredential(ClientId, ClientSecret, TenantId)
                    .Should().BeOfType<ChainedTokenCredential>();
            }
            finally
            {
                Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", original);
            }
        }
    }
}
