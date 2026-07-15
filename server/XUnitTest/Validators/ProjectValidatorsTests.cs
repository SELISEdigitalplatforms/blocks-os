using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using DomainService.Projects;
using FluentAssertions;
using Moq;

namespace XUnitTest.Validators
{
    public class CreateProjectRequestValidatorTests
    {
        private readonly Mock<IProjectRepository> _repo = new();

        private CreateProjectRequestValidator CreateValidator() => new(_repo.Object);

        private static CreateProjectRequest ValidRequest() => new()
        {
            Name = "My Project",
            IsAcceptBlocksTerms = true,
            IsUseBlocksExclusively = true,
            applicationContexts = new List<ApplicationContext>
            {
                new() { Environment = "dev", Domain = "https://dev.example.com", CookieDomain = "example.com" }
            }
        };

        [Fact]
        public async Task Validate_HappyPath_IsValid()
        {
            _repo.Setup(r => r.IsExistingEnviroment(It.IsAny<List<string>>(), It.IsAny<string>()))
                 .ReturnsAsync(false);

            var result = await CreateValidator().ValidateAsync(ValidRequest());

            result.IsValid.Should().BeTrue();
        }

        [Theory]
        [InlineData("")]
        [InlineData("ab")]
        public async Task Validate_ShortOrEmptyName_Fails(string name)
        {
            var request = ValidRequest();
            request.Name = name;

            var result = await CreateValidator().ValidateAsync(request);

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.PropertyName == nameof(CreateProjectRequest.Name));
        }

        [Fact]
        public async Task Validate_TermsNotAccepted_Fails()
        {
            var request = ValidRequest();
            request.IsAcceptBlocksTerms = false;

            var result = await CreateValidator().ValidateAsync(request);

            result.IsValid.Should().BeFalse();
        }

        [Fact]
        public async Task Validate_NotUseBlocksExclusively_Fails()
        {
            var request = ValidRequest();
            request.IsUseBlocksExclusively = false;

            var result = await CreateValidator().ValidateAsync(request);

            result.IsValid.Should().BeFalse();
        }

        [Fact]
        public async Task Validate_EmptyApplicationContexts_Fails()
        {
            var request = ValidRequest();
            request.applicationContexts = new List<ApplicationContext>();

            var result = await CreateValidator().ValidateAsync(request);

            result.IsValid.Should().BeFalse();
        }

        [Fact]
        public async Task Validate_UnsupportedEnvironment_Fails()
        {
            var request = ValidRequest();
            request.applicationContexts[0].Environment = "production";

            var result = await CreateValidator().ValidateAsync(request);

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.ErrorMessage.Contains("unsupported environment"));
        }

        [Fact]
        public async Task Validate_InvalidDomainUrl_Fails()
        {
            var request = ValidRequest();
            request.applicationContexts[0].Domain = "not-a-url";

            var result = await CreateValidator().ValidateAsync(request);

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.ErrorMessage.Contains("valid URL"));
        }

        [Fact]
        public async Task Validate_DuplicateEnvironments_WhenNoGroupId_Fails()
        {
            var request = ValidRequest();
            request.applicationContexts.Add(new ApplicationContext
            {
                Environment = "dev",
                Domain = "https://dev2.example.com",
                CookieDomain = "example.com"
            });

            var result = await CreateValidator().ValidateAsync(request);

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.ErrorMessage.Contains("duplicate environments"));
        }

        [Fact]
        public async Task Validate_ExistingEnvironment_WhenGroupIdProvided_Fails()
        {
            _repo.Setup(r => r.IsExistingEnviroment(It.IsAny<List<string>>(), It.IsAny<string>()))
                 .ReturnsAsync(true);

            var request = ValidRequest();
            request.TenantGroupId = "group-1";

            var result = await CreateValidator().ValidateAsync(request);

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.ErrorMessage.Contains("existing environment"));
        }

        [Fact]
        public async Task Validate_WithGroupId_AndNoExistingEnv_IsValid()
        {
            _repo.Setup(r => r.IsExistingEnviroment(It.IsAny<List<string>>(), It.IsAny<string>()))
                 .ReturnsAsync(false);

            var request = ValidRequest();
            request.TenantGroupId = "group-1";

            var result = await CreateValidator().ValidateAsync(request);

            result.IsValid.Should().BeTrue();
        }
    }

    public class UpdateProjectRequestValidatorTests
    {
        private readonly UpdateProjectRequestValidator _validator = new();

        [Fact]
        public async Task Validate_AddWithValidApplication_IsValid()
        {
            var request = new UpdateProjectRequest
            {
                Action = ApplicationAction.Add,
                Application = new Application { Domain = "https://app.example.com", CookieDomain = "example.com" }
            };

            var result = await _validator.ValidateAsync(request);

            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public async Task Validate_AddWithInvalidDomain_Fails()
        {
            var request = new UpdateProjectRequest
            {
                Action = ApplicationAction.Add,
                Application = new Application { Domain = "invalid domain" }
            };

            var result = await _validator.ValidateAsync(request);

            result.IsValid.Should().BeFalse();
        }

        [Fact]
        public async Task Validate_EditWithoutApplicationDomain_Fails()
        {
            var request = new UpdateProjectRequest
            {
                Action = ApplicationAction.Edit,
                Application = new Application { Domain = "https://app.example.com" },
                ApplicationDomain = ""
            };

            var result = await _validator.ValidateAsync(request);

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.PropertyName == nameof(UpdateProjectRequest.ApplicationDomain));
        }

        [Fact]
        public async Task Validate_DeleteWithApplicationDomain_IsValid()
        {
            var request = new UpdateProjectRequest
            {
                Action = ApplicationAction.Delete,
                ApplicationDomain = "https://app.example.com"
            };

            var result = await _validator.ValidateAsync(request);

            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public async Task Validate_InvalidEnumAction_Fails()
        {
            var request = new UpdateProjectRequest
            {
                Action = (ApplicationAction)999,
                Application = new Application { Domain = "https://app.example.com" },
                ApplicationDomain = "https://app.example.com"
            };

            var result = await _validator.ValidateAsync(request);

            result.IsValid.Should().BeFalse();
        }
    }

    public class UpdateAuthConfigRequestValidatorTests
    {
        private readonly UpdateAuthConfigRequestValidator _validator = new();

        private static UpdateAuthConfigRequest Valid() => new()
        {
            RefreshTokenValidForNumberMinutes = 60,
            GetNumberOfWrongAttemptsToLockTheAccount = 3,
            AccountLockDurationInMinutes = 15,
            ProjectId = "project-1",
            AllowedGrantTypes = new List<string> { "password" }
        };

        [Fact]
        public async Task Validate_HappyPath_IsValid()
        {
            var result = await _validator.ValidateAsync(Valid());
            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public async Task Validate_ZeroRefreshToken_Fails()
        {
            var request = Valid();
            request.RefreshTokenValidForNumberMinutes = 0;

            var result = await _validator.ValidateAsync(request);
            result.IsValid.Should().BeFalse();
        }

        [Fact]
        public async Task Validate_EmptyProjectId_Fails()
        {
            var request = Valid();
            request.ProjectId = "";

            var result = await _validator.ValidateAsync(request);
            result.IsValid.Should().BeFalse();
        }

        [Fact]
        public async Task Validate_NoGrantTypes_Fails()
        {
            var request = Valid();
            request.AllowedGrantTypes = new List<string>();

            var result = await _validator.ValidateAsync(request);
            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.ErrorMessage.Contains("grantType"));
        }
    }
}
