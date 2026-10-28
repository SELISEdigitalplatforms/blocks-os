using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis.Entities.Os;
using Blocks.Secrets;
using Configuration.DomainService.Mail.Providers;
using Configuration.DomainService.Mail.RequestModel;
using Configuration.DomainService.Mail.Services;
using Configuration.DomainService.Mail.Validators;
using Configuration.DomainService.Shared.Secrets;
using Configuration.DomainService.Shared.Services;
using FluentAssertions;
using FluentValidation;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using XUnitTest.TestSupport;

namespace XUnitTest.Services
{
    /// <summary>
    /// Mailbox passwords as linked secrets (blocks-os#710), through the real orchestrator,
    /// validator and provider definitions.
    /// </summary>
    /// <remarks>
    /// The secret store is a <b>strict</b> mock, but strictness alone does not fail a test: the
    /// production catch-alls (status resolution, compensation, restore) swallow the
    /// <c>MockException</c> an unexpected call throws. What pins each path's exact secret-call
    /// budget (spec §5), on success and on failure alike, is that every test that reaches the
    /// store ends with <c>VerifyNoOtherCalls</c>: Moq records the invocation before the strict check.
    /// </remarks>
    public class MailPasswordSecretTests
    {
        private const string SourcePassword = "zoho-app-pw";

        private readonly Mock<IConfigurationRepository> _repo = new();
        private readonly Mock<ISecretService> _secrets = new(MockBehavior.Strict);
        private readonly RecordingLogger<AmazonSesMailConfigurationProvider> _sesLogger = new();
        private readonly RecordingLogger<ZohoMailConfigurationProvider> _zohoLogger = new();
        private readonly RecordingLogger<GmailMailConfigurationProvider> _gmailLogger = new();
        private readonly RecordingLogger<Office365SmtpMailConfigurationProvider> _office365Logger = new();
        private readonly RecordingLogger<MailConfigurationService> _serviceLogger = new();
        private readonly List<SetSecretRequest> _created = new();
        private readonly List<MailServerConfiguration> _saved = new();

        public MailPasswordSecretTests()
        {
            _repo.Setup(r => r.GetMailConfigurationByNameAsync(It.IsAny<string>()))
                 .ReturnsAsync((MailServerConfiguration?)null);
            _repo.Setup(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()))
                 .Callback<MailServerConfiguration>(_saved.Add)
                 .Returns(Task.CompletedTask);
            _repo.Setup(r => r.DeleteMailConfigurationAsync(It.IsAny<string>()))
                 .Returns(Task.CompletedTask);
            _repo.Setup(r => r.UpdateMailSenderNameAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<string>()))
                 .Returns(Task.CompletedTask);
        }

        private MailConfigurationService Service()
        {
            IValidator<MailConfiguration> validator = new MailConfigurationValidator(_repo.Object);

            var registry = new MailConfigurationProviderRegistry(new IMailConfigurationProvider[]
            {
                new AmazonSesMailConfigurationProvider(_secrets.Object, _sesLogger),
                new ZohoMailConfigurationProvider(_secrets.Object, _zohoLogger),
                new GmailMailConfigurationProvider(_secrets.Object, _gmailLogger),
                new Office365SmtpMailConfigurationProvider(_secrets.Object, _office365Logger)
            });

            return new MailConfigurationService(_repo.Object, registry, validator, _serviceLogger);
        }

        // ---------- secret store setups ----------

        private void GivenSetReturns(string id) =>
            _secrets.Setup(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()))
                    .Callback<SetSecretRequest, CancellationToken>((request, _) => _created.Add(request))
                    .ReturnsAsync(id);

        /// <summary>The metadata read: a status, or null for "no such secret".</summary>
        private void GivenStatus(string? status) =>
            _secrets.Setup(s => s.GetAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                    .ReturnsAsync((string id, CancellationToken _) =>
                        status is null ? null : new SecretResult { SecretId = id, Name = "mail-password", Status = status });

        private void GivenRotateSucceeds() =>
            _secrets.Setup(s => s.RotateAsync(It.IsAny<string>(), It.IsAny<RotateSecretRequest>(), It.IsAny<CancellationToken>()))
                    .Returns(Task.CompletedTask);

        private void GivenDeleteSucceeds() =>
            _secrets.Setup(s => s.DeleteAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                    .Returns(Task.CompletedTask);

        // ---------- fixtures ----------

        private static MailConfiguration ZohoRequest(string configurationId = "", string password = SourcePassword) => new()
        {
            ConfigurationId = configurationId,
            ConfigurationName = "Zoho Primary",
            Provider = MailServiceProvider.Zoho,
            Host = "smtp.zoho.com",
            Port = 465,
            EnableSSL = true,
            SenderName = "Contoso",
            SenderAddress = "noreply@contoso.com",
            SenderUserName = "zohouser",
            AccountPassword = password
        };

        private static MailConfiguration RequestFor(MailServiceProvider provider) => provider switch
        {
            MailServiceProvider.AmazonSes => new MailConfiguration
            {
                ConfigurationName = "SES Primary",
                Provider = provider,
                Host = "email-smtp.eu-central-1.amazonaws.com",
                Port = 587,
                SenderName = "Contoso",
                SenderAddress = "noreply@contoso.com",
                SenderUserName = "ses-user",
                AccountPassword = "ses-password"
            },
            MailServiceProvider.Gmail => new MailConfiguration
            {
                ConfigurationName = "Gmail Primary",
                Provider = provider,
                SenderName = "Contoso",
                SenderAddress = "noreply@contoso.com",
                SenderUserName = "someone@gmail.com",
                AccountPassword = "gmail-app-pw"
            },
            MailServiceProvider.Office365Smtp => Office365PasswordRequest(),
            _ => ZohoRequest()
        };

        private static MailConfiguration Office365PasswordRequest(string configurationId = "") => new()
        {
            ConfigurationId = configurationId,
            ConfigurationName = "Microsoft 365 Basic",
            Provider = MailServiceProvider.Office365Smtp,
            AuthenticationType = MailAuthenticationType.Password,
            SenderName = "Contoso Support",
            SenderAddress = "support@contoso.com",
            SenderUserName = "support@contoso.com",
            AccountPassword = "o365-password"
        };

        private static MailServerConfiguration StoredZoho(string? reference = "pw-1", string password = "") => new()
        {
            ItemId = "zoho-1",
            Name = "Zoho Primary",
            Provider = MailServiceProvider.Zoho,
            Host = "smtp.zoho.com",
            Port = 465,
            EnableSSL = true,
            SenderName = "Contoso",
            SenderAddress = "noreply@contoso.com",
            SenderUserName = "zohouser",
            AccountPassword = password,
            AccountPasswordReference = reference
        };

        private static MailServerConfiguration StoredOffice365Password(string? reference = "pw-o365") => new()
        {
            ItemId = "o365-pw",
            Name = "Microsoft 365 Basic",
            Provider = MailServiceProvider.Office365Smtp,
            AuthenticationType = MailAuthenticationType.Password,
            Host = "smtp.office365.com",
            Port = 587,
            SecurityMode = MailSecurityMode.StartTls,
            SenderName = "Contoso Support",
            SenderAddress = "support@contoso.com",
            SenderUserName = "support@contoso.com",
            AccountPassword = "",
            AccountPasswordReference = reference
        };

        private void GivenStored(MailServerConfiguration stored) =>
            _repo.Setup(r => r.GetMailConfigurationByIdAsync(stored.ItemId)).ReturnsAsync(stored);

        /// <summary>
        /// A fresh copy on every read, as the database returns. Needed where a test reads the
        /// record back after the service has mutated the instance it loaded.
        /// </summary>
        private void GivenStoredFreshEachRead(string itemId, Func<MailServerConfiguration> stored) =>
            _repo.Setup(r => r.GetMailConfigurationByIdAsync(itemId)).ReturnsAsync(stored);

        /// <summary>
        /// The configuration write throws, but the document it sent was applied (a lost
        /// acknowledgement): a read-back by id returns it.
        /// </summary>
        private void GivenWriteAppliedButThrows()
        {
            var applied = new Dictionary<string, string?>();
            _repo.Setup(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()))
                 .Callback<MailServerConfiguration>(m => applied[m.ItemId] = m.AccountPasswordReference)
                 .ThrowsAsync(new TimeoutException("acknowledgement lost"));
            _repo.Setup(r => r.GetMailConfigurationByIdAsync(It.Is<string>(id => applied.ContainsKey(id))))
                 .ReturnsAsync((string id) => new MailServerConfiguration
                 {
                     ItemId = id,
                     Provider = MailServiceProvider.Zoho,
                     AccountPassword = "",
                     AccountPasswordReference = applied[id]
                 });
        }

        /// <summary>A stored, referenced record of <paramref name="provider"/>, matching <see cref="RequestFor"/>.</summary>
        private static MailServerConfiguration StoredFor(MailServiceProvider provider, string reference)
        {
            if (provider == MailServiceProvider.Office365Smtp)
            {
                return StoredOffice365Password(reference);
            }

            var stored = StoredZoho(reference);
            stored.ItemId = provider + "-1";
            stored.Name = RequestFor(provider).ConfigurationName;
            stored.Provider = provider;
            return stored;
        }

        private IEnumerable<(LogLevel Level, string Message, Exception? Exception)> ProviderLogEntries(MailServiceProvider provider) => provider switch
        {
            MailServiceProvider.AmazonSes => _sesLogger.Entries,
            MailServiceProvider.Gmail => _gmailLogger.Entries,
            MailServiceProvider.Office365Smtp => _office365Logger.Entries,
            _ => _zohoLogger.Entries
        };

        /// <summary>Every log line as a sink would render it: the message and any exception passed with it.</summary>
        private IEnumerable<string> AllLogMessages() =>
            _zohoLogger.Entries.Select(e => e.Message + " " + e.Exception)
                .Concat(_sesLogger.Entries.Select(e => e.Message + " " + e.Exception))
                .Concat(_gmailLogger.Entries.Select(e => e.Message + " " + e.Exception))
                .Concat(_office365Logger.Entries.Select(e => e.Message + " " + e.Exception))
                .Concat(_serviceLogger.Entries.Select(e => e.Message + " " + e.Exception));

        /// <summary>A store failure whose message, like a real not-found or vault error, names the secret.</summary>
        private static SecretVaultException VaultFailureNaming(string secretId) =>
            new("down", "Delete", secretId, new InvalidOperationException($"https://vault.example/secrets/{secretId} unreachable"));

        // ---------- H2 / H3: create ----------

        [Theory]
        [InlineData(MailServiceProvider.AmazonSes, "ses-password")]
        [InlineData(MailServiceProvider.Zoho, SourcePassword)]
        [InlineData(MailServiceProvider.Gmail, "gmail-app-pw")]
        [InlineData(MailServiceProvider.Office365Smtp, "o365-password")]
        public async Task Save_NewPasswordConfiguration_CreatesOneServiceSecretAndStoresOnlyItsReference(
            MailServiceProvider provider, string password)
        {
            using var _ = new BlocksTestContext();
            GivenSetReturns("pw-new");

            var result = await Service().SaveAsync(RequestFor(provider));

            result.Outcome.Should().Be(MailConfigurationOutcome.Success);
            var saved = _saved.Should().ContainSingle().Subject;
            saved.AccountPassword.Should().BeEmpty();
            saved.AccountPasswordReference.Should().Be("pw-new");
            saved.ClientSecretReference.Should().BeNull();
            saved.AuthenticationType.Should().Be(MailAuthenticationType.Password);

            var created = _created.Should().ContainSingle().Subject;
            created.Name.Should().Be("mail-password");
            created.Type.Should().Be(SecretTypes.Service);
            created.Value.Should().Be(password);
            created.Description.Should().Contain(saved.ItemId).And.Contain(saved.Name).And.NotContain(password);

            // §5: one SetAsync; no metadata read on a create.
            _secrets.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Save_NewOffice365OAuth_KeepsUsingTheClientSecretReference()
        {
            using var _ = new BlocksTestContext();
            GivenSetReturns("cs-new");

            var result = await Service().SaveAsync(new MailConfiguration
            {
                ConfigurationName = "Microsoft 365 Primary",
                Provider = MailServiceProvider.Office365Smtp,
                TenantId = "contoso-tenant",
                ClientId = "mailer-app",
                ClientSecret = "client-secret-value",
                MailboxAddress = "mailer@contoso.com",
                SenderName = "Contoso Notifications",
                SenderAddress = "notifications@contoso.com"
            });

            result.Outcome.Should().Be(MailConfigurationOutcome.Success);
            var saved = _saved.Single();
            saved.ClientSecretReference.Should().Be("cs-new");
            saved.AccountPasswordReference.Should().BeNull();
            saved.AccountPassword.Should().BeEmpty();
            _created.Single().Name.Should().Be("office365-smtp");
            _secrets.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        // ---------- Q3: SES and Zoho are password-only ----------

        [Theory]
        [InlineData(MailServiceProvider.AmazonSes)]
        [InlineData(MailServiceProvider.Zoho)]
        public async Task Save_SesOrZohoClaimingOAuthWithoutAPassword_IsRejectedBeforeAnySecretCall(MailServiceProvider provider)
        {
            var request = RequestFor(provider);
            request.AuthenticationType = MailAuthenticationType.OAuthClientCredentials;
            request.AccountPassword = "";

            var result = await Service().SaveAsync(request);

            result.Outcome.Should().Be(MailConfigurationOutcome.Invalid);
            result.Response.Errors.Should().Contain(new KeyValuePair<string, string>("AccountPassword", "Password is required."));
            _repo.Verify(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()), Times.Never);
            _secrets.VerifyNoOtherCalls();
        }

        [Theory]
        [InlineData(MailServiceProvider.AmazonSes)]
        [InlineData(MailServiceProvider.Zoho)]
        public async Task Save_SesOrZohoClaimingOAuthWithAPassword_IsStoredAsAPasswordConfiguration(MailServiceProvider provider)
        {
            using var _ = new BlocksTestContext();
            GivenSetReturns("pw-new");
            var request = RequestFor(provider);
            request.AuthenticationType = MailAuthenticationType.OAuthClientCredentials;

            (await Service().SaveAsync(request)).Outcome.Should().Be(MailConfigurationOutcome.Success);

            _saved.Single().AuthenticationType.Should().Be(MailAuthenticationType.Password);
            _saved.Single().AccountPasswordReference.Should().Be("pw-new");
            _secrets.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        // ---------- H4 / Q5: edit of a referenced configuration rotates ----------

        [Theory]
        [InlineData(SecretStatuses.Active)]
        [InlineData(SecretStatuses.Locked)]
        public async Task Save_EditOfAReferencedConfiguration_RotatesInPlaceAndKeepsTheReference(string status)
        {
            using var _ = new BlocksTestContext();
            GivenStored(StoredZoho());
            GivenStatus(status);
            GivenRotateSucceeds();

            var result = await Service().SaveAsync(ZohoRequest("zoho-1", "zoho-app-pw2"));

            result.Outcome.Should().Be(MailConfigurationOutcome.Success);
            var saved = _saved.Single();
            saved.AccountPasswordReference.Should().Be("pw-1");
            saved.AccountPassword.Should().BeEmpty();

            // §5: ≤1 metadata read plus one RotateAsync; no new secret.
            _secrets.Verify(s => s.GetAsync("pw-1", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.Verify(
                s => s.RotateAsync("pw-1", It.Is<RotateSecretRequest>(r => r.Value == "zoho-app-pw2"), It.IsAny<CancellationToken>()),
                Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Save_EditWhoseStatusReadFails_TreatsTheReferenceAsOnFileAndRotates()
        {
            using var _ = new BlocksTestContext();
            GivenStored(StoredZoho());
            _secrets.Setup(s => s.GetAsync("pw-1", It.IsAny<CancellationToken>()))
                    .ThrowsAsync(VaultFailureNaming("pw-1"));
            GivenRotateSucceeds();

            var result = await Service().SaveAsync(ZohoRequest("zoho-1"));

            result.Outcome.Should().Be(MailConfigurationOutcome.Success);
            _zohoLogger.Entries.Should().ContainSingle(e => e.Level == LogLevel.Warning).Which.Message.Should().Contain("zoho-1");
            AllLogMessages().Should().NotContain(m => m.Contains("pw-1"));
            _saved.Single().AccountPasswordReference.Should().Be("pw-1");
            _secrets.Verify(s => s.GetAsync("pw-1", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.Verify(s => s.RotateAsync("pw-1", It.IsAny<RotateSecretRequest>(), It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Save_EditOfAReferencedOffice365PasswordConfiguration_RotatesItsPasswordSecret()
        {
            using var _ = new BlocksTestContext();
            GivenStored(StoredOffice365Password());
            GivenStatus(SecretStatuses.Active);
            GivenRotateSucceeds();

            var result = await Service().SaveAsync(Office365PasswordRequest("o365-pw"));

            result.Outcome.Should().Be(MailConfigurationOutcome.Success);
            _saved.Single().AccountPasswordReference.Should().Be("pw-o365");
            _saved.Single().ClientSecretReference.Should().BeNull();
            _secrets.Verify(s => s.GetAsync("pw-o365", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.Verify(
                s => s.RotateAsync("pw-o365", It.Is<RotateSecretRequest>(r => r.Value == "o365-password"), It.IsAny<CancellationToken>()),
                Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        // ---------- the secret disappears between the status read and the rotation ----------

        public static TheoryData<MailServiceProvider, Exception> RotateFindsTheSecretGone => new()
        {
            { MailServiceProvider.AmazonSes, new SecretNotFoundException("pw-old") },
            { MailServiceProvider.Zoho, new SecretNotFoundException("pw-old") },
            { MailServiceProvider.Gmail, new SecretStateException(SecretStatuses.Deleted, "rotate") },
            { MailServiceProvider.Office365Smtp, new SecretStateException(SecretStatuses.Deleted, "rotate") }
        };

        [Theory]
        [MemberData(nameof(RotateFindsTheSecretGone))]
        public async Task Save_RotateFindsTheSecretGoneOrArchived_CreatesANewSecretAndRepoints(MailServiceProvider provider, Exception failure)
        {
            using var _ = new BlocksTestContext();
            var stored = StoredFor(provider, "pw-old");
            GivenStored(stored);
            GivenStatus(SecretStatuses.Active);
            _secrets.Setup(s => s.RotateAsync("pw-old", It.IsAny<RotateSecretRequest>(), It.IsAny<CancellationToken>()))
                    .ThrowsAsync(failure);
            GivenSetReturns("pw-new");
            var request = RequestFor(provider);
            request.ConfigurationId = stored.ItemId;

            var result = await Service().SaveAsync(request);

            // A save, not a 404 or 409 whose message could carry the reference.
            result.Outcome.Should().Be(MailConfigurationOutcome.Success);
            _saved.Single().AccountPasswordReference.Should().Be("pw-new");
            _saved.Single().AccountPassword.Should().BeEmpty();
            _created.Single().Value.Should().Be(request.AccountPassword);

            var warning = ProviderLogEntries(provider).Should().ContainSingle(e => e.Level == LogLevel.Warning).Subject;
            warning.Message.Should().Contain(stored.ItemId).And.Contain(failure.GetType().Name);
            AllLogMessages().Should().NotContain(m => m.Contains("pw-old") || m.Contains("pw-new"));

            _secrets.Verify(s => s.GetAsync("pw-old", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.Verify(s => s.RotateAsync("pw-old", It.IsAny<RotateSecretRequest>(), It.IsAny<CancellationToken>()), Times.Once);
            _secrets.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Save_RotateFindsTheSecretGoneAndTheWriteFails_RetiresTheReplacementOnly()
        {
            using var _ = new BlocksTestContext();
            GivenStoredFreshEachRead("zoho-1", () => StoredZoho());
            GivenStatus(SecretStatuses.Active);
            _secrets.Setup(s => s.RotateAsync("pw-1", It.IsAny<RotateSecretRequest>(), It.IsAny<CancellationToken>()))
                    .ThrowsAsync(new SecretNotFoundException("pw-1"));
            GivenSetReturns("pw-2");
            GivenDeleteSucceeds();
            _repo.Setup(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()))
                 .ThrowsAsync(new InvalidOperationException("mongo down"));

            await Assert.ThrowsAsync<InvalidOperationException>(() => Service().SaveAsync(ZohoRequest("zoho-1")));

            _secrets.Verify(s => s.GetAsync("pw-1", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.Verify(s => s.RotateAsync("pw-1", It.IsAny<RotateSecretRequest>(), It.IsAny<CancellationToken>()), Times.Once);
            _secrets.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Once);
            _secrets.Verify(s => s.DeleteAsync("pw-2", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Save_RotateRefusedForAnotherReason_PropagatesAndCreatesNothing()
        {
            using var _ = new BlocksTestContext();
            GivenStored(StoredZoho());
            GivenStatus(SecretStatuses.Active);
            _secrets.Setup(s => s.RotateAsync("pw-1", It.IsAny<RotateSecretRequest>(), It.IsAny<CancellationToken>()))
                    .ThrowsAsync(new SecretAccessDeniedException("NOT_IN_ACCESS_LIST"));

            await Assert.ThrowsAsync<SecretAccessDeniedException>(() => Service().SaveAsync(ZohoRequest("zoho-1")));

            _repo.Verify(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()), Times.Never);
            _secrets.Verify(s => s.GetAsync("pw-1", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.Verify(s => s.RotateAsync("pw-1", It.IsAny<RotateSecretRequest>(), It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        [Theory]
        [InlineData(MailServiceProvider.AmazonSes)]
        [InlineData(MailServiceProvider.Gmail)]
        public async Task Save_EditWhoseStatusReadFails_LogsTheSesOrGmailConfigurationButNeverTheReference(MailServiceProvider provider)
        {
            using var _ = new BlocksTestContext();
            var stored = StoredFor(provider, "pw-1");
            GivenStored(stored);
            _secrets.Setup(s => s.GetAsync("pw-1", It.IsAny<CancellationToken>()))
                    .ThrowsAsync(VaultFailureNaming("pw-1"));
            GivenRotateSucceeds();
            var request = RequestFor(provider);
            request.ConfigurationId = stored.ItemId;

            var result = await Service().SaveAsync(request);

            result.Outcome.Should().Be(MailConfigurationOutcome.Success);
            ProviderLogEntries(provider).Should().ContainSingle(e => e.Level == LogLevel.Warning).Which.Message.Should().Contain(stored.ItemId);
            AllLogMessages().Should().NotContain(m => m.Contains("pw-1") || m.Contains(request.AccountPassword!));
            _secrets.Verify(s => s.GetAsync("pw-1", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.Verify(s => s.RotateAsync("pw-1", It.IsAny<RotateSecretRequest>(), It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        [Theory]
        [InlineData(MailServiceProvider.AmazonSes)]
        [InlineData(MailServiceProvider.Gmail)]
        public async Task Duplicate_UnreadableSesOrGmailSource_LogsTheSourceButNeverTheReference(MailServiceProvider provider)
        {
            using var _ = new BlocksTestContext();
            var stored = StoredFor(provider, "pw-1");
            GivenStored(stored);
            _secrets.Setup(s => s.GetValueAsync("pw-1", It.IsAny<CancellationToken>())).ThrowsAsync(new SecretNotFoundException("pw-1"));

            var result = await Service().DuplicateAsync(new DuplicateMailConfigurationRequest { ConfigurationId = stored.ItemId });

            result.Outcome.Should().Be(MailConfigurationOutcome.Invalid);
            ProviderLogEntries(provider).Should().ContainSingle(e => e.Level == LogLevel.Warning).Which.Message.Should().Contain(stored.ItemId);
            AllLogMessages().Should().NotContain(m => m.Contains("pw-1"));
            _secrets.Verify(s => s.GetValueAsync("pw-1", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        // ---------- H5: edit of a legacy configuration migrates it ----------

        [Fact]
        public async Task Save_EditOfALegacyGmailConfiguration_CreatesASecretFromTheNormalizedPasswordAndBlanksThePlaintext()
        {
            using var _ = new BlocksTestContext();
            GivenStored(new MailServerConfiguration
            {
                ItemId = "gmail-1",
                Name = "Gmail Primary",
                Provider = MailServiceProvider.Gmail,
                Host = "smtp.gmail.com",
                Port = 587,
                SenderUserName = "someone@gmail.com",
                AccountPassword = "abcd efgh ijkl mnop"
            });
            GivenSetReturns("pw-new");

            var request = RequestFor(MailServiceProvider.Gmail);
            request.ConfigurationId = "gmail-1";
            request.AccountPassword = "abcd efgh ijkl mnop";

            var result = await Service().SaveAsync(request);

            result.Outcome.Should().Be(MailConfigurationOutcome.Success);
            _created.Single().Value.Should().Be("abcdefghijklmnop");
            var saved = _saved.Single();
            saved.ItemId.Should().Be("gmail-1");
            saved.AccountPassword.Should().BeEmpty();
            saved.AccountPasswordReference.Should().Be("pw-new");

            // §5: a legacy edit makes no metadata read.
            _secrets.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        // ---------- C3: a broken reference is replaced ----------

        [Theory]
        [InlineData(SecretStatuses.Deleted)]
        [InlineData(null)]
        public async Task Save_EditWithAnArchivedOrMissingReference_CreatesANewSecretAndLeavesTheOldOneAlone(string? status)
        {
            using var _ = new BlocksTestContext();
            GivenStored(StoredZoho());
            GivenStatus(status);
            GivenSetReturns("pw-2");

            var result = await Service().SaveAsync(ZohoRequest("zoho-1"));

            result.Outcome.Should().Be(MailConfigurationOutcome.Success);
            _saved.Single().AccountPasswordReference.Should().Be("pw-2");
            _secrets.Verify(s => s.GetAsync("pw-1", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        // ---------- H6 / C6 / C13: no secret call at all ----------

        [Fact]
        public async Task Save_EditOfTheDefaultRecordsSenderName_MakesNoSecretCall()
        {
            using var _ = new BlocksTestContext();
            var stored = StoredZoho(reference: null, password: "ses-password");
            stored.IsDefault = true;
            GivenStored(stored);

            var result = await Service().SaveAsync(new MailConfiguration
            {
                ConfigurationId = "zoho-1",
                Provider = MailServiceProvider.Zoho,
                SenderName = "Contoso Mailer",
                AccountPassword = "ignored-password"
            });

            result.Outcome.Should().Be(MailConfigurationOutcome.Success);
            _repo.Verify(r => r.UpdateMailSenderNameAsync("zoho-1", "Contoso Mailer", It.IsAny<DateTime>(), It.IsAny<string>()), Times.Once);
            _repo.Verify(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()), Times.Never);
            _secrets.VerifyNoOtherCalls();
        }

        [Theory]
        [InlineData(MailServiceProvider.Gmail, false)]
        [InlineData(MailServiceProvider.Zoho, true)]
        public async Task Save_ProviderOrDirectionChangeOfAReferencedRecord_IsRejectedBeforeAnySecretCall(MailServiceProvider provider, bool isInbound)
        {
            GivenStored(StoredZoho());
            var request = ZohoRequest("zoho-1");
            request.Provider = provider;
            request.IsInbound = isInbound;

            var result = await Service().SaveAsync(request);

            result.Outcome.Should().Be(MailConfigurationOutcome.Invalid);
            result.Response.Errors.Should().ContainKey("Provider");
            _repo.Verify(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()), Times.Never);
            _secrets.VerifyNoOtherCalls();
        }

        // ---------- C1: the vault is down ----------

        [Fact]
        public async Task Save_VaultDownOnCreate_ReturnsSecretStoreUnavailableAndWritesNothing()
        {
            _secrets.Setup(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()))
                    .ThrowsAsync(new SecretVaultException("down", "set", "pw-new"));

            var result = await Service().SaveAsync(ZohoRequest());

            result.Outcome.Should().Be(MailConfigurationOutcome.SecretStoreUnavailable);

            // Provider-neutral: a Zoho admin entered a password, not a client secret.
            result.Response.Errors.Should().Equal(new Dictionary<string, string>
            {
                ["ClientSecret"] = "The secret store is unavailable. Try again later."
            });
            _repo.Verify(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()), Times.Never);
            _secrets.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Save_VaultDownOnRotate_ReturnsSecretStoreUnavailableAndWritesNothing()
        {
            GivenStored(StoredZoho());
            GivenStatus(SecretStatuses.Active);
            _secrets.Setup(s => s.RotateAsync("pw-1", It.IsAny<RotateSecretRequest>(), It.IsAny<CancellationToken>()))
                    .ThrowsAsync(VaultFailureNaming("pw-1"));

            var result = await Service().SaveAsync(ZohoRequest("zoho-1"));

            result.Outcome.Should().Be(MailConfigurationOutcome.SecretStoreUnavailable);
            _serviceLogger.Entries.Should().Contain(e => e.Level == LogLevel.Error && e.Message.Contains(nameof(SecretVaultException)));
            AllLogMessages().Should().NotContain(m => m.Contains("pw-1"));
            _repo.Verify(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()), Times.Never);
            _secrets.Verify(s => s.GetAsync("pw-1", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.Verify(s => s.RotateAsync("pw-1", It.IsAny<RotateSecretRequest>(), It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Save_NonVaultSecretFailure_PropagatesToTheGlobalFilterAndWritesNothing()
        {
            _secrets.Setup(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()))
                    .ThrowsAsync(new SecretAccessDeniedException("not_permitted"));

            await Assert.ThrowsAsync<SecretAccessDeniedException>(() => Service().SaveAsync(ZohoRequest()));

            _repo.Verify(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()), Times.Never);
            _secrets.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        // ---------- C2: compensation ----------

        [Fact]
        public async Task Save_WriteFailsAfterCreate_RetiresTheNewSecret()
        {
            using var _ = new BlocksTestContext();
            GivenSetReturns("pw-new");
            GivenDeleteSucceeds();
            _repo.Setup(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()))
                 .ThrowsAsync(new InvalidOperationException("mongo down"));

            await Assert.ThrowsAsync<InvalidOperationException>(() => Service().SaveAsync(ZohoRequest()));

            // The read-back found no document, so the write did not land and the secret goes.
            _repo.Verify(r => r.GetMailConfigurationByIdAsync(It.IsAny<string>()), Times.Once);
            _secrets.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Once);
            _secrets.Verify(s => s.DeleteAsync("pw-new", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Save_WriteFailsAfterARepair_RetiresOnlyTheNewSecret()
        {
            using var _ = new BlocksTestContext();

            // The read-back sees the document as it still is: pointing at the archived pw-1.
            GivenStoredFreshEachRead("zoho-1", () => StoredZoho());
            GivenStatus(SecretStatuses.Deleted);
            GivenSetReturns("pw-2");
            GivenDeleteSucceeds();
            _repo.Setup(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()))
                 .ThrowsAsync(new InvalidOperationException("mongo down"));

            await Assert.ThrowsAsync<InvalidOperationException>(() => Service().SaveAsync(ZohoRequest("zoho-1")));

            _secrets.Verify(s => s.GetAsync("pw-1", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Once);
            _secrets.Verify(s => s.DeleteAsync("pw-2", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Save_WriteFailsAfterALegacyMigrationThatDidNotLand_RetiresTheNewSecret()
        {
            using var _ = new BlocksTestContext();
            GivenStoredFreshEachRead("zoho-1", () => StoredZoho(reference: null, password: "legacy-plaintext"));
            GivenSetReturns("pw-new");
            GivenDeleteSucceeds();
            _repo.Setup(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()))
                 .ThrowsAsync(new InvalidOperationException("mongo down"));

            await Assert.ThrowsAsync<InvalidOperationException>(() => Service().SaveAsync(ZohoRequest("zoho-1")));

            // One read to load the record, one to read it back after the failed write.
            _repo.Verify(r => r.GetMailConfigurationByIdAsync("zoho-1"), Times.Exactly(2));
            _secrets.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Once);
            _secrets.Verify(s => s.DeleteAsync("pw-new", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Save_WriteThrowsButTheDocumentWasStored_KeepsTheNewSecret()
        {
            using var _ = new BlocksTestContext();
            GivenSetReturns("pw-new");
            GivenWriteAppliedButThrows();

            // The write failure still reaches the caller; only the retire is skipped.
            await Assert.ThrowsAsync<TimeoutException>(() => Service().SaveAsync(ZohoRequest()));

            _serviceLogger.Entries.Should().ContainSingle(e => e.Level == LogLevel.Warning && e.Message.Contains("new secret is kept"));
            AllLogMessages().Should().NotContain(m => m.Contains("pw-new") || m.Contains(SourcePassword));
            _repo.Verify(r => r.GetMailConfigurationByIdAsync(It.IsAny<string>()), Times.Once);
            _secrets.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Save_WriteThrowsAndTheReadBackFails_KeepsTheNewSecretAndLogsTheTypeOnly()
        {
            using var _ = new BlocksTestContext();
            GivenSetReturns("pw-new");
            _repo.Setup(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()))
                 .ThrowsAsync(new InvalidOperationException("mongo down"));
            _repo.Setup(r => r.GetMailConfigurationByIdAsync(It.IsAny<string>()))
                 .ThrowsAsync(new TimeoutException("read-back of pw-new timed out"));

            await Assert.ThrowsAsync<InvalidOperationException>(() => Service().SaveAsync(ZohoRequest()));

            var warning = _serviceLogger.Entries.Should().ContainSingle(e => e.Level == LogLevel.Warning).Subject;
            warning.Message.Should().Contain(nameof(TimeoutException)).And.Contain("could not be read back");
            warning.Exception.Should().BeNull();
            AllLogMessages().Should().NotContain(m => m.Contains("pw-new"));
            _secrets.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Save_WriteFailsAfterARotation_RetiresNothing()
        {
            using var _ = new BlocksTestContext();
            GivenStored(StoredZoho());
            GivenStatus(SecretStatuses.Active);
            GivenRotateSucceeds();
            _repo.Setup(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()))
                 .ThrowsAsync(new InvalidOperationException("mongo down"));

            await Assert.ThrowsAsync<InvalidOperationException>(() => Service().SaveAsync(ZohoRequest("zoho-1")));

            _secrets.Verify(s => s.GetAsync("pw-1", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.Verify(s => s.RotateAsync("pw-1", It.IsAny<RotateSecretRequest>(), It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Save_CompensationThatFails_LogsTheConfigurationButNeverTheReference()
        {
            using var _ = new BlocksTestContext();
            GivenSetReturns("pw-new");
            _secrets.Setup(s => s.DeleteAsync("pw-new", It.IsAny<CancellationToken>()))
                    .ThrowsAsync(VaultFailureNaming("pw-new"));
            _repo.Setup(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()))
                 .ThrowsAsync(new InvalidOperationException("mongo down"));

            // The write failure is what the caller sees, not the compensation's.
            await Assert.ThrowsAsync<InvalidOperationException>(() => Service().SaveAsync(ZohoRequest()));

            _serviceLogger.Entries.Should().Contain(e => e.Level == LogLevel.Error && e.Message.Contains("could not be retired"));
            AllLogMessages().Should().NotContain(m => m.Contains("pw-new") || m.Contains(SourcePassword));
            _secrets.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Once);
            _secrets.Verify(s => s.DeleteAsync("pw-new", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        // ---------- C5: no plaintext on the entity or in a log ----------

        [Fact]
        public async Task CreateMigrateAndRotate_NeverPutThePlaintextOnTheEntityOrInALog()
        {
            using var _ = new BlocksTestContext();
            GivenSetReturns("pw-new");
            GivenStatus(SecretStatuses.Active);
            GivenRotateSucceeds();
            GivenStored(StoredZoho(reference: "pw-1"));
            var legacy = StoredZoho(reference: null, password: "legacy-plaintext");
            legacy.ItemId = "zoho-legacy";
            GivenStored(legacy);

            // A create, a legacy migration and an edit of a referenced record that rotates.
            await Service().SaveAsync(ZohoRequest());
            await Service().SaveAsync(ZohoRequest("zoho-legacy", "zoho-app-pw3"));
            await Service().SaveAsync(ZohoRequest("zoho-1", "zoho-app-pw2"));

            _saved.Should().HaveCount(3).And.OnlyContain(m => m.AccountPassword == "");
            _saved.Select(m => m.AccountPasswordReference).Should().Equal("pw-new", "pw-new", "pw-1");
            AllLogMessages().Should().NotContain(m =>
                m.Contains(SourcePassword) || m.Contains("zoho-app-pw2") || m.Contains("zoho-app-pw3")
                || m.Contains("legacy-plaintext") || m.Contains("pw-1") || m.Contains("pw-new"));

            _secrets.Verify(
                s => s.SetAsync(It.Is<SetSecretRequest>(r => r.Value == SourcePassword), It.IsAny<CancellationToken>()),
                Times.Once);
            _secrets.Verify(
                s => s.SetAsync(It.Is<SetSecretRequest>(r => r.Value == "zoho-app-pw3"), It.IsAny<CancellationToken>()),
                Times.Once);
            _secrets.Verify(s => s.GetAsync("pw-1", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.Verify(
                s => s.RotateAsync("pw-1", It.Is<RotateSecretRequest>(r => r.Value == "zoho-app-pw2"), It.IsAny<CancellationToken>()),
                Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        // ---------- H7 / Q4: duplicate ----------

        [Fact]
        public async Task Duplicate_ReferencedSource_CopiesThePasswordIntoAnIndependentSecretNamedForTheCopy()
        {
            using var _ = new BlocksTestContext();
            GivenStored(StoredZoho());
            _secrets.Setup(s => s.GetValueAsync("pw-1", It.IsAny<CancellationToken>())).ReturnsAsync(SourcePassword);
            GivenSetReturns("pw-2");

            var result = await Service().DuplicateAsync(new DuplicateMailConfigurationRequest { ConfigurationId = "zoho-1" });

            result.Outcome.Should().Be(MailConfigurationOutcome.Success);
            var copy = _saved.Should().ContainSingle().Subject;
            copy.ItemId.Should().NotBe("zoho-1");
            result.Response.ItemId.Should().Be(copy.ItemId);
            copy.Name.Should().Be("Zoho Primary - Copy");
            copy.AccountPassword.Should().BeEmpty();
            copy.AccountPasswordReference.Should().Be("pw-2");
            copy.ClientSecretReference.Should().BeNull();

            var created = _created.Single();
            created.Name.Should().Be("mail-password");
            created.Type.Should().Be(SecretTypes.Service);
            created.Value.Should().Be(SourcePassword);
            created.Description.Should().Contain(copy.ItemId).And.Contain("Zoho Primary - Copy").And.NotContain("zoho-1");

            // §5: one value read of the source and one SetAsync; the source is never written.
            _secrets.Verify(s => s.GetValueAsync("pw-1", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Duplicate_LegacySourceWithoutAPassword_CreatesNoSecret()
        {
            using var _ = new BlocksTestContext();
            GivenStored(StoredZoho(reference: null, password: ""));

            var result = await Service().DuplicateAsync(new DuplicateMailConfigurationRequest { ConfigurationId = "zoho-1" });

            result.Outcome.Should().Be(MailConfigurationOutcome.Success);
            var copy = _saved.Single();
            copy.AccountPassword.Should().BeEmpty();
            copy.AccountPasswordReference.Should().BeNull();
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Duplicate_Office365PasswordSource_CopiesItsPasswordSecret()
        {
            using var _ = new BlocksTestContext();
            GivenStored(StoredOffice365Password());
            _secrets.Setup(s => s.GetValueAsync("pw-o365", It.IsAny<CancellationToken>())).ReturnsAsync("o365-password");
            GivenSetReturns("pw-o365-2");

            var result = await Service().DuplicateAsync(new DuplicateMailConfigurationRequest { ConfigurationId = "o365-pw" });

            result.Outcome.Should().Be(MailConfigurationOutcome.Success);
            var copy = _saved.Single();
            copy.AccountPasswordReference.Should().Be("pw-o365-2");
            copy.ClientSecretReference.Should().BeNull();
            copy.AccountPassword.Should().BeEmpty();
            _created.Single().Value.Should().Be("o365-password");
            _secrets.Verify(s => s.GetValueAsync("pw-o365", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Duplicate_Office365OAuth_DescribesTheCopyNotTheSource()
        {
            using var _ = new BlocksTestContext();
            GivenStored(new MailServerConfiguration
            {
                ItemId = "o365-oauth",
                Name = "Microsoft 365 Primary",
                Provider = MailServiceProvider.Office365Smtp,
                AuthenticationType = MailAuthenticationType.OAuthClientCredentials,
                ClientSecretReference = "cs-1"
            });
            GivenSetReturns("cs-2");

            var result = await Service().DuplicateAsync(new DuplicateMailConfigurationRequest
            {
                ConfigurationId = "o365-oauth",
                ClientSecret = "copy-secret"
            });

            result.Outcome.Should().Be(MailConfigurationOutcome.Success);
            var copy = _saved.Single();
            copy.ClientSecretReference.Should().Be("cs-2");
            copy.AccountPasswordReference.Should().BeNull();
            _created.Single().Description.Should().Contain(copy.ItemId).And.Contain("Microsoft 365 Primary - Copy").And.NotContain("o365-oauth");
            _secrets.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        // ---------- C4 / C1 / C2: duplicate failures ----------

        public static TheoryData<Exception> UnreadableSource => new()
        {
            new SecretNotFoundException("pw-1"),
            new SecretStateException(SecretStatuses.Deleted, "read value", "STATUS_DELETED"),
            new SecretStateException(SecretStatuses.Locked, "read value", "STATUS_LOCKED")
        };

        [Theory]
        [MemberData(nameof(UnreadableSource))]
        public async Task Duplicate_UnreadableSourceSecret_IsAFieldErrorWithNoCopyAndNoSecret(Exception failure)
        {
            using var _ = new BlocksTestContext();
            GivenStored(StoredZoho());
            _secrets.Setup(s => s.GetValueAsync("pw-1", It.IsAny<CancellationToken>())).ThrowsAsync(failure);

            var result = await Service().DuplicateAsync(new DuplicateMailConfigurationRequest { ConfigurationId = "zoho-1" });

            result.Outcome.Should().Be(MailConfigurationOutcome.Invalid);
            result.Response.Errors.Should().Equal(new Dictionary<string, string>
            {
                ["AccountPassword"] = "The source configuration's password is unavailable. Edit the source and enter its password again."
            });
            _repo.Verify(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()), Times.Never);

            // The warning names the source configuration, never its reference.
            var warning = _zohoLogger.Entries.Should().ContainSingle(e => e.Level == LogLevel.Warning).Subject;
            warning.Message.Should().Contain("zoho-1").And.Contain(failure.GetType().Name).And.NotContain("pw-1");
            AllLogMessages().Should().NotContain(m => m.Contains("pw-1"));

            _secrets.Verify(s => s.GetValueAsync("pw-1", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Duplicate_VaultDownReadingTheSource_ReturnsSecretStoreUnavailableAndWritesNothing()
        {
            GivenStored(StoredZoho());
            _secrets.Setup(s => s.GetValueAsync("pw-1", It.IsAny<CancellationToken>()))
                    .ThrowsAsync(new SecretVaultException("down", "get", "pw-1"));

            var result = await Service().DuplicateAsync(new DuplicateMailConfigurationRequest { ConfigurationId = "zoho-1" });

            result.Outcome.Should().Be(MailConfigurationOutcome.SecretStoreUnavailable);
            _repo.Verify(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()), Times.Never);
            _secrets.Verify(s => s.GetValueAsync("pw-1", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Duplicate_VaultDownCreatingTheCopy_ReturnsSecretStoreUnavailableAndWritesNothing()
        {
            GivenStored(StoredZoho());
            _secrets.Setup(s => s.GetValueAsync("pw-1", It.IsAny<CancellationToken>())).ReturnsAsync(SourcePassword);
            _secrets.Setup(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()))
                    .ThrowsAsync(new SecretVaultException("down", "set", "pw-2"));

            var result = await Service().DuplicateAsync(new DuplicateMailConfigurationRequest { ConfigurationId = "zoho-1" });

            result.Outcome.Should().Be(MailConfigurationOutcome.SecretStoreUnavailable);
            _repo.Verify(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()), Times.Never);
            _secrets.Verify(s => s.GetValueAsync("pw-1", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Duplicate_WriteFails_RetiresTheCopysSecret()
        {
            using var _ = new BlocksTestContext();
            GivenStored(StoredZoho());
            _secrets.Setup(s => s.GetValueAsync("pw-1", It.IsAny<CancellationToken>())).ReturnsAsync(SourcePassword);
            GivenSetReturns("pw-2");
            GivenDeleteSucceeds();
            _repo.Setup(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()))
                 .ThrowsAsync(new InvalidOperationException("mongo down"));

            await Assert.ThrowsAsync<InvalidOperationException>(
                () => Service().DuplicateAsync(new DuplicateMailConfigurationRequest { ConfigurationId = "zoho-1" }));

            _secrets.Verify(s => s.GetValueAsync("pw-1", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Once);
            _secrets.Verify(s => s.DeleteAsync("pw-2", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Duplicate_WriteThrowsButTheCopyWasStored_KeepsTheCopysSecret()
        {
            using var _ = new BlocksTestContext();
            GivenStored(StoredZoho());
            _secrets.Setup(s => s.GetValueAsync("pw-1", It.IsAny<CancellationToken>())).ReturnsAsync(SourcePassword);
            GivenSetReturns("pw-2");
            GivenWriteAppliedButThrows();

            await Assert.ThrowsAsync<TimeoutException>(
                () => Service().DuplicateAsync(new DuplicateMailConfigurationRequest { ConfigurationId = "zoho-1" }));

            _serviceLogger.Entries.Should().ContainSingle(e => e.Level == LogLevel.Warning && e.Message.Contains("new secret is kept"));
            AllLogMessages().Should().NotContain(m => m.Contains("pw-1") || m.Contains("pw-2") || m.Contains(SourcePassword));
            _secrets.Verify(s => s.GetValueAsync("pw-1", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Duplicate_WriteThrowsAndTheReadBackFails_KeepsTheCopysSecret()
        {
            using var _ = new BlocksTestContext();
            var source = StoredZoho();
            _repo.Setup(r => r.GetMailConfigurationByIdAsync(It.IsAny<string>()))
                 .ReturnsAsync((string id) => id == "zoho-1" ? source : throw new TimeoutException("read-back timed out"));
            _secrets.Setup(s => s.GetValueAsync("pw-1", It.IsAny<CancellationToken>())).ReturnsAsync(SourcePassword);
            GivenSetReturns("pw-2");
            _repo.Setup(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()))
                 .ThrowsAsync(new InvalidOperationException("mongo down"));

            await Assert.ThrowsAsync<InvalidOperationException>(
                () => Service().DuplicateAsync(new DuplicateMailConfigurationRequest { ConfigurationId = "zoho-1" }));

            _serviceLogger.Entries.Should().Contain(e => e.Level == LogLevel.Warning && e.Message.Contains(nameof(TimeoutException)));
            AllLogMessages().Should().NotContain(m => m.Contains("pw-2"));
            _secrets.Verify(s => s.GetValueAsync("pw-1", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        // ---------- H8 / C1: delete ----------

        [Fact]
        public async Task Delete_ReferencedConfiguration_RetiresItsPasswordSecretBeforeTheDocument()
        {
            var order = new List<string>();
            GivenStored(StoredZoho());
            _secrets.Setup(s => s.DeleteAsync("pw-1", It.IsAny<CancellationToken>()))
                    .Callback(() => order.Add("secret"))
                    .Returns(Task.CompletedTask);
            _repo.Setup(r => r.DeleteMailConfigurationAsync("zoho-1"))
                 .Callback(() => order.Add("configuration"))
                 .Returns(Task.CompletedTask);

            var result = await Service().DeleteAsync(new DeleteMailConfigurationRequest { ConfigurationId = "zoho-1" });

            result.Outcome.Should().Be(MailConfigurationOutcome.Success);
            order.Should().Equal("secret", "configuration");
            _secrets.Verify(s => s.DeleteAsync("pw-1", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Delete_Office365PasswordConfiguration_RetiresThePasswordReference()
        {
            var stored = StoredOffice365Password();
            stored.ClientSecretReference = "unrelated";
            GivenStored(stored);
            GivenDeleteSucceeds();

            var result = await Service().DeleteAsync(new DeleteMailConfigurationRequest { ConfigurationId = "o365-pw" });

            result.Outcome.Should().Be(MailConfigurationOutcome.Success);
            _secrets.Verify(s => s.DeleteAsync("pw-o365", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Delete_DocumentDeleteFails_RestoresThePasswordSecret()
        {
            GivenStored(StoredZoho());
            GivenDeleteSucceeds();
            _secrets.Setup(s => s.RestoreAsync("pw-1", It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            _repo.Setup(r => r.DeleteMailConfigurationAsync("zoho-1")).ThrowsAsync(new InvalidOperationException("mongo down"));

            await Assert.ThrowsAsync<InvalidOperationException>(
                () => Service().DeleteAsync(new DeleteMailConfigurationRequest { ConfigurationId = "zoho-1" }));

            _secrets.Verify(s => s.DeleteAsync("pw-1", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.Verify(s => s.RestoreAsync("pw-1", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Delete_RestoreThatFails_IsLoggedWithoutTheReferenceAndTheDeleteFailurePropagates()
        {
            GivenStored(StoredZoho());
            GivenDeleteSucceeds();
            _secrets.Setup(s => s.RestoreAsync("pw-1", It.IsAny<CancellationToken>()))
                    .ThrowsAsync(new SecretNotFoundException("pw-1"));
            _repo.Setup(r => r.DeleteMailConfigurationAsync("zoho-1")).ThrowsAsync(new InvalidOperationException("mongo down"));

            await Assert.ThrowsAsync<InvalidOperationException>(
                () => Service().DeleteAsync(new DeleteMailConfigurationRequest { ConfigurationId = "zoho-1" }));

            _serviceLogger.Entries.Should().Contain(e => e.Level == LogLevel.Error && e.Message.Contains("zoho-1"));
            AllLogMessages().Should().NotContain(m => m.Contains("pw-1"));
            _secrets.Verify(s => s.DeleteAsync("pw-1", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.Verify(s => s.RestoreAsync("pw-1", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Delete_AlreadyArchivedPasswordSecret_DeletesTheDocumentAndRestoresNothingOnFailure()
        {
            GivenStored(StoredZoho());
            _secrets.Setup(s => s.DeleteAsync("pw-1", It.IsAny<CancellationToken>()))
                    .ThrowsAsync(new SecretStateException(SecretStatuses.Deleted, "delete", "STATUS_DELETED"));
            _repo.Setup(r => r.DeleteMailConfigurationAsync("zoho-1")).ThrowsAsync(new InvalidOperationException("mongo down"));

            await Assert.ThrowsAsync<InvalidOperationException>(
                () => Service().DeleteAsync(new DeleteMailConfigurationRequest { ConfigurationId = "zoho-1" }));

            _secrets.Verify(s => s.DeleteAsync("pw-1", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Delete_VaultDown_ReturnsSecretStoreUnavailableAndKeepsTheDocument()
        {
            GivenStored(StoredZoho());
            _secrets.Setup(s => s.DeleteAsync("pw-1", It.IsAny<CancellationToken>()))
                    .ThrowsAsync(new SecretVaultException("down", "delete", "pw-1"));

            var result = await Service().DeleteAsync(new DeleteMailConfigurationRequest { ConfigurationId = "zoho-1" });

            result.Outcome.Should().Be(MailConfigurationOutcome.SecretStoreUnavailable);
            _repo.Verify(r => r.DeleteMailConfigurationAsync(It.IsAny<string>()), Times.Never);
            _secrets.Verify(s => s.DeleteAsync("pw-1", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Delete_LegacyPasswordConfiguration_MakesNoSecretCall()
        {
            GivenStored(StoredZoho(reference: null, password: "legacy-plaintext"));

            var result = await Service().DeleteAsync(new DeleteMailConfigurationRequest { ConfigurationId = "zoho-1" });

            result.Outcome.Should().Be(MailConfigurationOutcome.Success);
            _repo.Verify(r => r.DeleteMailConfigurationAsync("zoho-1"), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        // ---------- H9 / C8 / C13: list ----------

        [Fact]
        public async Task GetAll_MasksEveryPasswordMakesNoSecretCallForPasswordRecordsAndWritesNothing()
        {
            GivenStatus(SecretStatuses.Active);
            var oauth = new MailServerConfiguration
            {
                ItemId = "o365-oauth",
                Name = "Microsoft 365 Primary",
                Provider = MailServiceProvider.Office365Smtp,
                AuthenticationType = MailAuthenticationType.OAuthClientCredentials,
                ClientSecretReference = "cs-1"
            };
            var gmail = StoredZoho("pw-gmail");
            gmail.ItemId = "gmail-1";
            gmail.Provider = MailServiceProvider.Gmail;
            _repo.Setup(r => r.GetAllMailConfigurationsAsync())
                 .ReturnsAsync(new List<MailServerConfiguration>
                 {
                     StoredZoho(reference: null, password: "legacy-plaintext"),
                     StoredZoho("pw-1"),
                     gmail,
                     StoredOffice365Password(reference: null),
                     StoredOffice365Password(),
                     oauth
                 });

            var responses = await Service().GetAllAsync();

            responses.Should().HaveCount(6);
            responses.Take(5).Should().OnlyContain(r => r.AccountPassword == "********" && r.ClientSecretStatus == null);
            responses.Last().ClientSecretStatus.Should().Be(LinkedSecretStatus.Active);
            var json = System.Text.Json.JsonSerializer.Serialize(
                responses,
                new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web));
            json.Should().NotContain("pw-1").And.NotContain("pw-gmail").And.NotContain("pw-o365").And.NotContain("cs-1")
                .And.NotContain("legacy-plaintext").And.NotContain("accountPasswordReference");

            // §5 allows ≤1 metadata read per referenced record. A password record shows only the
            // mask, so it gets none; the OAuth record keeps its one status read. Never a value.
            _secrets.Verify(s => s.GetAsync("cs-1", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();

            // C8: a read writes nothing.
            _repo.Verify(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()), Times.Never);
            _repo.Verify(r => r.UpdateMailSenderNameAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task Get_ReferencedPasswordRecord_MakesNoSecretCall()
        {
            _repo.Setup(r => r.GetMailConfigurationByNameForViewAsync("Zoho Primary")).ReturnsAsync(StoredZoho("pw-1"));

            var response = await Service().GetAsync(new GetMailConfigurationRequest { ConfigurationName = "Zoho Primary" });

            response!.AccountPassword.Should().Be("********");
            response.ClientSecretStatus.Should().BeNull();
            _secrets.VerifyNoOtherCalls();
        }

        // ---------- provider and helper contracts ----------

        [Fact]
        public void Office365_OwnsTheReferenceFieldOfItsMode()
        {
            var definition = new Office365SmtpMailConfigurationProvider(_secrets.Object, _office365Logger);
            var password = new MailServerConfiguration
            {
                AuthenticationType = MailAuthenticationType.Password,
                AccountPassword = "legacy-plaintext",
                ClientSecretReference = "cs-1"
            };
            var oauth = new MailServerConfiguration
            {
                AuthenticationType = MailAuthenticationType.OAuthClientCredentials,
                AccountPasswordReference = "pw-x"
            };

            definition.ApplyCredential(password, "pw-1");
            definition.ApplyCredential(oauth, "cs-2");

            definition.CredentialReferenceOf(password).Should().Be("pw-1");
            password.AccountPassword.Should().BeEmpty();
            password.ClientSecretReference.Should().Be("cs-1", "the other mode's field is not this credential's");
            definition.CredentialReferenceOf(oauth).Should().Be("cs-2");
            oauth.AccountPasswordReference.Should().Be("pw-x");
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task LinkedPasswordCredential_SaveWithoutAPassword_FailsBeforeAnySecretCall()
        {
            var credential = new LinkedPasswordCredential(_secrets.Object, _zohoLogger);

            var act = () => credential.SaveAsync("cfg-1", "Zoho Primary", "", existing: null, existingStatus: null);

            await act.Should().ThrowAsync<InvalidOperationException>();
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task LinkedPasswordCredential_WithoutAReference_RetiresRestoresAndChecksNothing()
        {
            var credential = new LinkedPasswordCredential(_secrets.Object, _zohoLogger);

            (await credential.RetireAsync(null)).Should().BeFalse();
            await credential.RestoreAsync("");
            (await credential.ResolveStatusAsync(new MailServerConfiguration())).Should().BeNull();

            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public void LinkedPasswordCredential_RequiresItsDependencies()
        {
            FluentActions.Invoking(() => new LinkedPasswordCredential(null!, _zohoLogger)).Should().Throw<ArgumentNullException>();
            FluentActions.Invoking(() => new LinkedPasswordCredential(_secrets.Object, null!)).Should().Throw<ArgumentNullException>();
        }
    }
}
