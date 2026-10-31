using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Blocks.Secrets;
using BlocksOs.Api.Controllers;
using Configuration.DomainService.DataGateway.Entities;
using Configuration.DomainService.DataGateway.RequestModel;
using Configuration.DomainService.DataGateway.ResponseModel;
using Configuration.DomainService.DataGateway.Services;
using Configuration.DomainService.DataGateway.Validators;
using DomainService.Projects;
using FluentAssertions;
using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Bson;
using MongoDB.Driver;
using Moq;
using StackExchange.Redis;
using XUnitTest.TestHelpers;

namespace XUnitTest.Services
{
    /// <summary>In-memory secret service. Records every call in the shared log.</summary>
    internal sealed class FakeSecrets : ISecretService
    {
        private readonly List<string> _calls;
        private int _next;
        public FakeSecrets(List<string> calls) => _calls = calls;
        public ConcurrentDictionary<string, (string Status, string? Value)> Items { get; } = new();
        public List<SetSecretRequest> SetRequests { get; } = new();
        public List<string> Deleted { get; } = new();
        public List<string> SetTenants { get; } = new();
        public List<string> GetValueTenants { get; } = new();
        public List<string> DeleteTenants { get; } = new();
        public Exception? RotateThrows { get; set; }
        public Exception? GetThrows { get; set; }
        public Exception? GetValueThrows { get; set; }
        /// <summary>Runs inside SetAsync, after the secret exists: lets a test act between the secret and the write that follows.</summary>
        public Action? AfterSet { get; set; }

        public string Add(string value, string status = SecretStatuses.Active)
        {
            var id = "s" + Interlocked.Increment(ref _next);
            Items[id] = (status, value);
            return id;
        }

        public Task<string> SetAsync(SetSecretRequest request, CancellationToken cancellationToken = default)
        {
            _calls.Add("secret.Set");
            SetRequests.Add(request);
            SetTenants.Add(BlocksContext.GetContext()?.TenantId ?? "");
            var id = Add(request.Value);
            AfterSet?.Invoke();
            return Task.FromResult(id);
        }

        public Task<SecretResult?> GetAsync(string secretId, CancellationToken cancellationToken = default)
        {
            _calls.Add("secret.Get");
            if (GetThrows != null) throw GetThrows;
            return Task.FromResult(Items.TryGetValue(secretId, out var s)
                ? new SecretResult { SecretId = secretId, Status = s.Status, Type = SecretTypes.Service }
                : null);
        }

        public Task<string> GetValueAsync(string secretId, CancellationToken cancellationToken = default)
        {
            _calls.Add("secret.GetValue");
            GetValueTenants.Add(BlocksContext.GetContext()?.TenantId ?? "");
            if (GetValueThrows != null) throw GetValueThrows;
            if (!Items.TryGetValue(secretId, out var s)) throw new SecretNotFoundException(secretId);
            if (s.Status != SecretStatuses.Active) throw new SecretStateException(s.Status, "read value");
            return Task.FromResult(s.Value ?? "");
        }

        public Task RotateAsync(string secretId, RotateSecretRequest request, CancellationToken cancellationToken = default)
        {
            _calls.Add("secret.Rotate");
            if (RotateThrows != null) throw RotateThrows;
            Items[secretId] = (Items[secretId].Status, request.Value);
            return Task.CompletedTask;
        }

        public Task DeleteAsync(string secretId, CancellationToken cancellationToken = default)
        {
            _calls.Add("secret.Delete");
            Deleted.Add(secretId);
            DeleteTenants.Add(BlocksContext.GetContext()?.TenantId ?? "");
            return Task.CompletedTask;
        }

        public Task<IReadOnlyDictionary<string, string>> SetManyAsync(IReadOnlyCollection<SetSecretRequest> requests, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<SecretListResult> FindAsync(SecretFilter filter, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<IReadOnlyList<SecretTagEntry>> GetTagsAsync(CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<IReadOnlyDictionary<string, string>> GetValuesAsync(IReadOnlyCollection<string> secretIds, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task UpdateAsync(string secretId, UpdateSecretRequest request, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task LockAsync(string secretId, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task UnlockAsync(string secretId, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task RestoreAsync(string secretId, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task PurgeAsync(string secretId, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task UpdateAccessAsync(string secretId, SecretAccess access, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<SecretAuditListResult> GetAuditLogsAsync(SecretAuditFilter filter, CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }

    /// <summary>In-memory root store: one doc, a log, and switches for the failure cases.</summary>
    internal sealed class FakeRootStore : IDataGatewayRootStore
    {
        private readonly List<string> _calls;
        public FakeRootStore(List<string> calls) => _calls = calls;
        public DataServiceConfiguration? Doc { get; set; }
        public int Inserts { get; private set; }
        public BsonDocument? LastSet { get; private set; }
        public (string Secret, string Db, bool Custom, DateTime Stamp)? Hash { get; private set; }
        public bool InsertLosesRace { get; set; }
        public Func<DataServiceConfiguration>? WinnerDoc { get; set; }
        public Exception? SetThrows { get; set; }
        public Exception? HashThrows { get; set; }
        public bool SetMatches { get; set; } = true;

        public Task<DataServiceConfiguration?> GetRootAsync(string tenantId, bool includeDeleted = false) =>
            Task.FromResult(Doc is null || (Doc.IsDeleted && !includeDeleted) ? null : Doc);

        public Task<bool> TryInsertRootAsync(DataServiceConfiguration root)
        {
            _calls.Add("root.insert");
            Inserts++;
            if (InsertLosesRace)
            {
                Doc = WinnerDoc!();
                return Task.FromResult(false);
            }
            Doc = root;
            return Task.FromResult(true);
        }

        public Task<bool> SetRootFieldsAsync(string tenantId, BsonDocument set)
        {
            _calls.Add("root.set");
            if (SetThrows != null) throw SetThrows;
            LastSet = set;
            return Task.FromResult(SetMatches);
        }

        public Task WriteHashAsync(string tenantId, string secretId, string databaseName, bool isCustom, DateTime lastUpdatedUtc)
        {
            _calls.Add("redis.hash");
            if (HashThrows != null) throw HashThrows;
            Hash = (secretId, databaseName, isCustom, lastUpdatedUtc);
            return Task.CompletedTask;
        }
    }

    public class DataGatewayConfigurationServiceTests : IDisposable
    {
        private const string Tenant = "tenant-1";
        private const string Conn = "mongodb+srv://u:VERY-SECRET-PW@host/db";
        private const string Conn2 = "mongodb://u:OTHER-SECRET-PW@host2/db";

        private readonly List<string> _calls = new();
        private readonly FakeSecrets _secrets;
        private readonly FakeRootStore _store;

        public DataGatewayConfigurationServiceTests()
        {
            TestBlocksContext.Set(Tenant, "user-1");
            _secrets = new FakeSecrets(_calls);
            _store = new FakeRootStore(_calls);
        }

        public void Dispose() => TestBlocksContext.Clear();

        private DataGatewayConfigurationService Service() => new(
            _store, new DataGatewayConfigurationValidator(), _secrets, NullLogger<DataGatewayConfigurationService>.Instance);

        private DataServiceConfiguration Root(string secretId, string db = "crm") => new()
        {
            ItemId = Tenant, TenantId = Tenant, DbConnectionSecretId = secretId, DatabaseName = db,
            LastUpdatedDate = DateTime.UtcNow, AnalyticsConfiguration = new AnalyticsConfiguration { EnableAnalytics = true }
        };

        private static SaveDataGatewayConfigurationRequest Save(string? conn, string db = "crm", bool update = true) => new()
        {
            UpdateRequest = update, ItemId = update ? Tenant : null, ConnectionString = conn, DatabaseName = db, ProjectKey = "pk"
        };

        // ---- Save ----

        [Fact]
        public async Task Save_FirstSave_NoSecretId_SetsNewSecret_ThenDoc_ThenRedis()
        {
            _store.Doc = Root("");
            var response = await Service().SaveDataGatewayConfigurationAsync(Save(Conn));

            response.IsSuccess.Should().BeTrue();
            _calls.Should().ContainInOrder("secret.Set", "root.set", "redis.hash");
            _secrets.SetRequests.Single().Should().Match<SetSecretRequest>(r =>
                r.Name == "data-source" && r.Type == SecretTypes.Service && r.Value == Conn && r.OrganizationId == "default");
            _store.LastSet!["DbConnectionSecretId"].AsString.Should().Be(_secrets.Items.Keys.Single());
            _store.Hash!.Value.Custom.Should().BeTrue();
        }

        [Fact]
        public async Task Save_Later_RotatesSameSecret_NoNewSecret()
        {
            var id = _secrets.Add("default");
            _store.Doc = Root(id);

            (await Service().SaveDataGatewayConfigurationAsync(Save(Conn))).IsSuccess.Should().BeTrue();

            _calls.Should().NotContain("secret.Set");
            _calls.Should().Contain("secret.Rotate");
            _secrets.Items[id].Value.Should().Be(Conn);
            _store.LastSet!["DbConnectionSecretId"].AsString.Should().Be(id);
            _calls.Should().ContainInOrder("secret.Rotate", "root.set", "redis.hash");
        }

        [Theory]
        [InlineData(SecretStatuses.Deleted)]
        [InlineData("missing")]
        public async Task Save_BrokenSecret_Repairs_NewSecret_OldLeftAlone(string state)
        {
            var old = state == "missing" ? "gone" : _secrets.Add("x", state);
            _store.Doc = Root(old);

            (await Service().SaveDataGatewayConfigurationAsync(Save(Conn))).IsSuccess.Should().BeTrue();

            _calls.Should().Contain("secret.Set").And.NotContain("secret.Rotate");
            _secrets.Deleted.Should().BeEmpty();
            _store.LastSet!["DbConnectionSecretId"].AsString.Should().NotBe(old);
        }

        [Fact]
        public async Task Save_Repair_DocWriteFails_DeletesOwnNewSecret_AndRethrows()
        {
            _store.Doc = Root("gone");
            _store.SetThrows = new InvalidOperationException("db down");

            var act = () => Service().SaveDataGatewayConfigurationAsync(Save(Conn));

            await act.Should().ThrowAsync<InvalidOperationException>();
            _secrets.Deleted.Should().ContainSingle().Which.Should().Be(_secrets.Items.Keys.Single());
            _calls.Should().NotContain("redis.hash");
        }

        [Fact]
        public async Task Save_Repair_DocVanished_DeletesOwnSecret_404()
        {
            _store.Doc = Root("gone");
            _store.SetMatches = false;

            var response = await Service().SaveDataGatewayConfigurationAsync(Save(Conn));

            response.IsSuccess.Should().BeFalse();
            response.Errors!["ItemId"].Should().Be(DataGatewayConfigurationService.NotFoundMessage);
            _secrets.Deleted.Should().HaveCount(1);
            _calls.Should().NotContain("redis.hash");
        }

        [Fact]
        public async Task Save_RotateFails_DocAndRedisUntouched()
        {
            var id = _secrets.Add(Conn);
            _store.Doc = Root(id);
            _secrets.RotateThrows = new InvalidOperationException("vault down");

            var act = () => Service().SaveDataGatewayConfigurationAsync(Save(Conn2));

            await act.Should().ThrowAsync<InvalidOperationException>();
            _calls.Should().NotContain("root.set").And.NotContain("redis.hash");
        }

        [Fact]
        public async Task Save_NullConnectionString_OnCustom_KeepsSecret_HashStaysCustom()
        {
            var id = _secrets.Add(Conn);
            _store.Doc = Root(id);

            (await Service().SaveDataGatewayConfigurationAsync(Save(null, "crm2"))).IsSuccess.Should().BeTrue();

            _calls.Should().NotContain("secret.Set").And.NotContain("secret.Rotate");
            _secrets.Items[id].Value.Should().Be(Conn);
            _store.LastSet!["DatabaseName"].AsString.Should().Be("crm2");
            _store.Hash!.Value.Custom.Should().BeTrue();
        }

        [Fact]
        public async Task Save_SwitchDefaultToCustom_AndBack()
        {
            var id = _secrets.Add("default");
            _store.Doc = Root(id, "default");

            await Service().SaveDataGatewayConfigurationAsync(Save(Conn, "crm"));
            _secrets.Items[id].Value.Should().Be(Conn);
            _store.Hash!.Value.Custom.Should().BeTrue();

            await Service().SaveDataGatewayConfigurationAsync(Save("default", "default"));
            _secrets.Items[id].Value.Should().Be("default");
            _store.Hash!.Value.Custom.Should().BeFalse();
            _store.Hash!.Value.Secret.Should().Be(id);
        }

        [Theory]
        [InlineData("")]
        [InlineData("  ")]
        [InlineData("DEFAULT")]
        public async Task Save_BlankOrDefault_StoresDefaultText(string value)
        {
            var id = _secrets.Add(Conn);
            _store.Doc = Root(id);

            await Service().SaveDataGatewayConfigurationAsync(Save(value, "default"));

            _secrets.Items[id].Value.Should().Be("default");
            _store.Hash!.Value.Custom.Should().BeFalse();
        }

        [Fact]
        public async Task Save_UnparsableString_Refused_NoSecretNoDoc_ValueNotEchoed()
        {
            _store.Doc = Root(_secrets.Add("default"));

            var response = await Service().SaveDataGatewayConfigurationAsync(Save("not a mongo string PW123"));

            response.IsSuccess.Should().BeFalse();
            response.Errors!["ConnectionString"].Should().Be("ConnectionString_Is_Invalid.");
            JsonSerializer.Serialize(response).Should().NotContain("PW123");
            _calls.Should().NotContain(c => c.StartsWith("secret.Rotate") || c == "secret.Set" || c == "root.set");
        }

        [Fact]
        public async Task Save_CustomWithoutDatabaseName_Refused()
        {
            _store.Doc = Root(_secrets.Add("default"));
            var response = await Service().SaveDataGatewayConfigurationAsync(Save(Conn, ""));
            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("DatabaseName");
        }

        [Fact]
        public async Task Save_ItemIdOfAnotherTenant_404_NothingWritten()
        {
            _store.Doc = Root(_secrets.Add("default"));
            var request = Save(Conn);
            request.ItemId = "other-tenant";

            var response = await Service().SaveDataGatewayConfigurationAsync(request);

            response.Errors!["ItemId"].Should().Be(DataGatewayConfigurationService.NotFoundMessage);
            _calls.Should().NotContain("secret.Rotate").And.NotContain("root.set");
        }

        [Fact]
        public async Task Save_SoftDeletedRoot_404()
        {
            var doc = Root(_secrets.Add("default"));
            doc.IsDeleted = true;
            _store.Doc = doc;
            var response = await Service().SaveDataGatewayConfigurationAsync(Save(Conn));
            response.IsSuccess.Should().BeFalse();
            _store.Inserts.Should().Be(0);
        }

        [Fact]
        public async Task Save_RedisFails_ReportsSaveAgain_DocAlreadyWritten()
        {
            _store.Doc = Root(_secrets.Add("default"));
            _store.HashThrows = new InvalidOperationException("redis down");

            var response = await Service().SaveDataGatewayConfigurationAsync(Save(Conn));

            response.IsSuccess.Should().BeFalse();
            response.Errors!["Redis"].Should().Be(DataGatewayConfigurationService.RedisFailedMessage);
            _calls.Should().ContainInOrder("secret.Rotate", "root.set", "redis.hash");
        }

        [Fact]
        public async Task Save_WritesNoOldModelFields_AndFieldSetOnly()
        {
            _store.Doc = Root(_secrets.Add("default"));
            await Service().SaveDataGatewayConfigurationAsync(Save(Conn));
            _store.LastSet!.Names.Should().NotContain(new[] { "DbConnectionString", "ConfigItemId", "ValueChangedAfterDeploy", "RootConfigEnabled", "_id", "ItemId" });
        }

        // ---- Get ----

        [Fact]
        public async Task Get_Custom_ReturnsTypeAndItemId_NeverTheValue()
        {
            _store.Doc = Root(_secrets.Add(Conn));
            var result = await Service().GetDataGatewayConfigurationAsync();

            result!.ConnectionType.Should().Be("Custom");
            result.ItemId.Should().Be(Tenant);
            var json = JsonSerializer.Serialize(result);
            json.Should().NotContain("VERY-SECRET-PW").And.NotContain("mongodb").And.NotContain("onnectionString");
        }

        [Fact]
        public async Task Get_Default_ReturnsDefault()
        {
            _store.Doc = Root(_secrets.Add("default"));
            (await Service().GetDataGatewayConfigurationAsync())!.ConnectionType.Should().Be("Default");
        }

        [Theory]
        [InlineData(SecretStatuses.Locked)]
        [InlineData(SecretStatuses.Deleted)]
        [InlineData("missing")]
        public async Task Get_BrokenSecret_LooksCustom_NotBlocksDb(string state)
        {
            _store.Doc = Root(state == "missing" ? "gone" : _secrets.Add("default", state));
            (await Service().GetDataGatewayConfigurationAsync())!.ConnectionType.Should().Be("Custom");
        }

        [Fact]
        public async Task Get_VaultDown_Fails_NotDefault()
        {
            _store.Doc = Root(_secrets.Add("default"));
            _secrets.GetThrows = new InvalidOperationException("vault down");
            var act = () => Service().GetDataGatewayConfigurationAsync();
            await act.Should().ThrowAsync<InvalidOperationException>();
        }

        [Fact]
        public async Task Get_NoRootDoc_CreatesDefaultDocAndSecret_SecretFirst()
        {
            var result = await Service().GetDataGatewayConfigurationAsync();

            _calls.Should().ContainInOrder("secret.Set", "root.insert");
            _secrets.SetRequests.Single().Value.Should().Be("default");
            _secrets.SetRequests.Single().Name.Should().Be("data-source");
            var doc = _store.Doc!;
            doc.ItemId.Should().Be(Tenant);
            doc.TenantId.Should().Be(Tenant);
            doc.DatabaseName.Should().Be("default");
            doc.IsCollectionNameEditable.Should().BeFalse();
            doc.CollectionNamePattern.Should().Be("sb_{SchemaName}s");
            doc.AnalyticsConfiguration.Should().BeNull();
            doc.DbConnectionSecretId.Should().Be(_secrets.Items.Keys.Single());
            doc.LastUpdatedDate.Ticks.Should().Be(doc.LastUpdatedDate.Ticks - doc.LastUpdatedDate.Ticks % TimeSpan.TicksPerMillisecond);
            result!.ConnectionType.Should().Be("Default");
        }

        [Fact]
        public async Task Get_NoRootDoc_ParallelRace_LoserDeletesOwnSecret_UsesWinnersDoc()
        {
            var winnerSecret = _secrets.Add("default");
            _store.InsertLosesRace = true;
            _store.WinnerDoc = () => Root(winnerSecret, "winner-db");

            var result = await Service().GetDataGatewayConfigurationAsync();

            _secrets.Deleted.Should().ContainSingle().Which.Should().NotBe(winnerSecret);
            result!.DatabaseName.Should().Be("winner-db");
            _store.Inserts.Should().Be(1);
        }

        [Fact]
        public async Task Get_NoRootDoc_InsertFails_DeletesOwnSecret_AndRethrows()
        {
            var failing = new Mock<IDataGatewayRootStore>();
            failing.Setup(s => s.GetRootAsync(It.IsAny<string>(), It.IsAny<bool>())).ReturnsAsync((DataServiceConfiguration?)null);
            failing.Setup(s => s.TryInsertRootAsync(It.IsAny<DataServiceConfiguration>())).ThrowsAsync(new InvalidOperationException("db"));
            var service = new DataGatewayConfigurationService(failing.Object, new DataGatewayConfigurationValidator(), _secrets, NullLogger<DataGatewayConfigurationService>.Instance);

            var act = () => service.GetDataGatewayConfigurationAsync();

            await act.Should().ThrowAsync<InvalidOperationException>();
            _secrets.Deleted.Should().HaveCount(1);
        }

        [Fact]
        public async Task Get_SoftDeletedRoot_ReturnsNull_CreatesNothing()
        {
            var doc = Root(_secrets.Add("default"));
            doc.IsDeleted = true;
            _store.Doc = doc;
            (await Service().GetDataGatewayConfigurationAsync()).Should().BeNull();
            _store.Inserts.Should().Be(0);
        }

        // ---- Redis hash shape ----

        [Fact]
        public async Task WriteHash_ExactShape_KeyIsTenantId()
        {
            var cache = new Mock<ICacheClient>();
            var calls = new List<string>();
            HashEntry[]? written = null;
            cache.Setup(c => c.KeyExistsAsync("t-9")).ReturnsAsync(true);
            cache.Setup(c => c.RemoveKeyAsync("t-9")).Callback(() => calls.Add("remove")).ReturnsAsync(true);
            cache.Setup(c => c.AddHashValueAsync("t-9", It.IsAny<IEnumerable<HashEntry>>()))
                 .Callback<string, IEnumerable<HashEntry>>((_, e) => { calls.Add("add"); written = e.ToArray(); }).ReturnsAsync(true);
            var store = new DataGatewayRootStore(Mock.Of<IDbContextProvider>(), Mock.Of<IBlocksSecret>(), cache.Object);
            var stamp = new DateTime(2026, 10, 15, 8, 0, 0, DateTimeKind.Utc).AddTicks(1234567);

            await store.WriteHashAsync("t-9", "sec-1", "crm", true, stamp);

            calls.Should().Equal("remove", "add");
            written!.Select(e => (e.Name.ToString(), e.Value.ToString())).Should().Equal(
                ("DbConnectionSecretId", "sec-1"),
                ("DatabaseName", "crm"),
                ("ConnectionType", "Custom"),
                ("Version", (stamp.Ticks - stamp.Ticks % TimeSpan.TicksPerMillisecond).ToString()));
            written!.Select(e => e.Name.ToString()).Should().NotContain("DbConnectionString");
        }

        [Fact]
        public async Task WriteHash_Default_TypeDefault_NoRemoveWhenKeyMissing()
        {
            var cache = new Mock<ICacheClient>();
            HashEntry[]? written = null;
            cache.Setup(c => c.KeyExistsAsync("t")).ReturnsAsync(false);
            cache.Setup(c => c.AddHashValueAsync("t", It.IsAny<IEnumerable<HashEntry>>()))
                 .Callback<string, IEnumerable<HashEntry>>((_, e) => written = e.ToArray()).ReturnsAsync(true);
            var store = new DataGatewayRootStore(Mock.Of<IDbContextProvider>(), Mock.Of<IBlocksSecret>(), cache.Object);

            await store.WriteHashAsync("t", "s", "default", false, DateTime.UtcNow);

            written!.Single(e => e.Name == "ConnectionType").Value.ToString().Should().Be("Default");
            cache.Verify(c => c.RemoveKeyAsync(It.IsAny<string>()), Times.Never);
        }

        // ---- Validator ----

        [Theory]
        [InlineData(null, true)]
        [InlineData("", true)]
        [InlineData("default", true)]
        [InlineData(Conn, true)]
        [InlineData("garbage", false)]
        public void IsValidOrDefault(string? value, bool expected) =>
            DataGatewayConfigurationService.IsValidOrDefault(value).Should().Be(expected);

        [Fact]
        public void Validator_UpdateNeedsItemId()
        {
            var result = new DataGatewayConfigurationValidator().Validate(new SaveDataGatewayConfigurationRequest { UpdateRequest = true });
            result.Errors.Should().Contain(e => e.PropertyName == "ItemId");
        }

        // ---- Controller ----

        [Fact]
        public async Task Controller_Get_Ok_And_NotFoundWhenDeleted()
        {
            var service = new Mock<IDataGatewayConfigurationService>();
            service.Setup(s => s.GetDataGatewayConfigurationAsync()).ReturnsAsync(new DataGatewayConfigurationResponse { ItemId = "t" });
            (await new DataGatewayController(service.Object).GetConfig()).Result.Should().BeOfType<OkObjectResult>();

            service.Setup(s => s.GetDataGatewayConfigurationAsync()).ReturnsAsync((DataGatewayConfigurationResponse?)null);
            (await new DataGatewayController(service.Object).GetConfig()).Result.Should().BeOfType<NotFoundResult>();
        }

        [Theory]
        [InlineData(true, null, 200)]
        [InlineData(false, "ConnectionString", 400)]
        [InlineData(false, "ItemId", 404)]
        public async Task Controller_Save_MapsStatus(bool ok, string? errorKey, int status)
        {
            var service = new Mock<IDataGatewayConfigurationService>();
            var errors = errorKey is null ? null : new Dictionary<string, string>
            {
                { errorKey, errorKey == "ItemId" ? DataGatewayConfigurationService.NotFoundMessage : "ConnectionString_Is_Invalid." }
            };
            service.Setup(s => s.SaveDataGatewayConfigurationAsync(It.IsAny<SaveDataGatewayConfigurationRequest>()))
                   .ReturnsAsync(new BaseMutationResponse { IsSuccess = ok, Errors = errors });

            var result = await new DataGatewayController(service.Object).SaveConfig(new SaveDataGatewayConfigurationRequest());

            ((ObjectResult)result).StatusCode.Should().Be(status);
        }
    }

    /// <summary>Project create: default root doc + secret for the NEW tenant.</summary>
    public class DataGatewayRootProvisionerTests : IDisposable
    {
        private readonly List<string> _calls = new();
        private readonly FakeSecrets _secrets;
        private readonly Mock<IMongoCollection<BsonDocument>> _collection = new();
        private readonly List<BsonDocument> _inserted = new();

        public DataGatewayRootProvisionerTests()
        {
            TestBlocksContext.Set("creator-tenant", "creator");
            _secrets = new FakeSecrets(_calls);
        }

        public void Dispose() => TestBlocksContext.Clear();

        private DataGatewayRootProvisioner Provisioner(long existing, Func<Task>? insert = null)
        {
            _collection.Setup(c => c.CountDocumentsAsync(It.IsAny<FilterDefinition<BsonDocument>>(), It.IsAny<CountOptions>(), default))
                       .ReturnsAsync(existing);
            _collection.Setup(c => c.InsertOneAsync(It.IsAny<BsonDocument>(), null, default))
                       .Callback<BsonDocument, InsertOneOptions, CancellationToken>((d, _, _) => { _calls.Add("root.insert"); _inserted.Add(d); })
                       .Returns(() => insert?.Invoke() ?? Task.CompletedTask);
            var database = new Mock<IMongoDatabase>();
            database.Setup(d => d.GetCollection<BsonDocument>("DataServiceConfigurations", null)).Returns(_collection.Object);
            var provider = new Mock<IDbContextProvider>();
            provider.Setup(p => p.GetDatabase("conn", "BlocksRootDb")).Returns(database.Object);
            var blocksSecret = new Mock<IBlocksSecret>();
            blocksSecret.SetupGet(s => s.DatabaseConnectionString).Returns("conn");
            blocksSecret.SetupGet(s => s.RootDatabaseName).Returns("BlocksRootDb");
            var services = new ServiceCollection().AddSingleton<ISecretService>(_secrets).BuildServiceProvider();
            return new DataGatewayRootProvisioner(provider.Object, blocksSecret.Object, services.GetRequiredService<IServiceScopeFactory>());
        }

        [Fact]
        public async Task Ensure_NewTenant_SecretInNewTenantContext_ThenSeedDoc()
        {
            await Provisioner(0).EnsureAsync("new-tenant", "creator");

            _calls.Should().ContainInOrder("secret.Set", "root.insert");
            _secrets.SetTenants.Single().Should().Be("new-tenant");
            _secrets.SetRequests.Single().Should().Match<SetSecretRequest>(r =>
                r.Name == "data-source" && r.Type == SecretTypes.Service && r.Value == "default");
            var doc = _inserted.Single();
            doc["_id"].AsString.Should().Be("new-tenant");
            doc["TenantId"].AsString.Should().Be("new-tenant");
            doc["DbConnectionSecretId"].AsString.Should().Be(_secrets.Items.Keys.Single());
            doc["DatabaseName"].AsString.Should().Be("default");
            doc["IsCollectionNameEditable"].AsBoolean.Should().BeFalse();
            doc["CollectionNamePattern"].AsString.Should().Be("sb_{SchemaName}s");
            doc["ProjectKey"].AsString.Should().BeEmpty();
            doc["ProjectShortKey"].AsString.Should().BeEmpty();
            doc["IsDeleted"].AsBoolean.Should().BeFalse();
            doc.Names.Should().NotContain(new[] { "DbConnectionString", "ConfigItemId", "ValueChangedAfterDeploy", "AnalyticsConfiguration" });
        }

        [Fact]
        public async Task Ensure_ExistingDoc_NoSecret_NoInsert()
        {
            await Provisioner(1).EnsureAsync("new-tenant", "creator");
            _calls.Should().BeEmpty();
        }

        [Fact]
        public async Task Ensure_DuplicateKey_DeletesOwnSecret()
        {
            // WriteError has no public constructor: build a DuplicateKey (code 11000) through the driver's own one.
            var ctor = typeof(WriteError).GetConstructors(System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)
                .First(c => c.GetParameters().Length == 4);
            var writeError = (WriteError)ctor.Invoke(new object?[] { ServerErrorCategory.DuplicateKey, 11000, "duplicate key", new BsonDocument() });
            var ex = new MongoWriteException(new MongoDB.Driver.Core.Connections.ConnectionId(new MongoDB.Driver.Core.Servers.ServerId(new MongoDB.Driver.Core.Clusters.ClusterId(), new System.Net.DnsEndPoint("h", 1))), writeError, null!, null!);

            await Provisioner(0, () => throw ex).EnsureAsync("new-tenant", "creator");

            _secrets.Deleted.Should().ContainSingle();
        }

        [Fact]
        public async Task Ensure_InsertFails_DeletesOwnSecret_AndRethrows()
        {
            var act = () => Provisioner(0, () => throw new InvalidOperationException("db")).EnsureAsync("new-tenant", "creator");
            await act.Should().ThrowAsync<InvalidOperationException>();
            _secrets.Deleted.Should().ContainSingle();
        }

        [Fact]
        public async Task Ensure_BlankTenant_Refused()
        {
            var act = () => Provisioner(0).EnsureAsync(" ", "creator");
            await act.Should().ThrowAsync<ArgumentException>();
            _calls.Should().BeEmpty();
        }
    }
}
