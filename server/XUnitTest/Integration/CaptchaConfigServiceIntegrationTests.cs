using System;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Blocks.Secrets;
using Configuration.DomainService.Captcha.RequestModel;
using Configuration.DomainService.Captcha.Services;
using Configuration.DomainService.Captcha.Validators;
using FluentAssertions;
using Moq;
using Xunit;

namespace XUnitTest.Integration
{
    /// <summary>
    /// Exercises <see cref="CaptchaConfigService"/> against Genesis's real
    /// <see cref="MongoKeyValueStore"/> and a real MongoDB — the secret vault is mocked, since
    /// that part is <see cref="ISecretService"/>'s own, already-tested responsibility.
    /// </summary>
    [Collection(MongoIntegrationCollection.Name)]
    public class CaptchaConfigServiceIntegrationTests
    {
        private readonly MongoIntegrationFixture _fixture;

        public CaptchaConfigServiceIntegrationTests(MongoIntegrationFixture fixture)
        {
            _fixture = fixture;
        }

        [Fact]
        public async Task SaveGetDelete_RoundTripsThroughRealMongoViaGenesissKeyValueStore()
        {
            var store = new MongoKeyValueStore(_fixture.DbContextProvider);
            var secretService = new Mock<ISecretService>();
            var audit = new Mock<ISecretAuditService>();
            var authorization = new Mock<ISecretAuthorizationService>();

            authorization.Setup(a => a.ResolveContext()).Returns(new SecretCallerContext
            {
                TenantId = "tenant-it",
                OrganizationId = "default",
                UserId = "user-it",
                Roles = Array.Empty<string>(),
                IsRoot = false,
                Impersonated = false
            });

            audit
                .Setup(a => a.RecordAsync(
                    It.IsAny<SecretCallerContext>(),
                    It.IsAny<string>(),
                    It.IsAny<Secret?>(),
                    It.IsAny<string>(),
                    It.IsAny<string?>(),
                    It.IsAny<int?>(),
                    It.IsAny<string?>(),
                    It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            secretService
                .Setup(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync("sec-it-1");

            var service = new CaptchaConfigService(store, secretService.Object, audit.Object, authorization.Object, new CaptchaConfigValidator());

            // Nothing saved yet.
            (await service.GetAsync()).Should().BeNull();

            // Create, no secret.
            var created = await service.SaveAsync(new SaveCaptchaConfigRequest
            {
                IsEnable = true,
                Provider = "recaptcha",
                CaptchaKey = "site-key-1",
                CaptchaGenerator = "EasyCaptchaGenerator"
            });
            created.SecretId.Should().BeNull();

            var afterCreate = await service.GetAsync();
            afterCreate.Should().NotBeNull();
            afterCreate!.Provider.Should().Be("recaptcha");
            afterCreate.CaptchaKey.Should().Be("site-key-1");
            afterCreate.SecretId.Should().BeNull();

            // Update, this time adding a secret — should call SetAsync (create), not Rotate.
            var updated = await service.SaveAsync(new SaveCaptchaConfigRequest
            {
                IsEnable = false,
                Provider = "hcaptcha",
                CaptchaKey = "site-key-2",
                CaptchaGenerator = "EasyCaptchaGenerator",
                CaptchaSecret = "the-secret"
            });
            updated.SecretId.Should().Be("sec-it-1");
            secretService.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Once);

            var afterUpdate = await service.GetAsync();
            afterUpdate!.Provider.Should().Be("hcaptcha");
            afterUpdate.IsEnable.Should().BeFalse();
            afterUpdate.SecretId.Should().Be("sec-it-1");

            // Delete: the linked secret must be deleted first, then the stored config disappears.
            secretService.Setup(s => s.DeleteAsync("sec-it-1", It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            await service.DeleteAsync();

            secretService.Verify(s => s.DeleteAsync("sec-it-1", It.IsAny<CancellationToken>()), Times.Once);
            (await service.GetAsync()).Should().BeNull();
        }
    }
}
