using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Secrets;
using Configuration.DomainService.Mail.Entities;
using Configuration.DomainService.Mail.Providers;
using Configuration.DomainService.Mail.RequestModel;
using Configuration.DomainService.Mail.Services;
using Configuration.DomainService.Mail.Validators;
using Configuration.DomainService.Shared.Enums;
using Configuration.DomainService.Shared.Services;
using FluentAssertions;
using FluentValidation;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using XUnitTest.TestSupport;

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

        public MailConfigurationServiceTests()
        {
            _repo.Setup(r => r.GetMailConfigurationByNameAsync(It.IsAny<string>()))
                 .ReturnsAsync((MailServerConfiguration?)null);
            _repo.Setup(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()))
                 .Returns(Task.CompletedTask);
            _repo.Setup(r => r.DeleteMailConfigurationAsync(It.IsAny<string>()))
                 .Returns(Task.CompletedTask);
            _secrets.Setup(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()))
                    .ReturnsAsync("secret-1");
        }

        private MailConfigurationService Service()
        {
            IValidator<MailConfiguration> validator = new MailConfigurationValidator(_repo.Object);

            var registry = new MailConfigurationProviderRegistry(new IMailConfigurationProvider[]
            {
                new AmazonSesMailConfigurationProvider(),
                new ZohoMailConfigurationProvider(),
                new Office365SmtpMailConfigurationProvider(_secrets.Object)
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
        public async Task Save_NewLegacyConfiguration_CreatesNoSecret()
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
            _secrets.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Never);
            _repo.Verify(
                r => r.SaveMailConfigurationAsync(It.Is<MailServerConfiguration>(m =>
                    m.AccountPassword == "password1" && m.EnableSSL && m.ClientSecretReference == null)),
                Times.Once);
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
        public async Task Save_Office365Inbound_IsRejectedWithNoWrites()
        {
            var request = Office365Request();
            request.IsInbound = true;

            var result = await Service().SaveAsync(request);

            result.Outcome.Should().Be(MailConfigurationOutcome.Invalid);
            result.Response.Errors.Should().Contain(new KeyValuePair<string, string>(
                "IsInbound", "SMTP Office 365 supports outbound configurations only."));
            _secrets.VerifyNoOtherCalls();
            _repo.Verify(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()), Times.Never);
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
                "ClientSecret", "The client secret could not be stored. Try again."));
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
            _repo.Setup(r => r.GetMailConfigurationByNameAsync("Microsoft 365 Primary")).ReturnsAsync(StoredOffice365());

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
        public async Task Duplicate_LegacyRecord_KeepsItsExistingBehaviour()
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
            saved.AccountPassword.Should().Be("password1");
            saved.IsDefault.Should().BeTrue();
            _secrets.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Never);
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
