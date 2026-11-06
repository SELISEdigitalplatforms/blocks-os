using Blocks.Genesis;
using Microsoft.Extensions.Logging.Abstractions;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis.Entities.Os;
using Configuration.DomainService.Mail.Template;
using Configuration.DomainService.Mail.Template.Services;
using Configuration.DomainService.Organizations;
using Configuration.DomainService.Shared.Services;
using FluentAssertions;
using FluentValidation;
using Moq;
using XUnitTest.TestSupport;

namespace XUnitTest.Services
{
    /// <summary>blocks-os#734 (SPEC32 §6): POST Mail/AssignTemplates, the service rules.</summary>
    public class MailTemplateAssignServiceTests
    {
        private readonly Mock<IMailTemplateRepository> _repo = new();
        private readonly Mock<IConfigurationRepository> _configurations = new();

        private MailTemplateService Service() =>
            new(new Mock<IValidator<SaveMailTemplateRequest>>().Object, _repo.Object,
                new Mock<IMailTemplateHtmlChecker>().Object, new Mock<IOrganizationReader>().Object, _configurations.Object,
                new Mock<IMessageClient>().Object, NullLogger<MailTemplateService>.Instance);

        private void Configuration(string id, string? organizationId, bool inbound = false) =>
            _configurations.Setup(c => c.GetMailConfigurationByIdAsync(id))
                           .ReturnsAsync(new MailServerConfiguration { ItemId = id, OrganizationId = organizationId!, IsInbound = inbound });

        private static void ShouldFail(AssignTemplatesResponse response, string field, string message)
        {
            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().BeEquivalentTo(new Dictionary<string, string> { { field, message } });
            response.UpdatedCount.Should().Be(0);
        }

        private void NothingAssigned() =>
            _repo.Verify(r => r.AssignConfigurationAsync(It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<IReadOnlyCollection<string>?>(), It.IsAny<string?>(), It.IsAny<string?>()), Times.Never);

        [Fact] // H1, example 1
        public async Task ExplicitIds_OfTheOrganization_AreAssignedAndCounted()
        {
            using var _ = new BlocksTestContext();
            Configuration("acme-smtp", "acme");
            _repo.Setup(r => r.CountOutsideOrganizationAsync(It.IsAny<IReadOnlyCollection<string>>(), "acme")).ReturnsAsync(0);
            _repo.Setup(r => r.AssignConfigurationAsync("acme-smtp", "acme",
                    It.Is<IReadOnlyCollection<string>?>(ids => ids!.SequenceEqual(new[] { "a1", "a2", "a3", "a4" })), null, null))
                 .ReturnsAsync(4);

            var response = await Service().AssignTemplatesAsync(new AssignTemplatesRequest
            {
                ConfigurationId = "acme-smtp",
                TemplateIds = new List<string> { "a1", "a2", "a3", "a4" },
                SearchKey = "ignored with ids",
                Language = "xx-XX",
            });

            response.IsSuccess.Should().BeTrue();
            response.Errors.Should().BeNullOrEmpty();
            response.UpdatedCount.Should().Be(4);
        }

        [Fact] // H2, H3, D3: all matching ignores the ids and passes the list's filters
        public async Task AllMatching_UsesTheFilters_AndIgnoresIds()
        {
            using var _ = new BlocksTestContext();
            Configuration("gmail-test", null);
            _repo.Setup(r => r.AssignConfigurationAsync("gmail-test", "default", null, "Order", "xx-XX")).ReturnsAsync(13);

            var response = await Service().AssignTemplatesAsync(new AssignTemplatesRequest
            {
                ConfigurationId = "gmail-test",
                AllMatching = true,
                TemplateIds = new List<string> { "would-be-foreign" },
                SearchKey = "Order",
                Language = "xx-XX",
            });

            response.IsSuccess.Should().BeTrue();
            response.UpdatedCount.Should().Be(13);
            _repo.Verify(r => r.CountOutsideOrganizationAsync(It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<string>()), Times.Never);
        }

        [Theory] // H5: the configuration's organization, missing or empty = Default
        [InlineData(null)]
        [InlineData("")]
        [InlineData("default")]
        public async Task DefaultOrganizationConfiguration_AssignsDefaultTemplates(string? stored)
        {
            using var _ = new BlocksTestContext();
            Configuration("cfg", stored);

            await Service().AssignTemplatesAsync(new AssignTemplatesRequest { ConfigurationId = "cfg", AllMatching = true });

            _repo.Verify(r => r.AssignConfigurationAsync("cfg", "default", null, null, null), Times.Once);
        }

        [Fact] // C2
        public async Task UnknownConfiguration_IsRefused()
        {
            var response = await Service().AssignTemplatesAsync(new AssignTemplatesRequest { ConfigurationId = "nope", AllMatching = true });

            ShouldFail(response, "ConfigurationId", "Configuration not found");
            NothingAssigned();
        }

        [Theory] // C2: no id at all
        [InlineData(null)]
        [InlineData("")]
        [InlineData("  ")]
        public async Task MissingConfigurationId_IsRefused(string? configurationId)
        {
            var response = await Service().AssignTemplatesAsync(new AssignTemplatesRequest { ConfigurationId = configurationId, AllMatching = true });

            ShouldFail(response, "ConfigurationId", "Configuration not found");
            _configurations.Verify(c => c.GetMailConfigurationByIdAsync(It.IsAny<string>()), Times.Never);
        }

        [Fact] // C1, example 4
        public async Task InboundConfiguration_IsRefused()
        {
            Configuration("acme-inbox", "acme", inbound: true);

            var response = await Service().AssignTemplatesAsync(new AssignTemplatesRequest
            {
                ConfigurationId = "acme-inbox",
                TemplateIds = new List<string> { "a1" },
            });

            ShouldFail(response, "ConfigurationId", "An inbound configuration can't send mail");
            NothingAssigned();
        }

        [Theory] // C5: no list, an empty list, or only blank ids (comma-separated here)
        [InlineData(null)]
        [InlineData("")]
        [InlineData(",  ")]
        public async Task NoIds_WithoutAllMatching_IsRefused(string? joined)
        {
            var ids = joined?.Split(',');
            Configuration("acme-smtp", "acme");

            var response = await Service().AssignTemplatesAsync(new AssignTemplatesRequest
            {
                ConfigurationId = "acme-smtp",
                TemplateIds = joined == "" ? new List<string>() : ids?.ToList(),
            });

            ShouldFail(response, "TemplateIds", "Select at least one template");
            NothingAssigned();
        }

        [Fact] // C4
        public async Task MoreThan500Ids_AreRefused()
        {
            Configuration("acme-smtp", "acme");

            var response = await Service().AssignTemplatesAsync(new AssignTemplatesRequest
            {
                ConfigurationId = "acme-smtp",
                TemplateIds = Enumerable.Range(0, 501).Select(i => "t" + i).ToList(),
            });

            ShouldFail(response, "TemplateIds", "No more than 500 templates per request");
            NothingAssigned();
        }

        [Fact] // C4 boundary: exactly 500 distinct ids are allowed; a repeated id counts once
        public async Task FiveHundredDistinctIds_AreAccepted()
        {
            using var _ = new BlocksTestContext();
            Configuration("acme-smtp", "acme");
            var ids = Enumerable.Range(0, 500).Select(i => "t" + i).ToList();
            ids.Add("t0");
            _repo.Setup(r => r.AssignConfigurationAsync("acme-smtp", "acme", It.Is<IReadOnlyCollection<string>?>(x => x!.Count == 500), null, null))
                 .ReturnsAsync(500);

            var response = await Service().AssignTemplatesAsync(new AssignTemplatesRequest { ConfigurationId = "acme-smtp", TemplateIds = ids });

            response.IsSuccess.Should().BeTrue();
            response.UpdatedCount.Should().Be(500);
        }

        [Fact] // C3, example 5: one template of another organization and nothing is updated
        public async Task AnIdOfAnotherOrganization_UpdatesNothing()
        {
            Configuration("acme-smtp", "acme");
            _repo.Setup(r => r.CountOutsideOrganizationAsync(It.Is<IReadOnlyCollection<string>>(x => x.Contains("d1")), "acme")).ReturnsAsync(1);

            var response = await Service().AssignTemplatesAsync(new AssignTemplatesRequest
            {
                ConfigurationId = "acme-smtp",
                TemplateIds = new List<string> { "a1", "d1" },
            });

            ShouldFail(response, "TemplateIds", "Some templates aren't in this configuration's organization");
            NothingAssigned();
        }

        [Fact] // C8: deleted ids are not an error; the real count comes back
        public async Task DeletedIds_AreSkipped_AndTheRealCountIsReturned()
        {
            using var _ = new BlocksTestContext();
            Configuration("acme-smtp", "acme");
            _repo.Setup(r => r.CountOutsideOrganizationAsync(It.IsAny<IReadOnlyCollection<string>>(), "acme")).ReturnsAsync(0);
            _repo.Setup(r => r.AssignConfigurationAsync("acme-smtp", "acme", It.IsAny<IReadOnlyCollection<string>?>(), null, null)).ReturnsAsync(1);

            var response = await Service().AssignTemplatesAsync(new AssignTemplatesRequest
            {
                ConfigurationId = "acme-smtp",
                TemplateIds = new List<string> { "a1", "deleted-meanwhile" },
            });

            response.IsSuccess.Should().BeTrue();
            response.UpdatedCount.Should().Be(1);
        }
    }
}
