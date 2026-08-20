using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Secrets;
using Configuration.DomainService.Captcha.RequestModel;
using Configuration.DomainService.Captcha.ResponseModel;
using Configuration.DomainService.Captcha.Services;
using Configuration.DomainService.Captcha.Validators;
using FluentAssertions;
using Moq;

namespace XUnitTest.Secrets
{
    /// <summary>
    /// <see cref="CaptchaConfigService"/> orchestration: when it creates vs. rotates the linked
    /// secret, when it never touches the vault at all, and what it audits.
    /// </summary>
    public class CaptchaConfigServiceTests
    {
        private const string OrganizationId = "org-1";
        private const string UserId = "user-1";

        private readonly Mock<Blocks.Genesis.IKeyValueStore> _store = new();
        private readonly Mock<ISecretService> _secretService = new();
        private readonly Mock<ISecretAuditService> _audit = new();
        private readonly Mock<ISecretAuthorizationService> _authorization = new();
        private readonly List<(string Action, string? SecretId)> _auditLog = new();

        private ICaptchaConfigService CreateService()
        {
            _authorization.Setup(a => a.ResolveContext()).Returns(new SecretCallerContext
            {
                TenantId = "tenant-1",
                OrganizationId = OrganizationId,
                UserId = UserId,
                Roles = Array.Empty<string>(),
                IsRoot = false,
                Impersonated = false
            });

            _audit
                .Setup(a => a.RecordAsync(
                    It.IsAny<SecretCallerContext>(),
                    It.IsAny<string>(),
                    It.IsAny<Secret?>(),
                    It.IsAny<string>(),
                    It.IsAny<string?>(),
                    It.IsAny<int?>(),
                    It.IsAny<string?>(),
                    It.IsAny<CancellationToken>()))
                .Callback<SecretCallerContext, string, Secret?, string, string?, int?, string?, CancellationToken>(
                    (_, action, _, _, _, _, secretId, _) => _auditLog.Add((action, secretId)))
                .Returns(Task.CompletedTask);

            // Real validator, not mocked: its one rule is exactly what several tests below
            // exercise, so a mock would only assert that the service calls something.
            return new CaptchaConfigService(_store.Object, _secretService.Object, _audit.Object, _authorization.Object, new CaptchaConfigValidator());
        }

        private void GivenExisting(CaptchaConfigResult? existing) =>
            _store
                .Setup(s => s.GetAsync<CaptchaConfigResult>(It.IsAny<string>(),true, It.IsAny<CancellationToken>()))
                .ReturnsAsync(existing);

        private static SaveCaptchaConfigRequest NewRequest(string? secretValue = null) => new()
        {
            IsEnable = true,
            Provider = "recaptcha",
            CaptchaKey = "site-key",
            CaptchaGenerator = "EasyCaptchaGenerator",
         CaptchaSecret = secretValue
        };

        #region Save — create

        [Fact]
        public async Task SaveAsync_FirstTime_WithSecretValue_CreatesTheSecretAndStoresTheConfig()
        {
            GivenExisting(null);
            _secretService
                .Setup(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync("sec-1");

            CaptchaConfigResult? stored = null;
            _store
                .Setup(s => s.SetAsync(It.IsAny<string>(), It.IsAny<CaptchaConfigResult>(),true, It.IsAny<CancellationToken>()))
                .Callback<string, CaptchaConfigResult, CancellationToken>((_, v, _) => stored = v)
                .Returns(Task.CompletedTask);

            var service = CreateService();

            var result = await service.SaveAsync(NewRequest(secretValue: "shh"));

            _secretService.Verify(s => s.SetAsync(
                It.Is<SetSecretRequest>(r => r.Name == "captcha" && r.Type == SecretTypes.Service && r.Value == "shh"),
                It.IsAny<CancellationToken>()), Times.Once);
            _secretService.Verify(s => s.RotateAsync(It.IsAny<string>(), It.IsAny<RotateSecretRequest>(), It.IsAny<CancellationToken>()), Times.Never);

            stored.Should().NotBeNull();
            stored!.SecretId.Should().Be("sec-1");
            stored.Provider.Should().Be("recaptcha");

            result.SecretId.Should().Be("sec-1");

            _auditLog.Should().ContainSingle(a => a.Action == SecretAuditActions.ConfigSet && a.SecretId == "sec-1");
        }

        [Fact]
        public async Task SaveAsync_FirstTime_WithoutSecretValue_NeverTouchesTheVault()
        {
            GivenExisting(null);
            _store.Setup(s => s.SetAsync(It.IsAny<string>(), It.IsAny<CaptchaConfigResult>(),true, It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

            var service = CreateService();

            var result = await service.SaveAsync(NewRequest());

            _secretService.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Never);
            _secretService.Verify(s => s.RotateAsync(It.IsAny<string>(), It.IsAny<RotateSecretRequest>(), It.IsAny<CancellationToken>()), Times.Never);

            result.SecretId.Should().BeNull();
            _auditLog.Should().ContainSingle(a => a.Action == SecretAuditActions.ConfigSet && a.SecretId == null);
        }

        #endregion

        #region Save — update

        [Fact]
        public async Task SaveAsync_Existing_WithSecretValue_RotatesInsteadOfCreating()
        {
            GivenExisting(new CaptchaConfigResult { Provider = "recaptcha", SecretId = "sec-1" });
            _store.Setup(s => s.SetAsync(It.IsAny<string>(), It.IsAny<CaptchaConfigResult>(),true, It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

            var service = CreateService();

            await service.SaveAsync(NewRequest(secretValue: "new-secret"));

            _secretService.Verify(s => s.RotateAsync(
                "sec-1",
                It.Is<RotateSecretRequest>(r => r.Value == "new-secret"),
                It.IsAny<CancellationToken>()), Times.Once);
            _secretService.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Never);

            _auditLog.Should().ContainSingle(a => a.Action == SecretAuditActions.ConfigUpdate && a.SecretId == "sec-1");
        }

        [Fact]
        public async Task SaveAsync_Existing_SecretValueOmitted_NeverTouchesTheVault()
        {
            GivenExisting(new CaptchaConfigResult { Provider = "recaptcha", SecretId = "sec-1" });
            _store.Setup(s => s.SetAsync(It.IsAny<string>(), It.IsAny<CaptchaConfigResult>(),true, It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

            var service = CreateService();

            var result = await service.SaveAsync(NewRequest());

            _secretService.Verify(s => s.RotateAsync(It.IsAny<string>(), It.IsAny<RotateSecretRequest>(), It.IsAny<CancellationToken>()), Times.Never);
            _secretService.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Never);

            result.SecretId.Should().Be("sec-1");
        }

        [Fact]
        public async Task SaveAsync_Existing_EmptySecretValue_IsTreatedAsOmitted()
        {
            GivenExisting(new CaptchaConfigResult { Provider = "recaptcha", SecretId = "sec-1" });
            _store.Setup(s => s.SetAsync(It.IsAny<string>(), It.IsAny<CaptchaConfigResult>(),true, It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

            var service = CreateService();

            await service.SaveAsync(NewRequest(secretValue: string.Empty));

            _secretService.Verify(s => s.RotateAsync(It.IsAny<string>(), It.IsAny<RotateSecretRequest>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        #endregion

        #region Read

        [Fact]
        public async Task GetAsync_WhenNothingSaved_ReturnsNull()
        {
            GivenExisting(null);

            var service = CreateService();

            var result = await service.GetAsync();

            result.Should().BeNull();
            _secretService.VerifyNoOtherCalls();
            _auditLog.Should().BeEmpty();
        }

        [Fact]
        public async Task GetAsync_NeverTouchesTheVaultOrAudit()
        {
            GivenExisting(new CaptchaConfigResult { Provider = "recaptcha", SecretId = "sec-1" });

            var service = CreateService();

            var result = await service.GetAsync();

            result.Should().NotBeNull();
            result!.SecretId.Should().Be("sec-1");
            _secretService.VerifyNoOtherCalls();
            _auditLog.Should().BeEmpty();
        }

        #endregion

        #region Delete

        [Fact]
        public async Task DeleteAsync_WhenALinkedSecretExists_DeletesTheSecretFirstThenTheConfig()
        {
            GivenExisting(new CaptchaConfigResult { Provider = "recaptcha", SecretId = "sec-1" });

            var order = new List<string>();
            _secretService
                .Setup(s => s.DeleteAsync("sec-1", It.IsAny<CancellationToken>()))
                .Callback(() => order.Add("secret"))
                .Returns(Task.CompletedTask);
            _store
                .Setup(s => s.DeleteAsync(It.IsAny<string>(),true, It.IsAny<CancellationToken>()))
                .Callback(() => order.Add("config"))
                .ReturnsAsync(true);

            var service = CreateService();
            await service.DeleteAsync();

            order.Should().Equal("secret", "config");
            _auditLog.Should().ContainSingle(a => a.Action == SecretAuditActions.ConfigDelete && a.SecretId == "sec-1");
        }

        [Fact]
        public async Task DeleteAsync_WhenNoLinkedSecret_NeverCallsTheSecretService()
        {
            GivenExisting(new CaptchaConfigResult { Provider = "recaptcha", SecretId = null });
            _store.Setup(s => s.DeleteAsync(It.IsAny<string>(),true, It.IsAny<CancellationToken>())).ReturnsAsync(true);

            var service = CreateService();
            await service.DeleteAsync();

            _secretService.Verify(s => s.DeleteAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
            _store.Verify(s => s.DeleteAsync(It.IsAny<string>(), true,It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task DeleteAsync_WhenNothingSaved_IsANoOpAndDeletesNothing()
        {
            GivenExisting(null);

            var service = CreateService();

            // Idempotent delete: nothing to remove is success, not an error.
            await service.DeleteAsync();

            _secretService.Verify(s => s.DeleteAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
            _store.Verify(s => s.DeleteAsync(It.IsAny<string>(),true , It.IsAny<CancellationToken>()), Times.Never);
            _auditLog.Should().BeEmpty();
        }

        #endregion

        #region Validation

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public async Task SaveAsync_RejectsAMissingProvider(string? provider)
        {
            var service = CreateService();

            var act = () => service.SaveAsync(new SaveCaptchaConfigRequest { IsEnable = true, Provider = provider! });

            await act.Should().ThrowAsync<SecretValidationException>();
        }

        #endregion

        #region Audit safety

        [Fact]
        public async Task SaveAsync_NeverPassesThePlaintextSecretToTheAuditService()
        {
            const string plaintext = "correct-horse-battery-staple";

            GivenExisting(null);
            _secretService
                .Setup(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync("sec-1");
            _store.Setup(s => s.SetAsync(It.IsAny<string>(), It.IsAny<CaptchaConfigResult>(),true, It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

            var service = CreateService();
            await service.SaveAsync(NewRequest(secretValue: plaintext));

            _auditLog.Should().NotContain(a => a.SecretId != null && a.SecretId.Contains(plaintext, StringComparison.Ordinal));
        }

        #endregion
    }
}
