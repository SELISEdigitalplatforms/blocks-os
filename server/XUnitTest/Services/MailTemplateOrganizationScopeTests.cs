using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Blocks.Genesis.Entities.Os;
using Configuration.DomainService.Mail.Template;
using Configuration.DomainService.Mail.Template.Services;
using Configuration.DomainService.Organizations;
using Configuration.DomainService.Shared.Services;
using FluentAssertions;
using FluentValidation;
using FluentValidation.Results;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using XUnitTest.TestSupport;

namespace XUnitTest.Services
{
    /// <summary>
    /// The token's organization bounds the email template endpoints. A Default organization token (the console, also
    /// when impersonating) or one without an organization acts for every organization, as before. A token of any other
    /// organization (a Construct app) gets, sets, clones, deletes and assigns only its own organization's templates.
    /// </summary>
    public class MailTemplateOrganizationScopeTests
    {
        private const string Acme = "acme";
        private const string Globex = "globex";

        private readonly Mock<IValidator<SaveMailTemplateRequest>> _validator = new();
        private readonly Mock<IMailTemplateRepository> _repo = new();
        private readonly Mock<IMailTemplateHtmlChecker> _htmlChecker = new();
        private readonly Mock<IOrganizationReader> _organizations = new();
        private readonly Mock<IConfigurationRepository> _configurations = new();
        private readonly Mock<IMessageClient> _messages = new();

        public MailTemplateOrganizationScopeTests()
        {
            _organizations.Setup(o => o.ExistsEnabledAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                          .ReturnsAsync((string id, CancellationToken _) => id is "default" or Acme or Globex);
            _validator.Setup(v => v.ValidateAsync(It.IsAny<SaveMailTemplateRequest>(), It.IsAny<CancellationToken>()))
                      .ReturnsAsync(new ValidationResult());
            _repo.Setup(r => r.GetsAsync(It.IsAny<GetAllMailTemplatesRequest>())).ReturnsAsync(new GetAllMailTemplatesResponse());
        }

        private MailTemplateService Service() =>
            new(_validator.Object, _repo.Object, _htmlChecker.Object, _organizations.Object, _configurations.Object,
                _messages.Object, NullLogger<MailTemplateService>.Instance);

        private MailTemplateCopyService CopyService() =>
            new(_repo.Object, _messages.Object, NullLogger<MailTemplateCopyService>.Instance);

        private static BlocksTestContext TokenOf(string organizationId, bool impersonated = false) =>
            new(tenantId: "project-1", organizationId: organizationId, impersonated: impersonated, originalTenantId: impersonated ? "root-1" : null);

        private void Stored(string id, string? organizationId)
        {
            var template = new EmailTemplate
            {
                ItemId = id,
                Name = "Welcome",
                Language = "en-US",
                OrganizationId = organizationId!,
                TemplateSubject = "Hi",
                TemplateBody = "<p>Hi</p>",
            };
            _repo.Setup(r => r.GetByIdAsync(id)).ReturnsAsync(template);
            _repo.Setup(r => r.GetForViewAsync(id)).ReturnsAsync(template);
        }

        private void NothingWritten()
        {
            _repo.Verify(r => r.SaveAsync(It.IsAny<EmailTemplate>()), Times.Never);
            _repo.Verify(r => r.DeleteAsync(It.IsAny<string>()), Times.Never);
            _repo.Verify(r => r.AssignConfigurationAsync(It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<IReadOnlyCollection<string>?>(), It.IsAny<string?>(), It.IsAny<string?>()), Times.Never);
            _messages.VerifyNoOtherCalls();
        }

        // ---- CallerOrganization ----

        [Theory]
        [InlineData("default")]
        [InlineData("")]
        public void A_default_or_blank_token_is_not_confined(string organizationId)
        {
            using var _ = TokenOf(organizationId);

            CallerOrganization.Confined().Should().BeNull();
            CallerOrganization.Scope(Globex).Should().Be(Globex);
            CallerOrganization.Scope(null).Should().BeNull();
        }

        [Fact]
        public void No_context_is_not_confined()
        {
            BlocksContext.ClearContext();

            CallerOrganization.Confined().Should().BeNull();
        }

        [Fact]
        public void An_organization_token_is_confined_to_it()
        {
            using var _ = TokenOf(Acme);

            CallerOrganization.Confined().Should().Be(Acme);
            CallerOrganization.Scope(null).Should().Be(Acme);
            CallerOrganization.Scope(" ").Should().Be(Acme);
            CallerOrganization.Scope(Acme).Should().Be(Acme);
            FluentActions.Invoking(() => CallerOrganization.Scope("default")).Should().Throw<OrganizationAccessDeniedException>();
            FluentActions.Invoking(() => CallerOrganization.Scope(Globex)).Should().Throw<OrganizationAccessDeniedException>();
            FluentActions.Invoking(() => CallerOrganization.EnsureMayAccess("")).Should().Throw<OrganizationAccessDeniedException>();
            FluentActions.Invoking(CallerOrganization.EnsureUnconfined).Should().Throw<OrganizationAccessDeniedException>();
        }

        // ---- Default organization token: today's behaviour ----

        [Theory]
        [InlineData(false)]
        [InlineData(true)]
        public async Task A_default_token_lists_any_organization(bool impersonated)
        {
            using var _ = TokenOf("default", impersonated);

            await Service().GetAllTemplatesAsync(new GetAllMailTemplatesRequest { OrganizationId = Globex });

            _repo.Verify(r => r.GetsAsync(It.Is<GetAllMailTemplatesRequest>(q => q.OrganizationId == Globex)), Times.Once);
        }

        [Fact]
        public async Task A_default_token_listing_without_an_organization_still_means_the_Default_one()
        {
            using var _ = TokenOf("default");

            await Service().GetAllTemplatesAsync(new GetAllMailTemplatesRequest());

            _repo.Verify(r => r.GetsAsync(It.Is<GetAllMailTemplatesRequest>(q => q.OrganizationId == null)), Times.Once);
        }

        [Fact]
        public async Task A_default_token_gets_edits_and_deletes_another_organizations_template()
        {
            using var _ = TokenOf("default");
            Stored("g1", Globex);

            (await Service().GetAsync(new GetMailTemplateRequest { ItemId = "g1" })).Should().NotBeNull();
            (await Service().SaveTemplateAsync(new SaveMailTemplateRequest { ItemId = "g1", TemplateBody = "<p>New</p>" })).IsSuccess.Should().BeTrue();
            (await Service().DeleteAsync(new DeleteMailTemplateRequest { ItemId = "g1" })).IsSuccess.Should().BeTrue();

            _repo.Verify(r => r.SaveAsync(It.Is<EmailTemplate>(t => t.ItemId == "g1" && t.OrganizationId == Globex)), Times.Once);
            _repo.Verify(r => r.DeleteAsync("g1"), Times.Once);
        }

        [Fact]
        public async Task A_default_token_creates_a_template_in_another_organization()
        {
            using var _ = TokenOf("default");

            var response = await Service().SaveTemplateAsync(new SaveMailTemplateRequest
            {
                Name = "Welcome", Language = "en-US", TemplateSubject = "Hi", OrganizationId = Globex,
            });

            response.IsSuccess.Should().BeTrue();
            _repo.Verify(r => r.SaveAsync(It.Is<EmailTemplate>(t => t.OrganizationId == Globex)), Times.Once);
        }

        // ---- Organization token: its own organization only ----

        [Fact]
        public async Task An_organization_token_listing_without_an_organization_gets_its_own()
        {
            using var _ = TokenOf(Acme);

            await Service().GetAllTemplatesAsync(new GetAllMailTemplatesRequest());

            _repo.Verify(r => r.GetsAsync(It.Is<GetAllMailTemplatesRequest>(q => q.OrganizationId == Acme)), Times.Once);
        }

        [Theory]
        [InlineData("default")]
        [InlineData(Globex)]
        public async Task An_organization_token_cannot_list_another_organization(string other)
        {
            using var _ = TokenOf(Acme);

            await FluentActions.Awaiting(() => Service().GetAllTemplatesAsync(new GetAllMailTemplatesRequest { OrganizationId = other }))
                .Should().ThrowAsync<OrganizationAccessDeniedException>();

            _repo.Verify(r => r.GetsAsync(It.IsAny<GetAllMailTemplatesRequest>()), Times.Never);
        }

        [Theory]
        [InlineData("default")]
        [InlineData("")]
        [InlineData(Globex)]
        public async Task An_organization_token_cannot_get_another_organizations_template(string other)
        {
            using var _ = TokenOf(Acme);
            Stored("t1", other);

            await FluentActions.Awaiting(() => Service().GetAsync(new GetMailTemplateRequest { ItemId = "t1" }))
                .Should().ThrowAsync<OrganizationAccessDeniedException>();
        }

        [Fact]
        public async Task An_organization_token_gets_its_own_template()
        {
            using var _ = TokenOf(Acme);
            Stored("a1", Acme);

            (await Service().GetAsync(new GetMailTemplateRequest { ItemId = "a1" }))!.ItemId.Should().Be("a1");
        }

        [Fact]
        public async Task An_organization_token_creates_in_its_own_organization_when_none_is_named()
        {
            using var _ = TokenOf(Acme);

            var response = await Service().SaveTemplateAsync(new SaveMailTemplateRequest
            {
                Name = "Welcome", Language = "en-US", TemplateSubject = "Hi",
            });

            response.IsSuccess.Should().BeTrue();
            // The uniqueness check is the organization's own, not the Default organization's.
            _validator.Verify(v => v.ValidateAsync(It.Is<SaveMailTemplateRequest>(q => q.OrganizationId == Acme), It.IsAny<CancellationToken>()), Times.Once);
            _repo.Verify(r => r.GetByNameAndLanguageAsync("Welcome", "en-US", Acme), Times.Once);
            _repo.Verify(r => r.SaveAsync(It.Is<EmailTemplate>(t => t.OrganizationId == Acme)), Times.Once);
        }

        [Theory]
        [InlineData("default")]
        [InlineData(Globex)]
        public async Task An_organization_token_cannot_create_in_another_organization(string other)
        {
            using var _ = TokenOf(Acme);

            await FluentActions.Awaiting(() => Service().SaveTemplateAsync(new SaveMailTemplateRequest
            {
                Name = "Welcome", Language = "en-US", TemplateSubject = "Hi", OrganizationId = other,
            })).Should().ThrowAsync<OrganizationAccessDeniedException>();

            // Refused before validation, which would read the other organization's templates.
            _validator.Verify(v => v.ValidateAsync(It.IsAny<SaveMailTemplateRequest>(), It.IsAny<CancellationToken>()), Times.Never);
            NothingWritten();
        }

        [Theory]
        [InlineData("default")]
        [InlineData(Globex)]
        public async Task An_organization_token_cannot_edit_another_organizations_template(string other)
        {
            using var _ = TokenOf(Acme);
            Stored("t1", other);

            await FluentActions.Awaiting(() => Service().SaveTemplateAsync(new SaveMailTemplateRequest { ItemId = "t1", TemplateBody = "<p>Mine</p>" }))
                .Should().ThrowAsync<OrganizationAccessDeniedException>();

            NothingWritten();
        }

        [Fact]
        public async Task An_organization_token_edits_its_own_template_without_naming_the_organization()
        {
            using var _ = TokenOf(Acme);
            Stored("a1", Acme);

            var response = await Service().SaveTemplateAsync(new SaveMailTemplateRequest { ItemId = "a1", TemplateBody = "<p>New</p>" });

            response.IsSuccess.Should().BeTrue();
            _repo.Verify(r => r.SaveAsync(It.Is<EmailTemplate>(t => t.ItemId == "a1" && t.TemplateBody == "<p>New</p>")), Times.Once);
        }

        [Fact]
        public async Task An_organization_token_cannot_clone_another_organizations_template()
        {
            using var _ = TokenOf(Acme);
            Stored("d1", "default");

            await FluentActions.Awaiting(() => Service().CloneTemplateAsync(new CloneMailTemplateRequest { ItemId = "d1", Language = "de-DE" }))
                .Should().ThrowAsync<OrganizationAccessDeniedException>();

            NothingWritten();
        }

        [Fact]
        public async Task An_organization_token_clones_its_own_template_into_its_organization()
        {
            using var _ = TokenOf(Acme);
            Stored("a1", Acme);

            var response = await Service().CloneTemplateAsync(new CloneMailTemplateRequest { ItemId = "a1", Language = "de-DE" });

            response.IsSuccess.Should().BeTrue();
            _repo.Verify(r => r.SaveAsync(It.Is<EmailTemplate>(t => t.OrganizationId == Acme && t.Language == "de-DE")), Times.Once);
        }

        [Theory]
        [InlineData("default")]
        [InlineData(Globex)]
        public async Task An_organization_token_cannot_delete_another_organizations_template(string other)
        {
            using var _ = TokenOf(Acme);
            Stored("t1", other);

            await FluentActions.Awaiting(() => Service().DeleteAsync(new DeleteMailTemplateRequest { ItemId = "t1" }))
                .Should().ThrowAsync<OrganizationAccessDeniedException>();

            NothingWritten();
        }

        [Fact]
        public async Task An_organization_token_deletes_its_own_template()
        {
            using var _ = TokenOf(Acme);
            Stored("a1", Acme);

            (await Service().DeleteAsync(new DeleteMailTemplateRequest { ItemId = "a1" })).IsSuccess.Should().BeTrue();

            _repo.Verify(r => r.DeleteAsync("a1"), Times.Once);
        }

        [Theory]
        [InlineData("default")]
        [InlineData(Globex)]
        public async Task An_organization_token_cannot_assign_another_organizations_templates(string other)
        {
            using var _ = TokenOf(Acme);
            _configurations.Setup(c => c.GetMailConfigurationByIdAsync("smtp"))
                           .ReturnsAsync(new MailServerConfiguration { ItemId = "smtp", OrganizationId = other });

            await FluentActions.Awaiting(() => Service().AssignTemplatesAsync(new AssignTemplatesRequest { ConfigurationId = "smtp", AllMatching = true }))
                .Should().ThrowAsync<OrganizationAccessDeniedException>();

            NothingWritten();
        }

        [Fact]
        public async Task An_organization_token_assigns_its_own_templates_to_its_configuration()
        {
            using var _ = TokenOf(Acme);
            _configurations.Setup(c => c.GetMailConfigurationByIdAsync("acme-smtp"))
                           .ReturnsAsync(new MailServerConfiguration { ItemId = "acme-smtp", OrganizationId = Acme });
            _repo.Setup(r => r.AssignConfigurationAsync("acme-smtp", Acme, null, null, null)).ReturnsAsync(3);

            var response = await Service().AssignTemplatesAsync(new AssignTemplatesRequest { ConfigurationId = "acme-smtp", AllMatching = true });

            response.IsSuccess.Should().BeTrue();
            response.UpdatedCount.Should().Be(3);
        }

        [Fact]
        public async Task An_organization_token_cannot_delete_across_organizations()
        {
            using var _ = TokenOf(Acme);
            Stored("d1", "default");

            await FluentActions.Awaiting(() => Service().DeleteAcrossOrganizationsAsync(new DeleteTemplateAcrossOrganizationsRequest
            {
                TemplateId = "d1", OrganizationIds = new List<string> { Acme },
            })).Should().ThrowAsync<OrganizationAccessDeniedException>();

            _repo.Verify(r => r.GetByIdAsync(It.IsAny<string>()), Times.Never);
            NothingWritten();
        }

        [Fact]
        public async Task An_organization_token_cannot_copy_to_organizations()
        {
            using var _ = TokenOf(Acme);
            Stored("d1", "default");

            await FluentActions.Awaiting(() => CopyService().CopyToOrganizationsAsync(new CopyTemplateToOrganizationsRequest
            {
                TemplateId = "d1", OrganizationIds = new List<string> { Acme }, Existing = "keep",
            })).Should().ThrowAsync<OrganizationAccessDeniedException>();

            _repo.Verify(r => r.GetByIdAsync(It.IsAny<string>()), Times.Never);
            NothingWritten();
        }

        [Fact]
        public async Task An_organization_token_cannot_look_up_other_organizations_copies()
        {
            using var _ = TokenOf(Acme);
            Stored("d1", "default");

            await FluentActions.Awaiting(() => CopyService().GetOrganizationCopiesAsync(new GetTemplateOrganizationCopiesRequest
            {
                TemplateId = "d1", OrganizationIds = Globex,
            })).Should().ThrowAsync<OrganizationAccessDeniedException>();

            _repo.Verify(r => r.GetOrganizationCopiesAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IReadOnlyCollection<string>>()), Times.Never);
        }
    }
}
