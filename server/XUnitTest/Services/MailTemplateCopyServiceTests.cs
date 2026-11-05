using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Blocks.Genesis;
using Blocks.Genesis.Entities.Os;
using Configuration.DomainService.Mail.Template;
using Configuration.DomainService.Mail.Template.Services;
using Configuration.DomainService.Shared.Utilities;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using XUnitTest.TestSupport;

namespace XUnitTest.Services
{
    /// <summary>blocks-os#735 (SPEC33 §6.1, §6.2): the API side of copying a Default template to organizations.</summary>
    public class MailTemplateCopyServiceTests
    {
        private readonly Mock<IMailTemplateRepository> _repo = new();
        private readonly Mock<IMessageClient> _messages = new();
        private readonly List<ConsumerMessage<EmailTemplateCopyCommand>> _sent = [];

        public MailTemplateCopyServiceTests()
        {
            _messages
                .Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<EmailTemplateCopyCommand>>()))
                .Callback<ConsumerMessage<EmailTemplateCopyCommand>>(_sent.Add)
                .Returns(Task.CompletedTask);
        }

        private MailTemplateCopyService Service() => new(_repo.Object, _messages.Object, NullLogger<MailTemplateCopyService>.Instance);

        private void Stored(string id, string? organizationId = "default", string? body = "<p>Hi</p>") =>
            _repo.Setup(r => r.GetByIdAsync(id)).ReturnsAsync(new EmailTemplate
            {
                ItemId = id,
                Name = "OrderConfirmation",
                Language = "en-US",
                OrganizationId = organizationId!,
                TemplateBody = body,
            });

        private static CopyTemplateToOrganizationsRequest Request(string templateId = "d-order", params string[] organizations) => new()
        {
            TemplateId = templateId,
            OrganizationIds = organizations.Length == 0 ? new List<string> { "acme", "globex" } : organizations.ToList(),
            Existing = "keep",
        };

        private static void ShouldBeRejected(BaseMutationResponse response, string key, string message)
        {
            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().BeEquivalentTo(new Dictionary<string, string> { { key, message } });
        }

        [Fact] // H1, example 1
        public async Task ValidRequest_QueuesOneJob_AndReturnsItsId()
        {
            using var _ = new BlocksTestContext(tenantId: "project-1", userId: "admin-1", originalTenantId: "root-1");
            Stored("d-order");

            var response = await Service().CopyToOrganizationsAsync(Request("d-order", "acme", "globex", "acme", "default", " "));

            response.IsSuccess.Should().BeTrue();
            _sent.Should().ContainSingle();
            var message = _sent[0];
            message.ConsumerName.Should().Be(Constants.EmailTemplateQueue);
            message.ConsumerName.Should().Be("blocks_os_email_template_listener");
            var command = message.Payload;
            response.ItemId.Should().Be(command.JobId);
            Guid.TryParse(command.JobId, out var jobGuid).Should().BeTrue();
            jobGuid.Should().NotBe(Guid.Empty);
            command.TenantId.Should().Be("project-1");
            command.OriginalTenantId.Should().Be("root-1");
            command.RequestedByUserId.Should().Be("admin-1");
            command.TemplateId.Should().Be("d-order");
            command.AllOrganizations.Should().BeFalse();
            command.OrganizationIds.Should().Equal("acme", "globex");
            command.Existing.Should().Be("keep");
        }

        [Fact] // H1 with all organizations: the ids are not needed
        public async Task AllOrganizations_QueuesWithoutIds()
        {
            using var _ = new BlocksTestContext(tenantId: "project-1");
            Stored("d-order");

            var response = await Service().CopyToOrganizationsAsync(new CopyTemplateToOrganizationsRequest
            {
                TemplateId = "d-order", AllOrganizations = true, Existing = "Replace",
            });

            response.IsSuccess.Should().BeTrue();
            _sent.Single().Payload.AllOrganizations.Should().BeTrue();
            _sent.Single().Payload.OrganizationIds.Should().BeEmpty();
            _sent.Single().Payload.Existing.Should().Be("replace");
        }

        [Fact]
        public async Task UnknownTemplate_IsRejected()
        {
            using var _ = new BlocksTestContext();
            var response = await Service().CopyToOrganizationsAsync(Request("missing"));
            ShouldBeRejected(response, "TemplateId", "Template not found");
            _sent.Should().BeEmpty();
        }

        [Theory] // C1, example 4
        [InlineData("acme")]
        [InlineData("globex")]
        public async Task OrganizationTemplate_IsRejected(string organizationId)
        {
            using var _ = new BlocksTestContext();
            Stored("acme-order", organizationId);
            var response = await Service().CopyToOrganizationsAsync(Request("acme-order"));
            ShouldBeRejected(response, "TemplateId", "Only Default organization templates can be copied");
            _sent.Should().BeEmpty();
        }

        [Theory] // a Default template stored without an organization is still the Default organization's
        [InlineData(null)]
        [InlineData("")]
        public async Task TemplateStoredWithoutOrganization_IsDefault(string? organizationId)
        {
            using var _ = new BlocksTestContext();
            Stored("d-old", organizationId);
            var response = await Service().CopyToOrganizationsAsync(Request("d-old"));
            response.IsSuccess.Should().BeTrue();
        }

        [Theory] // C2, example 5
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public async Task EmptyBody_IsRejected(string? body)
        {
            using var _ = new BlocksTestContext();
            Stored("d-new", body: body);
            var response = await Service().CopyToOrganizationsAsync(Request("d-new"));
            ShouldBeRejected(response, "TemplateId", "Finish the template before copying");
        }

        [Theory] // C8 (the ids are given comma-separated here)
        [InlineData("")]
        [InlineData("default")]
        [InlineData(" ,")]
        public async Task NoOrganizations_IsRejected(string organizations)
        {
            using var _ = new BlocksTestContext();
            Stored("d-order");
            var request = Request("d-order");
            request.OrganizationIds = organizations.Length == 0 ? new List<string>() : organizations.Split(',').ToList();
            var response = await Service().CopyToOrganizationsAsync(request);
            ShouldBeRejected(response, "OrganizationIds", "Select at least one organization");
        }

        [Fact] // C8
        public async Task MissingOrganizationList_IsRejected()
        {
            using var _ = new BlocksTestContext();
            Stored("d-order");
            var request = Request("d-order");
            request.OrganizationIds = null;
            var response = await Service().CopyToOrganizationsAsync(request);
            ShouldBeRejected(response, "OrganizationIds", "Select at least one organization");
        }

        [Fact] // C8: 1000 distinct ids pass, 1001 don't; a repeated id counts once
        public async Task MoreThan1000Organizations_IsRejected()
        {
            using var _ = new BlocksTestContext();
            Stored("d-order");
            var request = Request("d-order");
            request.OrganizationIds = Enumerable.Range(0, 1000).Select(i => "org" + i).Concat(new[] { "org0" }).ToList();
            (await Service().CopyToOrganizationsAsync(request)).IsSuccess.Should().BeTrue();

            request.OrganizationIds.Add("org1000");
            ShouldBeRejected(await Service().CopyToOrganizationsAsync(request), "OrganizationIds", "No more than 1000 organizations per request");
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("overwrite")]
        public async Task UnknownExisting_IsRejected(string? existing)
        {
            using var _ = new BlocksTestContext();
            Stored("d-order");
            var request = Request("d-order");
            request.Existing = existing;
            ShouldBeRejected(await Service().CopyToOrganizationsAsync(request), "Existing", "Choose keep or replace");
        }

        [Fact] // C9
        public async Task QueueFailure_SaysCopyingCouldNotStart()
        {
            using var _ = new BlocksTestContext();
            Stored("d-order");
            _messages
                .Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<EmailTemplateCopyCommand>>()))
                .ThrowsAsync(new InvalidOperationException("bus down"));

            var response = await Service().CopyToOrganizationsAsync(Request("d-order"));

            ShouldBeRejected(response, "Copy", "Copying couldn't start. Try again.");
        }

        // ---- §6.2 GetTemplateOrganizationCopies ----

        [Fact] // H9
        public async Task Copies_AreTheOrganizationsWithTheSameNameAndLanguage()
        {
            using var _ = new BlocksTestContext();
            Stored("d-order");
            var updated = new DateTime(2026, 10, 30, 0, 0, 0, DateTimeKind.Utc);
            _repo.Setup(r => r.GetOrganizationCopiesAsync("OrderConfirmation", "en-US",
                    It.Is<IReadOnlyCollection<string>>(ids => ids.SequenceEqual(new[] { "acme", "umbrella" }))))
                .ReturnsAsync(new List<EmailTemplate>
                {
                    new() { ItemId = "u-order", OrganizationId = "umbrella", LastUpdatedDate = updated },
                });

            var response = await Service().GetOrganizationCopiesAsync(new GetTemplateOrganizationCopiesRequest
            {
                TemplateId = "d-order", OrganizationIds = "acme, umbrella,,acme",
            });

            response.IsSuccess.Should().BeTrue();
            response.Copies.Should().ContainSingle();
            response.Copies[0].OrganizationId.Should().Be("umbrella");
            response.Copies[0].TemplateId.Should().Be("u-order");
            response.Copies[0].LastUpdatedDate.Should().Be(updated);
        }

        [Fact]
        public async Task Copies_OfAnUnknownTemplate_AreRejected()
        {
            using var _ = new BlocksTestContext();
            var response = await Service().GetOrganizationCopiesAsync(new GetTemplateOrganizationCopiesRequest { TemplateId = "nope", OrganizationIds = "acme" });
            ShouldBeRejected(response, "TemplateId", "Template not found");
        }

        [Fact]
        public async Task Copies_ForMoreThan25Organizations_AreRejected()
        {
            using var _ = new BlocksTestContext();
            Stored("d-order");
            _repo.Setup(r => r.GetOrganizationCopiesAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IReadOnlyCollection<string>>()))
                .ReturnsAsync(new List<EmailTemplate>());
            var ids = Enumerable.Range(0, 25).Select(i => "o" + i).ToList();
            (await Service().GetOrganizationCopiesAsync(new GetTemplateOrganizationCopiesRequest { TemplateId = "d-order", OrganizationIds = string.Join(",", ids) }))
                .IsSuccess.Should().BeTrue();

            var response = await Service().GetOrganizationCopiesAsync(new GetTemplateOrganizationCopiesRequest
            {
                TemplateId = "d-order", OrganizationIds = string.Join(",", ids.Append("o25")),
            });
            ShouldBeRejected(response, "OrganizationIds", "No more than 25 organizations per request");
        }

        [Fact]
        public async Task Copies_WithNoOrganizations_AreEmpty_WithoutARead()
        {
            using var _ = new BlocksTestContext();
            Stored("d-order");
            var response = await Service().GetOrganizationCopiesAsync(new GetTemplateOrganizationCopiesRequest { TemplateId = "d-order" });
            response.IsSuccess.Should().BeTrue();
            response.Copies.Should().BeEmpty();
            _repo.Verify(r => r.GetOrganizationCopiesAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IReadOnlyCollection<string>>()), Times.Never);
        }
    }
}
