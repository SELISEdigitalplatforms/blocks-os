using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Configuration.DomainService.Mail.Entities;
using Configuration.DomainService.Mail.Template;
using Configuration.DomainService.Mail.Template.Models;
using Configuration.DomainService.Mail.Template.Services;
using FluentAssertions;
using FluentValidation;
using FluentValidation.Results;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using XUnitTest.TestSupport;

namespace XUnitTest.Services
{
    public class MailTemplateServiceTests
    {
        private readonly Mock<IValidator<SaveMailTemplateRequest>> _validator = new();
        private readonly Mock<IMailTemplateRepository> _repo = new();
        private readonly Mock<IHttpService> _httpService = new();

        private MailTemplateService Service() =>
            new(_validator.Object, _repo.Object, _httpService.Object, NullLogger<MailTemplateService>.Instance);

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
                Language = "en"
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
        public async Task GetAsync_DelegatesToRepository()
        {
            var template = new EmailTemplate { ItemId = "t1" };
            _repo.Setup(r => r.GetByIdAsync("t1")).ReturnsAsync(template);

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
                Language = "en"
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

        private void PluginConfigExists(string provider, string contentType, Dictionary<string, string>? headers = null) =>
            _repo.Setup(r => r.GetPluginConfigAsync(provider))
                 .ReturnsAsync(new TemplatePluginConfig
                 {
                     ItemId = "cfg-1",
                     PluginProvider = provider,
                     HttpMethod = "POST",
                     RequestUri = "https://auth.getbee.io/loginV2",
                     ContentType = contentType,
                     Payload = "{\"client_id\":\"cid\",\"client_secret\":\"secret\",\"uid\":\"placeholder\"}",
                     HttpHeders = headers
                 });

        private void HttpReturns(BeeLoginResponse? response, string error = "") =>
            _httpService.Setup(h => h.SendRequest<BeeLoginResponse>(
                    It.IsAny<HttpMethod>(),
                    It.IsAny<string>(),
                    It.IsAny<object>(),
                    It.IsAny<string>(),
                    It.IsAny<Dictionary<string, string>>(),
                    It.IsAny<CancellationToken>(),
                    It.IsAny<int?>()))
                .ReturnsAsync((response!, error));

        [Fact]
        public async Task GetTemplatePluginTokenAsync_WhenUidMissing_ReturnsNull()
        {
            var response = await Service().GetTemplatePluginTokenAsync("Bee", string.Empty);

            response.Should().BeNull();
            _repo.Verify(r => r.GetPluginConfigAsync(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task GetTemplatePluginTokenAsync_WhenNoConfig_ReturnsNull()
        {
            _repo.Setup(r => r.GetPluginConfigAsync("Bee")).ReturnsAsync((TemplatePluginConfig?)null);

            var response = await Service().GetTemplatePluginTokenAsync("Bee", "uid-1");

            response.Should().BeNull();
        }

        [Fact]
        public async Task GetTemplatePluginTokenAsync_WithJsonPayload_ReturnsTokenAndOverwritesUid()
        {
            PluginConfigExists("Bee", "application/json");
            HttpReturns(new BeeLoginResponse { AccessToken = "token-123" });

            var response = await Service().GetTemplatePluginTokenAsync("Bee", "uid-1");

            response!.AccessToken.Should().Be("token-123");
            _httpService.Verify(h => h.SendRequest<BeeLoginResponse>(
                It.IsAny<HttpMethod>(),
                "https://auth.getbee.io/loginV2",
                It.Is<object>(p => ((Dictionary<string, JsonElement>)p)["uid"].GetString() == "uid-1"),
                "application/json",
                It.IsAny<Dictionary<string, string>>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<int?>()), Times.Once);
        }

        [Fact]
        public async Task GetTemplatePluginTokenAsync_WithFormPayload_OverwritesUid()
        {
            PluginConfigExists("Bee", "application/x-www-form-urlencoded");
            HttpReturns(new BeeLoginResponse { AccessToken = "token-456" });

            var response = await Service().GetTemplatePluginTokenAsync("Bee", "uid-2");

            response!.AccessToken.Should().Be("token-456");
            _httpService.Verify(h => h.SendRequest<BeeLoginResponse>(
                It.IsAny<HttpMethod>(),
                It.IsAny<string>(),
                It.Is<object>(p => ((Dictionary<string, string>)p)["uid"] == "uid-2"),
                It.IsAny<string>(),
                It.IsAny<Dictionary<string, string>>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<int?>()), Times.Once);
        }

        [Fact]
        public async Task GetTemplatePluginTokenAsync_DropsStoredAuthorizationHeader()
        {
            PluginConfigExists("Bee", "application/json", new Dictionary<string, string>
            {
                ["Authorization"] = "should-be-dropped",
                ["X-Api"] = "keep"
            });
            HttpReturns(new BeeLoginResponse { AccessToken = "token-789" });

            await Service().GetTemplatePluginTokenAsync("Bee", "uid-3");

            _httpService.Verify(h => h.SendRequest<BeeLoginResponse>(
                It.IsAny<HttpMethod>(),
                It.IsAny<string>(),
                It.IsAny<object>(),
                It.IsAny<string>(),
                It.Is<Dictionary<string, string>>(h2 => !h2.ContainsKey("Authorization") && h2["X-Api"] == "keep"),
                It.IsAny<CancellationToken>(),
                It.IsAny<int?>()), Times.Once);
        }

        [Fact]
        public async Task GetTemplatePluginTokenAsync_WhenHttpFails_ReturnsNull()
        {
            PluginConfigExists("Bee", "application/json");
            HttpReturns(null, "boom");

            var response = await Service().GetTemplatePluginTokenAsync("Bee", "uid-1");

            response.Should().BeNull();
        }
    }
}
