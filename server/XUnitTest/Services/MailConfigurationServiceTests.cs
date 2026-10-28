using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
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
using Blocks.Genesis.Entities.Os;

namespace XUnitTest.Services
{
    /// <summary>
    /// Covers the orchestrator against the real validator and the real provider definitions, with
    /// only the repository and the secret store faked. The point of the boundary is that the
    /// orchestrator has no provider branch, so exercising it through the registry is the only way
    /// to prove that holds.
    /// </summary>
    public class MailConfigurationServiceTests
    {
        private readonly Mock<IConfigurationRepository> _repo = new();
        private readonly Mock<ISecretService> _secrets = new();
        private readonly RecordingLogger<Office365SmtpMailConfigurationProvider> _providerLogger = new();

        public MailConfigurationServiceTests()
        {
            _repo.Setup(r => r.GetMailConfigurationByNameAsync(It.IsAny<string>()))
                 .ReturnsAsync((MailServerConfiguration?)null);
            _repo.Setup(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()))
                 .Returns(Task.CompletedTask);
            _repo.Setup(r => r.DeleteMailConfigurationAsync(It.IsAny<string>()))
                 .Returns(Task.CompletedTask);
            _repo.Setup(r => r.UpdateMailSenderNameAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<string>()))
                 .Returns(Task.CompletedTask);
            _secrets.Setup(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()))
                    .ReturnsAsync("secret-1");

            // Every linked secret is healthy unless a test says otherwise.
            GivenSecretStatus(SecretStatuses.Active);
        }

        /// <summary>Stubs the metadata read for any secret: a status, or null for "no such secret".</summary>
        private void GivenSecretStatus(string? status) =>
            _secrets.Setup(s => s.GetAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                    .ReturnsAsync((string id, CancellationToken _) =>
                        status is null ? null : new SecretResult { SecretId = id, Name = "office365-smtp", Status = status });

        private MailConfigurationService Service()
        {
            IValidator<MailConfiguration> validator = new MailConfigurationValidator(_repo.Object);

            var registry = new MailConfigurationProviderRegistry(new IMailConfigurationProvider[]
            {
                new AmazonSesMailConfigurationProvider(_secrets.Object, NullLogger<AmazonSesMailConfigurationProvider>.Instance),
                new ZohoMailConfigurationProvider(_secrets.Object, NullLogger<ZohoMailConfigurationProvider>.Instance),
                new Office365SmtpMailConfigurationProvider(_secrets.Object, _providerLogger)
            });

            return new MailConfigurationService(
                _repo.Object,
                registry,
                validator,
                NullLogger<MailConfigurationService>.Instance);
        }

        private static MailConfiguration Office365Request() => new()
        {
            ConfigurationId = "",
            ConfigurationName = "Microsoft 365 Primary",
            Provider = MailServiceProvider.Office365Smtp,
            IsInbound = false,
            TenantId = "contoso-tenant",
            ClientId = "mailer-app",
            ClientSecret = "secret-value",
            MailboxAddress = "mailer@contoso.com",
            SenderName = "Contoso Notifications",
            SenderAddress = "notifications@contoso.com",

            // Deliberately wrong: the provider must overwrite these rather than reject them.
            Host = "smtp.contoso.example",
            Port = 25
        };

        private static MailServerConfiguration StoredOffice365(string itemId = "cfg-1") => new()
        {
            ItemId = itemId,
            Name = "Microsoft 365 Primary",
            Provider = MailServiceProvider.Office365Smtp,
            IsInbound = false,
            Host = "smtp.office365.com",
            Port = 587,
            AuthenticationType = MailAuthenticationType.OAuthClientCredentials,
            SecurityMode = MailSecurityMode.StartTls,
            TenantId = "contoso-tenant",
            ClientId = "mailer-app",
            MailboxAddress = "mailer@contoso.com",
            SenderName = "Contoso Notifications",
            SenderAddress = "notifications@contoso.com",
            ClientSecretReference = "secret-1"
        };

        // ---------- H2: create ----------

        [Fact]
        public async Task Save_NewOffice365_NormalizesTransportAndStoresOnlyAReference()
        {
            using var _ = new BlocksTestContext();
            MailServerConfiguration? saved = null;
            _repo.Setup(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()))
                 .Callback<MailServerConfiguration>(m => saved = m)
                 .Returns(Task.CompletedTask);

            var result = await Service().SaveAsync(Office365Request());

            result.Outcome.Should().Be(MailConfigurationOutcome.Success);
            result.Response.IsSuccess.Should().BeTrue();

            saved!.Host.Should().Be("smtp.office365.com");
            saved.Port.Should().Be(587);
            saved.AuthenticationType.Should().Be(MailAuthenticationType.OAuthClientCredentials);
            saved.SecurityMode.Should().Be(MailSecurityMode.StartTls);
            saved.EnableSSL.Should().BeFalse();
            saved.ClientSecretReference.Should().Be("secret-1");
            saved.AccountPassword.Should().BeEmpty();
            saved.IsEnableSnsConfiguration.Should().BeFalse();

            _secrets.Verify(
                s => s.SetAsync(
                    It.Is<SetSecretRequest>(r => r.Type == SecretTypes.Service && r.Value == "secret-value"),
                    It.IsAny<CancellationToken>()),
                Times.Once);
        }

        [Fact]
        public async Task Save_NewOffice365_ReturnsTheIdOfTheDocumentItWrote()
        {
            using var _ = new BlocksTestContext();
            MailServerConfiguration? saved = null;
            _repo.Setup(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()))
                 .Callback<MailServerConfiguration>(m => saved = m)
                 .Returns(Task.CompletedTask);

            var result = await Service().SaveAsync(Office365Request());

            result.Response.ItemId.Should().NotBeNullOrEmpty();
            result.Response.ItemId.Should().Be(saved!.ItemId);
        }

        [Fact]
        public async Task Save_NewZohoConfiguration_StoresThePasswordAsASecretAndOnlyItsReference()
        {
            using var _ = new BlocksTestContext();

            var result = await Service().SaveAsync(new MailConfiguration
            {
                ConfigurationId = "",
                ConfigurationName = "Zoho Primary",
                Provider = MailServiceProvider.Zoho,
                Host = "smtp.zoho.com",
                Port = 465,
                EnableSSL = true,
                SenderName = "Contoso",
                SenderAddress = "noreply@contoso.com",
                SenderUserName = "zohouser",
                AccountPassword = "password1"
            });

            result.Outcome.Should().Be(MailConfigurationOutcome.Success);
            _secrets.Verify(
                s => s.SetAsync(
                    It.Is<SetSecretRequest>(r => r.Name == "mail-password" && r.Type == SecretTypes.Service && r.Value == "password1"),
                    It.IsAny<CancellationToken>()),
                Times.Once);
            _repo.Verify(
                r => r.SaveMailConfigurationAsync(It.Is<MailServerConfiguration>(m =>
                    m.AccountPassword == "" && m.AccountPasswordReference == "secret-1" && m.EnableSSL && m.ClientSecretReference == null)),
                Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        // ---------- H4: edit ----------

        [Fact]
        public async Task Save_EditWithEmptySecret_KeepsTheExistingSecretUntouched()
        {
            using var _ = new BlocksTestContext();
            _repo.Setup(r => r.GetMailConfigurationByIdAsync("cfg-1")).ReturnsAsync(StoredOffice365());

            var request = Office365Request();
            request.ConfigurationId = "cfg-1";
            request.ClientSecret = "";
            request.SenderName = "Contoso Alerts";

            var result = await Service().SaveAsync(request);

            result.Outcome.Should().Be(MailConfigurationOutcome.Success);
            _secrets.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Never);
            _secrets.Verify(s => s.RotateAsync(It.IsAny<string>(), It.IsAny<RotateSecretRequest>(), It.IsAny<CancellationToken>()), Times.Never);
            _repo.Verify(
                r => r.SaveMailConfigurationAsync(It.Is<MailServerConfiguration>(m =>
                    m.SenderName == "Contoso Alerts" && m.ClientSecretReference == "secret-1")),
                Times.Once);
        }

        [Fact]
        public async Task Save_EditWithReplacementSecret_RotatesTheSameReference()
        {
            using var _ = new BlocksTestContext();
            _repo.Setup(r => r.GetMailConfigurationByIdAsync("cfg-1")).ReturnsAsync(StoredOffice365());

            var request = Office365Request();
            request.ConfigurationId = "cfg-1";
            request.ClientSecret = "replacement-value";

            var result = await Service().SaveAsync(request);

            result.Outcome.Should().Be(MailConfigurationOutcome.Success);
            _secrets.Verify(
                s => s.RotateAsync("secret-1", It.Is<RotateSecretRequest>(r => r.Value == "replacement-value"), It.IsAny<CancellationToken>()),
                Times.Once);
            _repo.Verify(
                r => r.SaveMailConfigurationAsync(It.Is<MailServerConfiguration>(m => m.ClientSecretReference == "secret-1")),
                Times.Once);
        }

        [Fact]
        public async Task Save_EditOfAMissingRecord_DoesNotCreateOne()
        {
            _repo.Setup(r => r.GetMailConfigurationByIdAsync("ghost")).ReturnsAsync((MailServerConfiguration?)null);

            var request = Office365Request();
            request.ConfigurationId = "ghost";

            var result = await Service().SaveAsync(request);

            result.Outcome.Should().Be(MailConfigurationOutcome.Invalid);
            result.Response.Errors.Should().Contain(new KeyValuePair<string, string>("ConfigurationId", "Configuration not found"));
            _repo.Verify(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()), Times.Never);
            _secrets.VerifyNoOtherCalls();
        }

        private static MailServerConfiguration StoredDefault() => new()
        {
            ItemId = "default-1",
            Name = "Default",
            IsDefault = true,
            Provider = MailServiceProvider.AmazonSes,
            IsInbound = false,
            Host = "email-smtp.eu-central-1.amazonaws.com",
            Port = 587,
            SenderName = "Selise Blocks",
            SenderAddress = "blocks@selise.io",
            SenderUserName = "ses-user",
            AccountPassword = "ses-password"
        };

        [Fact]
        public async Task Save_EditOfDefault_ChangesOnlyTheSenderName()
        {
            using var _ = new BlocksTestContext();
            _repo.Setup(r => r.GetMailConfigurationByIdAsync("default-1")).ReturnsAsync(StoredDefault());

            // Everything but the sender name is either changed or blank, as a browser that never
            // received the password would send it.
            var result = await Service().SaveAsync(new MailConfiguration
            {
                ConfigurationId = "default-1",
                ConfigurationName = "Renamed",
                Provider = MailServiceProvider.Zoho,
                Host = "smtp.other.example",
                Port = 25,
                SenderName = "  Contoso Mailer  ",
                SenderAddress = "other@contoso.com",
                SenderUserName = "",
                AccountPassword = ""
            });

            result.Outcome.Should().Be(MailConfigurationOutcome.Success);
            result.Response.ItemId.Should().Be("default-1");

            // Only the sender name is written, as a field update; the document is never replaced.
            _repo.Verify(
                r => r.UpdateMailSenderNameAsync("default-1", "Contoso Mailer", It.IsAny<DateTime>(), It.IsAny<string>()),
                Times.Once);
            _repo.Verify(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()), Times.Never);
            _secrets.VerifyNoOtherCalls();
        }

        [Theory]
        [InlineData(null)]
        [InlineData("  ")]
        [InlineData("ab")]
        public async Task Save_EditOfDefaultWithInvalidSenderName_IsRejected(string? senderName)
        {
            _repo.Setup(r => r.GetMailConfigurationByIdAsync("default-1")).ReturnsAsync(StoredDefault());

            var result = await Service().SaveAsync(new MailConfiguration
            {
                ConfigurationId = "default-1",
                ConfigurationName = "Default",
                Host = "email-smtp.eu-central-1.amazonaws.com",
                Port = 587,
                SenderName = senderName
            });

            result.Outcome.Should().Be(MailConfigurationOutcome.Invalid);
            result.Response.Errors.Should().ContainKey("SenderName");
            _repo.Verify(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()), Times.Never);
            _repo.Verify(
                r => r.UpdateMailSenderNameAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<string>()),
                Times.Never);
        }

        [Fact]
        public async Task Save_EditChangingProvider_IsRejectedBeforeAnyCredentialWork()
        {
            _repo.Setup(r => r.GetMailConfigurationByIdAsync("cfg-1")).ReturnsAsync(StoredOffice365());

            var request = Office365Request();
            request.ConfigurationId = "cfg-1";
            request.Provider = MailServiceProvider.Zoho;
            request.SenderUserName = "zohouser";
            request.AccountPassword = "password1";

            var result = await Service().SaveAsync(request);

            result.Outcome.Should().Be(MailConfigurationOutcome.Invalid);
            result.Response.Errors.Should().Contain(new KeyValuePair<string, string>(
                "Provider", "The provider and direction of an existing configuration cannot be changed."));
            _secrets.VerifyNoOtherCalls();
            _repo.Verify(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()), Times.Never);
        }

        // ---------- C1 / C2: rejections ----------

        [Fact]
        public async Task Save_AmazonSesInbound_IsRejectedWithNoWrites()
        {
            var request = Office365Request();
            request.Provider = MailServiceProvider.AmazonSes;
            request.IsInbound = true;

            var result = await Service().SaveAsync(request);

            result.Outcome.Should().Be(MailConfigurationOutcome.Invalid);
            result.Response.Errors.Should().Contain(new KeyValuePair<string, string>(
                "IsInbound", "Amazon SES supports outbound configurations only."));
            _secrets.VerifyNoOtherCalls();
            _repo.Verify(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()), Times.Never);
        }

        // ---------- Office 365 inbound and password mode ----------

        [Fact]
        public async Task Save_Office365Inbound_UsesImapTransportAndOAuth()
        {
            using var _ = new BlocksTestContext();
            MailServerConfiguration? saved = null;
            _repo.Setup(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()))
                 .Callback<MailServerConfiguration>(m => saved = m)
                 .Returns(Task.CompletedTask);

            var request = Office365Request();
            request.IsInbound = true;
            request.SenderName = null;
            request.SenderAddress = null;

            var result = await Service().SaveAsync(request);

            result.Outcome.Should().Be(MailConfigurationOutcome.Success);
            saved!.Host.Should().Be("outlook.office365.com");
            saved.Port.Should().Be(993);
            saved.SecurityMode.Should().Be(MailSecurityMode.SslOnConnect);
            saved.EnableSSL.Should().BeTrue();
            saved.AuthenticationType.Should().Be(MailAuthenticationType.OAuthClientCredentials);
            saved.ClientSecretReference.Should().Be("secret-1");
        }

        [Fact]
        public async Task Save_Office365InboundWithPasswordOnly_IsRejected()
        {
            var request = new MailConfiguration
            {
                ConfigurationId = "",
                ConfigurationName = "Microsoft 365 Inbox",
                Provider = MailServiceProvider.Office365Smtp,
                IsInbound = true,
                AuthenticationType = MailAuthenticationType.Password,
                SenderUserName = "support@contoso.com",
                AccountPassword = "password1"
            };

            var result = await Service().SaveAsync(request);

            result.Outcome.Should().Be(MailConfigurationOutcome.Invalid);
            result.Response.Errors.Should().Contain(new KeyValuePair<string, string>(
                "AccountPassword", "Office 365 inbound does not accept password authentication. Use OAuth client credentials."));
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Save_Office365OutboundWithPassword_StoresThePasswordAsASecretAndNoClientSecret()
        {
            using var _ = new BlocksTestContext();
            MailServerConfiguration? saved = null;
            _repo.Setup(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()))
                 .Callback<MailServerConfiguration>(m => saved = m)
                 .Returns(Task.CompletedTask);

            var request = new MailConfiguration
            {
                ConfigurationId = "",
                ConfigurationName = "Microsoft 365 Basic",
                Provider = MailServiceProvider.Office365Smtp,
                IsInbound = false,
                AuthenticationType = MailAuthenticationType.Password,
                SenderName = "Contoso Support",
                SenderAddress = "support@contoso.com",
                SenderUserName = "support@contoso.com",
                AccountPassword = "password1",
                Host = "smtp.contoso.example",
                Port = 25
            };

            var result = await Service().SaveAsync(request);

            result.Outcome.Should().Be(MailConfigurationOutcome.Success);
            saved!.Host.Should().Be("smtp.office365.com");
            saved.Port.Should().Be(587);
            saved.SecurityMode.Should().Be(MailSecurityMode.StartTls);
            saved.AuthenticationType.Should().Be(MailAuthenticationType.Password);
            saved.SenderUserName.Should().Be("support@contoso.com");
            saved.AccountPassword.Should().BeEmpty();
            saved.AccountPasswordReference.Should().Be("secret-1");
            saved.ClientSecretReference.Should().BeNull();
            _secrets.Verify(
                s => s.SetAsync(
                    It.Is<SetSecretRequest>(r => r.Name == "mail-password" && r.Type == SecretTypes.Service && r.Value == "password1"),
                    It.IsAny<CancellationToken>()),
                Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Save_Office365EditChangingAuthenticationMethod_IsRejected()
        {
            _repo.Setup(r => r.GetMailConfigurationByIdAsync("cfg-1")).ReturnsAsync(StoredOffice365());

            var request = new MailConfiguration
            {
                ConfigurationId = "cfg-1",
                ConfigurationName = "Microsoft 365 Primary",
                Provider = MailServiceProvider.Office365Smtp,
                AuthenticationType = MailAuthenticationType.Password,
                SenderName = "Contoso Notifications",
                SenderAddress = "notifications@contoso.com",
                SenderUserName = "notifications@contoso.com",
                AccountPassword = "password1"
            };

            var result = await Service().SaveAsync(request);

            result.Response.Errors.Should().Contain(new KeyValuePair<string, string>(
                "AuthenticationType", "The authentication method of an existing Office 365 configuration cannot be changed."));

            // The stored secret's metadata may be read to judge the edit; nothing is written.
            _secrets.Verify(s => s.GetAsync("secret-1", It.IsAny<CancellationToken>()), Times.AtMostOnce());
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Save_UndefinedProvider_IsRejected()
        {
            var request = Office365Request();
            request.Provider = (MailServiceProvider)99;

            var result = await Service().SaveAsync(request);

            result.Outcome.Should().Be(MailConfigurationOutcome.Invalid);
            result.Response.Errors.Should().Contain(new KeyValuePair<string, string>(
                "Provider", "Unsupported mail service provider."));
        }

        [Theory]
        [InlineData("TenantId", "Tenant ID is required for SMTP Office 365.")]
        [InlineData("ClientId", "Client ID is required for SMTP Office 365.")]
        [InlineData("MailboxAddress", "Mailbox address must be a valid email address.")]
        public async Task Save_MissingOffice365Field_ReturnsTheExactError(string field, string message)
        {
            var request = Office365Request();
            switch (field)
            {
                case "TenantId": request.TenantId = "   "; break;
                case "ClientId": request.ClientId = ""; break;
                case "MailboxAddress": request.MailboxAddress = "not-an-email"; break;
            }

            var result = await Service().SaveAsync(request);

            result.Outcome.Should().Be(MailConfigurationOutcome.Invalid);
            result.Response.Errors.Should().Contain(new KeyValuePair<string, string>(field, message));
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Save_MissingSecretOnCreate_IsRejected()
        {
            var request = Office365Request();
            request.ClientSecret = null;

            var result = await Service().SaveAsync(request);

            result.Response.Errors.Should().Contain(new KeyValuePair<string, string>(
                "ClientSecret", "Client secret is required for a new SMTP Office 365 configuration."));
        }

        [Fact]
        public async Task Save_WhitespaceSecretOnEdit_IsRejectedRatherThanTreatedAsPreserve()
        {
            _repo.Setup(r => r.GetMailConfigurationByIdAsync("cfg-1")).ReturnsAsync(StoredOffice365());

            var request = Office365Request();
            request.ConfigurationId = "cfg-1";
            request.ClientSecret = "   ";

            var result = await Service().SaveAsync(request);

            result.Response.Errors.Should().Contain(new KeyValuePair<string, string>(
                "ClientSecret", "Client secret must not be blank."));
            _secrets.Verify(s => s.RotateAsync(It.IsAny<string>(), It.IsAny<RotateSecretRequest>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Save_Office365WithPassword_IsRejected()
        {
            var request = Office365Request();
            request.AccountPassword = "password1";

            var result = await Service().SaveAsync(request);

            result.Response.Errors.Should().Contain(new KeyValuePair<string, string>(
                "AccountPassword", "Password authentication is not supported for SMTP Office 365."));
        }

        [Fact]
        public async Task Save_Office365WithSns_IsRejected()
        {
            var request = Office365Request();
            request.IsEnableSnsConfiguration = true;

            var result = await Service().SaveAsync(request);

            result.Response.Errors.Should().Contain(new KeyValuePair<string, string>(
                "IsEnableSnsConfiguration", "SNS configuration is not supported for SMTP Office 365."));
        }

        [Fact]
        public async Task Save_Office365WithInvalidSenderAddress_ReturnsTheSharedError()
        {
            var request = Office365Request();
            request.SenderAddress = "nope";

            var result = await Service().SaveAsync(request);

            result.Response.Errors.Should().Contain(new KeyValuePair<string, string>(
                "SenderAddress", "Sender email address must be a valid email."));
        }

        // ---------- C3: secret failures ----------

        [Fact]
        public async Task Save_VaultUnavailable_Returns503AndWritesNothing()
        {
            _secrets.Setup(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()))
                    .ThrowsAsync(new SecretVaultException("down", "set", "secret-1"));

            var result = await Service().SaveAsync(Office365Request());

            result.Outcome.Should().Be(MailConfigurationOutcome.SecretStoreUnavailable);
            result.Response.Errors.Should().Contain(new KeyValuePair<string, string>(
                "ClientSecret", "The secret store is unavailable. Try again later."));
            _repo.Verify(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()), Times.Never);
        }

        [Fact]
        public async Task Save_AuthorizationFailure_IsNotTurnedIntoAnAvailabilityError()
        {
            _secrets.Setup(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()))
                    .ThrowsAsync(new SecretAccessDeniedException("not_permitted"));

            // Left to propagate so the global SecretExceptionFilter answers 403.
            await Assert.ThrowsAsync<SecretAccessDeniedException>(() => Service().SaveAsync(Office365Request()));
            _repo.Verify(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()), Times.Never);
        }

        [Fact]
        public async Task Save_ConfigurationWriteFails_RetiresTheSecretItJustCreated()
        {
            using var _ = new BlocksTestContext();
            _repo.Setup(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()))
                 .ThrowsAsync(new InvalidOperationException("mongo down"));

            await Assert.ThrowsAsync<InvalidOperationException>(() => Service().SaveAsync(Office365Request()));

            _secrets.Verify(s => s.DeleteAsync("secret-1", It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Save_ConfigurationWriteFailsAfterRotation_DoesNotRetireTheExistingSecret()
        {
            using var _ = new BlocksTestContext();
            _repo.Setup(r => r.GetMailConfigurationByIdAsync("cfg-1")).ReturnsAsync(StoredOffice365());
            _repo.Setup(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()))
                 .ThrowsAsync(new InvalidOperationException("mongo down"));

            var request = Office365Request();
            request.ConfigurationId = "cfg-1";
            request.ClientSecret = "replacement-value";

            await Assert.ThrowsAsync<InvalidOperationException>(() => Service().SaveAsync(request));

            // The secret belongs to the record, which still exists. Deleting it here would take
            // out a live configuration's credential over a failed edit.
            _secrets.Verify(s => s.DeleteAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        // ---------- H3: projection ----------

        [Fact]
        public async Task GetAll_Office365_ExposesNonSecretFieldsAndTheConfiguredFlagOnly()
        {
            _repo.Setup(r => r.GetAllMailConfigurationsAsync())
                 .ReturnsAsync(new List<MailServerConfiguration> { StoredOffice365() });

            var responses = await Service().GetAllAsync();

            var response = responses.Single();
            response.Provider.Should().Be(MailServiceProvider.Office365Smtp);
            response.TenantId.Should().Be("contoso-tenant");
            response.ClientId.Should().Be("mailer-app");
            response.MailboxAddress.Should().Be("mailer@contoso.com");
            response.IsClientSecretConfigured.Should().BeTrue();

            // Neither the plaintext nor the reference has a field to travel in, and the password
            // mask is dropped so nothing submittable is shown.
            response.AccountPassword.Should().BeNull();
            response.GetType().GetProperty("ClientSecretReference").Should().BeNull();
            response.GetType().GetProperty("ClientSecret").Should().BeNull();
        }

        [Fact]
        public async Task GetAll_LegacyRecord_KeepsTheExistingMask()
        {
            _repo.Setup(r => r.GetAllMailConfigurationsAsync())
                 .ReturnsAsync(new List<MailServerConfiguration>
                 {
                     new() { Provider = MailServiceProvider.Zoho, AccountPassword = "actual", EnableSSL = true }
                 });

            var response = (await Service().GetAllAsync()).Single();

            response.AccountPassword.Should().Be("********");
            response.IsClientSecretConfigured.Should().BeFalse();
            response.EnableSSL.Should().BeTrue();
        }

        [Fact]
        public async Task GetAll_PreChangeRecordWithoutNewFields_DeserializesOntoTheLegacyPath()
        {
            // What an old BSON document yields: the additive fields absent, so the zero values.
            _repo.Setup(r => r.GetAllMailConfigurationsAsync())
                 .ReturnsAsync(new List<MailServerConfiguration>
                 {
                     new() { Provider = MailServiceProvider.Zoho, Name = "Legacy", AccountPassword = "p", EnableSSL = true }
                 });

            var response = (await Service().GetAllAsync()).Single();

            response.AuthenticationType.Should().Be(MailAuthenticationType.Password);
            response.SecurityMode.Should().Be(MailSecurityMode.Legacy);
            response.TenantId.Should().BeNull();
        }

        [Fact]
        public async Task Get_ByName_ReadsTheStoredRecord()
        {
            _repo.Setup(r => r.GetMailConfigurationByNameForViewAsync("Microsoft 365 Primary")).ReturnsAsync(StoredOffice365());

            var response = await Service().GetAsync(new GetMailConfigurationRequest { ConfigurationName = "Microsoft 365 Primary" });

            response!.Name.Should().Be("Microsoft 365 Primary");
            response.IsClientSecretConfigured.Should().BeTrue();
        }

        // ---------- H5: duplicate and delete ----------

        [Fact]
        public async Task Duplicate_Office365WithoutASecret_IsRejected()
        {
            _repo.Setup(r => r.GetMailConfigurationByIdAsync("cfg-1")).ReturnsAsync(StoredOffice365());

            var result = await Service().DuplicateAsync(new DuplicateMailConfigurationRequest { ConfigurationId = "cfg-1" });

            result.Outcome.Should().Be(MailConfigurationOutcome.Invalid);
            result.Response.Errors.Should().Contain(new KeyValuePair<string, string>(
                "ClientSecret", "A new client secret is required to duplicate an SMTP Office 365 configuration."));
            _repo.Verify(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()), Times.Never);
        }

        [Fact]
        public async Task Duplicate_Office365WithASecret_CreatesAnIndependentNonDefaultCopy()
        {
            using var _ = new BlocksTestContext();
            _repo.Setup(r => r.GetMailConfigurationByIdAsync("cfg-1"))
                 .ReturnsAsync(() =>
                 {
                     var source = StoredOffice365();
                     source.IsDefault = true;
                     return source;
                 });
            _secrets.Setup(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()))
                    .ReturnsAsync("secret-2");

            MailServerConfiguration? saved = null;
            _repo.Setup(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()))
                 .Callback<MailServerConfiguration>(m => saved = m)
                 .Returns(Task.CompletedTask);

            var result = await Service().DuplicateAsync(new DuplicateMailConfigurationRequest
            {
                ConfigurationId = "cfg-1",
                ClientSecret = "copy-secret"
            });

            result.Outcome.Should().Be(MailConfigurationOutcome.Success);
            saved!.Name.Should().Be("Microsoft 365 Primary - Copy");
            saved.ClientSecretReference.Should().Be("secret-2");
            saved.ItemId.Should().NotBe("cfg-1");
            saved.IsDefault.Should().BeFalse();
            result.Response.ItemId.Should().Be(saved.ItemId);
        }

        [Fact]
        public async Task Duplicate_LegacyRecord_GivesTheCopyItsOwnSecretFromTheDocumentPassword()
        {
            using var _ = new BlocksTestContext();
            _repo.Setup(r => r.GetMailConfigurationByIdAsync("c-1"))
                 .ReturnsAsync(new MailServerConfiguration
                 {
                     ItemId = "c-1",
                     Name = "Primary",
                     Host = "smtp.zoho.com",
                     Provider = MailServiceProvider.Zoho,
                     AccountPassword = "password1",
                     IsDefault = true
                 });

            MailServerConfiguration? saved = null;
            _repo.Setup(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()))
                 .Callback<MailServerConfiguration>(m => saved = m)
                 .Returns(Task.CompletedTask);

            var result = await Service().DuplicateAsync(new DuplicateMailConfigurationRequest { ConfigurationId = "c-1" });

            result.Outcome.Should().Be(MailConfigurationOutcome.Success);
            saved!.Name.Should().Be("Primary - Copy");
            saved.AccountPassword.Should().BeEmpty();
            saved.AccountPasswordReference.Should().Be("secret-1");
            saved.IsDefault.Should().BeTrue();

            // The source still holds its password in the document, so there is no value to read.
            _secrets.Verify(
                s => s.SetAsync(It.Is<SetSecretRequest>(r => r.Name == "mail-password" && r.Value == "password1"), It.IsAny<CancellationToken>()),
                Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Delete_Office365_RetiresTheSecretBeforeTheConfiguration()
        {
            var order = new List<string>();
            _repo.Setup(r => r.GetMailConfigurationByIdAsync("cfg-1")).ReturnsAsync(StoredOffice365());
            _secrets.Setup(s => s.DeleteAsync("secret-1", It.IsAny<CancellationToken>()))
                    .Callback(() => order.Add("secret"))
                    .Returns(Task.CompletedTask);
            _repo.Setup(r => r.DeleteMailConfigurationAsync("cfg-1"))
                 .Callback(() => order.Add("configuration"))
                 .Returns(Task.CompletedTask);

            var result = await Service().DeleteAsync(new DeleteMailConfigurationRequest { ConfigurationId = "cfg-1" });

            result.Outcome.Should().Be(MailConfigurationOutcome.Success);
            order.Should().Equal("secret", "configuration");
        }

        [Fact]
        public async Task Delete_SecretRetirementFails_LeavesTheConfigurationInPlace()
        {
            _repo.Setup(r => r.GetMailConfigurationByIdAsync("cfg-1")).ReturnsAsync(StoredOffice365());
            _secrets.Setup(s => s.DeleteAsync("secret-1", It.IsAny<CancellationToken>()))
                    .ThrowsAsync(new SecretVaultException("down", "delete", "secret-1"));

            var result = await Service().DeleteAsync(new DeleteMailConfigurationRequest { ConfigurationId = "cfg-1" });

            result.Outcome.Should().Be(MailConfigurationOutcome.SecretStoreUnavailable);
            _repo.Verify(r => r.DeleteMailConfigurationAsync(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task Delete_ConfigurationWriteFailsAfterRetirement_RestoresTheSecret()
        {
            _repo.Setup(r => r.GetMailConfigurationByIdAsync("cfg-1")).ReturnsAsync(StoredOffice365());
            _repo.Setup(r => r.DeleteMailConfigurationAsync("cfg-1"))
                 .ThrowsAsync(new InvalidOperationException("mongo down"));

            await Assert.ThrowsAsync<InvalidOperationException>(
                () => Service().DeleteAsync(new DeleteMailConfigurationRequest { ConfigurationId = "cfg-1" }));

            _secrets.Verify(s => s.RestoreAsync("secret-1", It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Delete_LegacyRecord_TouchesNoSecret()
        {
            _repo.Setup(r => r.GetMailConfigurationByIdAsync("c-1"))
                 .ReturnsAsync(new MailServerConfiguration { ItemId = "c-1", Provider = MailServiceProvider.Zoho });

            var result = await Service().DeleteAsync(new DeleteMailConfigurationRequest { ConfigurationId = "c-1" });

            result.Outcome.Should().Be(MailConfigurationOutcome.Success);
            _secrets.Verify(s => s.DeleteAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        // ---------- Linked secret status (H2, C1, C12, C14) ----------

        [Theory]
        [InlineData(SecretStatuses.Active, LinkedSecretStatus.Active, true)]
        [InlineData(SecretStatuses.Locked, LinkedSecretStatus.Locked, true)]
        [InlineData(SecretStatuses.Deleted, LinkedSecretStatus.Archived, false)]
        [InlineData(null, LinkedSecretStatus.Missing, false)]
        public async Task GetAll_Office365_ReportsTheLinkedSecretStatus(string? secretStatus, string expected, bool configured)
        {
            GivenSecretStatus(secretStatus);
            _repo.Setup(r => r.GetAllMailConfigurationsAsync())
                 .ReturnsAsync(new List<MailServerConfiguration> { StoredOffice365() });

            var response = (await Service().GetAllAsync()).Single();

            response.ClientSecretStatus.Should().Be(expected);
            response.IsClientSecretConfigured.Should().Be(configured);
        }

        [Fact]
        public async Task GetAll_Office365WithoutAReference_ReportsNone()
        {
            var stored = StoredOffice365();
            stored.ClientSecretReference = null;
            _repo.Setup(r => r.GetAllMailConfigurationsAsync()).ReturnsAsync(new List<MailServerConfiguration> { stored });

            var response = (await Service().GetAllAsync()).Single();

            response.ClientSecretStatus.Should().Be(LinkedSecretStatus.None);
            response.IsClientSecretConfigured.Should().BeFalse();
            _secrets.Verify(s => s.GetAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task GetAll_AFailedStatusRead_MarksOnlyThatConfigurationUnavailable()
        {
            var healthy = StoredOffice365("cfg-1");
            var unreadable = StoredOffice365("cfg-2");
            unreadable.ClientSecretReference = "secret-down";
            _repo.Setup(r => r.GetAllMailConfigurationsAsync())
                 .ReturnsAsync(new List<MailServerConfiguration> { healthy, unreadable });
            _secrets.Setup(s => s.GetAsync("secret-down", It.IsAny<CancellationToken>()))
                    .ThrowsAsync(new SecretVaultException("down", "get", "secret-down"));

            var responses = await Service().GetAllAsync();

            responses.Select(r => (r.ItemId, r.ClientSecretStatus, r.IsClientSecretConfigured)).Should().Equal(
                ("cfg-1", LinkedSecretStatus.Active, true),
                // A4: an outage keeps "configured" so nobody is forced to re-enter a secret.
                ("cfg-2", LinkedSecretStatus.Unavailable, true));

            // C1: the configuration id is logged; the reference never is.
            var warning = _providerLogger.Entries.Should().ContainSingle(e => e.Level == LogLevel.Warning).Subject;
            warning.Message.Should().Contain("cfg-2");
            warning.Message.Should().NotContain("secret-down");
        }

        [Fact]
        public async Task GetAll_PasswordProvidersAndOffice365PasswordMode_HaveNoStatusAndReadNoSecret()
        {
            var office365Password = StoredOffice365("cfg-pw");
            office365Password.AuthenticationType = MailAuthenticationType.Password;
            office365Password.ClientSecretReference = null;
            _repo.Setup(r => r.GetAllMailConfigurationsAsync())
                 .ReturnsAsync(new List<MailServerConfiguration>
                 {
                     new() { ItemId = "zoho", Provider = MailServiceProvider.Zoho, AccountPassword = "p" },
                     office365Password
                 });

            var responses = await Service().GetAllAsync();

            responses.Should().OnlyContain(r => r.ClientSecretStatus == null);
            _secrets.Verify(s => s.GetAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Get_ByName_ReportsTheLinkedSecretStatus()
        {
            GivenSecretStatus(SecretStatuses.Deleted);
            _repo.Setup(r => r.GetMailConfigurationByNameForViewAsync("Microsoft 365 Primary")).ReturnsAsync(StoredOffice365());

            var response = await Service().GetAsync(new GetMailConfigurationRequest { ConfigurationName = "Microsoft 365 Primary" });

            response!.ClientSecretStatus.Should().Be(LinkedSecretStatus.Archived);
            response.IsClientSecretConfigured.Should().BeFalse();
        }

        [Fact]
        public async Task GetAll_SerializedResponse_CarriesTheStatusButNeverTheReference()
        {
            GivenSecretStatus(null);
            _repo.Setup(r => r.GetAllMailConfigurationsAsync())
                 .ReturnsAsync(new List<MailServerConfiguration>
                 {
                     StoredOffice365(),
                     new() { ItemId = "zoho", Provider = MailServiceProvider.Zoho, AccountPassword = "p" },
                     new() { ItemId = "zoho-ref", Provider = MailServiceProvider.Zoho, AccountPassword = "", AccountPasswordReference = "password-ref-1" }
                 });

            var responses = await Service().GetAllAsync();
            var json = System.Text.Json.JsonSerializer.Serialize(
                responses,
                new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web));

            json.Should().NotContain("secret-1");
            json.Should().NotContain("clientSecretReference", "the reference has no field to travel in");
            json.Should().NotContain("password-ref-1");
            json.Should().NotContain("accountPasswordReference", "the password reference has no field to travel in either");
            responses.Where(r => r.Provider == MailServiceProvider.Zoho).Should().OnlyContain(r => r.AccountPassword == "********");
            json.Should().Contain("\"clientSecretStatus\":\"missing\"");

            // Omitted, not null, for a provider that owns no linked secret.
            System.Text.RegularExpressions.Regex.Matches(json, "clientSecretStatus").Should().HaveCount(1);
        }

        [Fact]
        public async Task ReadsAndSaves_NeverReadASecretValue()
        {
            // Only a duplicate reads a value (the source password, to copy it). Listing and saving
            // a configuration of either kind, linked or not, never does.
            using var _ = new BlocksTestContext();
            var zoho = new MailServerConfiguration
            {
                ItemId = "zoho-1",
                Name = "Zoho Primary",
                Provider = MailServiceProvider.Zoho,
                Host = "smtp.zoho.com",
                Port = 465,
                AccountPassword = "",
                AccountPasswordReference = "password-ref-1"
            };
            _repo.Setup(r => r.GetAllMailConfigurationsAsync()).ReturnsAsync(new List<MailServerConfiguration> { StoredOffice365(), zoho });
            _repo.Setup(r => r.GetMailConfigurationByIdAsync("cfg-1")).ReturnsAsync(StoredOffice365());
            _repo.Setup(r => r.GetMailConfigurationByIdAsync("zoho-1")).ReturnsAsync(zoho);
            var request = Office365Request();
            request.ConfigurationId = "cfg-1";
            request.ClientSecret = "";

            await Service().GetAllAsync();
            await Service().SaveAsync(request);
            (await Service().SaveAsync(new MailConfiguration
            {
                ConfigurationId = "zoho-1",
                ConfigurationName = "Zoho Primary",
                Provider = MailServiceProvider.Zoho,
                Host = "smtp.zoho.com",
                Port = 465,
                SenderName = "Contoso",
                SenderAddress = "noreply@contoso.com",
                SenderUserName = "zohouser",
                AccountPassword = "password2"
            })).Outcome.Should().Be(MailConfigurationOutcome.Success);

            _secrets.Verify(s => s.GetValueAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
            _secrets.Verify(s => s.GetValuesAsync(It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        // ---------- Repair (H6, C3, C4, C15, C16) ----------

        [Theory]
        [InlineData(SecretStatuses.Deleted)]
        [InlineData(null)]
        public async Task Save_EditWithEmptySecretAndABrokenReference_IsRejectedWithNoWrites(string? brokenStatus)
        {
            using var _ = new BlocksTestContext();
            GivenSecretStatus(brokenStatus);
            _repo.Setup(r => r.GetMailConfigurationByIdAsync("cfg-1")).ReturnsAsync(StoredOffice365());

            var request = Office365Request();
            request.ConfigurationId = "cfg-1";
            request.ClientSecret = "";

            var result = await Service().SaveAsync(request);

            result.Outcome.Should().Be(MailConfigurationOutcome.Invalid);
            result.Response.IsSuccess.Should().BeFalse();
            result.Response.Errors.Should().Contain(new KeyValuePair<string, string>(
                "ClientSecret", "The linked client secret was archived or removed. Enter a new client secret."));
            _secrets.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Never);
            _repo.Verify(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()), Times.Never);
        }

        [Theory]
        [InlineData(SecretStatuses.Deleted)]
        [InlineData(null)]
        public async Task Save_EditWithANewSecretAndABrokenReference_CreatesANewSecretAndRepoints(string? brokenStatus)
        {
            using var _ = new BlocksTestContext();
            GivenSecretStatus(brokenStatus);
            _repo.Setup(r => r.GetMailConfigurationByIdAsync("cfg-1")).ReturnsAsync(StoredOffice365());
            _secrets.Setup(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()))
                    .ReturnsAsync("secret-2");

            var request = Office365Request();
            request.ConfigurationId = "cfg-1";
            request.ClientSecret = "replacement";

            var result = await Service().SaveAsync(request);

            result.Outcome.Should().Be(MailConfigurationOutcome.Success);
            result.Response.IsSuccess.Should().BeTrue();
            _secrets.Verify(
                s => s.SetAsync(
                    It.Is<SetSecretRequest>(r => r.Name == "office365-smtp" && r.Type == SecretTypes.Service && r.Value == "replacement"),
                    It.IsAny<CancellationToken>()),
                Times.Once);
            _secrets.Verify(s => s.RotateAsync(It.IsAny<string>(), It.IsAny<RotateSecretRequest>(), It.IsAny<CancellationToken>()), Times.Never);
            _secrets.Verify(s => s.DeleteAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
            _secrets.Verify(s => s.RestoreAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
            _repo.Verify(
                r => r.SaveMailConfigurationAsync(It.Is<MailServerConfiguration>(m => m.ItemId == "cfg-1" && m.ClientSecretReference == "secret-2")),
                Times.Once);
        }

        [Fact]
        public async Task Save_RepairWhoseWriteFails_RetiresTheNewSecretOnly()
        {
            using var _ = new BlocksTestContext();
            GivenSecretStatus(SecretStatuses.Deleted);

            // A fresh document per read, as the database returns: the read-back after the failed
            // write must see the stored record, not the instance the service updated in memory.
            _repo.Setup(r => r.GetMailConfigurationByIdAsync("cfg-1")).ReturnsAsync(() => StoredOffice365());
            _repo.Setup(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()))
                 .ThrowsAsync(new InvalidOperationException("mongo down"));
            _secrets.Setup(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()))
                    .ReturnsAsync("secret-2");

            var request = Office365Request();
            request.ConfigurationId = "cfg-1";
            request.ClientSecret = "replacement";

            await Assert.ThrowsAsync<InvalidOperationException>(() => Service().SaveAsync(request));

            _secrets.Verify(s => s.DeleteAsync("secret-2", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.Verify(s => s.DeleteAsync("secret-1", It.IsAny<CancellationToken>()), Times.Never);
        }

        [Theory]
        [InlineData(SecretStatuses.Locked)]
        [InlineData("unreadable")]
        public async Task Save_LockedOrUnavailableReference_KeepsTheExistingBehaviour(string status)
        {
            using var _ = new BlocksTestContext();
            if (status == "unreadable")
            {
                _secrets.Setup(s => s.GetAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                        .ThrowsAsync(new SecretVaultException("down", "get", "secret-1"));
            }
            else
            {
                GivenSecretStatus(status);
            }

            _repo.Setup(r => r.GetMailConfigurationByIdAsync("cfg-1")).ReturnsAsync(StoredOffice365());

            var keep = Office365Request();
            keep.ConfigurationId = "cfg-1";
            keep.ClientSecret = "";
            (await Service().SaveAsync(keep)).Outcome.Should().Be(MailConfigurationOutcome.Success);

            var rotate = Office365Request();
            rotate.ConfigurationId = "cfg-1";
            rotate.ClientSecret = "v2";
            (await Service().SaveAsync(rotate)).Outcome.Should().Be(MailConfigurationOutcome.Success);

            _secrets.Verify(s => s.RotateAsync("secret-1", It.IsAny<RotateSecretRequest>(), It.IsAny<CancellationToken>()), Times.Once);
            _secrets.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Save_EditOfAnOffice365Default_KeepsTheSenderNameOnlyPathAndChecksNoSecret()
        {
            using var _ = new BlocksTestContext();
            GivenSecretStatus(null);
            var stored = StoredOffice365("default-o365");
            stored.IsDefault = true;
            _repo.Setup(r => r.GetMailConfigurationByIdAsync("default-o365")).ReturnsAsync(stored);

            var result = await Service().SaveAsync(new MailConfiguration
            {
                ConfigurationId = "default-o365",
                Provider = MailServiceProvider.Office365Smtp,
                SenderName = "Contoso Mailer"
            });

            result.Outcome.Should().Be(MailConfigurationOutcome.Success);
            _repo.Verify(r => r.UpdateMailSenderNameAsync("default-o365", "Contoso Mailer", It.IsAny<DateTime>(), It.IsAny<string>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        // ---------- Tolerant delete (H7, C5, C6, C7) ----------

        public static TheoryData<Exception> AlreadyRetired => new()
        {
            new SecretStateException(SecretStatuses.Deleted, "delete", "STATUS_DELETED"),
            new SecretNotFoundException("secret-1")
        };

        [Theory]
        [MemberData(nameof(AlreadyRetired))]
        public async Task Delete_SecretAlreadyArchivedOrPurged_StillDeletesTheConfiguration(Exception alreadyRetired)
        {
            _repo.Setup(r => r.GetMailConfigurationByIdAsync("cfg-1")).ReturnsAsync(StoredOffice365());
            _secrets.Setup(s => s.DeleteAsync("secret-1", It.IsAny<CancellationToken>())).ThrowsAsync(alreadyRetired);

            var result = await Service().DeleteAsync(new DeleteMailConfigurationRequest { ConfigurationId = "cfg-1" });

            result.Outcome.Should().Be(MailConfigurationOutcome.Success);
            _repo.Verify(r => r.DeleteMailConfigurationAsync("cfg-1"), Times.Once);
            _secrets.Verify(s => s.RestoreAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
            _secrets.Verify(s => s.PurgeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Delete_SkippedAnAlreadyArchivedSecretThenTheWriteFails_DoesNotRestoreIt()
        {
            _repo.Setup(r => r.GetMailConfigurationByIdAsync("cfg-1")).ReturnsAsync(StoredOffice365());
            _secrets.Setup(s => s.DeleteAsync("secret-1", It.IsAny<CancellationToken>()))
                    .ThrowsAsync(new SecretStateException(SecretStatuses.Deleted, "delete", "STATUS_DELETED"));
            _repo.Setup(r => r.DeleteMailConfigurationAsync("cfg-1"))
                 .ThrowsAsync(new InvalidOperationException("mongo down"));

            await Assert.ThrowsAsync<InvalidOperationException>(
                () => Service().DeleteAsync(new DeleteMailConfigurationRequest { ConfigurationId = "cfg-1" }));

            _secrets.Verify(s => s.RestoreAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Delete_AccessDenied_KeepsTheConfigurationAndSurfacesTheError()
        {
            _repo.Setup(r => r.GetMailConfigurationByIdAsync("cfg-1")).ReturnsAsync(StoredOffice365());
            _secrets.Setup(s => s.DeleteAsync("secret-1", It.IsAny<CancellationToken>()))
                    .ThrowsAsync(new SecretAccessDeniedException("NOT_IN_ACCESS_LIST"));

            await Assert.ThrowsAsync<SecretAccessDeniedException>(
                () => Service().DeleteAsync(new DeleteMailConfigurationRequest { ConfigurationId = "cfg-1" }));

            _repo.Verify(r => r.DeleteMailConfigurationAsync(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task Delete_Missing_ReturnsTheNotFoundError()
        {
            _repo.Setup(r => r.GetMailConfigurationByIdAsync("missing")).ReturnsAsync((MailServerConfiguration?)null);

            var result = await Service().DeleteAsync(new DeleteMailConfigurationRequest { ConfigurationId = "missing" });

            result.Outcome.Should().Be(MailConfigurationOutcome.Invalid);
            result.Response.Errors.Should().ContainKey("ConfigurationId");
        }
    }
}
