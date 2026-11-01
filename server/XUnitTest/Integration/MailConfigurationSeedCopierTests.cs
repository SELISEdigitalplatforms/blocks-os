using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using Blocks.Secrets;
using Configuration.DomainService.Mail.Providers;
using DomainService.Projects;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;
using XUnitTest.Services;
using XUnitTest.TestSupport;

namespace XUnitTest.Integration
{
    /// <summary>
    /// New project: seed mail configurations copied with secrets of the project's own tenant. Seed and project docs in
    /// real Mongo, secrets in <see cref="FakeSecrets"/>, which records the tenant of every call.
    /// </summary>
    [Collection(MongoIntegrationCollection.Name)]
    public class MailConfigurationSeedCopierTests
    {
        private const string RootTenant = "root-tenant";
        private const string ProjectTenant = "project-tenant";
        private const string Creator = "creator";
        private const string SeedPassword = "seed-mailbox-pw";
        private const string SeedReference = "root-ref-7f3a";

        private readonly MongoIntegrationFixture _fixture;
        private readonly List<string> _calls = new();
        private readonly FakeSecrets _secrets;
        private readonly RecordingLogger<MailConfigurationSeedCopier> _logger = new();
        private readonly string _tag = Guid.NewGuid().ToString("N")[..8];

        public MailConfigurationSeedCopierTests(MongoIntegrationFixture fixture)
        {
            _fixture = fixture;
            _secrets = new FakeSecrets(_calls);
        }

        private IMongoDatabase SeedDb => _fixture.DbContextProvider.GetDatabase("", "mseed-" + _tag);

        private IMongoDatabase ProjectDb => _fixture.DbContextProvider.GetDatabase("", "mproj-" + _tag);

        private IMongoCollection<BsonDocument> ProjectConfigs => ProjectDb.GetCollection<BsonDocument>(MailConfigurationSeedCopier.CollectionName);

        private Task CopyAsync(string? rootTenantId = RootTenant)
        {
            var services = new ServiceCollection().AddScoped<ISecretService>(_ => _secrets).BuildServiceProvider();
            var copier = new MailConfigurationSeedCopier(services.GetRequiredService<IServiceScopeFactory>(), _logger);
            return copier.CopyAsync(SeedDb, ProjectDb, rootTenantId, ProjectTenant, Creator);
        }

        private Task SeedAsync(params BsonDocument[] configurations) =>
            SeedDb.GetCollection<BsonDocument>(MailConfigurationSeedCopier.CollectionName).InsertManyAsync(configurations);

        private Task<BsonDocument> ProjectConfigAsync(string id) => ProjectConfigs.Find(new BsonDocument("_id", id)).SingleAsync();

        private void RootSecret(string status = SecretStatuses.Active) => _secrets.Items[SeedReference] = (status, SeedPassword);

        private static BsonDocument PasswordConfig(string id, string password = "", string? reference = null)
        {
            var configuration = new BsonDocument
            {
                { "_id", id }, { "Name", "Default" }, { "Host", "email-smtp.eu-west-1.amazonaws.com" }, { "Port", 587 },
                { "SenderUserName", "smtp-user" }, { "AccountPassword", password }, { "AuthenticationType", 0 },
                { "IsDefault", true }, { "Provider", 1 }, { "CreatedBy", "seed-admin" }, { "LastUpdatedBy", "seed-admin" },
            };
            if (reference is not null)
                configuration["AccountPasswordReference"] = reference;
            return configuration;
        }

        // ---------- the credential ----------

        [Fact]
        public async Task SeedWithAPassword_ProjectGetsItsOwnSecret_AndNoPlaintext()
        {
            await SeedAsync(PasswordConfig("cfg-1", password: SeedPassword));

            await CopyAsync();

            var copy = await ProjectConfigAsync("cfg-1");
            copy["AccountPassword"].AsString.Should().BeEmpty();
            _secrets.Items[copy["AccountPasswordReference"].AsString].Value.Should().Be(SeedPassword);
            _secrets.SetTenants.Should().Equal(ProjectTenant);
            _secrets.SetRequests.Single().Should().Match<SetSecretRequest>(r =>
                r.Name == "mail-password" && r.Type == SecretTypes.Service
                && r.Description == "Mailbox password for mail configuration Default (cfg-1).");
            _calls.Should().NotContain("secret.GetValue");
        }

        [Fact]
        public async Task SeedWithAReference_IsReadInTheRootTenant_AndStoredAgainForTheProject()
        {
            RootSecret();
            await SeedAsync(PasswordConfig("cfg-1", reference: SeedReference));

            await CopyAsync();

            var reference = (await ProjectConfigAsync("cfg-1"))["AccountPasswordReference"].AsString;
            reference.Should().NotBe(SeedReference);
            _secrets.Items[reference].Value.Should().Be(SeedPassword);
            _secrets.GetValueTenants.Should().Equal(RootTenant);
            _secrets.SetTenants.Should().Equal(ProjectTenant);
            _calls.Should().Equal("secret.GetValue", "secret.Set");
        }

        [Theory]
        [InlineData(1)]
        [InlineData("OAuthClientCredentials")]
        public async Task Office365OAuthSeed_ClientSecretIsStoredAgainForTheProject(object authenticationType)
        {
            _secrets.Items[SeedReference] = (SecretStatuses.Active, "o365-client-secret");
            await SeedAsync(new BsonDocument
            {
                { "_id", "cfg-o" }, { "Name", "O365" }, { "AuthenticationType", BsonValue.Create(authenticationType) },
                { "ClientId", "client" }, { "ClientSecretReference", SeedReference }, { "AccountPassword", "" },
            });

            await CopyAsync();

            var copy = await ProjectConfigAsync("cfg-o");
            var reference = copy["ClientSecretReference"].AsString;
            reference.Should().NotBe(SeedReference);
            _secrets.Items[reference].Value.Should().Be("o365-client-secret");
            copy.Contains("AccountPasswordReference").Should().BeFalse();
            _secrets.GetValueTenants.Should().Equal(RootTenant);
            _secrets.SetRequests.Single().Should().Match<SetSecretRequest>(r =>
                r.Name == "office365-smtp" && r.Description == "SMTP Office 365 client secret for mail configuration O365 (cfg-o).");
        }

        [Fact]
        public async Task SeedWithoutAPassword_IsCopiedWithoutASecret()
        {
            await SeedAsync(PasswordConfig("cfg-1"));

            await CopyAsync();

            (await ProjectConfigAsync("cfg-1")).Contains("AccountPasswordReference").Should().BeFalse();
            _calls.Should().BeEmpty();
        }

        // ---------- the document ----------

        [Fact]
        public async Task Copy_KeepsTheSeedsIdAndSettings_AndIsOwnedByTheCreator()
        {
            await SeedAsync(PasswordConfig("cfg-1", password: SeedPassword));

            await CopyAsync();

            var copy = await ProjectConfigAsync("cfg-1");
            copy["Host"].AsString.Should().Be("email-smtp.eu-west-1.amazonaws.com");
            copy["Port"].AsInt32.Should().Be(587);
            copy["SenderUserName"].AsString.Should().Be("smtp-user");
            copy["IsDefault"].AsBoolean.Should().BeTrue();
            copy["CreatedBy"].AsString.Should().Be(Creator);
            copy["LastUpdatedBy"].AsString.Should().Be(Creator);
        }

        [Fact]
        public async Task ConfigurationTheProjectHas_IsLeftAlone_AndARetryCreatesNoSecret()
        {
            await SeedAsync(PasswordConfig("cfg-1", password: SeedPassword), PasswordConfig("cfg-2", password: SeedPassword));
            await ProjectConfigs.InsertOneAsync(new BsonDocument { { "_id", "cfg-1" }, { "Name", "changed by the project" } });

            await CopyAsync();
            await CopyAsync();

            (await ProjectConfigAsync("cfg-1"))["Name"].AsString.Should().Be("changed by the project");
            (await ProjectConfigAsync("cfg-2"))["AccountPasswordReference"].AsString.Should().NotBeEmpty();
            _secrets.SetRequests.Should().ContainSingle();
        }

        // ---------- failures ----------

        [Theory]
        [InlineData(false, nameof(SecretNotFoundException))]
        [InlineData(true, nameof(SecretStateException))]
        public async Task UnreadableSeedSecret_ThatConfigurationIsCopiedWithoutCredential_TheOthersStillAre(bool locked, string errorType)
        {
            if (locked)
                RootSecret(SecretStatuses.Locked);
            await SeedAsync(PasswordConfig("cfg-1", reference: SeedReference), PasswordConfig("cfg-2", password: SeedPassword));

            await CopyAsync();

            var broken = await ProjectConfigAsync("cfg-1");
            broken.Contains("AccountPasswordReference").Should().BeFalse();
            broken["AccountPassword"].AsString.Should().BeEmpty();
            (await ProjectConfigAsync("cfg-2"))["AccountPasswordReference"].AsString.Should().NotBeEmpty();
            _secrets.SetRequests.Should().ContainSingle();
            _logger.Entries.Should().Contain(e => e.Level == LogLevel.Error && e.Message.Contains("cfg-1") && e.Message.Contains(errorType));
            _logger.Entries.Should().OnlyContain(e => !e.Message.Contains(SeedReference) && !e.Message.Contains(SeedPassword) && e.Exception == null);
        }

        [Fact]
        public async Task NoRootTenantConfigured_AReferencedSeedIsCopiedWithoutCredential_APasswordSeedStillGetsItsSecret()
        {
            RootSecret();
            await SeedAsync(PasswordConfig("cfg-1", reference: SeedReference), PasswordConfig("cfg-2", password: SeedPassword));

            await CopyAsync(rootTenantId: null);

            (await ProjectConfigAsync("cfg-1")).Contains("AccountPasswordReference").Should().BeFalse();
            (await ProjectConfigAsync("cfg-2"))["AccountPasswordReference"].AsString.Should().NotBeEmpty();
            _calls.Should().NotContain("secret.GetValue");
            _logger.Entries.Should().Contain(e => e.Level == LogLevel.Error && e.Message.Contains(MailConfigurationSeedCopier.NoRootTenantFailure));
        }

        [Fact]
        public async Task VaultUnavailable_FailsTheCopy_WritesNothing_AndARetryCompletesIt()
        {
            RootSecret();
            await SeedAsync(PasswordConfig("cfg-1", reference: SeedReference));
            _secrets.GetValueThrows = new SecretVaultException("down", "get", SeedReference);

            var act = () => CopyAsync();

            await act.Should().ThrowAsync<SecretVaultException>();
            (await ProjectConfigs.CountDocumentsAsync(FilterDefinition<BsonDocument>.Empty)).Should().Be(0);
            _secrets.SetRequests.Should().BeEmpty();

            _secrets.GetValueThrows = null;
            await CopyAsync();

            _secrets.Items[(await ProjectConfigAsync("cfg-1"))["AccountPasswordReference"].AsString].Value.Should().Be(SeedPassword);
        }

        [Fact]
        public async Task LostInsert_DeletesTheSecretItCreated_AndKeepsTheOtherRunsDocument()
        {
            await SeedAsync(PasswordConfig("cfg-1", password: SeedPassword));
            // A parallel run writes the document between our secret and our insert.
            _secrets.AfterSet = () => ProjectConfigs.InsertOne(new BsonDocument { { "_id", "cfg-1" }, { "Name", "parallel run" } });

            await CopyAsync();

            _secrets.Deleted.Should().Equal(_secrets.Items.Keys.Single());
            _secrets.DeleteTenants.Should().Equal(ProjectTenant);
            (await ProjectConfigAsync("cfg-1"))["Name"].AsString.Should().Be("parallel run");
        }

        [Fact]
        public async Task LostInsert_SecretDeleteFails_IsLoggedByTypeOnly_AndTheCopyStillCompletes()
        {
            await SeedAsync(PasswordConfig("cfg-1", password: SeedPassword));
            _secrets.AfterSet = () => ProjectConfigs.InsertOne(new BsonDocument { { "_id", "cfg-1" }, { "Name", "parallel run" } });
            var failure = new SecretVaultException("vault unavailable", "delete", "orphan-ref");
            _secrets.DeleteThrows = failure;

            await CopyAsync();

            _secrets.DeleteTenants.Should().Equal(ProjectTenant);
            (await ProjectConfigAsync("cfg-1"))["Name"].AsString.Should().Be("parallel run");
            _logger.Entries.Should().Contain(e => e.Level == LogLevel.Error && e.Message.Contains(nameof(SecretVaultException)));
            _logger.Entries.Should().OnlyContain(e => e.Exception == null && !e.Message.Contains(failure.Message) && !e.Message.Contains("orphan-ref"));
        }

        // ---------- drift ----------

        [Fact]
        public void SecretNames_MatchTheConsoleMailProviders()
        {
            MailConfigurationSeedCopier.PasswordSecretName.Should().Be(LinkedPasswordCredential.SecretName);
            typeof(Office365SmtpMailConfigurationProvider)
                .GetField("SecretName", BindingFlags.NonPublic | BindingFlags.Static)!
                .GetValue(null).Should().Be(MailConfigurationSeedCopier.ClientSecretName);
        }
    }
}
