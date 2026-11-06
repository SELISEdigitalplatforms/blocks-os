using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Blocks.Genesis;
using Blocks.Genesis.Entities.Os;
using Configuration.DomainService.Mail.Template;
using Configuration.DomainService.Mail.Template.Services;
using Configuration.DomainService.Organizations;
using Configuration.DomainService.Shared.Services;
using Configuration.DomainService.Shared.Utilities;
using FluentAssertions;
using FluentValidation;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using XUnitTest.TestSupport;

namespace XUnitTest.Services
{
    /// <summary>blocks-os#736 (SPEC34 §6.1): the API side of deleting a Default template across organizations.</summary>
    public class MailTemplateDeleteAcrossServiceTests
    {
        private const string CopiesNotStarted =
            "The Default template was deleted, but deleting organization copies couldn't start. Try again from an organization's template.";

        private readonly Mock<IMailTemplateRepository> _repo = new();
        private readonly Mock<IMessageClient> _messages = new();
        private readonly List<ConsumerMessage<EmailTemplateDeleteCommand>> _sent = [];
        private readonly List<string> _calls = [];

        public MailTemplateDeleteAcrossServiceTests()
        {
            _messages
                .Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<EmailTemplateDeleteCommand>>()))
                .Callback<ConsumerMessage<EmailTemplateDeleteCommand>>(m => { _sent.Add(m); _calls.Add("enqueue"); })
                .Returns(Task.CompletedTask);
            _repo.Setup(r => r.DeleteAsync(It.IsAny<string>())).Callback<string>(id => _calls.Add("delete " + id)).Returns(Task.CompletedTask);
        }

        private MailTemplateService Service() =>
            new(new Mock<IValidator<SaveMailTemplateRequest>>().Object, _repo.Object, new Mock<IMailTemplateHtmlChecker>().Object,
                new Mock<IOrganizationReader>().Object, new Mock<IConfigurationRepository>().Object,
                _messages.Object, NullLogger<MailTemplateService>.Instance);

        private void Stored(string id, string? organizationId = "default") =>
            _repo.Setup(r => r.GetByIdAsync(id)).ReturnsAsync(new EmailTemplate
            {
                ItemId = id,
                Name = "OrderConfirmation",
                Language = "en-US",
                OrganizationId = organizationId!,
            });

        private static DeleteTemplateAcrossOrganizationsRequest Request(string templateId = "d-order", params string[] organizations) => new()
        {
            TemplateId = templateId,
            OrganizationIds = organizations.Length == 0 ? new List<string> { "umbrella" } : organizations.ToList(),
        };

        // A refusal deletes nothing and queues nothing (§6.1: the checks come first).
        private void ShouldBeRefused(BaseMutationResponse response, string key, string message)
        {
            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().BeEquivalentTo(new Dictionary<string, string> { { key, message } });
            _calls.Should().BeEmpty();
            _sent.Should().BeEmpty();
        }

        [Fact] // H2, example 1: the Default template goes now, then one job is queued with its Name + Language
        public async Task SelectedOrganizations_DeleteTheDefaultTemplate_ThenQueueOneJob()
        {
            using var _ = new BlocksTestContext(tenantId: "project-1", userId: "admin-1", originalTenantId: "root-1");
            Stored("d-order");

            var response = await Service().DeleteAcrossOrganizationsAsync(Request("d-order", "umbrella", " umbrella ", "default", ""));

            response.IsSuccess.Should().BeTrue();
            _calls.Should().Equal("delete d-order", "enqueue");
            var message = _sent.Should().ContainSingle().Subject;
            message.ConsumerName.Should().Be(Constants.EmailTemplateQueue);
            var command = message.Payload;
            response.ItemId.Should().Be(command.JobId).And.NotBeNullOrWhiteSpace();
            command.TenantId.Should().Be("project-1");
            command.OriginalTenantId.Should().Be("root-1");
            command.RequestedByUserId.Should().Be("admin-1");
            command.Name.Should().Be("OrderConfirmation");
            command.Language.Should().Be("en-US");
            command.AllOrganizations.Should().BeFalse();
            command.OrganizationIds.Should().Equal("umbrella");
        }

        [Fact] // H4, example 2: all organizations sends no ids
        public async Task AllOrganizations_QueueAJobWithoutIds()
        {
            using var _ = new BlocksTestContext(tenantId: "project-1");
            Stored("d-order", organizationId: "");

            var response = await Service().DeleteAcrossOrganizationsAsync(new DeleteTemplateAcrossOrganizationsRequest
            {
                TemplateId = "d-order", AllOrganizations = true, OrganizationIds = new List<string> { "ignored" },
            });

            response.IsSuccess.Should().BeTrue();
            var command = _sent.Should().ContainSingle().Subject.Payload;
            command.AllOrganizations.Should().BeTrue();
            command.OrganizationIds.Should().BeEmpty();
        }

        [Theory] // C2
        [InlineData(null)]
        [InlineData("")]
        [InlineData("missing")]
        public async Task AnUnknownTemplate_IsRefused(string? templateId)
        {
            using var _ = new BlocksTestContext();

            var response = await Service().DeleteAcrossOrganizationsAsync(new DeleteTemplateAcrossOrganizationsRequest { TemplateId = templateId, AllOrganizations = true });

            ShouldBeRefused(response, "TemplateId", "Template not found");
        }

        [Fact] // C1, example 3
        public async Task AnOrganizationTemplate_IsRefused()
        {
            using var _ = new BlocksTestContext();
            Stored("acme-order", organizationId: "acme");

            ShouldBeRefused(await Service().DeleteAcrossOrganizationsAsync(Request("acme-order")),
                "TemplateId", "Only Default organization templates can be deleted across organizations");
        }

        [Theory] // C3, example 4 (ids separated by "|")
        [InlineData("")]
        [InlineData("default")]
        [InlineData(" |")]
        public async Task NoOrganization_IsRefused(string organizations)
        {
            using var _ = new BlocksTestContext();
            Stored("d-order");

            var response = await Service().DeleteAcrossOrganizationsAsync(new DeleteTemplateAcrossOrganizationsRequest
            {
                TemplateId = "d-order", OrganizationIds = organizations.Length == 0 ? new List<string>() : organizations.Split('|').ToList(),
            });

            ShouldBeRefused(response, "OrganizationIds", "Select at least one organization");
        }

        [Fact] // C3: a missing list is the same as an empty one
        public async Task AMissingOrganizationList_IsRefused()
        {
            using var _ = new BlocksTestContext();
            Stored("d-order");

            ShouldBeRefused(await Service().DeleteAcrossOrganizationsAsync(new DeleteTemplateAcrossOrganizationsRequest { TemplateId = "d-order" }),
                "OrganizationIds", "Select at least one organization");
        }

        [Fact] // C3: 1000 distinct organizations are allowed, 1001 are not
        public async Task MoreThan1000Organizations_AreRefused()
        {
            using var _ = new BlocksTestContext();
            Stored("d-order");
            var thousand = Enumerable.Range(0, 1000).Select(i => "org-" + i).ToArray();

            (await Service().DeleteAcrossOrganizationsAsync(Request("d-order", thousand.Concat(thousand).ToArray()))).IsSuccess.Should().BeTrue();
            _calls.Clear();
            _sent.Clear();

            ShouldBeRefused(await Service().DeleteAcrossOrganizationsAsync(Request("d-order", thousand.Append("org-1000").ToArray())),
                "OrganizationIds", "No more than 1000 organizations per request");
        }

        [Theory] // no project tenant: nothing is deleted or queued
        [InlineData("")]
        [InlineData("  ")]
        public async Task WithoutAProjectTenant_NothingIsDeleted(string tenantId)
        {
            using var _ = new BlocksTestContext(tenantId: tenantId);
            Stored("d-order");

            ShouldBeRefused(await Service().DeleteAcrossOrganizationsAsync(Request()),
                "Copies", "Deleting organization copies couldn't start. Try again.");
        }

        [Fact] // C5: the queue fails after the Default template was deleted
        public async Task AQueueFailure_AfterTheDelete_IsReportedAsCopies()
        {
            using var _ = new BlocksTestContext(tenantId: "project-1");
            Stored("d-order");
            _messages
                .Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<EmailTemplateDeleteCommand>>()))
                .ThrowsAsync(new InvalidOperationException("bus down"));

            var response = await Service().DeleteAcrossOrganizationsAsync(Request());

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().BeEquivalentTo(new Dictionary<string, string> { { "Copies", CopiesNotStarted } });
            _calls.Should().Equal("delete d-order");
        }
    }
}
