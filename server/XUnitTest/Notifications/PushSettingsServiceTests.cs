using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis.Entities.Logic;
using Blocks.Secrets;
using Configuration.DomainService.Notification.Push;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using XUnitTest.TestHelpers;
using XUnitTest.TestSupport;

namespace XUnitTest.Notifications
{
    /// <summary>
    /// Push settings save rules and failure handling: secrets first, KV last, nothing half saved, no value ever returned or logged.
    /// Real service, plan, writer and repository; only the secret service is a fake, the KV store is in memory.
    /// </summary>
    public class PushSettingsServiceTests
    {
        private const string ProjectA = "shop-a";
        private const string ProjectB = "shop-b";
        private const string KeySecretId = "key-secret";
        private const string WebSecretId = "web-secret";
        private const string FirstCreatedId = "created-1";
        private const string OldValue = "old-value";
        private const string SenderId = "123456789012";
        private const string ApiKeyValue = "TestOnlyWebApiValue0123456789abcdefgh";
        private const string VapidValue = "BTestOnlyVapidKey_0123456789-abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456";

        private static readonly string PrivateKeyPem = CreatePrivateKeyPem();

        private readonly InMemoryKeyValueStore _kv = new();
        private readonly Mock<ISecretService> _secrets = new();
        private readonly RecordingLogger<PushSettingsService> _log = new();
        private readonly RecordingLogger<PushSecretWriter> _writerLog = new();
        private readonly List<string> _createdNames = [];
        private int _createdCount;

        public PushSettingsServiceTests()
        {
            _secrets.Setup(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()))
                    .ReturnsAsync((SetSecretRequest r, CancellationToken _) =>
                    {
                        _createdNames.Add(r.Name);
                        return $"created-{++_createdCount}";
                    });
            _secrets.Setup(s => s.GetValueAsync(It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync(OldValue);
            _secrets.Setup(s => s.FindAsync(It.IsAny<SecretFilter>(), It.IsAny<CancellationToken>())).ReturnsAsync(new SecretListResult());
        }

        private PushSettingsService Service() => new(
            new PushSettingsRepository(_kv),
            new PushSecretWriter(_secrets.Object, _writerLog),
            TimeProvider.System,
            _log);

        private PushSettingsRecord? Stored => _kv.Rows.TryGetValue(FirebasePushConfiguration.KeyValueKey, out var row) ? (PushSettingsRecord)row : null;

        private void Store(PushSettingsRecord record) => _kv.Rows[FirebasePushConfiguration.KeyValueKey] = record;

        private static PushSettingsRecord WithKey(string projectId = ProjectA, bool webConfig = false) => new()
        {
            ProjectId = projectId,
            Enabled = true,
            SecretId = KeySecretId,
            KeyUploadedAt = DateTime.UtcNow.AddDays(-1),
            KeyUploadedBy = "Earlier User",
            WebSecretId = webConfig ? WebSecretId : null,
            WebConfigUploadedAt = webConfig ? DateTime.UtcNow.AddDays(-1) : null,
            Platforms = new PushPlatformSwitches { Android = true, Ios = true, Web = webConfig },
        };

        private static string KeyJson(string projectId = ProjectA, string type = "service_account", string? privateKey = null) =>
            JsonSerializer.Serialize(new Dictionary<string, string>
            {
                ["type"] = type,
                ["project_id"] = projectId,
                ["client_email"] = $"push@{projectId}.iam.gserviceaccount.com",
                ["private_key"] = privateKey ?? PrivateKeyPem,
            });

        private static PushWebConfigRequest WebConfig(string? projectId = ProjectA, string appIdNumber = SenderId) => new()
        {
            ApiKey = ApiKeyValue,
            AppId = $"1:{appIdNumber}:web:0a1b2c3d4e5f",
            MessagingSenderId = SenderId,
            VapidKey = VapidValue,
            ProjectId = projectId,
        };

        private static SavePushSettingsRequest Request(bool enabled = true, string? key = null, PushWebConfigRequest? web = null, PushPlatformsModel? platforms = null) => new()
        {
            Enabled = enabled,
            ServiceAccountJson = key,
            WebConfig = web,
            Platforms = platforms,
        };

        private static string CreatePrivateKeyPem()
        {
            using var rsa = RSA.Create(2048);
            return rsa.ExportPkcs8PrivateKeyPem();
        }

        private void SecretWriteFails(string name) =>
            _secrets.Setup(s => s.SetAsync(It.Is<SetSecretRequest>(r => r.Name == name), It.IsAny<CancellationToken>()))
                    .ThrowsAsync(new SecretVaultException($"vault down for value {ApiKeyValue}", "set", "id"));

        // ---------------- key checks ----------------

        [Fact]
        public async Task Key_NotJson_IsRefused_AndNothingIsWritten()
        {
            var response = await Service().SaveAsync(Request(key: "not json {"), CancellationToken.None);

            response.Errors![PushSettingsSavePlan.KeyField].Should().Be("The service account key is not valid JSON.");
            _kv.SetCalls.Should().Be(0);
            _secrets.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Key_Over20KB_IsRefused()
        {
            var oversized = KeyJson() + new string(' ', ServiceAccountKey.MaxJsonBytes);

            var response = await Service().SaveAsync(Request(key: oversized), CancellationToken.None);

            response.Errors![PushSettingsSavePlan.KeyField].Should().Be("The service account key is larger than 20 KB.");
        }

        [Fact]
        public async Task Key_OfAnotherType_IsRefused()
        {
            var response = await Service().SaveAsync(Request(key: KeyJson(type: "authorized_user")), CancellationToken.None);

            response.Errors![PushSettingsSavePlan.KeyField].Should().Be("This file is not a Firebase service account key.");
        }

        [Fact]
        public async Task Key_WhosePrivateKeyIsNotRsa_IsRefused_AndTheErrorHoldsNoPartOfIt()
        {
            var response = await Service().SaveAsync(Request(key: KeyJson(privateKey: "-----BEGIN PRIVATE KEY-----broken")), CancellationToken.None);

            response.Errors![PushSettingsSavePlan.KeyField].Should().Be("The key has no valid private_key.");
        }

        // ---------------- rules ----------------

        [Fact]
        public async Task FirstValidKey_TurnsPushOn_AndKvHoldsOnlyAPointer()
        {
            using var _ = new BlocksTestContext();

            var response = await Service().SaveAsync(Request(enabled: false, key: KeyJson()), CancellationToken.None);

            response.IsSuccess.Should().BeTrue();
            Stored!.Enabled.Should().BeTrue();
            Stored.ProjectId.Should().Be(ProjectA);
            Stored.SecretId.Should().Be(FirstCreatedId);
            Stored.KeyUploadedBy.Should().Be("Test User");
            JsonSerializer.Serialize(Stored).Should().NotContain("PRIVATE KEY");
        }

        [Fact]
        public async Task Enable_WithoutAnyKey_IsRefused()
        {
            var response = await Service().SaveAsync(Request(enabled: true), CancellationToken.None);

            response.Errors![PushSettingsSavePlan.EnabledField].Should().Be(PushSettingsSavePlan.KeyNeededToEnable);
            _kv.SetCalls.Should().Be(0);
        }

        [Fact]
        public async Task PlatformSwitchedOn_WithoutAnyKey_IsRefused()
        {
            Store(new PushSettingsRecord { Platforms = new PushPlatformSwitches { Android = false } });

            var response = await Service().SaveAsync(Request(enabled: false, platforms: new PushPlatformsModel { Android = true, Ios = true }), CancellationToken.None);

            response.Errors![PushSettingsSavePlan.PlatformsField].Should().Be(PushSettingsSavePlan.KeyNeededForPlatform);
        }

        [Fact]
        public async Task WebOn_WithoutAWebConfig_IsRefused()
        {
            Store(WithKey());

            var response = await Service().SaveAsync(Request(platforms: new PushPlatformsModel { Android = true, Ios = true, Web = true }), CancellationToken.None);

            response.Errors![PushSettingsSavePlan.PlatformsField].Should().Be(PushSettingsSavePlan.WebConfigNeeded);
        }

        [Fact]
        public async Task WebConfig_WithoutAKey_IsRefused()
        {
            var response = await Service().SaveAsync(Request(enabled: false, web: WebConfig()), CancellationToken.None);

            response.Errors![PushSettingsSavePlan.WebConfigField].Should().Be(PushSettingsSavePlan.KeyNeededForWebConfig);
        }

        [Fact]
        public async Task WebConfig_ForAnotherProject_IsRefused()
        {
            Store(WithKey());

            var response = await Service().SaveAsync(Request(web: WebConfig(projectId: ProjectB)), CancellationToken.None);

            response.Errors![PushSettingsSavePlan.WebConfigField].Should().Be(PushWebConfig.OtherProject);
            _secrets.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task KeyAndWebConfigOfDifferentProjects_InOneSave_AreRefused()
        {
            Store(WithKey());

            var response = await Service().SaveAsync(Request(key: KeyJson(ProjectB), web: WebConfig(projectId: ProjectA)), CancellationToken.None);

            response.Errors![PushSettingsSavePlan.WebConfigField].Should().Be(PushWebConfig.OtherProject);
            Stored!.ProjectId.Should().Be(ProjectA);
        }

        [Fact]
        public async Task WebConfig_WhoseAppIdNumberIsNotTheSender_IsRefused()
        {
            Store(WithKey());

            var response = await Service().SaveAsync(Request(web: WebConfig(appIdNumber: "999")), CancellationToken.None);

            response.Errors![PushSettingsSavePlan.WebConfigField].Should().Be(PushWebConfig.AppIdOtherSender);
        }

        [Fact]
        public async Task WebConfig_WithAMalformedApiKey_IsRefused()
        {
            Store(WithKey());
            var web = WebConfig();
            web.ApiKey = "short";

            var response = await Service().SaveAsync(Request(web: web), CancellationToken.None);

            response.Errors![PushSettingsSavePlan.WebConfigField].Should().Be(PushWebConfig.NotWebConfig);
        }

        [Fact]
        public async Task ValidWebConfig_IsStoredAsASecret_AndWebCanBeTurnedOn()
        {
            using var _ = new BlocksTestContext();
            Store(WithKey());
            string? storedValue = null;
            _secrets.Setup(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()))
                    .Callback<SetSecretRequest, CancellationToken>((r, _) => storedValue = r.Value)
                    .ReturnsAsync("created-web");

            var response = await Service().SaveAsync(Request(web: WebConfig(), platforms: new PushPlatformsModel { Android = true, Ios = true, Web = true }), CancellationToken.None);

            response.IsSuccess.Should().BeTrue();
            Stored!.WebSecretId.Should().Be("created-web");
            Stored.Platforms.Web.Should().BeTrue();
            JsonDocument.Parse(storedValue!).RootElement.EnumerateObject().Select(p => p.Name)
                .Should().BeEquivalentTo("apiKey", "appId", "messagingSenderId", "vapidKey");
        }

        [Fact]
        public async Task KeyMovedToAnotherProject_DropsTheWebConfig_TurnsWebOff_AndRetiresItsSecret()
        {
            Store(WithKey(webConfig: true));

            var response = await Service().SaveAsync(Request(key: KeyJson(ProjectB), platforms: new PushPlatformsModel { Android = true, Ios = true, Web = true }), CancellationToken.None);

            response.IsSuccess.Should().BeTrue();
            Stored!.ProjectId.Should().Be(ProjectB);
            Stored.WebSecretId.Should().BeNull();
            Stored.Platforms.Web.Should().BeFalse();
            Stored.SecretId.Should().Be(KeySecretId, "the key secret is rotated in place");
            _secrets.Verify(s => s.DeleteAsync(WebSecretId, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task OldLogicRecord_WithoutSecretId_RotatesTheSecretFoundByName()
        {
            Store(new PushSettingsRecord { ProjectId = ProjectA, Enabled = true, KeyUploadedAt = DateTime.UtcNow });
            _secrets.Setup(s => s.FindAsync(It.IsAny<SecretFilter>(), It.IsAny<CancellationToken>()))
                    .ReturnsAsync(new SecretListResult { Data = [new SecretResult { SecretId = "by-name", Name = FirebasePushConfiguration.DefaultSecretName }] });

            var response = await Service().SaveAsync(Request(key: KeyJson()), CancellationToken.None);

            response.IsSuccess.Should().BeTrue();
            Stored!.SecretId.Should().Be("by-name");
            _secrets.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        // ---------------- failures: nothing half saved ----------------

        [Fact]
        public async Task KeySecretWriteFails_KvIsUntouched()
        {
            SecretWriteFails(FirebasePushConfiguration.DefaultSecretName);

            var response = await Service().SaveAsync(Request(key: KeyJson()), CancellationToken.None);

            response.Errors![PushSettingsSavePlan.KeyField].Should().Be(PushSettingsService.KeyNotStored);
            _kv.SetCalls.Should().Be(0);
        }

        [Fact]
        public async Task WebSecretWriteFails_TheKeySecretThisSaveCreatedIsRetired_AndKvIsUntouched()
        {
            SecretWriteFails(PushSettingsRecord.WebConfigSecretName);

            var response = await Service().SaveAsync(Request(key: KeyJson(), web: WebConfig()), CancellationToken.None);

            response.Errors![PushSettingsSavePlan.WebConfigField].Should().Be(PushSettingsService.WebConfigNotStored);
            _kv.SetCalls.Should().Be(0);
            _secrets.Verify(s => s.DeleteAsync(FirstCreatedId, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task WebSecretWriteFails_TheRotatedKeyGetsItsOldValueBack()
        {
            Store(WithKey());
            SecretWriteFails(PushSettingsRecord.WebConfigSecretName);

            await Service().SaveAsync(Request(key: KeyJson(), web: WebConfig()), CancellationToken.None);

            _secrets.Verify(s => s.RotateAsync(KeySecretId, It.Is<RotateSecretRequest>(r => r.Value == OldValue), It.IsAny<CancellationToken>()), Times.Once);
            Stored!.KeyUploadedBy.Should().Be("Earlier User");
        }

        [Fact]
        public async Task KvWriteFails_TheSecretThisSaveCreatedIsRetired()
        {
            _kv.FailOnSet = true;

            var response = await Service().SaveAsync(Request(key: KeyJson()), CancellationToken.None);

            response.Errors![PushSettingsService.SettingsField].Should().Be(PushSettingsService.SettingsNotStored);
            _secrets.Verify(s => s.DeleteAsync(FirstCreatedId, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task ConcurrentSaveWins_TheSecretThisSaveCreatedIsRetired()
        {
            var repository = new Mock<IPushSettingsRepository>();
            repository.SetupSequence(r => r.GetAsync(It.IsAny<CancellationToken>()))
                      .ReturnsAsync((PushSettingsRecord?)null)
                      .ReturnsAsync(new PushSettingsRecord { ProjectId = ProjectA, SecretId = "the-other-save" });
            var service = new PushSettingsService(repository.Object, new PushSecretWriter(_secrets.Object, _writerLog), TimeProvider.System, _log);

            var response = await service.SaveAsync(Request(key: KeyJson()), CancellationToken.None);

            response.IsSuccess.Should().BeTrue("last write wins");
            _secrets.Verify(s => s.DeleteAsync(FirstCreatedId, It.IsAny<CancellationToken>()), Times.Once);
            _secrets.Verify(s => s.DeleteAsync("the-other-save", It.IsAny<CancellationToken>()), Times.Never);
        }

        // ---------------- no value leaves the server ----------------

        [Fact]
        public async Task Get_NeverHoldsAFirebaseValue()
        {
            Store(WithKey(webConfig: true));

            var view = await Service().GetAsync(CancellationToken.None);

            view.HasKey.Should().BeTrue();
            view.HasWebConfig.Should().BeTrue();
            var json = JsonSerializer.Serialize(view);
            json.Should().NotContain(KeySecretId).And.NotContain(WebSecretId);
        }

        [Fact]
        public async Task FailedSave_LogsNoValue()
        {
            SecretWriteFails(PushSettingsRecord.WebConfigSecretName);

            var response = await Service().SaveAsync(Request(key: KeyJson(), web: WebConfig()), CancellationToken.None);

            var everything = _log.Entries.Select(e => e.Message).Concat(_writerLog.Entries.Select(e => e.Message))
                .Append(JsonSerializer.Serialize(response)).ToList();
            everything.Should().NotBeEmpty();
            everything.Should().NotContain(m => m.Contains(ApiKeyValue) || m.Contains(VapidValue) || m.Contains("PRIVATE KEY") || m.Contains(OldValue));
        }
    }
}
