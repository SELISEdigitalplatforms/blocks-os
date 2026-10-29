using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Secrets;
using Configuration.DomainService.Captcha.RequestModel;
using Configuration.DomainService.Captcha.ResponseModel;
using Configuration.DomainService.Captcha.Services;
using Configuration.DomainService.Captcha.Validators;
using Configuration.DomainService.Shared.Secrets;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using Moq;
using XUnitTest.TestSupport;

namespace XUnitTest.Secrets
{
    /// <summary>
    /// <see cref="CaptchaConfigService"/> orchestration: when it creates vs. rotates the linked
    /// secret, when it never touches the vault at all, and what it audits — plus the linked-secret
    /// status it reports, repair of a broken pointer, and tolerant delete.
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
        private readonly RecordingLogger<CaptchaConfigService> _logger = new();

        public CaptchaConfigServiceTests()
        {
            // Every linked secret is healthy unless a test says otherwise, so the pre-existing
            // rotate/keep tests keep exercising the paths they were written for.
            GivenSecretStatus(SecretStatuses.Active);
        }

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
            return new CaptchaConfigService(_store.Object, _secretService.Object, _audit.Object, _authorization.Object, new CaptchaConfigValidator(), _logger);
        }

        /// <summary>
        /// Stubs the metadata read for any secret id: a status string, or null for "no such
        /// secret" (purged).
        /// </summary>
        private void GivenSecretStatus(string? status) =>
            _secretService
                .Setup(s => s.GetAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync((string id, CancellationToken _) =>
                    status is null ? null : new SecretResult { SecretId = id, Name = "captcha", Status = status });

        /// <summary>
        /// Stubs the record the store returns for any id. Null means "no such record".
        /// </summary>
        private void GivenExisting(CaptchaConfigResult? existing) =>
            _store
                .Setup(s => s.GetByIdAsync<CaptchaConfigResult>(It.IsAny<string>(), true, It.IsAny<CancellationToken>()))
                .ReturnsAsync(existing is null ? null : Item(existing));

        /// <summary>Wraps a record in the envelope the multi-value API returns.</summary>
        private static Blocks.Genesis.KeyValueItem<CaptchaConfigResult> Item(CaptchaConfigResult value) =>
            new(value.Id, "captcha", value, Array.Empty<string>(), DateTime.UtcNow, DateTime.UtcNow, UserId, UserId, OrganizationId);

        /// <summary>Captures what a create writes, and hands back a generated ItemId.</summary>
        private void ExpectAdd(string itemId, Action<CaptchaConfigResult>? capture = null) =>
            _store
                .Setup(s => s.AddAsync(It.IsAny<string>(), It.IsAny<CaptchaConfigResult>(), null, true, It.IsAny<CancellationToken>()))
                .Callback<string, CaptchaConfigResult, IEnumerable<string>?, bool, CancellationToken>((_, v, _, _, _) => capture?.Invoke(v))
                .ReturnsAsync(itemId);

        /// <summary>Captures what an update writes.</summary>
        private void ExpectUpdate(Action<CaptchaConfigResult>? capture = null) =>
            _store
                .Setup(s => s.UpdateByIdAsync(It.IsAny<string>(), It.IsAny<CaptchaConfigResult>(), true, It.IsAny<CancellationToken>()))
                .Callback<string, CaptchaConfigResult, bool, CancellationToken>((_, v, _, _) => capture?.Invoke(v))
                .ReturnsAsync(true);

        private static SaveCaptchaConfigRequest NewRequest(string? secretValue = null, string? key = null) => new()
        {
            Id = key,
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
            ExpectAdd("cfg-new", v => stored = v);

            var service = CreateService();

            var result = await service.SaveAsync(NewRequest(secretValue: "shh"));

            _secretService.Verify(s => s.SetAsync(
                It.Is<SetSecretRequest>(r => r.Name == "captcha" && r.Type == SecretTypes.Service && r.Value == "shh"),
                It.IsAny<CancellationToken>()), Times.Once);
            _secretService.Verify(s => s.RotateAsync(It.IsAny<string>(), It.IsAny<RotateSecretRequest>(), It.IsAny<CancellationToken>()), Times.Never);

            stored.Should().NotBeNull();
            stored!.SecretId.Should().Be("sec-1");
            stored.Provider.Should().Be("recaptcha");

            // Identity comes from the store, not the payload.
            _store.Verify(s => s.AddAsync("captcha", It.IsAny<CaptchaConfigResult>(), null, true, It.IsAny<CancellationToken>()), Times.Once);

            result.SecretId.Should().Be("sec-1");
            result.Id.Should().Be("cfg-new");

            _auditLog.Should().ContainSingle(a => a.Action == SecretAuditActions.ConfigSet && a.SecretId == "sec-1");
        }

        [Fact]
        public async Task SaveAsync_FirstTime_WithoutSecretValue_NeverTouchesTheVault()
        {
            GivenExisting(null);
            ExpectAdd("cfg-new");

            var service = CreateService();

            var result = await service.SaveAsync(NewRequest());

            _secretService.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Never);
            _secretService.Verify(s => s.RotateAsync(It.IsAny<string>(), It.IsAny<RotateSecretRequest>(), It.IsAny<CancellationToken>()), Times.Never);

            result.SecretId.Should().BeNull();
            result.Id.Should().Be("cfg-new");
            _auditLog.Should().ContainSingle(a => a.Action == SecretAuditActions.ConfigSet && a.SecretId == null);
        }

        #endregion

        #region Save — update

        [Fact]
        public async Task SaveAsync_Existing_WithSecretValue_RotatesInsteadOfCreating()
        {
            GivenExisting(new CaptchaConfigResult { Id = "cfg-1", Provider = "recaptcha", SecretId = "sec-1" });
            ExpectUpdate();

            var service = CreateService();

            var result = await service.SaveAsync(NewRequest(secretValue: "new-secret", key: "cfg-1"));

            _secretService.Verify(s => s.RotateAsync(
                "sec-1",
                It.Is<RotateSecretRequest>(r => r.Value == "new-secret"),
                It.IsAny<CancellationToken>()), Times.Once);
            _secretService.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Never);

            result.Id.Should().Be("cfg-1");
            _auditLog.Should().ContainSingle(a => a.Action == SecretAuditActions.ConfigUpdate && a.SecretId == "sec-1");
        }

        [Fact]
        public async Task SaveAsync_Existing_SecretValueOmitted_NeverTouchesTheVault()
        {
            GivenExisting(new CaptchaConfigResult { Id = "cfg-1", Provider = "recaptcha", SecretId = "sec-1" });
            ExpectUpdate();

            var service = CreateService();

            var result = await service.SaveAsync(NewRequest(key: "cfg-1"));

            _secretService.Verify(s => s.RotateAsync(It.IsAny<string>(), It.IsAny<RotateSecretRequest>(), It.IsAny<CancellationToken>()), Times.Never);
            _secretService.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Never);

            result.SecretId.Should().Be("sec-1");
            result.Id.Should().Be("cfg-1");
        }

        [Fact]
        public async Task SaveAsync_Existing_EmptySecretValue_IsTreatedAsOmitted()
        {
            GivenExisting(new CaptchaConfigResult { Id = "cfg-1", Provider = "recaptcha", SecretId = "sec-1" });
            ExpectUpdate();

            var service = CreateService();

            await service.SaveAsync(NewRequest(secretValue: string.Empty, key: "cfg-1"));

            _secretService.Verify(s => s.RotateAsync(It.IsAny<string>(), It.IsAny<RotateSecretRequest>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task SaveAsync_UnknownKey_Throws()
        {
            GivenExisting(null);

            var service = CreateService();

            var act = () => service.SaveAsync(NewRequest(key: "missing"));

            await act.Should().ThrowAsync<SecretValidationException>();
            _store.Verify(s => s.AddAsync(It.IsAny<string>(), It.IsAny<CaptchaConfigResult>(), null, true, It.IsAny<CancellationToken>()), Times.Never);
            _store.Verify(s => s.UpdateByIdAsync(It.IsAny<string>(), It.IsAny<CaptchaConfigResult>(), true, It.IsAny<CancellationToken>()), Times.Never);
        }

        #endregion

        #region Read

        [Fact]
        public async Task GetAsync_WhenNothingSaved_ReturnsNull()
        {
            GivenExisting(null);

            var service = CreateService();

            var result = await service.GetAsync("cfg-1");

            result.Should().BeNull();
            _secretService.VerifyNoOtherCalls();
            _auditLog.Should().BeEmpty();
        }

        [Fact]
        public async Task GetAsync_ReadsOnlyTheSecretMetadataAndNeverAudits()
        {
            GivenExisting(new CaptchaConfigResult { Id = "cfg-1", Provider = "recaptcha", SecretId = "sec-1" });

            var service = CreateService();

            var result = await service.GetAsync("cfg-1");

            result.Should().NotBeNull();
            result!.SecretId.Should().Be("sec-1");
            result.SecretStatus.Should().Be(LinkedSecretStatus.Active);

            // C14: one metadata read, never a value read.
            _secretService.Verify(s => s.GetAsync("sec-1", It.IsAny<CancellationToken>()), Times.Once);
            _secretService.VerifyNoOtherCalls();
            _auditLog.Should().BeEmpty();
        }

        [Fact]
        public async Task GetListAsync_ReturnsEveryRecord()
        {
            var records = new List<CaptchaConfigResult>
            {
                new() { Id = "cfg-1", Provider = "recaptcha" },
                new() { Id = "cfg-2", Provider = "hcaptcha" }
            };
            _store
                .Setup(s => s.GetAllAsync<CaptchaConfigResult>("captcha", null, true, It.IsAny<CancellationToken>()))
                .ReturnsAsync(records.Select(Item).ToList());

            var service = CreateService();

            var result = await service.GetListAsync();

            result.Should().BeEquivalentTo(records);
        }

        #endregion

        #region Delete

        [Fact]
        public async Task DeleteAsync_WhenALinkedSecretExists_DeletesTheSecretFirstThenTheConfig()
        {
            GivenExisting(new CaptchaConfigResult { Id = "cfg-1", Provider = "recaptcha", SecretId = "sec-1" });

            var order = new List<string>();
            _secretService
                .Setup(s => s.DeleteAsync("sec-1", It.IsAny<CancellationToken>()))
                .Callback(() => order.Add("secret"))
                .Returns(Task.CompletedTask);
            _store
                .Setup(s => s.DeleteByIdAsync(It.IsAny<string>(), true, It.IsAny<CancellationToken>()))
                .Callback(() => order.Add("config"))
                .ReturnsAsync(true);

            var service = CreateService();
            await service.DeleteAsync("cfg-1");

            order.Should().Equal("secret", "config");
            _auditLog.Should().ContainSingle(a => a.Action == SecretAuditActions.ConfigDelete && a.SecretId == "sec-1");
        }

        [Fact]
        public async Task DeleteAsync_WhenNoLinkedSecret_NeverCallsTheSecretService()
        {
            GivenExisting(new CaptchaConfigResult { Id = "cfg-1", Provider = "recaptcha", SecretId = null });
            _store.Setup(s => s.DeleteByIdAsync(It.IsAny<string>(), true, It.IsAny<CancellationToken>())).ReturnsAsync(true);

            var service = CreateService();
            await service.DeleteAsync("cfg-1");

            _secretService.Verify(s => s.DeleteAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
            _store.Verify(s => s.DeleteByIdAsync(It.IsAny<string>(), true, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task DeleteAsync_WhenNothingSaved_IsANoOpAndDeletesNothing()
        {
            GivenExisting(null);

            var service = CreateService();

            // Idempotent delete: nothing to remove is success, not an error.
            await service.DeleteAsync("cfg-1");

            _secretService.Verify(s => s.DeleteAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
            _store.Verify(s => s.DeleteByIdAsync(It.IsAny<string>(), true, It.IsAny<CancellationToken>()), Times.Never);
            _auditLog.Should().BeEmpty();
        }

        #endregion

        #region Linked secret status (H1, C1, C14)

        [Theory]
        [InlineData(SecretStatuses.Active, LinkedSecretStatus.Active)]
        [InlineData(SecretStatuses.Locked, LinkedSecretStatus.Locked)]
        [InlineData(SecretStatuses.Deleted, LinkedSecretStatus.Archived)]
        [InlineData(null, LinkedSecretStatus.Missing)]
        public async Task GetAsync_ReportsTheLinkedSecretStatus(string? secretStatus, string expected)
        {
            GivenExisting(new CaptchaConfigResult { Id = "cfg-1", Provider = "recaptcha", SecretId = "sec-1" });
            GivenSecretStatus(secretStatus);

            var result = await CreateService().GetAsync("cfg-1");

            result!.SecretStatus.Should().Be(expected);
        }

        [Fact]
        public async Task GetAsync_WithoutALinkedSecret_ReportsNoneWithoutReadingAnything()
        {
            GivenExisting(new CaptchaConfigResult { Id = "cfg-1", Provider = "recaptcha", SecretId = null });

            var result = await CreateService().GetAsync("cfg-1");

            result!.SecretStatus.Should().Be(LinkedSecretStatus.None);
            _secretService.Verify(s => s.GetAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task GetListAsync_ReportsEachRecordsStatus_AndAFailedReadOnlyMarksThatRecordUnavailable()
        {
            _store
                .Setup(s => s.GetAllAsync<CaptchaConfigResult>("captcha", null, true, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<CaptchaConfigResult>
                {
                    new() { Id = "cfg-1", Provider = "recaptcha", SecretId = "sec-ok" },
                    new() { Id = "cfg-2", Provider = "hcaptcha", SecretId = "sec-down" },
                    new() { Id = "cfg-3", Provider = "turnstile", SecretId = "sec-gone" },
                    new() { Id = "cfg-4", Provider = "custom" }
                }.Select(Item).ToList());
            _secretService
                .Setup(s => s.GetAsync("sec-ok", It.IsAny<CancellationToken>()))
                .ReturnsAsync(new SecretResult { SecretId = "sec-ok", Status = SecretStatuses.Active });
            _secretService
                .Setup(s => s.GetAsync("sec-down", It.IsAny<CancellationToken>()))
                .ThrowsAsync(new SecretVaultException("down", "get", "sec-down"));
            _secretService
                .Setup(s => s.GetAsync("sec-gone", It.IsAny<CancellationToken>()))
                .ReturnsAsync((SecretResult?)null);

            var result = await CreateService().GetListAsync();

            result.Select(r => (r.Id, r.SecretStatus)).Should().Equal(
                ("cfg-1", LinkedSecretStatus.Active),
                ("cfg-2", LinkedSecretStatus.Unavailable),
                ("cfg-3", LinkedSecretStatus.Missing),
                ("cfg-4", LinkedSecretStatus.None));

            // C1: logged at Warning with the configuration id, never the secret id.
            var warning = _logger.Entries.Should().ContainSingle(e => e.Level == LogLevel.Warning).Subject;
            warning.Message.Should().Contain("cfg-2");
            warning.Message.Should().NotContain("sec-down");
        }

        [Fact]
        public async Task ReadsAndSaves_NeverReadASecretValue()
        {
            GivenExisting(new CaptchaConfigResult { Id = "cfg-1", Provider = "recaptcha", SecretId = "sec-1" });
            _store
                .Setup(s => s.GetAllAsync<CaptchaConfigResult>("captcha", null, true, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<CaptchaConfigResult> { new() { Id = "cfg-1", Provider = "recaptcha", SecretId = "sec-1" } }.Select(Item).ToList());
            ExpectUpdate();
            var service = CreateService();

            await service.GetAsync("cfg-1");
            await service.GetListAsync();
            await service.SaveAsync(NewRequest(key: "cfg-1"));

            _secretService.Verify(s => s.GetValueAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
            _secretService.Verify(s => s.GetValuesAsync(It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        #endregion

        #region Repair (H5, C2, C4, C11, C15)

        [Theory]
        [InlineData(SecretStatuses.Deleted)]
        [InlineData(null)]
        public async Task SaveAsync_BrokenPointerWithANewValue_CreatesANewSecretAndRepointsTheSameRecord(string? brokenStatus)
        {
            GivenExisting(new CaptchaConfigResult { Id = "cfg-1", Provider = "recaptcha", SecretId = "sec-old" });
            GivenSecretStatus(brokenStatus);
            _secretService
                .Setup(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync("sec-new");

            string? updatedId = null;
            CaptchaConfigResult? stored = null;
            _store
                .Setup(s => s.UpdateByIdAsync(It.IsAny<string>(), It.IsAny<CaptchaConfigResult>(), true, It.IsAny<CancellationToken>()))
                .Callback<string, CaptchaConfigResult, bool, CancellationToken>((id, v, _, _) => { updatedId = id; stored = v; })
                .ReturnsAsync(true);

            var result = await CreateService().SaveAsync(NewRequest(secretValue: "new-value", key: "cfg-1"));

            _secretService.Verify(s => s.SetAsync(
                It.Is<SetSecretRequest>(r =>
                    r.Name == "captcha"
                    && r.Type == SecretTypes.Service
                    && r.Value == "new-value"
                    && r.Description == "recaptcha configuration"),
                It.IsAny<CancellationToken>()), Times.Once);

            // The dead secret is neither rotated, restored nor retired.
            _secretService.Verify(s => s.RotateAsync(It.IsAny<string>(), It.IsAny<RotateSecretRequest>(), It.IsAny<CancellationToken>()), Times.Never);
            _secretService.Verify(s => s.RestoreAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
            _secretService.Verify(s => s.DeleteAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);

            // Updated in place under the same ItemId, never re-added.
            updatedId.Should().Be("cfg-1");
            stored!.SecretId.Should().Be("sec-new");
            _store.Verify(s => s.AddAsync(It.IsAny<string>(), It.IsAny<CaptchaConfigResult>(), It.IsAny<IEnumerable<string>?>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()), Times.Never);

            result.Id.Should().Be("cfg-1");
            result.SecretId.Should().Be("sec-new");
            result.SecretStatus.Should().Be(LinkedSecretStatus.Active);
            _auditLog.Should().ContainSingle(a => a.Action == SecretAuditActions.ConfigUpdate && a.SecretId == "sec-new");
        }

        [Theory]
        [InlineData(SecretStatuses.Deleted, LinkedSecretStatus.Archived)]
        [InlineData(null, LinkedSecretStatus.Missing)]
        public async Task SaveAsync_BrokenPointerWithoutAValue_SavesTheOtherFieldsAndKeepsThePointer(string? brokenStatus, string expected)
        {
            // The enable/disable toggle saves exactly this way: no secret value.
            GivenExisting(new CaptchaConfigResult { Id = "cfg-1", Provider = "recaptcha", SecretId = "sec-old", IsEnable = true });
            GivenSecretStatus(brokenStatus);
            CaptchaConfigResult? stored = null;
            ExpectUpdate(v => stored = v);

            var request = NewRequest(key: "cfg-1");
            request.IsEnable = false;

            var result = await CreateService().SaveAsync(request);

            _secretService.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Never);
            _secretService.Verify(s => s.RotateAsync(It.IsAny<string>(), It.IsAny<RotateSecretRequest>(), It.IsAny<CancellationToken>()), Times.Never);
            stored!.IsEnable.Should().BeFalse();
            stored.SecretId.Should().Be("sec-old");
            result.SecretStatus.Should().Be(expected);
        }

        [Fact]
        public async Task SaveAsync_LockedSecretWithANewValue_StillRotatesInPlace()
        {
            GivenExisting(new CaptchaConfigResult { Id = "cfg-1", Provider = "recaptcha", SecretId = "sec-1" });
            GivenSecretStatus(SecretStatuses.Locked);
            ExpectUpdate();

            var result = await CreateService().SaveAsync(NewRequest(secretValue: "v2", key: "cfg-1"));

            _secretService.Verify(s => s.RotateAsync("sec-1", It.IsAny<RotateSecretRequest>(), It.IsAny<CancellationToken>()), Times.Once);
            _secretService.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Never);
            result.SecretStatus.Should().Be(LinkedSecretStatus.Locked);
        }

        [Fact]
        public async Task SaveAsync_StatusUnavailable_IsTreatedAsHealthyAndRotates()
        {
            GivenExisting(new CaptchaConfigResult { Id = "cfg-1", Provider = "recaptcha", SecretId = "sec-1" });
            _secretService
                .Setup(s => s.GetAsync("sec-1", It.IsAny<CancellationToken>()))
                .ThrowsAsync(new SecretVaultException("down", "get", "sec-1"));
            ExpectUpdate();

            await CreateService().SaveAsync(NewRequest(secretValue: "v2", key: "cfg-1"));

            _secretService.Verify(s => s.RotateAsync("sec-1", It.IsAny<RotateSecretRequest>(), It.IsAny<CancellationToken>()), Times.Once);
            _secretService.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task SaveAsync_RepairWhoseWriteThrows_RetiresTheNewSecretAndRethrows()
        {
            GivenExisting(new CaptchaConfigResult { Id = "cfg-1", Provider = "recaptcha", SecretId = "sec-old" });
            GivenSecretStatus(SecretStatuses.Deleted);
            _secretService
                .Setup(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync("sec-new");
            _store
                .Setup(s => s.UpdateByIdAsync(It.IsAny<string>(), It.IsAny<CaptchaConfigResult>(), true, It.IsAny<CancellationToken>()))
                .ThrowsAsync(new InvalidOperationException("mongo down"));

            var act = () => CreateService().SaveAsync(NewRequest(secretValue: "v2", key: "cfg-1"));

            await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("mongo down");
            _secretService.Verify(s => s.DeleteAsync("sec-new", It.IsAny<CancellationToken>()), Times.Once);
            _secretService.Verify(s => s.DeleteAsync("sec-old", It.IsAny<CancellationToken>()), Times.Never);
            _auditLog.Should().BeEmpty();
        }

        [Fact]
        public async Task SaveAsync_RepairOfARecordRemovedMeanwhile_RetiresTheNewSecretAndReportsNotFound()
        {
            GivenExisting(new CaptchaConfigResult { Id = "cfg-1", Provider = "recaptcha", SecretId = "sec-old" });
            GivenSecretStatus(null);
            _secretService
                .Setup(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync("sec-new");
            _store
                .Setup(s => s.UpdateByIdAsync(It.IsAny<string>(), It.IsAny<CaptchaConfigResult>(), true, It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);

            var act = () => CreateService().SaveAsync(NewRequest(secretValue: "v2", key: "cfg-1"));

            (await act.Should().ThrowAsync<SecretValidationException>()).Which.ReasonCode.Should().Be("NOT_FOUND");
            _secretService.Verify(s => s.DeleteAsync("sec-new", It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task SaveAsync_RepairCompensationThatAlsoFails_LogsTheConfigurationAndRethrowsTheOriginalError()
        {
            GivenExisting(new CaptchaConfigResult { Id = "cfg-1", Provider = "recaptcha", SecretId = "sec-old" });
            GivenSecretStatus(SecretStatuses.Deleted);
            _secretService
                .Setup(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync("sec-new");
            _secretService
                .Setup(s => s.DeleteAsync("sec-new", It.IsAny<CancellationToken>()))
                .ThrowsAsync(new SecretVaultException("down", "delete", "sec-new"));
            _store
                .Setup(s => s.UpdateByIdAsync(It.IsAny<string>(), It.IsAny<CaptchaConfigResult>(), true, It.IsAny<CancellationToken>()))
                .ThrowsAsync(new InvalidOperationException("mongo down"));

            var act = () => CreateService().SaveAsync(NewRequest(secretValue: "v2", key: "cfg-1"));

            await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("mongo down");
            var error = _logger.Entries.Should().ContainSingle(e => e.Level == LogLevel.Error).Subject;
            error.Message.Should().Contain("cfg-1");
            error.Message.Should().NotContain("sec-new");
        }

        [Fact]
        public async Task SaveAsync_RotationWhoseWriteFails_RetiresNothing()
        {
            // Only a secret the save created is compensated; a rotated one cannot be rolled back.
            GivenExisting(new CaptchaConfigResult { Id = "cfg-1", Provider = "recaptcha", SecretId = "sec-1" });
            _store
                .Setup(s => s.UpdateByIdAsync(It.IsAny<string>(), It.IsAny<CaptchaConfigResult>(), true, It.IsAny<CancellationToken>()))
                .ThrowsAsync(new InvalidOperationException("mongo down"));

            var act = () => CreateService().SaveAsync(NewRequest(secretValue: "v2", key: "cfg-1"));

            await act.Should().ThrowAsync<InvalidOperationException>();
            _secretService.Verify(s => s.DeleteAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task SaveAsync_TheStoredDocumentNeverCarriesTheStatus()
        {
            GivenExisting(new CaptchaConfigResult { Id = "cfg-1", Provider = "recaptcha", SecretId = "sec-old" });
            GivenSecretStatus(SecretStatuses.Deleted);
            _secretService
                .Setup(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync("sec-new");
            CaptchaConfigResult? stored = null;
            ExpectUpdate(v => stored = v);

            var result = await CreateService().SaveAsync(NewRequest(secretValue: "v2", key: "cfg-1"));

            // The same BSON serializer Genesis's MongoKeyValueStore writes the value with. The
            // returned object is the written one with the status stamped on afterwards, so it is
            // serialized too: the attribute, not the timing, is what keeps the field out.
            foreach (var document in new[] { stored!.ToBsonDocument(), result.ToBsonDocument() })
            {
                document.Names.Should().NotContain(n => n.Equals("SecretStatus", StringComparison.OrdinalIgnoreCase));
                document["SecretId"].AsString.Should().Be("sec-new");
            }
        }

        [Fact]
        public void CaptchaConfigResult_StillSerializesTheStatusToJson()
        {
            var json = System.Text.Json.JsonSerializer.Serialize(
                new CaptchaConfigResult { Id = "cfg-1", SecretStatus = LinkedSecretStatus.Archived },
                new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web));

            json.Should().Contain("\"secretStatus\":\"archived\"");
        }

        #endregion

        #region Tolerant delete (H7, C5, C6, C15)

        public static TheoryData<Exception> AlreadyRetired => new()
        {
            new SecretStateException(SecretStatuses.Deleted, "delete", "STATUS_DELETED"),
            new SecretNotFoundException("sec-1")
        };

        [Theory]
        [MemberData(nameof(AlreadyRetired))]
        public async Task DeleteAsync_SecretAlreadyArchivedOrPurged_StillDeletesTheConfig(Exception alreadyRetired)
        {
            GivenExisting(new CaptchaConfigResult { Id = "cfg-1", Provider = "recaptcha", SecretId = "sec-1" });
            _secretService.Setup(s => s.DeleteAsync("sec-1", It.IsAny<CancellationToken>())).ThrowsAsync(alreadyRetired);
            _store.Setup(s => s.DeleteByIdAsync("cfg-1", true, It.IsAny<CancellationToken>())).ReturnsAsync(true);

            await CreateService().DeleteAsync("cfg-1");

            _store.Verify(s => s.DeleteByIdAsync("cfg-1", true, It.IsAny<CancellationToken>()), Times.Once);
            _secretService.Verify(s => s.RestoreAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
            _secretService.Verify(s => s.PurgeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
            _auditLog.Should().ContainSingle(a => a.Action == SecretAuditActions.ConfigDelete && a.SecretId == "sec-1");
        }

        public static TheoryData<Exception> OtherFailures => new()
        {
            new SecretVaultException("down", "delete", "sec-1"),
            new SecretAccessDeniedException("NOT_IN_ACCESS_LIST"),
            new SecretStateException(SecretStatuses.Locked, "delete"),
            new InvalidOperationException("unexpected")
        };

        [Theory]
        [MemberData(nameof(OtherFailures))]
        public async Task DeleteAsync_AnyOtherRetirementFailure_KeepsTheConfigAndPropagates(Exception failure)
        {
            GivenExisting(new CaptchaConfigResult { Id = "cfg-1", Provider = "recaptcha", SecretId = "sec-1" });
            _secretService.Setup(s => s.DeleteAsync("sec-1", It.IsAny<CancellationToken>())).ThrowsAsync(failure);

            var act = () => CreateService().DeleteAsync("cfg-1");

            (await act.Should().ThrowAsync<Exception>()).Which.Should().BeSameAs(failure);
            _store.Verify(s => s.DeleteByIdAsync(It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()), Times.Never);
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
            ExpectAdd("cfg-new");

            var service = CreateService();
            await service.SaveAsync(NewRequest(secretValue: plaintext));

            _auditLog.Should().NotContain(a => a.SecretId != null && a.SecretId.Contains(plaintext, StringComparison.Ordinal));
        }

        #endregion
    }
}
