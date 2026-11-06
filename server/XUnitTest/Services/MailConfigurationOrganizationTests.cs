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
using Configuration.DomainService.Mail.Template.Services;
using Configuration.DomainService.Mail.Validators;
using Configuration.DomainService.Organizations;
using Configuration.DomainService.Shared.Secrets;
using Configuration.DomainService.Shared.Services;
using FluentAssertions;
using FluentValidation;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using XUnitTest.TestSupport;

namespace XUnitTest.Services
{
    /// <summary>
    /// blocks-os#732 (SPEC30): mail configurations per organization, through the real validator and
    /// provider definitions with the repositories, the organization reader and the secret store faked.
    /// </summary>
    public class MailConfigurationOrganizationTests
    {
        private const string OrganizationNotFound = "Organization not found";
        private const string OrganizationFixed = "A configuration's organization can't be changed";
        private const string InboundCannotBeDefault = "An inbound configuration can't be the organization default";

        private readonly Mock<IConfigurationRepository> _repo = new();
        private readonly Mock<ISecretService> _secrets = new();
        private readonly Mock<IOrganizationReader> _organizations = new();
        private readonly Mock<IMailTemplateRepository> _templates = new();
        private readonly List<MailServerConfiguration> _saved = new();

        public MailConfigurationOrganizationTests()
        {
            _repo.Setup(r => r.GetMailConfigurationByNameAsync(It.IsAny<string>()))
                 .ReturnsAsync((MailServerConfiguration?)null);
            _repo.Setup(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()))
                 .Callback<MailServerConfiguration>(_saved.Add)
                 .Returns(Task.CompletedTask);
            _repo.Setup(r => r.ClearOtherOrganizationDefaultsAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<DateTime>()))
                 .Returns(Task.CompletedTask);
            _repo.Setup(r => r.UpdateMailSenderNameAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<string>()))
                 .Returns(Task.CompletedTask);
            _secrets.Setup(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()))
                    .ReturnsAsync("secret-1");
            _secrets.Setup(s => s.GetAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                    .ReturnsAsync((string id, CancellationToken _) => new SecretResult { SecretId = id, Name = "mail-password", Status = SecretStatuses.Active });
            _secrets.Setup(s => s.GetValueAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                    .ReturnsAsync("password1");

            _organizations.Setup(o => o.ExistsEnabledAsync("acme", It.IsAny<CancellationToken>())).ReturnsAsync(true);
            _organizations.Setup(o => o.ExistsEnabledAsync("globex", It.IsAny<CancellationToken>())).ReturnsAsync(true);
            _organizations.Setup(o => o.ExistsEnabledAsync("ghost", It.IsAny<CancellationToken>())).ReturnsAsync(false);
        }

        private MailConfigurationService Service()
        {
            IValidator<MailConfiguration> validator = new MailConfigurationValidator(_repo.Object);
            var registry = new MailConfigurationProviderRegistry(new IMailConfigurationProvider[]
            {
                new AmazonSesMailConfigurationProvider(_secrets.Object, NullLogger<AmazonSesMailConfigurationProvider>.Instance),
                new ZohoMailConfigurationProvider(_secrets.Object, NullLogger<ZohoMailConfigurationProvider>.Instance),
                new GmailMailConfigurationProvider(_secrets.Object, NullLogger<GmailMailConfigurationProvider>.Instance),
                new Office365SmtpMailConfigurationProvider(_secrets.Object, NullLogger<Office365SmtpMailConfigurationProvider>.Instance)
            });

            return new MailConfigurationService(
                _repo.Object, registry, validator, NullLogger<MailConfigurationService>.Instance, _organizations.Object, _templates.Object);
        }

        private static MailConfiguration ZohoRequest(string? organizationId = null, bool? isOrganizationDefault = false, string id = "") => new()
        {
            ConfigurationId = id,
            ConfigurationName = "Acme SMTP",
            Provider = MailServiceProvider.Zoho,
            Host = "smtp.zoho.com",
            Port = 465,
            EnableSSL = true,
            SenderName = "Acme Orders",
            SenderAddress = "orders@acme.example",
            SenderUserName = "acme-user",
            AccountPassword = "password1",
            OrganizationId = organizationId,
            IsOrganizationDefault = isOrganizationDefault
        };

        private static MailServerConfiguration StoredZoho(string itemId, string? organizationId, bool isOrganizationDefault = false) => new()
        {
            ItemId = itemId,
            Name = "Acme SMTP",
            Provider = MailServiceProvider.Zoho,
            Host = "smtp.zoho.com",
            Port = 465,
            EnableSSL = true,
            SenderName = "Acme Orders",
            SenderAddress = "orders@acme.example",
            SenderUserName = "acme-user",
            AccountPasswordReference = "secret-0",
            OrganizationId = organizationId!,
            IsOrganizationDefault = isOrganizationDefault
        };

        private void GivenStored(MailServerConfiguration stored) =>
            _repo.Setup(r => r.GetMailConfigurationByIdAsync(stored.ItemId)).ReturnsAsync(stored);

        // ---------- H1, H2 ----------

        [Fact]
        public async Task Save_CreateForAnEnabledOrganization_StoresThatOrganization()
        {
            using var _ = new BlocksTestContext();

            var result = await Service().SaveAsync(ZohoRequest("acme"));

            result.Outcome.Should().Be(MailConfigurationOutcome.Success);
            _saved.Single().OrganizationId.Should().Be("acme");
            _organizations.Verify(o => o.ExistsEnabledAsync("acme", It.IsAny<CancellationToken>()), Times.Once);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData("default")]
        public async Task Save_CreateWithoutAnOrganization_StoresTheDefaultOrganization(string? organizationId)
        {
            using var _ = new BlocksTestContext();

            var result = await Service().SaveAsync(ZohoRequest(organizationId));

            result.Outcome.Should().Be(MailConfigurationOutcome.Success);
            _saved.Single().OrganizationId.Should().Be("default");
            // The Default organization is not stored in IAM, so it is never looked up.
            _organizations.Verify(o => o.ExistsEnabledAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        // ---------- C1 ----------

        [Fact]
        public async Task Save_CreateForAnUnknownOrDisabledOrganization_IsRejectedAndSavesNothing()
        {
            using var _ = new BlocksTestContext();

            var result = await Service().SaveAsync(ZohoRequest("ghost"));

            result.Outcome.Should().Be(MailConfigurationOutcome.Invalid);
            result.Response.IsSuccess.Should().BeFalse();
            result.Response.Errors.Should().Contain(new KeyValuePair<string, string>("OrganizationId", OrganizationNotFound));
            _saved.Should().BeEmpty();
            _secrets.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        // ---------- C2 ----------

        [Fact]
        public async Task Save_EditSendingAnotherOrganization_IsRejectedAndSavesNothing()
        {
            using var _ = new BlocksTestContext();
            GivenStored(StoredZoho("cfg-acme", "acme"));

            var result = await Service().SaveAsync(ZohoRequest("globex", id: "cfg-acme"));

            result.Outcome.Should().Be(MailConfigurationOutcome.Invalid);
            result.Response.Errors.Should().Contain(new KeyValuePair<string, string>("OrganizationId", OrganizationFixed));
            _saved.Should().BeEmpty();
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        public async Task Save_EditOfAConfigurationStoredWithoutAnOrganization_RejectsAnotherOrganization(string? stored)
        {
            using var _ = new BlocksTestContext();
            GivenStored(StoredZoho("cfg-old", stored));

            var result = await Service().SaveAsync(ZohoRequest("acme", id: "cfg-old"));

            result.Response.Errors.Should().Contain(new KeyValuePair<string, string>("OrganizationId", OrganizationFixed));
            _saved.Should().BeEmpty();
        }

        [Fact]
        public async Task Save_EditSendingTheSameOrganization_KeepsIt()
        {
            using var _ = new BlocksTestContext();
            GivenStored(StoredZoho("cfg-acme", "acme"));

            var result = await Service().SaveAsync(ZohoRequest("acme", id: "cfg-acme"));

            result.Outcome.Should().Be(MailConfigurationOutcome.Success);
            _saved.Single().OrganizationId.Should().Be("acme");
        }

        [Fact]
        public async Task Save_EditWithoutAnOrganization_KeepsTheStoredOne()
        {
            // Callers that predate organizations (blocks-cli) send no organization on edit.
            using var _ = new BlocksTestContext();
            GivenStored(StoredZoho("cfg-acme", "acme"));

            var result = await Service().SaveAsync(ZohoRequest(null, id: "cfg-acme"));

            result.Outcome.Should().Be(MailConfigurationOutcome.Success);
            _saved.Single().OrganizationId.Should().Be("acme");
        }

        // ---------- C4 ----------

        [Fact]
        public async Task Save_EditOfAConfigurationStoredWithoutAnOrganization_WritesTheDefaultOrganization()
        {
            using var _ = new BlocksTestContext();
            GivenStored(StoredZoho("cfg-old", null));

            var result = await Service().SaveAsync(ZohoRequest(null, id: "cfg-old"));

            result.Outcome.Should().Be(MailConfigurationOutcome.Success);
            _saved.Single().OrganizationId.Should().Be("default");
        }

        // ---------- H3, C5 ----------

        [Fact]
        public async Task Save_AsOrganizationDefault_MarksItAndClearsTheOthersOfThatOrganizationAfterTheSave()
        {
            using var _ = new BlocksTestContext();
            var order = new List<string>();
            _repo.Setup(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()))
                 .Callback<MailServerConfiguration>(m => { _saved.Add(m); order.Add("save"); })
                 .Returns(Task.CompletedTask);
            _repo.Setup(r => r.ClearOtherOrganizationDefaultsAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<DateTime>()))
                 .Callback(() => order.Add("clear"))
                 .Returns(Task.CompletedTask);

            var result = await Service().SaveAsync(ZohoRequest("acme", isOrganizationDefault: true));

            result.Outcome.Should().Be(MailConfigurationOutcome.Success);
            var saved = _saved.Single();
            saved.IsOrganizationDefault.Should().BeTrue();
            _repo.Verify(r => r.ClearOtherOrganizationDefaultsAsync("acme", saved.ItemId, saved.LastUpdatedDate), Times.Once);
            order.Should().Equal("save", "clear");
        }

        [Fact]
        public async Task Save_AsOrganizationDefault_WhenClearingTheOthersFails_StillReportsTheSave()
        {
            // The configuration is already written; the next default save settles the marks.
            using var _ = new BlocksTestContext();
            _repo.Setup(r => r.ClearOtherOrganizationDefaultsAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<DateTime>()))
                 .ThrowsAsync(new InvalidOperationException("clear failed"));

            var result = await Service().SaveAsync(ZohoRequest("acme", isOrganizationDefault: true));

            result.Outcome.Should().Be(MailConfigurationOutcome.Success);
            _saved.Single().IsOrganizationDefault.Should().BeTrue();
        }

        [Fact]
        public async Task Save_NotAsOrganizationDefault_ClearsNothing()
        {
            using var _ = new BlocksTestContext();

            await Service().SaveAsync(ZohoRequest("acme"));

            _saved.Single().IsOrganizationDefault.Should().BeFalse();
            _repo.Verify(r => r.ClearOtherOrganizationDefaultsAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<DateTime>()), Times.Never);
        }

        [Fact]
        public async Task Save_EditUnmarkingTheOrganizationDefault_StoresFalse()
        {
            using var _ = new BlocksTestContext();
            GivenStored(StoredZoho("cfg-acme", "acme", isOrganizationDefault: true));

            await Service().SaveAsync(ZohoRequest("acme", isOrganizationDefault: false, id: "cfg-acme"));

            _saved.Single().IsOrganizationDefault.Should().BeFalse();
        }

        [Fact]
        public async Task Save_EditWithoutTheDefaultFlag_KeepsTheStoredMark()
        {
            // Hosts without organizations (the authentication dialog, blocks-cli) don't send it.
            using var _ = new BlocksTestContext();
            GivenStored(StoredZoho("cfg-acme", "acme", isOrganizationDefault: true));

            await Service().SaveAsync(ZohoRequest(null, isOrganizationDefault: null, id: "cfg-acme"));

            _saved.Single().IsOrganizationDefault.Should().BeTrue();
        }

        [Fact]
        public async Task Save_CreateWithoutTheDefaultFlag_IsNotTheDefault()
        {
            using var _ = new BlocksTestContext();

            await Service().SaveAsync(ZohoRequest("acme", isOrganizationDefault: null));

            _saved.Single().IsOrganizationDefault.Should().BeFalse();
        }

        // ---------- C3, C7 ----------

        [Fact]
        public async Task Save_InboundAsOrganizationDefault_IsRejected()
        {
            using var _ = new BlocksTestContext();
            var request = new MailConfiguration
            {
                ConfigurationId = "",
                ConfigurationName = "Acme Inbox",
                Provider = MailServiceProvider.Office365Smtp,
                IsInbound = true,
                TenantId = "contoso-tenant",
                ClientId = "mailer-app",
                ClientSecret = "secret-value",
                MailboxAddress = "inbox@contoso.com",
                OrganizationId = "acme",
                IsOrganizationDefault = true
            };

            var result = await Service().SaveAsync(request);

            result.Outcome.Should().Be(MailConfigurationOutcome.Invalid);
            result.Response.Errors.Should().Contain(new KeyValuePair<string, string>("IsOrganizationDefault", InboundCannotBeDefault));
            _saved.Should().BeEmpty();
        }

        // ---------- C4: the project default record ----------

        [Fact]
        public async Task Save_SenderNameOfTheProjectDefault_IsStillTheTargetedUpdate()
        {
            using var _ = new BlocksTestContext();
            GivenStored(new MailServerConfiguration
            {
                ItemId = "default-1",
                Name = "Default",
                IsDefault = true,
                Provider = MailServiceProvider.AmazonSes,
                Host = "email-smtp.eu-central-1.amazonaws.com",
                Port = 587
            });

            var result = await Service().SaveAsync(new MailConfiguration { ConfigurationId = "default-1", SenderName = "Contoso Mailer", OrganizationId = "acme" });

            result.Outcome.Should().Be(MailConfigurationOutcome.Success);
            _repo.Verify(r => r.UpdateMailSenderNameAsync("default-1", "Contoso Mailer", It.IsAny<DateTime>(), It.IsAny<string>()), Times.Once);
            _saved.Should().BeEmpty();
        }

        // ---------- H4, H5, C4 (list) ----------

        [Fact]
        public async Task GetAll_PassesTheOrganizationAndNormalizesWhatItReturns()
        {
            _repo.Setup(r => r.GetAllMailConfigurationsAsync("acme")).ReturnsAsync(new List<MailServerConfiguration>
            {
                StoredZoho("cfg-acme", "acme", isOrganizationDefault: true),
                StoredZoho("cfg-old", null),
                StoredZoho("cfg-empty", "")
            });

            var responses = await Service().GetAllAsync(new GetAllMailConfigurationsRequest { OrganizationId = "acme" });

            responses.Select(r => (r.ItemId, r.OrganizationId, r.IsOrganizationDefault)).Should().Equal(
                ("cfg-acme", "acme", true),
                ("cfg-old", "default", false),
                ("cfg-empty", "default", false));
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("  ")]
        public async Task GetAll_WithoutAnOrganization_ListsEverything(string? organizationId)
        {
            _repo.Setup(r => r.GetAllMailConfigurationsAsync(null)).ReturnsAsync(new List<MailServerConfiguration> { StoredZoho("cfg-1", "globex") });

            var responses = await Service().GetAllAsync(new GetAllMailConfigurationsRequest { OrganizationId = organizationId });

            responses.Single().OrganizationId.Should().Be("globex");
            _repo.Verify(r => r.GetAllMailConfigurationsAsync(null), Times.Once);
        }

        // ---------- H6, §6.3 ----------

        [Fact]
        public async Task GetUsage_OfAnExistingConfiguration_CountsTheTemplatesNamingIt()
        {
            GivenStored(StoredZoho("acme-smtp", "acme"));
            _templates.Setup(t => t.CountByMailConfigurationIdAsync("acme-smtp")).ReturnsAsync(6);

            var response = await Service().GetUsageAsync(new GetMailConfigurationUsageRequest { ConfigurationId = "acme-smtp" });

            response.IsSuccess.Should().BeTrue();
            response.TemplateCount.Should().Be(6);
            response.Errors.Should().BeNull();
        }

        [Theory]
        [InlineData("missing")]
        [InlineData("")]
        public async Task GetUsage_OfAnUnknownConfiguration_ReturnsConfigurationNotFound(string configurationId)
        {
            var response = await Service().GetUsageAsync(new GetMailConfigurationUsageRequest { ConfigurationId = configurationId });

            response.IsSuccess.Should().BeFalse();
            response.TemplateCount.Should().BeNull();
            response.Errors.Should().Contain(new KeyValuePair<string, string>("ConfigurationId", "Configuration not found"));
            _templates.Verify(t => t.CountByMailConfigurationIdAsync(It.IsAny<string>()), Times.Never);
        }

        // ---------- H13 ----------

        [Fact]
        public async Task Duplicate_KeepsTheOrganizationAndDropsTheOrganizationDefaultMark()
        {
            using var _ = new BlocksTestContext();
            GivenStored(StoredZoho("cfg-acme", "acme", isOrganizationDefault: true));

            var result = await Service().DuplicateAsync(new DuplicateMailConfigurationRequest { ConfigurationId = "cfg-acme" });

            result.Outcome.Should().Be(MailConfigurationOutcome.Success);
            var copy = _saved.Single();
            copy.OrganizationId.Should().Be("acme");
            copy.IsOrganizationDefault.Should().BeFalse();
        }

        [Fact]
        public async Task Duplicate_OfAConfigurationStoredWithoutAnOrganization_WritesTheDefaultOrganization()
        {
            using var _ = new BlocksTestContext();
            GivenStored(StoredZoho("cfg-old", null));

            await Service().DuplicateAsync(new DuplicateMailConfigurationRequest { ConfigurationId = "cfg-old" });

            _saved.Single().OrganizationId.Should().Be("default");
        }
    }
}
