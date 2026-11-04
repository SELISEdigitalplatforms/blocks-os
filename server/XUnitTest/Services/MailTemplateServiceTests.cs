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

namespace XUnitTest.Services
{
    public class MailTemplateServiceTests
    {
        private readonly Mock<IValidator<SaveMailTemplateRequest>> _validator = new();
        private readonly Mock<IMailTemplateRepository> _repo = new();
        private readonly Mock<IMailTemplateHtmlChecker> _htmlChecker = new();

        private MailTemplateService Service() =>
            new(_validator.Object, _repo.Object, _htmlChecker.Object);

        [Fact]
        public async Task CloneTemplateAsync_WhenTheSourceBodyBreaksTheHtmlRules_SavesNothing()
        {
            _repo.Setup(r => r.GetByIdAsync("src")).ReturnsAsync(new EmailTemplate { ItemId = "src", Name = "Old", TemplateBody = "<a href=\"https://evil.example\">x</a>" });
            _htmlChecker.Setup(c => c.FindProblem(It.IsAny<string?>())).Returns("A link to evil.example is not allowed.");

            var response = await Service().CloneTemplateAsync(new CloneMailTemplateRequest { ItemId = "src" });

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
            _repo.Setup(r => r.GetByNameAndLanguageAsync("Welcome", "en"))
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
            _repo.Setup(r => r.GetByNameAndLanguageAsync("Welcome", "en"))
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
            _repo.Setup(r => r.GetByNameAndLanguageAsync(It.IsAny<string>(), It.IsAny<string>()))
                 .ReturnsAsync((EmailTemplate?)null);
            _repo.Setup(r => r.GetByIdAsync("item-1"))
                 .ReturnsAsync(new EmailTemplate { ItemId = "item-1", Name = "Old", TemplateSubject = "OldSub" });

            var response = await Service().SaveTemplateAsync(new SaveMailTemplateRequest
            {
                ItemId = "item-1",
                Name = "New",
                Language = "en"
            });

            response.IsSuccess.Should().BeTrue();
            response.ItemId.Should().Be("item-1");
            _repo.Verify(r => r.SaveAsync(It.Is<EmailTemplate>(t => t.ItemId == "item-1" && t.Name == "New")), Times.Once);
        }

        [Fact]
        public async Task SaveTemplateAsync_ExistingItem_NameConflictWithDifferentItem_ReturnsError()
        {
            using var _ = new BlocksTestContext();
            ValidationSucceeds();
            _repo.Setup(r => r.GetByNameAndLanguageAsync("Dup", "en"))
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
            _repo.Setup(r => r.GetByNameAndLanguageAsync(It.IsAny<string>(), It.IsAny<string>()))
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
                Name = "Copy",
                Language = "fr",
                TemplateSubject = "NewSub",
                MailConfigurationId = "cfg-2"
            });

            response.IsSuccess.Should().BeTrue();
            saved.Should().NotBeNull();
            saved!.Name.Should().Be("Copy");
            saved.Language.Should().Be("fr");
            saved.TemplateSubject.Should().Be("NewSub");
            saved.MailConfigurationId.Should().Be("cfg-2");
            saved.JsonContent.Should().Be("{}");
            saved.ItemId.Should().NotBe("src");
        }

        [Fact]
        public async Task CloneTemplateAsync_DefaultsNameWhenNotProvided()
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

            await Service().CloneTemplateAsync(new CloneMailTemplateRequest { ItemId = "src" });

            saved!.Name.Should().Be("Original_clone");
            saved.Language.Should().Be("en");
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
            _repo.Setup(r => r.GetByNameAndLanguageAsync(It.IsAny<string>(), It.IsAny<string>()))
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
            _repo.Verify(r => r.GetByNameAndLanguageAsync("spec-nosub", "en"), Times.Once);
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
            _repo.Verify(r => r.GetByNameAndLanguageAsync(It.IsAny<string>(), It.IsAny<string>()), Times.Never);
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
            _repo.Verify(r => r.GetByNameAndLanguageAsync("spec-upsert", "en"), Times.Once);
            _repo.Verify(r => r.GetByIdAsync("ghost"), Times.Once);
        }

        [Fact]
        public async Task SaveTemplateAsync_DuplicateNameAndLanguageWithoutASubject_ReturnsOnlyTheDuplicateError()
        {
            using var _ = new BlocksTestContext();
            ValidationSucceeds();
            _repo.Setup(r => r.GetByNameAndLanguageAsync("welcome", "en"))
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

            var response = await Service().CloneTemplateAsync(new CloneMailTemplateRequest { ItemId = "legacy", TemplateSubject = "Hello" });

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

            var response = await Service().CloneTemplateAsync(new CloneMailTemplateRequest { ItemId = "src", TemplateSubject = requestSubject });

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

            var response = await Service().CloneTemplateAsync(new CloneMailTemplateRequest { ItemId = "src", TemplateSubject = "  Hi  " });

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

            var response = await Service().CloneTemplateAsync(new CloneMailTemplateRequest { ItemId = "legacy", TemplateSubject = requestSubject });

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

            var response = await Service().CloneTemplateAsync(new CloneMailTemplateRequest { ItemId = "legacy" });

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
    }
}
