using Microsoft.Extensions.Logging.Abstractions;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Configuration.DomainService.Mail.Template;
using Configuration.DomainService.Mail.Template.Services;
using FluentAssertions;
using FluentValidation;
using FluentValidation.Results;
using Moq;
using XUnitTest.TestSupport;
using Blocks.Genesis.Entities.Os;
using Configuration.DomainService.Organizations;
using Configuration.DomainService.Shared.Services;

namespace XUnitTest.Services
{
    public class MailTemplateServiceTests
    {
        private readonly Mock<IValidator<SaveMailTemplateRequest>> _validator = new();
        private readonly Mock<IMailTemplateRepository> _repo = new();
        private readonly Mock<IMailTemplateHtmlChecker> _htmlChecker = new();
        private readonly Mock<IOrganizationReader> _organizations = new();
        private readonly Mock<IConfigurationRepository> _configurations = new();

        public MailTemplateServiceTests()
        {
            // The Default organization always exists; "acme" is an enabled organization.
            _organizations.Setup(o => o.ExistsEnabledAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                          .ReturnsAsync((string id, CancellationToken _) => id is "default" or "acme");
        }

        private MailTemplateService Service() =>
            new(_validator.Object, _repo.Object, _htmlChecker.Object, _organizations.Object, _configurations.Object,
                new Mock<IMessageClient>().Object, NullLogger<MailTemplateService>.Instance);

        [Fact]
        public async Task CloneTemplateAsync_WhenTheSourceBodyBreaksTheHtmlRules_SavesNothing()
        {
            _repo.Setup(r => r.GetByIdAsync("src")).ReturnsAsync(new EmailTemplate { ItemId = "src", Name = "Old", TemplateBody = "<a href=\"https://evil.example\">x</a>" });
            _htmlChecker.Setup(c => c.FindProblem(It.IsAny<string?>())).Returns("A link to evil.example is not allowed.");

            var response = await Service().CloneTemplateAsync(new CloneMailTemplateRequest { ItemId = "src", Language = "xx-XX" });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey(nameof(EmailTemplate.TemplateBody));
            _repo.Verify(r => r.SaveAsync(It.IsAny<EmailTemplate>()), Times.Never);
        }

        private void ValidationSucceeds() =>
            _validator.Setup(v => v.ValidateAsync(It.IsAny<SaveMailTemplateRequest>(), It.IsAny<CancellationToken>()))
                      .ReturnsAsync(new ValidationResult());

        [Fact]
        public async Task SaveTemplateAsync_WhenInvalid_ReturnsErrors()
        {
            _validator.Setup(v => v.ValidateAsync(It.IsAny<SaveMailTemplateRequest>(), It.IsAny<CancellationToken>()))
                      .ReturnsAsync(new ValidationResult(new[] { new ValidationFailure("Name", "Name is required") }));

            var response = await Service().SaveTemplateAsync(new SaveMailTemplateRequest());

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("Name");
            _repo.Verify(r => r.SaveAsync(It.IsAny<EmailTemplate>()), Times.Never);
        }

        [Fact]
        public async Task SaveTemplateAsync_NewTemplate_SavesAndReturnsItemId()
        {
            using var _ = new BlocksTestContext();
            ValidationSucceeds();
            _repo.Setup(r => r.GetByNameAndLanguageAsync("Welcome", "en", "default"))
                 .ReturnsAsync((EmailTemplate?)null);

            var response = await Service().SaveTemplateAsync(new SaveMailTemplateRequest
            {
                Name = "Welcome",
                Language = "en",
                TemplateSubject = "Hi"
            });

            response.IsSuccess.Should().BeTrue();
            response.ItemId.Should().NotBeNullOrEmpty();
            _repo.Verify(r => r.SaveAsync(It.Is<EmailTemplate>(t => t.Name == "Welcome")), Times.Once);
        }

        [Fact]
        public async Task SaveTemplateAsync_NewTemplate_DuplicateNameLanguage_ReturnsError()
        {
            using var _ = new BlocksTestContext();
            ValidationSucceeds();
            _repo.Setup(r => r.GetByNameAndLanguageAsync("Welcome", "en", "default"))
                 .ReturnsAsync(new EmailTemplate { ItemId = "existing", Name = "Welcome", Language = "en" });

            var response = await Service().SaveTemplateAsync(new SaveMailTemplateRequest
            {
                Name = "Welcome",
                Language = "en"
            });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("Template");
            _repo.Verify(r => r.SaveAsync(It.IsAny<EmailTemplate>()), Times.Never);
        }

        [Fact]
        public async Task SaveTemplateAsync_ExistingItem_UpdatesFields()
        {
            using var _ = new BlocksTestContext();
            ValidationSucceeds();
            _repo.Setup(r => r.GetByNameAndLanguageAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                 .ReturnsAsync((EmailTemplate?)null);
            _repo.Setup(r => r.GetByIdAsync("item-1"))
                 .ReturnsAsync(new EmailTemplate { ItemId = "item-1", Name = "Old", Language = "en", TemplateSubject = "OldSub" });

            // SPEC31: Name and Language are fixed, so an edit sends them unchanged (or not at all).
            var response = await Service().SaveTemplateAsync(new SaveMailTemplateRequest
            {
                ItemId = "item-1",
                Name = "Old",
                Language = "en",
                TemplateSubject = "NewSub"
            });

            response.IsSuccess.Should().BeTrue();
            response.ItemId.Should().Be("item-1");
            _repo.Verify(r => r.SaveAsync(It.Is<EmailTemplate>(t => t.ItemId == "item-1" && t.Name == "Old" && t.TemplateSubject == "NewSub")), Times.Once);
        }

        [Fact]
        public async Task SaveTemplateAsync_UnknownItem_NameConflictWithDifferentItem_ReturnsError()
        {
            using var _ = new BlocksTestContext();
            ValidationSucceeds();
            _repo.Setup(r => r.GetByIdAsync("item-1")).ReturnsAsync((EmailTemplate?)null);
            _repo.Setup(r => r.GetByNameAndLanguageAsync("Dup", "en", "default"))
                 .ReturnsAsync(new EmailTemplate { ItemId = "other", Name = "Dup", Language = "en" });

            var response = await Service().SaveTemplateAsync(new SaveMailTemplateRequest
            {
                ItemId = "item-1",
                Name = "Dup",
                Language = "en"
            });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("Template");
        }

        [Fact]
        public async Task SaveTemplateAsync_ExistingItem_NotInRepo_CreatesFromRequestId()
        {
            using var _ = new BlocksTestContext();
            ValidationSucceeds();
            _repo.Setup(r => r.GetByNameAndLanguageAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                 .ReturnsAsync((EmailTemplate?)null);
            _repo.Setup(r => r.GetByIdAsync("ghost")).ReturnsAsync((EmailTemplate?)null);

            var response = await Service().SaveTemplateAsync(new SaveMailTemplateRequest
            {
                ItemId = "ghost",
                Name = "Fresh",
                Language = "en",
                TemplateSubject = "Hi"
            });

            response.IsSuccess.Should().BeTrue();
            response.ItemId.Should().Be("ghost");
            _repo.Verify(r => r.SaveAsync(It.Is<EmailTemplate>(t => t.ItemId == "ghost")), Times.Once);
        }

        [Fact]
        public async Task GetAllTemplatesAsync_DelegatesToRepository()
        {
            var expected = new GetAllMailTemplatesResponse { TotalCount = 3 };
            _repo.Setup(r => r.GetsAsync(It.IsAny<GetAllMailTemplatesRequest>())).ReturnsAsync(expected);

            var response = await Service().GetAllTemplatesAsync(new GetAllMailTemplatesRequest());

            response.Should().BeSameAs(expected);
        }

        [Fact]
        public async Task GetAsync_ReadsTheTemplateAsTheCallerMayView()
        {
            var template = new EmailTemplate { ItemId = "t1" };
            _repo.Setup(r => r.GetForViewAsync("t1")).ReturnsAsync(template);

            var response = await Service().GetAsync(new GetMailTemplateRequest { ItemId = "t1" });

            response.Should().BeSameAs(template);
        }

        [Fact]
        public async Task CloneTemplateAsync_WhenNotFound_ReturnsError()
        {
            _repo.Setup(r => r.GetByIdAsync("missing")).ReturnsAsync((EmailTemplate?)null);

            var response = await Service().CloneTemplateAsync(new CloneMailTemplateRequest { ItemId = "missing" });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("Template");
        }

        [Fact]
        public async Task CloneTemplateAsync_UsesOverridesWhenProvided()
        {
            using var _ = new BlocksTestContext();
            _configurations.Setup(c => c.GetMailConfigurationByIdAsync("cfg-2"))
                           .ReturnsAsync(new MailServerConfiguration { ItemId = "cfg-2" });
            _repo.Setup(r => r.GetByIdAsync("src")).ReturnsAsync(new EmailTemplate
            {
                ItemId = "src",
                Name = "Original",
                Language = "en",
                TemplateSubject = "OrigSub",
                MailConfigurationId = "cfg-1",
                JsonContent = "{}"
            });

            EmailTemplate? saved = null;
            _repo.Setup(r => r.SaveAsync(It.IsAny<EmailTemplate>()))
                 .Callback<EmailTemplate>(t => saved = t)
                 .Returns(Task.CompletedTask);

            var response = await Service().CloneTemplateAsync(new CloneMailTemplateRequest
            {
                ItemId = "src",
                Name = "Original",
                Language = "xx-XX",
                TemplateSubject = "NewSub",
                MailConfigurationId = "cfg-2"
            });

            response.IsSuccess.Should().BeTrue();
            saved.Should().NotBeNull();
            saved!.Name.Should().Be("Original");
            saved.Language.Should().Be("xx-XX");
            saved.TemplateSubject.Should().Be("NewSub");
            saved.MailConfigurationId.Should().Be("cfg-2");
            saved.JsonContent.Should().Be("{}");
            saved.ItemId.Should().NotBe("src");
        }

        [Fact]
        public async Task CloneTemplateAsync_KeepsTheNameWhenNotProvided()
        {
            using var _ = new BlocksTestContext();
            _repo.Setup(r => r.GetByIdAsync("src")).ReturnsAsync(new EmailTemplate
            {
                ItemId = "src",
                Name = "Original",
                Language = "en",
                TemplateSubject = "OrigSub"
            });
            EmailTemplate? saved = null;
            _repo.Setup(r => r.SaveAsync(It.IsAny<EmailTemplate>()))
                 .Callback<EmailTemplate>(t => saved = t)
                 .Returns(Task.CompletedTask);

            await Service().CloneTemplateAsync(new CloneMailTemplateRequest { ItemId = "src", Language = "xx-XX" });

            // SPEC31 §6.4: a clone keeps the source's name (no "_clone") in the chosen language.
            saved!.Name.Should().Be("Original");
            saved.Language.Should().Be("xx-XX");
        }

        [Fact]
        public async Task DeleteAsync_WhenNotFound_ReturnsError()
        {
            _repo.Setup(r => r.GetByIdAsync("missing")).ReturnsAsync((EmailTemplate?)null);

            var response = await Service().DeleteAsync(new DeleteMailTemplateRequest { ItemId = "missing" });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("ItemId");
            _repo.Verify(r => r.DeleteAsync(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task DeleteAsync_WhenFound_Deletes()
        {
            _repo.Setup(r => r.GetByIdAsync("t1")).ReturnsAsync(new EmailTemplate { ItemId = "t1" });

            var response = await Service().DeleteAsync(new DeleteMailTemplateRequest { ItemId = "t1" });

            response.IsSuccess.Should().BeTrue();
            _repo.Verify(r => r.DeleteAsync("t1"), Times.Once);
        }

        // #726: a template is never stored without a subject (Logic cannot send it). The rule
        // checks the subject the template would be stored with, after merging and clone fallback.

        private static readonly Dictionary<string, string> SubjectRequired = new()
        {
            { nameof(EmailTemplate.TemplateSubject), "Subject is required." }
        };

        private void NoTemplateWithTheSameNameAndLanguage() =>
            _repo.Setup(r => r.GetByNameAndLanguageAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                 .ReturnsAsync((EmailTemplate?)null);

        private Func<EmailTemplate?> CaptureSaved()
        {
            EmailTemplate? saved = null;
            _repo.Setup(r => r.SaveAsync(It.IsAny<EmailTemplate>()))
                 .Callback<EmailTemplate>(t => saved = t)
                 .Returns(Task.CompletedTask);
            return () => saved;
        }

        private void ShouldBeRejectedForTheSubject(BaseMutationResponse response)
        {
            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().BeEquivalentTo(SubjectRequired);
            response.ItemId.Should().BeNull();
            _repo.Verify(r => r.SaveAsync(It.IsAny<EmailTemplate>()), Times.Never);
        }

        [Fact]
        public async Task SaveTemplateAsync_Create_WithSubjectAndNoBody_StoresTheSubjectAndANullBody()
        {
            using var _ = new BlocksTestContext();
            ValidationSucceeds();
            _configurations.Setup(c => c.GetMailConfigurationByIdAsync("c1")).ReturnsAsync(new MailServerConfiguration { ItemId = "c1" });
            NoTemplateWithTheSameNameAndLanguage();
            var saved = CaptureSaved();

            var response = await Service().SaveTemplateAsync(new SaveMailTemplateRequest
            {
                Name = "welcome",
                Language = "en",
                MailConfigurationId = "c1",
                TemplateSubject = "Welcome {{name}}"
            });

            response.IsSuccess.Should().BeTrue();
            response.ItemId.Should().NotBeNullOrEmpty().And.Be(saved()!.ItemId);
            saved()!.TemplateSubject.Should().Be("Welcome {{name}}");
            saved()!.TemplateBody.Should().BeNull();
            _repo.Verify(r => r.SaveAsync(It.IsAny<EmailTemplate>()), Times.Once);
        }

        [Fact]
        public async Task SaveTemplateAsync_Create_WithSubjectAndBody_StoresBoth()
        {
            using var _ = new BlocksTestContext();
            ValidationSucceeds();
            NoTemplateWithTheSameNameAndLanguage();
            var saved = CaptureSaved();

            var response = await Service().SaveTemplateAsync(new SaveMailTemplateRequest
            {
                Name = "welcome",
                Language = "en",
                TemplateSubject = "Welcome",
                TemplateBody = "<p>Hi</p>"
            });

            response.IsSuccess.Should().BeTrue();
            saved()!.TemplateSubject.Should().Be("Welcome");
            saved()!.TemplateBody.Should().Be("<p>Hi</p>");
        }

        [Fact]
        public async Task SaveTemplateAsync_Update_WithoutASubject_KeepsTheStoredSubject()
        {
            using var _ = new BlocksTestContext();
            ValidationSucceeds();
            _repo.Setup(r => r.GetByIdAsync("item-1"))
                 .ReturnsAsync(new EmailTemplate { ItemId = "item-1", Name = "welcome", TemplateSubject = "Welcome" });
            var saved = CaptureSaved();

            var response = await Service().SaveTemplateAsync(new SaveMailTemplateRequest
            {
                ItemId = "item-1",
                TemplateBody = "<p>Hi</p>"
            });

            response.IsSuccess.Should().BeTrue();
            response.ItemId.Should().Be("item-1");
            saved()!.TemplateSubject.Should().Be("Welcome");
            saved()!.TemplateBody.Should().Be("<p>Hi</p>");
        }

        [Theory]
        [InlineData("Welcome")]
        [InlineData(null)]
        public async Task SaveTemplateAsync_Update_WithANewSubject_StoresIt(string? storedSubject)
        {
            using var _ = new BlocksTestContext();
            ValidationSucceeds();
            _repo.Setup(r => r.GetByIdAsync("item-1"))
                 .ReturnsAsync(new EmailTemplate { ItemId = "item-1", Name = "welcome", TemplateSubject = storedSubject });
            var saved = CaptureSaved();

            var response = await Service().SaveTemplateAsync(new SaveMailTemplateRequest
            {
                ItemId = "item-1",
                TemplateSubject = "Now set"
            });

            response.IsSuccess.Should().BeTrue();
            saved()!.TemplateSubject.Should().Be("Now set");
        }

        [Fact]
        public async Task SaveTemplateAsync_SubjectWithOuterSpaces_IsStoredUnchanged()
        {
            using var _ = new BlocksTestContext();
            ValidationSucceeds();
            NoTemplateWithTheSameNameAndLanguage();
            _repo.Setup(r => r.GetByIdAsync("item-1"))
                 .ReturnsAsync(new EmailTemplate { ItemId = "item-1", TemplateSubject = "Old" });
            var saved = CaptureSaved();

            var created = await Service().SaveTemplateAsync(new SaveMailTemplateRequest
            {
                Name = "welcome",
                Language = "en",
                TemplateSubject = "  Hi  "
            });
            created.IsSuccess.Should().BeTrue();
            saved()!.TemplateSubject.Should().Be("  Hi  ");

            var updated = await Service().SaveTemplateAsync(new SaveMailTemplateRequest
            {
                ItemId = "item-1",
                TemplateSubject = "  Hi  "
            });
            updated.IsSuccess.Should().BeTrue();
            saved()!.ItemId.Should().Be("item-1");
            saved()!.TemplateSubject.Should().Be("  Hi  ");
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData("\t\n")]
        public async Task SaveTemplateAsync_Create_WithoutANonBlankSubject_IsRejected(string? subject)
        {
            using var _ = new BlocksTestContext();
            ValidationSucceeds();
            NoTemplateWithTheSameNameAndLanguage();

            var response = await Service().SaveTemplateAsync(new SaveMailTemplateRequest
            {
                Name = "spec-nosub",
                Language = "en",
                MailConfigurationId = "c1",
                TemplateSubject = subject
            });

            ShouldBeRejectedForTheSubject(response);
            // No read beyond today's: the mapping's name/language lookup only.
            _repo.Verify(r => r.GetByNameAndLanguageAsync("spec-nosub", "en", "default"), Times.Once);
            _repo.Verify(r => r.GetByIdAsync(It.IsAny<string>()), Times.Never);
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        public async Task SaveTemplateAsync_Update_BlankingTheSubject_IsRejected(string subject)
        {
            using var _ = new BlocksTestContext();
            ValidationSucceeds();
            _repo.Setup(r => r.GetByIdAsync("item-1"))
                 .ReturnsAsync(new EmailTemplate { ItemId = "item-1", TemplateSubject = "Welcome" });

            var response = await Service().SaveTemplateAsync(new SaveMailTemplateRequest
            {
                ItemId = "item-1",
                TemplateSubject = subject
            });

            ShouldBeRejectedForTheSubject(response);
            _repo.Verify(r => r.GetByIdAsync("item-1"), Times.Once);
            _repo.Verify(r => r.GetByNameAndLanguageAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task SaveTemplateAsync_BodyOnlyUpdateOfASubjectlessTemplate_IsRejected()
        {
            using var _ = new BlocksTestContext();
            ValidationSucceeds();
            _repo.Setup(r => r.GetByIdAsync("legacy"))
                 .ReturnsAsync(new EmailTemplate { ItemId = "legacy", Name = "spec-legacy", Language = "en" });

            var response = await Service().SaveTemplateAsync(new SaveMailTemplateRequest
            {
                ItemId = "legacy",
                TemplateBody = "<p>x</p>"
            });

            ShouldBeRejectedForTheSubject(response);
            _repo.Verify(r => r.GetByIdAsync("legacy"), Times.Once);
        }

        [Fact]
        public async Task SaveTemplateAsync_UpsertOfAnUnknownIdWithoutASubject_IsRejected()
        {
            using var _ = new BlocksTestContext();
            ValidationSucceeds();
            NoTemplateWithTheSameNameAndLanguage();
            _repo.Setup(r => r.GetByIdAsync("ghost")).ReturnsAsync((EmailTemplate?)null);

            var response = await Service().SaveTemplateAsync(new SaveMailTemplateRequest
            {
                ItemId = "ghost",
                Name = "spec-upsert",
                Language = "en"
            });

            ShouldBeRejectedForTheSubject(response);
            _repo.Verify(r => r.GetByNameAndLanguageAsync("spec-upsert", "en", "default"), Times.Once);
            _repo.Verify(r => r.GetByIdAsync("ghost"), Times.Once);
        }

        [Fact]
        public async Task SaveTemplateAsync_DuplicateNameAndLanguageWithoutASubject_ReturnsOnlyTheDuplicateError()
        {
            using var _ = new BlocksTestContext();
            ValidationSucceeds();
            _repo.Setup(r => r.GetByNameAndLanguageAsync("welcome", "en", "default"))
                 .ReturnsAsync(new EmailTemplate { ItemId = "other", Name = "welcome", Language = "en", TemplateSubject = "Hi" });

            var created = await Service().SaveTemplateAsync(new SaveMailTemplateRequest { Name = "welcome", Language = "en" });
            var updated = await Service().SaveTemplateAsync(new SaveMailTemplateRequest { ItemId = "item-1", Name = "welcome", Language = "en" });

            var duplicate = new Dictionary<string, string> { { "Template", "Template with the same Name and Language already exists" } };
            created.IsSuccess.Should().BeFalse();
            created.Errors.Should().BeEquivalentTo(duplicate);
            updated.IsSuccess.Should().BeFalse();
            updated.Errors.Should().BeEquivalentTo(duplicate);
            _repo.Verify(r => r.SaveAsync(It.IsAny<EmailTemplate>()), Times.Never);
        }

        [Theory]
        [InlineData("Template", "Template with the same Name and Language already exists")]
        [InlineData(nameof(EmailTemplate.TemplateBody), "A link to evil.example is not allowed.")]
        public async Task SaveTemplateAsync_ValidatorErrorWithoutASubject_ReturnsOnlyTheValidatorError(string property, string message)
        {
            _validator.Setup(v => v.ValidateAsync(It.IsAny<SaveMailTemplateRequest>(), It.IsAny<CancellationToken>()))
                      .ReturnsAsync(new ValidationResult(new[] { new ValidationFailure(property, message) }));

            var response = await Service().SaveTemplateAsync(new SaveMailTemplateRequest
            {
                Name = "welcome",
                Language = "en",
                TemplateBody = "<a href=\"https://evil.example\">x</a>"
            });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().BeEquivalentTo(new Dictionary<string, string> { { property, message } });
            _repo.Verify(r => r.SaveAsync(It.IsAny<EmailTemplate>()), Times.Never);
        }

        [Fact]
        public async Task CloneTemplateAsync_WithASubject_FromASubjectlessSource_StoresThatSubject()
        {
            using var _ = new BlocksTestContext();
            _repo.Setup(r => r.GetByIdAsync("legacy"))
                 .ReturnsAsync(new EmailTemplate { ItemId = "legacy", Name = "spec-legacy", Language = "en" });
            var saved = CaptureSaved();

            var response = await Service().CloneTemplateAsync(new CloneMailTemplateRequest { ItemId = "legacy", Language = "xx-XX", TemplateSubject = "Hello" });

            response.IsSuccess.Should().BeTrue();
            response.ItemId.Should().Be(saved()!.ItemId);
            saved()!.TemplateSubject.Should().Be("Hello");
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public async Task CloneTemplateAsync_WithoutASubject_KeepsTheSourceSubject(string? requestSubject)
        {
            using var _ = new BlocksTestContext();
            _repo.Setup(r => r.GetByIdAsync("src"))
                 .ReturnsAsync(new EmailTemplate { ItemId = "src", Name = "Original", Language = "en", TemplateSubject = "OrigSub" });
            var saved = CaptureSaved();

            var response = await Service().CloneTemplateAsync(new CloneMailTemplateRequest { ItemId = "src", Language = "xx-XX", TemplateSubject = requestSubject });

            response.IsSuccess.Should().BeTrue();
            saved()!.TemplateSubject.Should().Be("OrigSub");
        }

        [Fact]
        public async Task CloneTemplateAsync_SubjectWithOuterSpaces_IsStoredUnchanged()
        {
            using var _ = new BlocksTestContext();
            _repo.Setup(r => r.GetByIdAsync("src"))
                 .ReturnsAsync(new EmailTemplate { ItemId = "src", Name = "Original", Language = "en" });
            var saved = CaptureSaved();

            var response = await Service().CloneTemplateAsync(new CloneMailTemplateRequest { ItemId = "src", Language = "xx-XX", TemplateSubject = "  Hi  " });

            response.IsSuccess.Should().BeTrue();
            saved()!.TemplateSubject.Should().Be("  Hi  ");
        }

        [Theory]
        [InlineData(null, null)]
        [InlineData(null, "")]
        [InlineData(null, "   ")]
        [InlineData("   ", null)]
        [InlineData("\t", "")]
        public async Task CloneTemplateAsync_WithoutANonBlankSubjectAnywhere_IsRejected(string? requestSubject, string? sourceSubject)
        {
            using var _ = new BlocksTestContext();
            _repo.Setup(r => r.GetByIdAsync("legacy"))
                 .ReturnsAsync(new EmailTemplate { ItemId = "legacy", Name = "spec-legacy", Language = "en", TemplateSubject = sourceSubject });

            var response = await Service().CloneTemplateAsync(new CloneMailTemplateRequest { ItemId = "legacy", Language = "xx-XX", TemplateSubject = requestSubject });

            ShouldBeRejectedForTheSubject(response);
            _repo.Verify(r => r.GetByIdAsync("legacy"), Times.Once);
        }

        [Fact]
        public async Task CloneTemplateAsync_MissingSource_ReturnsOnlyNotFound()
        {
            _repo.Setup(r => r.GetByIdAsync("missing")).ReturnsAsync((EmailTemplate?)null);

            var response = await Service().CloneTemplateAsync(new CloneMailTemplateRequest { ItemId = "missing" });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().BeEquivalentTo(new Dictionary<string, string> { { "Template", "Template not found" } });
            _repo.Verify(r => r.SaveAsync(It.IsAny<EmailTemplate>()), Times.Never);
        }

        [Fact]
        public async Task CloneTemplateAsync_SubjectlessSourceWithABodyProblem_ReturnsOnlyTheBodyError()
        {
            _repo.Setup(r => r.GetByIdAsync("legacy"))
                 .ReturnsAsync(new EmailTemplate { ItemId = "legacy", TemplateBody = "<a href=\"https://evil.example\">x</a>" });
            _htmlChecker.Setup(c => c.FindProblem(It.IsAny<string?>())).Returns("A link to evil.example is not allowed.");

            var response = await Service().CloneTemplateAsync(new CloneMailTemplateRequest { ItemId = "legacy", Language = "xx-XX" });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().BeEquivalentTo(new Dictionary<string, string>
            {
                { nameof(EmailTemplate.TemplateBody), "A link to evil.example is not allowed." }
            });
            _repo.Verify(r => r.SaveAsync(It.IsAny<EmailTemplate>()), Times.Never);
        }

        [Fact]
        public async Task GetAsync_And_GetAllTemplatesAsync_ReturnSubjectlessTemplatesAsStored()
        {
            var legacy = new EmailTemplate { ItemId = "legacy", Name = "spec-legacy", Language = "en" };
            var page = new GetAllMailTemplatesResponse { TotalCount = 1, Templates = [legacy] };
            _repo.Setup(r => r.GetForViewAsync("legacy")).ReturnsAsync(legacy);
            _repo.Setup(r => r.GetsAsync(It.IsAny<GetAllMailTemplatesRequest>())).ReturnsAsync(page);

            var one = await Service().GetAsync(new GetMailTemplateRequest { ItemId = "legacy" });
            var all = await Service().GetAllTemplatesAsync(new GetAllMailTemplatesRequest());

            one.Should().BeSameAs(legacy);
            one!.TemplateSubject.Should().BeNull();
            all.Should().BeSameAs(page);
            all.Templates.Should().ContainSingle().Which.TemplateSubject.Should().BeNull();
        }

        [Fact]
        public async Task DeleteAsync_SubjectlessTemplate_Deletes()
        {
            _repo.Setup(r => r.GetByIdAsync("legacy"))
                 .ReturnsAsync(new EmailTemplate { ItemId = "legacy", Name = "spec-legacy", Language = "en" });

            var response = await Service().DeleteAsync(new DeleteMailTemplateRequest { ItemId = "legacy" });

            response.IsSuccess.Should().BeTrue();
            _repo.Verify(r => r.DeleteAsync("legacy"), Times.Once);
        }
            // ---- SPEC31 (#733): templates per organization ----

        private static readonly MailServerConfiguration AcmeOutbound = new() { ItemId = "acme-smtp", OrganizationId = "acme" };
        private static readonly MailServerConfiguration AcmeInbound = new() { ItemId = "acme-inbox", OrganizationId = "acme", IsInbound = true };
        private static readonly MailServerConfiguration DefaultOutbound = new() { ItemId = "default-smtp", OrganizationId = "default" };
        private static readonly MailServerConfiguration LegacyOutbound = new() { ItemId = "legacy-smtp", OrganizationId = "" };
        private static readonly MailServerConfiguration GlobexOutbound = new() { ItemId = "globex-smtp", OrganizationId = "globex" };

        private void Configurations(params MailServerConfiguration[] configurations)
        {
            foreach (var configuration in configurations)
            {
                _configurations.Setup(c => c.GetMailConfigurationByIdAsync(configuration.ItemId)).ReturnsAsync(configuration);
            }
        }

        private void ShouldBeRejected(BaseMutationResponse response, string field, string message)
        {
            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().BeEquivalentTo(new Dictionary<string, string> { { field, message } });
            _repo.Verify(r => r.SaveAsync(It.IsAny<EmailTemplate>()), Times.Never);
        }

        private static SaveMailTemplateRequest NewOrderConfirmation(string? organizationId, string? mailConfigurationId = null) => new()
        {
            Name = "OrderConfirmation",
            Language = "en-US",
            TemplateSubject = "Your order",
            OrganizationId = organizationId,
            MailConfigurationId = mailConfigurationId
        };

        [Fact]
        public async Task SaveTemplateAsync_Create_ForAnEnabledOrganization_StoresItsId() // H1
        {
            using var _ = new BlocksTestContext();
            ValidationSucceeds();
            NoTemplateWithTheSameNameAndLanguage();
            var saved = CaptureSaved();

            var response = await Service().SaveTemplateAsync(NewOrderConfirmation("acme", ""));

            response.IsSuccess.Should().BeTrue();
            saved()!.OrganizationId.Should().Be("acme");
            saved()!.CreatedFromDefault.Should().BeFalse();
            _repo.Verify(r => r.GetByNameAndLanguageAsync("OrderConfirmation", "en-US", "acme"), Times.Once);
        }

        [Theory] // H2
        [InlineData(null)]
        [InlineData("")]
        [InlineData("  ")]
        [InlineData("default")]
        public async Task SaveTemplateAsync_Create_WithoutAnOrganization_StoresDefault(string? organizationId)
        {
            using var _ = new BlocksTestContext();
            ValidationSucceeds();
            NoTemplateWithTheSameNameAndLanguage();
            var saved = CaptureSaved();

            var response = await Service().SaveTemplateAsync(NewOrderConfirmation(organizationId));

            response.IsSuccess.Should().BeTrue();
            saved()!.OrganizationId.Should().Be("default");
            _repo.Verify(r => r.GetByNameAndLanguageAsync("OrderConfirmation", "en-US", "default"), Times.Once);
        }

        [Fact]
        public async Task SaveTemplateAsync_Create_SameNameAndLanguageOnlyInAnotherOrganization_IsAllowed() // H3, example 1
        {
            using var _ = new BlocksTestContext();
            ValidationSucceeds();
            _repo.Setup(r => r.GetByNameAndLanguageAsync("OrderConfirmation", "en-US", "default"))
                 .ReturnsAsync(new EmailTemplate { ItemId = "t-default", Name = "OrderConfirmation", Language = "en-US" });
            _repo.Setup(r => r.GetByNameAndLanguageAsync("OrderConfirmation", "en-US", "acme")).ReturnsAsync((EmailTemplate?)null);
            var saved = CaptureSaved();

            var response = await Service().SaveTemplateAsync(NewOrderConfirmation("acme"));

            response.IsSuccess.Should().BeTrue();
            saved()!.OrganizationId.Should().Be("acme");
        }

        [Fact]
        public async Task SaveTemplateAsync_Create_SameNameAndLanguageInTheSameOrganization_IsRejected() // C1, example 2
        {
            using var _ = new BlocksTestContext();
            ValidationSucceeds();
            _repo.Setup(r => r.GetByNameAndLanguageAsync("OrderConfirmation", "en-US", "acme"))
                 .ReturnsAsync(new EmailTemplate { ItemId = "t-acme", Name = "OrderConfirmation", Language = "en-US", OrganizationId = "acme" });

            var response = await Service().SaveTemplateAsync(NewOrderConfirmation("acme"));

            ShouldBeRejected(response, "Template", "Template with the same Name and Language already exists");
        }

        [Theory] // C5
        [InlineData("disabled-org")]
        [InlineData("no-such-org")]
        public async Task SaveTemplateAsync_Create_ForAMissingOrDisabledOrganization_IsRejected(string organizationId)
        {
            using var _ = new BlocksTestContext();
            ValidationSucceeds();
            NoTemplateWithTheSameNameAndLanguage();

            var response = await Service().SaveTemplateAsync(NewOrderConfirmation(organizationId));

            ShouldBeRejected(response, "OrganizationId", "Organization not found");
        }

        [Fact]
        public async Task SaveTemplateAsync_UpsertOfAnUnknownId_ChecksTheOrganizationLikeACreate() // D3
        {
            using var _ = new BlocksTestContext();
            ValidationSucceeds();
            NoTemplateWithTheSameNameAndLanguage();
            _repo.Setup(r => r.GetByIdAsync("ghost")).ReturnsAsync((EmailTemplate?)null);
            var saved = CaptureSaved();

            var rejected = await Service().SaveTemplateAsync(new SaveMailTemplateRequest
            {
                ItemId = "ghost", Name = "Fresh", Language = "en-US", TemplateSubject = "Hi", OrganizationId = "no-such-org"
            });
            rejected.Errors.Should().BeEquivalentTo(new Dictionary<string, string> { { "OrganizationId", "Organization not found" } });

            var created = await Service().SaveTemplateAsync(new SaveMailTemplateRequest
            {
                ItemId = "ghost", Name = "Fresh", Language = "en-US", TemplateSubject = "Hi", OrganizationId = "acme"
            });
            created.IsSuccess.Should().BeTrue();
            saved()!.ItemId.Should().Be("ghost");
            saved()!.OrganizationId.Should().Be("acme");
        }

        private void StoredAcmeTemplate(bool createdFromDefault = false, string? organizationId = "acme") =>
            _repo.Setup(r => r.GetByIdAsync("t-acme")).ReturnsAsync(new EmailTemplate
            {
                ItemId = "t-acme",
                Name = "OrderConfirmation",
                Language = "en-US",
                TemplateSubject = "Your order",
                MailConfigurationId = "acme-smtp",
                OrganizationId = organizationId!,
                CreatedFromDefault = createdFromDefault
            });

        [Fact]
        public async Task SaveTemplateAsync_Edit_ChangingTheName_IsRejectedAndSavesNothing() // C2, example 3
        {
            using var _ = new BlocksTestContext();
            ValidationSucceeds();
            StoredAcmeTemplate();

            var response = await Service().SaveTemplateAsync(new SaveMailTemplateRequest { ItemId = "t-acme", Name = "OrderConfirm2" });

            ShouldBeRejected(response, "Name", "A template's name can't be changed");
        }

        [Fact]
        public async Task SaveTemplateAsync_Edit_ChangingTheLanguage_IsRejected() // C3
        {
            using var _ = new BlocksTestContext();
            ValidationSucceeds();
            StoredAcmeTemplate();

            var response = await Service().SaveTemplateAsync(new SaveMailTemplateRequest { ItemId = "t-acme", Language = "xx-XX" });

            ShouldBeRejected(response, "Language", "A template's language can't be changed");
        }

        [Theory] // C4
        [InlineData("default")]
        [InlineData("")]
        [InlineData("globex")]
        public async Task SaveTemplateAsync_Edit_ChangingTheOrganization_IsRejected(string organizationId)
        {
            using var _ = new BlocksTestContext();
            ValidationSucceeds();
            StoredAcmeTemplate();

            var response = await Service().SaveTemplateAsync(new SaveMailTemplateRequest { ItemId = "t-acme", OrganizationId = organizationId });

            ShouldBeRejected(response, "OrganizationId", "A template's organization can't be changed");
        }

        [Theory] // C4: a blank organization sent for a Default template is the Default organization
        [InlineData("")]
        [InlineData("   ")]
        public async Task SaveTemplateAsync_Edit_OfADefaultTemplate_WithABlankOrganization_IsAccepted(string organizationId)
        {
            using var _ = new BlocksTestContext();
            ValidationSucceeds();
            StoredAcmeTemplate(organizationId: "default");
            var saved = CaptureSaved();

            var response = await Service().SaveTemplateAsync(new SaveMailTemplateRequest { ItemId = "t-acme", OrganizationId = organizationId, TemplateSubject = "New" });

            response.IsSuccess.Should().BeTrue();
            saved()!.OrganizationId.Should().Be("default");
        }

        [Fact] // Organization default: a blank configuration id is stored empty
        public async Task SaveTemplateAsync_Edit_WithABlankConfiguration_StoresItEmpty()
        {
            using var _ = new BlocksTestContext();
            ValidationSucceeds();
            StoredAcmeTemplate();
            var saved = CaptureSaved();

            var response = await Service().SaveTemplateAsync(new SaveMailTemplateRequest { ItemId = "t-acme", MailConfigurationId = "  " });

            response.IsSuccess.Should().BeTrue();
            saved()!.MailConfigurationId.Should().BeEmpty();
        }

        [Theory] // C4 with stored missing organization = Default
        [InlineData(null)]
        [InlineData("")]
        public async Task SaveTemplateAsync_Edit_OfATemplateStoredWithoutAnOrganization_TreatsItAsDefault(string? stored)
        {
            using var _ = new BlocksTestContext();
            ValidationSucceeds();
            StoredAcmeTemplate(organizationId: stored);
            var saved = CaptureSaved();

            var same = await Service().SaveTemplateAsync(new SaveMailTemplateRequest { ItemId = "t-acme", OrganizationId = "default", TemplateSubject = "New" });
            same.IsSuccess.Should().BeTrue();
            saved()!.OrganizationId.Should().Be("default");

            var other = await Service().SaveTemplateAsync(new SaveMailTemplateRequest { ItemId = "t-acme", OrganizationId = "acme" });
            other.Errors.Should().BeEquivalentTo(new Dictionary<string, string> { { "OrganizationId", "A template's organization can't be changed" } });
        }

        [Fact]
        public async Task SaveTemplateAsync_Edit_SendingTheStoredValues_SavesWithoutAUniquenessLookup() // D2
        {
            using var _ = new BlocksTestContext();
            ValidationSucceeds();
            StoredAcmeTemplate();
            var saved = CaptureSaved();

            var response = await Service().SaveTemplateAsync(new SaveMailTemplateRequest
            {
                ItemId = "t-acme", Name = "OrderConfirmation", Language = "en-US", OrganizationId = "acme", TemplateSubject = "Shipped"
            });

            response.IsSuccess.Should().BeTrue();
            saved()!.TemplateSubject.Should().Be("Shipped");
            saved()!.OrganizationId.Should().Be("acme");
            _repo.Verify(r => r.GetByNameAndLanguageAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task SaveTemplateAsync_Edit_BodyOnly_KeepsNameLanguageAndOrganization() // D2: New Template step 2
        {
            using var _ = new BlocksTestContext();
            ValidationSucceeds();
            StoredAcmeTemplate();
            var saved = CaptureSaved();

            var response = await Service().SaveTemplateAsync(new SaveMailTemplateRequest { ItemId = "t-acme", TemplateBody = "<p>x</p>" });

            response.IsSuccess.Should().BeTrue();
            saved()!.Name.Should().Be("OrderConfirmation");
            saved()!.Language.Should().Be("en-US");
            saved()!.OrganizationId.Should().Be("acme");
            saved()!.TemplateBody.Should().Be("<p>x</p>");
        }

        [Fact]
        public async Task SaveTemplateAsync_Edit_KeepsCreatedFromDefault() // C10
        {
            using var _ = new BlocksTestContext();
            ValidationSucceeds();
            StoredAcmeTemplate(createdFromDefault: true);
            var saved = CaptureSaved();

            var response = await Service().SaveTemplateAsync(new SaveMailTemplateRequest { ItemId = "t-acme", TemplateSubject = "Edited" });

            response.IsSuccess.Should().BeTrue();
            saved()!.CreatedFromDefault.Should().BeTrue();
        }

        [Fact]
        public async Task SaveTemplateAsync_InboundConfiguration_IsRejected() // C6, example 4
        {
            using var _ = new BlocksTestContext();
            ValidationSucceeds();
            NoTemplateWithTheSameNameAndLanguage();
            Configurations(AcmeInbound);

            var response = await Service().SaveTemplateAsync(NewOrderConfirmation("acme", "acme-inbox"));

            ShouldBeRejected(response, "MailConfigurationId", "An inbound configuration can't send mail");
        }

        [Theory] // C7
        [InlineData("acme", "globex-smtp")]
        [InlineData("default", "acme-smtp")]
        [InlineData("acme", "no-such-config")]
        public async Task SaveTemplateAsync_ConfigurationOfAnotherOrganizationOrMissing_IsRejected(string organizationId, string configurationId)
        {
            using var _ = new BlocksTestContext();
            ValidationSucceeds();
            NoTemplateWithTheSameNameAndLanguage();
            Configurations(AcmeOutbound, GlobexOutbound);

            var response = await Service().SaveTemplateAsync(NewOrderConfirmation(organizationId, configurationId));

            ShouldBeRejected(response, "MailConfigurationId", "Configuration not found");
        }

        [Theory] // §6.1: the template's organization, the Default organization (stored as "default" or empty), or none
        [InlineData("acme", "acme-smtp")]
        [InlineData("acme", "default-smtp")]
        [InlineData("acme", "legacy-smtp")]
        [InlineData("default", "default-smtp")]
        [InlineData("acme", "")]
        [InlineData("acme", null)]
        public async Task SaveTemplateAsync_AllowedConfiguration_IsStored(string organizationId, string? configurationId)
        {
            using var _ = new BlocksTestContext();
            ValidationSucceeds();
            NoTemplateWithTheSameNameAndLanguage();
            Configurations(AcmeOutbound, DefaultOutbound, LegacyOutbound);
            var saved = CaptureSaved();

            var response = await Service().SaveTemplateAsync(NewOrderConfirmation(organizationId, configurationId));

            response.IsSuccess.Should().BeTrue();
            saved()!.MailConfigurationId.Should().Be(configurationId);
        }

        [Fact]
        public async Task SaveTemplateAsync_Edit_ConfigurationIsCheckedAgainstTheStoredOrganization()
        {
            using var _ = new BlocksTestContext();
            ValidationSucceeds();
            StoredAcmeTemplate();
            Configurations(GlobexOutbound, DefaultOutbound);
            var saved = CaptureSaved();

            var rejected = await Service().SaveTemplateAsync(new SaveMailTemplateRequest { ItemId = "t-acme", MailConfigurationId = "globex-smtp" });
            rejected.Errors.Should().BeEquivalentTo(new Dictionary<string, string> { { "MailConfigurationId", "Configuration not found" } });

            var accepted = await Service().SaveTemplateAsync(new SaveMailTemplateRequest { ItemId = "t-acme", MailConfigurationId = "default-smtp" });
            accepted.IsSuccess.Should().BeTrue();
            saved()!.MailConfigurationId.Should().Be("default-smtp");
        }

        private void AcmeSource() =>
            _repo.Setup(r => r.GetByIdAsync("t-acme")).ReturnsAsync(new EmailTemplate
            {
                ItemId = "t-acme",
                Name = "OrderConfirmation",
                Language = "en-US",
                TemplateSubject = "Your order",
                TemplateBody = "<p>body</p>",
                JsonContent = "{}",
                ImageId = "img",
                ImageUrl = "https://img",
                MailConfigurationId = "acme-smtp",
                OrganizationId = "acme",
                CreatedFromDefault = true
            });

        [Fact]
        public async Task CloneTemplateAsync_IntoANewLanguage_KeepsNameOrganizationAndContent() // H10, example 7
        {
            using var _ = new BlocksTestContext();
            AcmeSource();
            var saved = CaptureSaved();

            var response = await Service().CloneTemplateAsync(new CloneMailTemplateRequest { ItemId = "t-acme", Language = "xx-XX" });

            response.IsSuccess.Should().BeTrue();
            var clone = saved()!;
            clone.ItemId.Should().NotBe("t-acme").And.Be(response.ItemId);
            clone.Name.Should().Be("OrderConfirmation");
            clone.Language.Should().Be("xx-XX");
            clone.OrganizationId.Should().Be("acme");
            clone.TemplateSubject.Should().Be("Your order");
            clone.TemplateBody.Should().Be("<p>body</p>");
            clone.JsonContent.Should().Be("{}");
            clone.ImageId.Should().Be("img");
            clone.ImageUrl.Should().Be("https://img");
            clone.MailConfigurationId.Should().Be("acme-smtp");
            clone.CreatedFromDefault.Should().BeFalse();
            _repo.Verify(r => r.GetByNameAndLanguageAsync("OrderConfirmation", "xx-XX", "acme"), Times.Once);
        }

        [Theory] // §6.4
        [InlineData(null)]
        [InlineData("")]
        [InlineData("  ")]
        public async Task CloneTemplateAsync_WithoutALanguage_IsRejected(string? language)
        {
            AcmeSource();

            var response = await Service().CloneTemplateAsync(new CloneMailTemplateRequest { ItemId = "t-acme", Language = language });

            ShouldBeRejected(response, "Language", "Language is required");
        }

        [Fact]
        public async Task CloneTemplateAsync_IntoALanguageTheNameAlreadyHas_IsRejected() // C8
        {
            AcmeSource();
            _repo.Setup(r => r.GetByNameAndLanguageAsync("OrderConfirmation", "en-US", "acme"))
                 .ReturnsAsync(new EmailTemplate { ItemId = "t-acme", Name = "OrderConfirmation", Language = "en-US", OrganizationId = "acme" });

            var response = await Service().CloneTemplateAsync(new CloneMailTemplateRequest { ItemId = "t-acme", Language = "en-US" });

            ShouldBeRejected(response, "Language", "This template already exists in that language");
        }

        [Fact]
        public async Task CloneTemplateAsync_WithAnotherName_IsRejected() // C9
        {
            AcmeSource();

            var response = await Service().CloneTemplateAsync(new CloneMailTemplateRequest { ItemId = "t-acme", Language = "xx-XX", Name = "OrderConfirmation_clone" });

            ShouldBeRejected(response, "Name", "A clone keeps the template's name");
        }

        [Fact]
        public async Task CloneTemplateAsync_SendingTheSameName_IsAccepted()
        {
            using var _ = new BlocksTestContext();
            AcmeSource();
            CaptureSaved();

            var response = await Service().CloneTemplateAsync(new CloneMailTemplateRequest { ItemId = "t-acme", Language = "xx-XX", Name = "OrderConfirmation" });

            response.IsSuccess.Should().BeTrue();
        }

        [Fact]
        public async Task CloneTemplateAsync_ConfigurationFollowsTheSaveRules()
        {
            using var _ = new BlocksTestContext();
            AcmeSource();
            Configurations(AcmeInbound, GlobexOutbound, DefaultOutbound);
            var saved = CaptureSaved();

            var inbound = await Service().CloneTemplateAsync(new CloneMailTemplateRequest { ItemId = "t-acme", Language = "xx-XX", MailConfigurationId = "acme-inbox" });
            inbound.Errors.Should().BeEquivalentTo(new Dictionary<string, string> { { "MailConfigurationId", "An inbound configuration can't send mail" } });

            var other = await Service().CloneTemplateAsync(new CloneMailTemplateRequest { ItemId = "t-acme", Language = "xx-XX", MailConfigurationId = "globex-smtp" });
            other.Errors.Should().BeEquivalentTo(new Dictionary<string, string> { { "MailConfigurationId", "Configuration not found" } });
            _repo.Verify(r => r.SaveAsync(It.IsAny<EmailTemplate>()), Times.Never);

            var shared = await Service().CloneTemplateAsync(new CloneMailTemplateRequest { ItemId = "t-acme", Language = "xx-XX", MailConfigurationId = "default-smtp" });
            shared.IsSuccess.Should().BeTrue();
            saved()!.MailConfigurationId.Should().Be("default-smtp");
        }

        [Fact]
        public async Task CloneTemplateAsync_OfATemplateStoredWithoutAnOrganization_ClonesIntoDefault()
        {
            using var _ = new BlocksTestContext();
            _repo.Setup(r => r.GetByIdAsync("legacy")).ReturnsAsync(new EmailTemplate { ItemId = "legacy", Name = "Welcome", Language = "en-US", TemplateSubject = "Hi", OrganizationId = "" });
            var saved = CaptureSaved();

            var response = await Service().CloneTemplateAsync(new CloneMailTemplateRequest { ItemId = "legacy", Language = "xx-XX" });

            response.IsSuccess.Should().BeTrue();
            saved()!.OrganizationId.Should().Be("default");
            _repo.Verify(r => r.GetByNameAndLanguageAsync("Welcome", "xx-XX", "default"), Times.Once);
        }
    }
}
