using System.Threading.Tasks;
using Configuration.DomainService.Mail.Template;
using Configuration.DomainService.Mail.Template.Services;
using Configuration.DomainService.Mail.Template.Validators;
using FluentAssertions;
using Moq;
using Blocks.Genesis.Entities.Os;

namespace XUnitTest.Validators
{
    public class MailTemplateValidatorTests
    {
        private readonly Mock<IMailTemplateRepository> _repo = new();
        private readonly Mock<IMailTemplateHtmlChecker> _htmlChecker = new();
        private MailTemplateValidator Validator() => new(_repo.Object, _htmlChecker.Object);

        [Fact]
        public async Task Invalid_WhenTheBodyBreaksTheHtmlRules_WithTheCheckersReason()
        {
            _htmlChecker.Setup(c => c.FindProblem("<script>x</script>")).Returns("<script> is not allowed in a mail template.");

            var result = await Validator().ValidateAsync(new SaveMailTemplateRequest { TemplateBody = "<script>x</script>" });

            result.IsValid.Should().BeFalse();
            result.Errors.Should().ContainSingle(e => e.PropertyName == nameof(SaveMailTemplateRequest.TemplateBody)
                                                      && e.ErrorMessage == "<script> is not allowed in a mail template.");
        }

        [Fact]
        public async Task Valid_WhenNameOrLanguageMissing()
        {
            var result = await Validator().ValidateAsync(new SaveMailTemplateRequest { Name = "", Language = "en" });

            result.IsValid.Should().BeTrue();
            _repo.Verify(r => r.GetByNameAndLanguageAsync(It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task Valid_WhenNoExistingTemplate()
        {
            _repo.Setup(r => r.GetByNameAndLanguageAsync("Welcome", "en")).ReturnsAsync((EmailTemplate?)null);

            var result = await Validator().ValidateAsync(new SaveMailTemplateRequest { Name = "Welcome", Language = "en" });

            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public async Task Valid_WhenExistingIsSameItem()
        {
            _repo.Setup(r => r.GetByNameAndLanguageAsync("Welcome", "en"))
                 .ReturnsAsync(new EmailTemplate { ItemId = "t1", Name = "Welcome", Language = "en" });

            var result = await Validator().ValidateAsync(new SaveMailTemplateRequest
            {
                ItemId = "t1",
                Name = "Welcome",
                Language = "en"
            });

            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public async Task Invalid_WhenExistingIsDifferentItem()
        {
            _repo.Setup(r => r.GetByNameAndLanguageAsync("Welcome", "en"))
                 .ReturnsAsync(new EmailTemplate { ItemId = "other", Name = "Welcome", Language = "en" });

            var result = await Validator().ValidateAsync(new SaveMailTemplateRequest
            {
                ItemId = "t1",
                Name = "Welcome",
                Language = "en"
            });

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.ErrorMessage.Contains("already exists"));
        }
    }
}
