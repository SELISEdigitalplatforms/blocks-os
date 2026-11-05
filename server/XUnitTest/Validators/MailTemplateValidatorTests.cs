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
            _repo.Verify(r => r.GetByNameAndLanguageAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task Valid_WhenNoExistingTemplate()
        {
            _repo.Setup(r => r.GetByNameAndLanguageAsync("Welcome", "en", "default")).ReturnsAsync((EmailTemplate?)null);

            var result = await Validator().ValidateAsync(new SaveMailTemplateRequest { Name = "Welcome", Language = "en" });

            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public async Task Invalid_WhenTheOrganizationHasTheNameAndLanguage() // SPEC31 C1
        {
            _repo.Setup(r => r.GetByNameAndLanguageAsync("Welcome", "en", "acme"))
                 .ReturnsAsync(new EmailTemplate { ItemId = "other", Name = "Welcome", Language = "en", OrganizationId = "acme" });

            var result = await Validator().ValidateAsync(new SaveMailTemplateRequest
            {
                Name = "Welcome",
                Language = "en",
                OrganizationId = "acme"
            });

            result.IsValid.Should().BeFalse();
            result.Errors.Should().ContainSingle(e => e.ErrorMessage == "Template with the same Name and Language already exists");
        }

        [Theory] // SPEC31 H2/H3: a create without an organization is checked in the Default organization only
        [InlineData(null)]
        [InlineData("")]
        [InlineData("default")]
        public async Task Create_WithoutAnOrganization_LooksInTheDefaultOrganization(string? organizationId)
        {
            _repo.Setup(r => r.GetByNameAndLanguageAsync("Welcome", "en", "acme"))
                 .ReturnsAsync(new EmailTemplate { ItemId = "other", Name = "Welcome", Language = "en", OrganizationId = "acme" });

            var result = await Validator().ValidateAsync(new SaveMailTemplateRequest { Name = "Welcome", Language = "en", OrganizationId = organizationId });

            result.IsValid.Should().BeTrue();
            _repo.Verify(r => r.GetByNameAndLanguageAsync("Welcome", "en", "default"), Times.Once);
        }

        [Fact]
        public async Task Edit_IsLeftToTheService()
        {
            // An edit's organization is the stored one, which only the service reads (SPEC31 D2/D3).
            var result = await Validator().ValidateAsync(new SaveMailTemplateRequest
            {
                ItemId = "t1",
                Name = "Welcome",
                Language = "en"
            });

            result.IsValid.Should().BeTrue();
            _repo.Verify(r => r.GetByNameAndLanguageAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }
    }
}
