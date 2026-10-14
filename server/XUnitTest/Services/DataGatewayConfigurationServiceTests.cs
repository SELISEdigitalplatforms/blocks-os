using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Secrets;
using Configuration.DomainService.DataGateway.Entities;
using Configuration.DomainService.DataGateway.RequestModel;
using Configuration.DomainService.DataGateway.Services;
using Configuration.DomainService.Shared.Services;
using FluentAssertions;
using FluentValidation;
using FluentValidation.Results;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using Moq;
using StackExchange.Redis;
using XUnitTest.TestHelpers;
using XUnitTest.TestSupport;

namespace XUnitTest.Services
{
    /// <summary>os SPEC2 X-3: data-gateway GET/save, switch off and on (unit, fake repository/secrets/redis).</summary>
    public class DataGatewayConfigurationServiceTests
    {
        private const string Tenant = "tenant-1";
        private const string ConfigItemId = "cfg-1";
        private const string Value = "mongodb+srv://u:VERY-SECRET-PW@host/db";
        private const string NewValue = "mongodb+srv://u:OTHER-SECRET-PW@host2/db";

        private readonly List<string> _calls = new();
        private readonly Mock<IConfigurationRepository> _repo = new();
        private readonly Mock<IValidator<SaveDataGatewayConfigurationRequest>> _validator = new();
        private readonly FakeSecretService _secrets;
        private readonly FakeRedis _redis;
        private readonly RecordingLogger<DataGatewayConfigurationService> _logger = new();
        private readonly List<BsonDocument> _rootSets = new();
        private readonly List<List<string>> _rootUnsets = new();
        private readonly List<BsonDocument> _copySets = new();
        private DataGatewayConfiguration? _inserted;

        public DataGatewayConfigurationServiceTests()
        {
            _secrets = new FakeSecretService(_calls);
            _redis = new FakeRedis(_calls);
            _validator.Setup(v => v.ValidateAsync(It.IsAny<SaveDataGatewayConfigurationRequest>(), It.IsAny<CancellationToken>()))
                      .ReturnsAsync(new ValidationResult());
            _repo.Setup(r => r.SetDataGatewayRootFieldsAsync(It.IsAny<string>(), It.IsAny<BsonDocument>(), It.IsAny<IEnumerable<string>?>()))
                 .Callback<string, BsonDocument, IEnumerable<string>?>((_, set, unset) =>
                 {
                     _calls.Add(set.Names.SequenceEqual(new[] { "ValueChangedAfterDeploy" }) ? "root.flag" : "root.set");
                     _rootSets.Add(set);
                     _rootUnsets.Add(unset?.ToList() ?? new List<string>());
                 })
                 .ReturnsAsync(1);
            _repo.Setup(r => r.SetDataGatewayTenantCopyNonSecretAsync(It.IsAny<string>(), It.IsAny<BsonDocument>()))
                 .Callback<string, BsonDocument>((_, set) => { _calls.Add("copy.set"); _copySets.Add(set); })
                 .ReturnsAsync(1);
            _repo.Setup(r => r.InsertDataGatewayRootAsync(It.IsAny<DataGatewayConfiguration>()))
                 .Callback<DataGatewayConfiguration>(d => { _calls.Add("root.insert"); _inserted = d; })
                 .ReturnsAsync(true);
        }

        private DataGatewayConfigurationService Service(bool on) => new(
            _repo.Object, _validator.Object, _secrets, _redis.Client(), DataGatewayTestSupport.Mode(on), _logger);

        private static string B64(string s) => Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(s));

        private static DataGatewayConfiguration Root(string? secretId, bool flagged = false) => new()
        {
            ItemId = Tenant,
            ConfigItemId = ConfigItemId,
            DbConnectionString = null,
            DbConnectionSecretId = secretId,
            DatabaseName = "crm",
            ProjectKey = Tenant,
            ValueChangedAfterDeploy = flagged ? true : null,
            AnalyticsConfiguration = new AnalyticsConfiguration { EnableAnalytics = true }
        };

        private void HasRoot(DataGatewayConfiguration? root) =>
            _repo.Setup(r => r.GetDataGatewayRootAsync(Tenant)).ReturnsAsync(root);

        private static SaveDataGatewayConfigurationRequest Update(string value, string itemId = ConfigItemId, string db = "crm") => new()
        {
            UpdateRequest = true, ItemId = itemId, ConnectionString = value, DatabaseName = db, ProjectKey = Tenant
        };

        private static SaveDataGatewayConfigurationRequest Create(string value, string? itemId = null, string projectKey = Tenant) => new()
        {
            UpdateRequest = false, ItemId = itemId, ConnectionString = value, DatabaseName = "crm", ProjectKey = projectKey
        };

        private void NoValueInLogs()
        {
            _logger.Entries.Should().NotContain(e => e.Message.Contains("SECRET-PW"));
        }

        // ---------------- switch OFF (R-X-OFF, C18) ----------------

        [Fact]
        public async Task Off_Get_ReturnsTodaysDecodedTenantDoc_NoRootNoSecretNoRedis()
        {
            using var _ = new BlocksTestContext(Tenant);
            _repo.Setup(r => r.GetDataGatewayConfigurationAsync())
                 .ReturnsAsync(new DataGatewayConfiguration { ItemId = "legacy", DbConnectionString = B64(Value) });

            var result = await Service(on: false).GetDataGatewayConfigurationAsync();

            result!.ItemId.Should().Be("legacy");
            result.DbConnectionString.Should().Be(Value);
            _calls.Should().BeEmpty();
            _repo.Verify(r => r.GetDataGatewayRootAsync(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task Off_Get_None_ReturnsNull()
        {
            using var _ = new BlocksTestContext(Tenant);
            (await Service(on: false).GetDataGatewayConfigurationAsync()).Should().BeNull();
        }

        [Fact]
        public async Task Off_Save_Create_TodaysMap_Base64NewGuidBodyProjectKey_NoSecretNoRedis()
        {
            using var _ = new BlocksTestContext(Tenant, userId: "u1");
            DataGatewayConfiguration? saved = null;
            _repo.Setup(r => r.SaveDataGatewayConfigurationAsync(It.IsAny<DataGatewayConfiguration>()))
                 .Callback<DataGatewayConfiguration>(c => saved = c).Returns(Task.CompletedTask);

            var response = await Service(on: false).SaveDataGatewayConfigurationAsync(Create(Value, itemId: "body-id", projectKey: "pk"));

            response.IsSuccess.Should().BeTrue();
            saved!.DbConnectionString.Should().Be(B64(Value));
            saved.ItemId.Should().NotBe("body-id");
            Guid.TryParse(saved.ItemId, out var _g).Should().BeTrue();
            response.ItemId.Should().Be(saved.ItemId);
            saved.ProjectKey.Should().Be("pk");
            saved.CreatedBy.Should().Be("u1");
            saved.AnalyticsConfiguration!.EnableAnalytics.Should().BeTrue();
            saved.AnalyticsConfiguration.ValidTill.Should().BeCloseTo(DateTime.UtcNow.AddDays(14), TimeSpan.FromMinutes(1));
            _calls.Should().BeEmpty();
        }

        [Fact]
        public async Task Off_Save_Update_UnknownItemId_MakesNewDoc_AsToday()
        {
            using var _ = new BlocksTestContext(Tenant);
            DataGatewayConfiguration? saved = null;
            _repo.Setup(r => r.SaveDataGatewayConfigurationAsync(It.IsAny<DataGatewayConfiguration>()))
                 .Callback<DataGatewayConfiguration>(c => saved = c).Returns(Task.CompletedTask);

            var response = await Service(on: false).SaveDataGatewayConfigurationAsync(Update(Value, itemId: "unknown"));

            response.IsSuccess.Should().BeTrue();
            saved!.ItemId.Should().NotBe("unknown");
        }

        [Fact]
        public async Task Off_Save_UpdateOntoRootDoc_IsRefused_NothingWritten()
        {
            using var _ = new BlocksTestContext(Tenant);
            _repo.Setup(r => r.GetDataGatewayConfigurationByIdAsync("T1"))
                 .ReturnsAsync(new DataGatewayConfiguration { ItemId = "T1", ConfigItemId = "old-T1" });

            var response = await Service(on: false).SaveDataGatewayConfigurationAsync(Update(Value, itemId: "T1"));

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().Contain("ItemId", DataGatewayConfigurationService.NotFoundMessage);
            _repo.Verify(r => r.SaveDataGatewayConfigurationAsync(It.IsAny<DataGatewayConfiguration>()), Times.Never);
        }

        [Fact]
        public async Task Validation_Fails_ReturnsErrors_NothingWritten()
        {
            using var _ = new BlocksTestContext(Tenant);
            _validator.Setup(v => v.ValidateAsync(It.IsAny<SaveDataGatewayConfigurationRequest>(), It.IsAny<CancellationToken>()))
                      .ReturnsAsync(new ValidationResult(new[] { new ValidationFailure("ConnectionString", "ConnectionString must not be empty.") }));

            foreach (var on in new[] { true, false })
            {
                var response = await Service(on).SaveDataGatewayConfigurationAsync(Create(""));
                response.IsSuccess.Should().BeFalse();
                response.Errors.Should().ContainKey("ConnectionString");
            }

            _calls.Should().BeEmpty();
        }

        // ---------------- switch ON: GET ----------------

        [Fact]
        public async Task On_Get_ByoRootDoc_ReadsSecretPerCall_TodaysJsonKeysOnly()
        {
            using var _ = new BlocksTestContext(Tenant);
            var id = _secrets.Add(Value);
            HasRoot(Root(id, flagged: true));

            var result = await Service(on: true).GetDataGatewayConfigurationAsync();
            await Service(on: true).GetDataGatewayConfigurationAsync();

            result!.ItemId.Should().Be(ConfigItemId);
            result.DbConnectionString.Should().Be(Value);
            result.DatabaseName.Should().Be("crm");
            _calls.Count(c => c == "secret.GetValue").Should().Be(2, "never cached: one read per GET");

            var json = JsonSerializer.Serialize(result, new JsonSerializerOptions(JsonSerializerDefaults.Web));
            json.Should().Contain("\"itemId\":\"cfg-1\"");
            json.Should().NotContain("dbConnectionSecretId").And.NotContain("configItemId").And.NotContain("valueChangedAfterDeploy");
            _repo.Verify(r => r.GetDataGatewayTenantCopyAsync(), Times.Never);
        }

        [Theory]
        [InlineData("default", "default")]
        [InlineData("Default", "default")]
        [InlineData("DEFAULT", "default")]
        [InlineData(null, "")]
        public async Task On_Get_DefaultOrBlank_NoSecretCall(string? secretId, string expected)
        {
            using var _ = new BlocksTestContext(Tenant);
            HasRoot(Root(secretId));

            var result = await Service(on: true).GetDataGatewayConfigurationAsync();

            result!.DbConnectionString.Should().Be(expected);
            _calls.Should().BeEmpty();
        }

        [Fact]
        public async Task On_Get_NoRoot_AnswersFromTenantCopy()
        {
            using var _ = new BlocksTestContext(Tenant);
            HasRoot(null);
            _repo.Setup(r => r.GetDataGatewayTenantCopyAsync())
                 .ReturnsAsync(new DataGatewayConfiguration { ItemId = "legacy", DbConnectionString = B64(Value) });

            var result = await Service(on: true).GetDataGatewayConfigurationAsync();

            result!.ItemId.Should().Be("legacy");
            result.DbConnectionString.Should().Be(Value);
            _calls.Should().BeEmpty();
        }

        [Fact]
        public async Task On_Get_NothingAnywhere_ReturnsNull_204()
        {
            using var _ = new BlocksTestContext(Tenant);
            HasRoot(null);
            (await Service(on: true).GetDataGatewayConfigurationAsync()).Should().BeNull();
        }

        [Theory]
        [InlineData("locked")]
        [InlineData("deleted")]
        [InlineData("missing")]
        [InlineData("value-missing")]
        [InlineData("bad-id")]
        public async Task On_Get_UnusableSecret_Answers200WithEmptyValue_AndWarns(string state)
        {
            using var _ = new BlocksTestContext(Tenant);
            string id = state switch
            {
                "locked" => _secrets.Add(Value, SecretStatuses.Locked),
                "deleted" => _secrets.Add(Value, SecretStatuses.Deleted),
                "value-missing" => _secrets.Add(null!),
                "bad-id" => "xyz",
                _ => "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"
            };
            var root = Root(id);
            HasRoot(root);
            _repo.Setup(r => r.GetDataGatewayTenantCopyAsync())
                 .ReturnsAsync(new DataGatewayConfiguration { ItemId = "legacy", DbConnectionString = B64("tenant-copy-OLD-SECRET-PW") });

            var result = await Service(on: true).GetDataGatewayConfigurationAsync();

            result!.DbConnectionString.Should().Be("", "never the tenant-copy value");
            result.ItemId.Should().Be(ConfigItemId);
            result.DatabaseName.Should().Be("crm");
            _calls.Should().Contain("secret.GetValue", "a malformed id goes to Blocks Secrets like any id");
            _logger.Entries.Should().Contain(e => e.Level == LogLevel.Warning && e.Message.Contains("result=secret-unavailable") && e.Message.Contains(id));
            NoValueInLogs();
        }

        [Fact]
        public async Task On_Get_VaultDown_NotCaught_GoesToSecretExceptionFilter()
        {
            using var _ = new BlocksTestContext(Tenant);
            HasRoot(Root(_secrets.Add(Value)));
            _secrets.GetValueThrows = new SecretVaultException("vault down", "get", "id");

            await FluentActions.Awaiting(() => Service(on: true).GetDataGatewayConfigurationAsync())
                .Should().ThrowAsync<SecretVaultException>();
        }

        [Fact]
        public async Task On_Get_AccessDeniedOrValidation_NotCaught()
        {
            using var _ = new BlocksTestContext(Tenant);
            HasRoot(Root(_secrets.Add(Value)));
            _secrets.GetValueThrows = new SecretAccessDeniedException("DENIED");
            await FluentActions.Awaiting(() => Service(on: true).GetDataGatewayConfigurationAsync())
                .Should().ThrowAsync<SecretAccessDeniedException>();

            _secrets.GetValueThrows = new SecretValidationException("bad");
            await FluentActions.Awaiting(() => Service(on: true).GetDataGatewayConfigurationAsync())
                .Should().ThrowAsync<SecretValidationException>();
        }

        [Fact]
        public async Task On_Get_RepositoryError_NotCaught_GenesisMiddleware()
        {
            using var _ = new BlocksTestContext(Tenant);
            _repo.Setup(r => r.GetDataGatewayRootAsync(Tenant)).ThrowsAsync(new TimeoutException("db timeout host-a"));

            await FluentActions.Awaiting(() => Service(on: true).GetDataGatewayConfigurationAsync())
                .Should().ThrowAsync<TimeoutException>();
        }

        [Fact]
        public async Task On_Get_NoRoot_TenantCopyReadError_NotCaught_GenesisMiddleware()
        {
            using var _ = new BlocksTestContext(Tenant);
            HasRoot(null);
            _repo.Setup(r => r.GetDataGatewayTenantCopyAsync()).ThrowsAsync(new TimeoutException("tenant db timeout host-b"));

            await FluentActions.Awaiting(() => Service(on: true).GetDataGatewayConfigurationAsync())
                .Should().ThrowAsync<TimeoutException>();
            _calls.Should().BeEmpty();
        }

        // ---------------- switch ON: create (R-X-CREATE, R-X-CREATE-RACE, C8) ----------------

        [Fact]
        public async Task On_Create_Custom_ServiceSecret_RootDocFlagged_RedisHash()
        {
            using var _ = new BlocksTestContext(Tenant, userId: "admin");

            var response = await Service(on: true).SaveDataGatewayConfigurationAsync(Create(Value, itemId: "body-id"));

            response.IsSuccess.Should().BeTrue();
            var set = _secrets.SetRequests.Should().ContainSingle().Subject;
            set.Name.Should().Be("data-source-connection");
            set.Type.Should().Be(SecretTypes.Service);
            set.Tags.Should().BeEquivalentTo(new[] { "data" });
            set.OrganizationId.Should().Be("default");
            set.Value.Should().Be(Value);
            set.Description.Should().Be("Data source connection");

            var secretId = _secrets.Secrets.Keys.Single();
            _inserted!.ItemId.Should().Be(Tenant);
            _inserted.ConfigItemId.Should().NotBe("body-id");
            Guid.TryParse(_inserted.ConfigItemId, out var _g).Should().BeTrue();
            _inserted.DbConnectionString.Should().BeNull();
            _inserted.DbConnectionSecretId.Should().Be(secretId);
            _inserted.ValueChangedAfterDeploy.Should().BeTrue();
            _inserted.ProjectKey.Should().Be(Tenant);
            _inserted.CreatedBy.Should().Be("admin");
            _inserted.AnalyticsConfiguration!.EnableAnalytics.Should().BeTrue();
            response.ItemId.Should().Be(_inserted.ConfigItemId);

            _calls.Should().Equal("secret.Set", "root.insert", "redis.HSET", "redis.HDEL:DbConnectionString", "redis.EXEC");
            var hash = _redis.Hashes[Tenant];
            hash.Keys.Should().BeEquivalentTo(new[] { "DbConnectionSecretId", "DatabaseName", "Version" });
            hash["DbConnectionSecretId"].Should().Be(secretId);
            hash["DatabaseName"].Should().Be("crm");
            long.Parse(hash["Version"]).Should().BeGreaterThan(0);
            _calls.Should().NotContain("redis.KeyDelete");
        }

        [Theory]
        [InlineData("default")]
        [InlineData("Default")]
        [InlineData("DEFAULT")]
        public async Task On_Create_Default_AnyCase_NoSecret_StoresLowercaseDefault(string value)
        {
            using var _ = new BlocksTestContext(Tenant);

            var response = await Service(on: true).SaveDataGatewayConfigurationAsync(Create(value));

            response.IsSuccess.Should().BeTrue();
            _secrets.SetRequests.Should().BeEmpty();
            _inserted!.DbConnectionSecretId.Should().Be("default");
            _inserted.ValueChangedAfterDeploy.Should().BeTrue();
            _redis.Hashes[Tenant]["DbConnectionSecretId"].Should().Be("default");
        }

        [Fact]
        public async Task On_Create_BodyProjectKeyOfOtherTenant_TouchesOnlyCallerTenant_StoresBodyValue()
        {
            using var _ = new BlocksTestContext(Tenant);

            await Service(on: true).SaveDataGatewayConfigurationAsync(Create(Value, projectKey: "other-tenant"));

            _inserted!.ItemId.Should().Be(Tenant);
            _inserted.ProjectKey.Should().Be("other-tenant", "today's rule: create stores the body value");
            _redis.Hashes.Keys.Should().Equal(Tenant);
            _logger.Entries.Should().NotContain(e => e.Level == LogLevel.Warning);
        }

        [Fact]
        public async Task On_Create_Race_DuplicateKey_AlreadyExists_SecretLeftUnused()
        {
            using var _ = new BlocksTestContext(Tenant);
            _repo.Setup(r => r.InsertDataGatewayRootAsync(It.IsAny<DataGatewayConfiguration>())).ReturnsAsync(false);

            var response = await Service(on: true).SaveDataGatewayConfigurationAsync(Create(Value));

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().Contain("ItemId", DataGatewayConfigurationService.AlreadyExistsMessage);
            _calls.Should().Contain("secret.Set").And.NotContain("secret.Delete");
            _redis.Transactions.Should().Be(0);
        }

        [Fact]
        public async Task On_Create_VaultDown_NotCaught_NothingWritten()
        {
            using var _ = new BlocksTestContext(Tenant);
            _secrets.SetThrows = new SecretVaultException("vault down", "set", "");

            await FluentActions.Awaiting(() => Service(on: true).SaveDataGatewayConfigurationAsync(Create(Value)))
                .Should().ThrowAsync<SecretVaultException>();

            _inserted.Should().BeNull();
            _redis.Transactions.Should().Be(0);
        }

        // ---------------- switch ON: update ----------------

        [Fact]
        public async Task On_Update_NoRootDoc_RefusedNotMigrated_NothingWritten()
        {
            using var _ = new BlocksTestContext(Tenant);
            HasRoot(null);

            var response = await Service(on: true).SaveDataGatewayConfigurationAsync(Update(Value));

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().Contain("ItemId", DataGatewayConfigurationService.NotMigratedMessage);
            _calls.Should().BeEmpty();
            _repo.Verify(r => r.SaveDataGatewayConfigurationAsync(It.IsAny<DataGatewayConfiguration>()), Times.Never);
        }

        [Fact]
        public async Task On_Update_WrongItemId_RefusedNotFound_NoSecondDoc()
        {
            using var _ = new BlocksTestContext(Tenant);
            HasRoot(Root(_secrets.Add(Value)));

            var response = await Service(on: true).SaveDataGatewayConfigurationAsync(Update(Value, itemId: "wrong"));

            response.Errors.Should().Contain("ItemId", DataGatewayConfigurationService.NotFoundMessage);
            _calls.Should().BeEmpty();
            _repo.Verify(r => r.InsertDataGatewayRootAsync(It.IsAny<DataGatewayConfiguration>()), Times.Never);
        }

        [Fact]
        public async Task On_Update_SameValue_NoRotateNoFlag_RootCopyRedisWritten()
        {
            using var _ = new BlocksTestContext(Tenant, userId: "admin");
            var id = _secrets.Add(Value);
            HasRoot(Root(id));

            var response = await Service(on: true).SaveDataGatewayConfigurationAsync(Update(Value, db: "crm2"));

            response.IsSuccess.Should().BeTrue();
            response.ItemId.Should().Be(ConfigItemId);
            _calls.Should().Equal("secret.Get", "secret.GetValue", "root.set", "copy.set", "redis.HSET", "redis.HDEL:DbConnectionString", "redis.EXEC");
            var set = _rootSets.Single();
            set["DbConnectionSecretId"].AsString.Should().Be(id);
            set["DatabaseName"].AsString.Should().Be("crm2");
            set["LastUpdatedBy"].AsString.Should().Be("admin");
            set.Names.Should().NotContain(new[] { "ProjectKey", "DbConnectionString", "ValueChangedAfterDeploy" });
            var copy = _copySets.Single();
            copy.Names.Should().BeEquivalentTo("DatabaseName", "IsCollectionNameEditable", "CollectionNamePattern", "AnalyticsConfiguration", "LastUpdatedDate", "LastUpdatedBy");
            copy["LastUpdatedDate"].Should().Be(set["LastUpdatedDate"]);
            _repo.Verify(r => r.SetDataGatewayTenantCopyNonSecretAsync(ConfigItemId, It.IsAny<BsonDocument>()), Times.Once);
            _redis.Hashes[Tenant]["DatabaseName"].Should().Be("crm2");
            _redis.Hashes[Tenant]["DbConnectionSecretId"].Should().Be(id);
        }

        [Fact]
        public async Task On_Update_NewValue_FlagBeforeRotate_SameId()
        {
            using var _ = new BlocksTestContext(Tenant);
            var id = _secrets.Add(Value);
            HasRoot(Root(id));

            var response = await Service(on: true).SaveDataGatewayConfigurationAsync(Update(NewValue));

            response.IsSuccess.Should().BeTrue();
            _calls.Should().Equal("secret.Get", "secret.GetValue", "root.flag", "secret.Rotate", "root.set", "copy.set",
                "redis.HSET", "redis.HDEL:DbConnectionString", "redis.EXEC");
            _secrets.Secrets[id].Value.Should().Be(NewValue);
            _rootSets.Last()["DbConnectionSecretId"].AsString.Should().Be(id);
            NoValueInLogs();
        }

        [Fact]
        public async Task On_Update_NewValue_AlreadyFlagged_NoExtraFlagWrite()
        {
            using var _ = new BlocksTestContext(Tenant);
            HasRoot(Root(_secrets.Add(Value), flagged: true));

            await Service(on: true).SaveDataGatewayConfigurationAsync(Update(NewValue));

            _calls.Should().NotContain("root.flag").And.Contain("secret.Rotate");
        }

        [Theory]
        [InlineData("default")]
        [InlineData("Default")]
        public async Task On_Update_ToDefault_FlagFirst_NoDelete_OldSecretUntouched(string value)
        {
            using var _ = new BlocksTestContext(Tenant);
            var id = _secrets.Add(Value);
            HasRoot(Root(id));

            var response = await Service(on: true).SaveDataGatewayConfigurationAsync(Update(value));

            response.IsSuccess.Should().BeTrue();
            _calls.Should().Equal("root.flag", "root.set", "copy.set", "redis.HSET", "redis.HDEL:DbConnectionString", "redis.EXEC");
            _calls.Should().NotContain("secret.Delete");
            _secrets.Secrets[id].Should().Be((SecretStatuses.Active, Value));
            _rootSets.Last()["DbConnectionSecretId"].AsString.Should().Be("default");
            _redis.Hashes[Tenant]["DbConnectionSecretId"].Should().Be("default");
        }

        [Theory]
        [InlineData("default")]
        [InlineData("DEFAULT")]
        public async Task On_Update_DefaultToDefault_AnyCase_NoneAction_NoFlag(string rootId)
        {
            using var _ = new BlocksTestContext(Tenant);
            HasRoot(Root(rootId));

            var response = await Service(on: true).SaveDataGatewayConfigurationAsync(Update("Default"));

            response.IsSuccess.Should().BeTrue();
            _calls.Should().NotContain("root.flag");
            _rootSets.Single()["DbConnectionSecretId"].AsString.Should().Be("default");
        }

        [Fact]
        public async Task On_Update_CustomFromDefault_SetsNewSecret_FlagFirst()
        {
            using var _ = new BlocksTestContext(Tenant);
            HasRoot(Root("Default"));

            await Service(on: true).SaveDataGatewayConfigurationAsync(Update(Value));

            _calls.Should().StartWith(new[] { "root.flag", "secret.Set" });
            _rootSets.Last()["DbConnectionSecretId"].AsString.Should().Be(_secrets.Secrets.Keys.Single());
        }

        [Fact]
        public async Task On_Update_Locked_RotatesWithoutCompare()
        {
            using var _ = new BlocksTestContext(Tenant);
            var id = _secrets.Add(Value, SecretStatuses.Locked);
            HasRoot(Root(id));

            await Service(on: true).SaveDataGatewayConfigurationAsync(Update(Value));

            _calls.Should().StartWith(new[] { "secret.Get", "root.flag", "secret.Rotate" });
            _calls.Should().NotContain("secret.GetValue");
        }

        [Theory]
        [InlineData("deleted")]
        [InlineData("missing")]
        [InlineData("bad-id")]
        public async Task On_Update_DeletedMissingOrMalformed_RepairsWithNewSecret(string state)
        {
            using var _ = new BlocksTestContext(Tenant);
            var oldId = state switch
            {
                "deleted" => _secrets.Add(Value, SecretStatuses.Deleted),
                "missing" => "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
                _ => "xyz"
            };
            HasRoot(Root(oldId));

            var response = await Service(on: true).SaveDataGatewayConfigurationAsync(Update(Value));

            response.IsSuccess.Should().BeTrue();
            _calls.Should().StartWith(new[] { "secret.Get", "root.flag", "secret.Set" });
            _calls.Should().NotContain("secret.Delete");
            var newId = _secrets.SetRequests.Should().ContainSingle().Which;
            _rootSets.Last()["DbConnectionSecretId"].AsString.Should().NotBe(oldId);
            _redis.Hashes[Tenant]["DbConnectionSecretId"].Should().Be(_rootSets.Last()["DbConnectionSecretId"].AsString);
        }

        [Fact]
        public async Task On_Update_ActiveButVaultValueMissing_RotatesSameId()
        {
            using var _ = new BlocksTestContext(Tenant);
            var id = _secrets.Add(null!);
            HasRoot(Root(id));

            await Service(on: true).SaveDataGatewayConfigurationAsync(Update(Value));

            _calls.Should().StartWith(new[] { "secret.Get", "secret.GetValue", "root.flag", "secret.Rotate" });
            _rootSets.Last()["DbConnectionSecretId"].AsString.Should().Be(id);
        }

        [Fact]
        public async Task On_Update_FlagWriteThrows_NoSecretWrite_ErrorGoesUp()
        {
            using var _ = new BlocksTestContext(Tenant);
            HasRoot(Root(_secrets.Add(Value)));
            _repo.Setup(r => r.SetDataGatewayRootFieldsAsync(Tenant, It.Is<BsonDocument>(d => d.Contains("ValueChangedAfterDeploy")), It.IsAny<IEnumerable<string>?>()))
                 .ThrowsAsync(new TimeoutException("flag write timeout"));

            await FluentActions.Awaiting(() => Service(on: true).SaveDataGatewayConfigurationAsync(Update(NewValue)))
                .Should().ThrowAsync<TimeoutException>();

            _calls.Should().NotContain(new[] { "secret.Rotate", "secret.Set" });
            _redis.Transactions.Should().Be(0);
        }

        [Fact]
        public async Task On_Update_FlagMatchedZero_RefusedNotMigrated_NoSecretWrite()
        {
            using var _ = new BlocksTestContext(Tenant);
            HasRoot(Root(_secrets.Add(Value)));
            _repo.Setup(r => r.SetDataGatewayRootFieldsAsync(Tenant, It.IsAny<BsonDocument>(), It.IsAny<IEnumerable<string>?>())).ReturnsAsync(0);

            var response = await Service(on: true).SaveDataGatewayConfigurationAsync(Update(NewValue));

            response.Errors.Should().Contain("ItemId", DataGatewayConfigurationService.NotMigratedMessage);
            _calls.Should().NotContain(new[] { "secret.Rotate", "secret.Set" });
        }

        [Fact]
        public async Task On_Update_RotateThenRootFails_Error_FlagAlreadySet_ResaveSameValueNoSecondRotate()
        {
            using var _ = new BlocksTestContext(Tenant);
            var id = _secrets.Add(Value);
            HasRoot(Root(id));
            var rootSetCalls = 0;
            _repo.Setup(r => r.SetDataGatewayRootFieldsAsync(Tenant, It.IsAny<BsonDocument>(), It.IsAny<IEnumerable<string>?>()))
                 .Returns<string, BsonDocument, IEnumerable<string>?>((_, set, _) =>
                 {
                     _calls.Add(set.Contains("DatabaseName") ? "root.set" : "root.flag");
                     if (set.Contains("DatabaseName") && ++rootSetCalls == 1) throw new TimeoutException("root timeout");
                     return Task.FromResult(1L);
                 });

            await FluentActions.Awaiting(() => Service(on: true).SaveDataGatewayConfigurationAsync(Update(NewValue)))
                .Should().ThrowAsync<TimeoutException>();
            _calls.Should().Equal("secret.Get", "secret.GetValue", "root.flag", "secret.Rotate", "root.set");
            _redis.Transactions.Should().Be(0);

            // The flag is on the doc now; a re-save with the same (new) value: no rotate, root + copy + redis.
            _calls.Clear();
            HasRoot(Root(id, flagged: true));
            var response = await Service(on: true).SaveDataGatewayConfigurationAsync(Update(NewValue));
            response.IsSuccess.Should().BeTrue();
            _calls.Should().Equal("secret.Get", "secret.GetValue", "root.set", "copy.set", "redis.HSET", "redis.HDEL:DbConnectionString", "redis.EXEC");
            _calls.Should().NotContain("secret.Delete");
            NoValueInLogs();
        }

        [Fact]
        public async Task On_Update_SetThenRootFails_Error_NewSecretNotDeleted()
        {
            using var _ = new BlocksTestContext(Tenant);
            HasRoot(Root(null));
            _repo.Setup(r => r.SetDataGatewayRootFieldsAsync(Tenant, It.Is<BsonDocument>(d => d.Contains("DatabaseName")), It.IsAny<IEnumerable<string>?>()))
                 .ThrowsAsync(new TimeoutException("root timeout"));

            await FluentActions.Awaiting(() => Service(on: true).SaveDataGatewayConfigurationAsync(Update(Value)))
                .Should().ThrowAsync<TimeoutException>();

            _calls.Should().Contain("secret.Set").And.NotContain("secret.Delete");
        }

        [Fact]
        public async Task On_Update_TenantCopyWriteFails_ErrorUp_RedisNotWritten()
        {
            using var _ = new BlocksTestContext(Tenant);
            HasRoot(Root(_secrets.Add(Value)));
            _repo.Setup(r => r.SetDataGatewayTenantCopyNonSecretAsync(It.IsAny<string>(), It.IsAny<BsonDocument>()))
                 .ThrowsAsync(new TimeoutException("copy timeout"));

            await FluentActions.Awaiting(() => Service(on: true).SaveDataGatewayConfigurationAsync(Update(Value)))
                .Should().ThrowAsync<TimeoutException>();

            _redis.Transactions.Should().Be(0);
        }

        [Fact]
        public async Task On_Update_VaultDownOnCompare_NotCaught_NothingWritten()
        {
            using var _ = new BlocksTestContext(Tenant);
            HasRoot(Root(_secrets.Add(Value)));
            _secrets.GetValueThrows = new SecretVaultException("vault down", "get", "id");

            await FluentActions.Awaiting(() => Service(on: true).SaveDataGatewayConfigurationAsync(Update(NewValue)))
                .Should().ThrowAsync<SecretVaultException>();

            _calls.Should().NotContain(new[] { "root.flag", "root.set", "copy.set" });
        }

        [Fact]
        public async Task On_Update_VaultDownOnRotate_OnlyTheFlagIsWritten()
        {
            using var _ = new BlocksTestContext(Tenant);
            HasRoot(Root(_secrets.Add(Value)));
            _secrets.RotateThrows = new SecretVaultException("vault down", "rotate", "id");

            await FluentActions.Awaiting(() => Service(on: true).SaveDataGatewayConfigurationAsync(Update(NewValue)))
                .Should().ThrowAsync<SecretVaultException>();

            _calls.Should().Contain("root.flag").And.NotContain(new[] { "root.set", "copy.set" });
            _redis.Transactions.Should().Be(0);
        }

        [Theory]
        [InlineData(false)]
        [InlineData(true)]
        public async Task On_Update_RedisFails_SaveAgainError_ResaveRewritesHashWithoutRotate(bool throws)
        {
            using var _ = new BlocksTestContext(Tenant);
            var id = _secrets.Add(Value);
            HasRoot(Root(id, flagged: true));
            if (throws) _redis.ExecuteThrows = new RedisConnectionException(ConnectionFailureType.UnableToConnect, "down");
            else _redis.CommitResult = false;

            var response = await Service(on: true).SaveDataGatewayConfigurationAsync(Update(NewValue));

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().Contain("Redis", DataGatewayConfigurationService.RedisFailedMessage);
            _redis.Hashes.Should().BeEmpty();

            _calls.Clear();
            _redis.ExecuteThrows = null;
            _redis.CommitResult = true;
            response = await Service(on: true).SaveDataGatewayConfigurationAsync(Update(NewValue));
            response.IsSuccess.Should().BeTrue();
            _calls.Should().NotContain("secret.Rotate");
            _redis.Hashes[Tenant]["DbConnectionSecretId"].Should().Be(id);
        }

        [Fact]
        public async Task On_Update_BodyProjectKeyOfOtherTenant_OnlyCallerRootAndRedis_ProjectKeyUnchanged()
        {
            using var _ = new BlocksTestContext(Tenant);
            HasRoot(Root(_secrets.Add(Value)));
            var request = Update(Value);
            request.ProjectKey = "other-tenant";

            await Service(on: true).SaveDataGatewayConfigurationAsync(request);

            _repo.Verify(r => r.GetDataGatewayRootAsync(Tenant), Times.Once);
            _repo.Verify(r => r.SetDataGatewayRootFieldsAsync(It.Is<string>(t => t != Tenant), It.IsAny<BsonDocument>(), It.IsAny<IEnumerable<string>?>()), Times.Never);
            _rootSets.Single().Names.Should().NotContain("ProjectKey");
            _redis.Hashes.Keys.Should().Equal(Tenant);
        }
    }
}
