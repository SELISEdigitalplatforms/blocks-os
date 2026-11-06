using System;
using System.Collections.Generic;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Blocks.Genesis.DataAccess;
using Blocks.Genesis.DataAccess.Evaluation;
using Blocks.Genesis.Entities.Data;
using Blocks.Genesis.Entities.Os;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Driver;
using Moq;
using Os.DataAccess;
using Xunit;

namespace XUnitTest.Services;

/// <summary>The resolver wrapper: granted/denied reads, mutation filters, insert gate, missing schema, skip path.</summary>
public class OsDataAccessTests : IDisposable
{
    private readonly Mock<IDataAccessResolver> _resolver = new();
    private readonly Mock<ILogger<OsDataAccess>> _logger = new();
    private readonly OsDataAccess _sut;

    private static readonly FilterDefinition<EmailTemplate> UserFilter = Builders<EmailTemplate>.Filter.Eq(r => r.ItemId, "r1");

    public OsDataAccessTests()
    {
        BlocksContext.IsTestMode = true;
        SetContext("t1", authenticated: true);
        _sut = new OsDataAccess(_resolver.Object, _logger.Object);
    }

    public void Dispose()
    {
        BlocksContext.SetContext(null);
        BlocksContext.IsTestMode = false;
    }

    private static void SetContext(string tenantId, bool authenticated) =>
        BlocksContext.SetContext(BlocksContext.Create(
            tenantId, new[] { "role" }, "user-1", authenticated, "uri", "org",
            DateTime.UtcNow.AddHours(1), "e@x.com", new[] { "perm" }, "octo",
            "phone", "display", "oauth", tenantId));

    private static PolicyEvaluationResult Result(bool granted) =>
        new() { IsAccessGranted = granted };

    private static BsonDocument Render(FilterDefinition<EmailTemplate> f) =>
        f.Render(new RenderArgs<EmailTemplate>(BsonSerializer.LookupSerializer<EmailTemplate>(), BsonSerializer.SerializerRegistry));

    private void VerifyLogged(LogLevel level, string text) =>
        _logger.Verify(l => l.Log(level, It.IsAny<EventId>(),
            It.Is<It.IsAnyType>((v, _) => v.ToString()!.Contains(text)), It.IsAny<Exception?>(),
            It.IsAny<Func<It.IsAnyType, Exception?, string>>()), Times.AtLeastOnce);

    [Fact]
    public async Task Read_Granted_UsesResolverFilterAndProjection()
    {
        var resolverFilter = new BsonDocument("$and", new BsonArray { new BsonDocument("ItemId", "r1"), new BsonDocument("OrganizationId", "org") });
        var projection = new BsonDocument("ItemId", 1);
        _resolver.Setup(r => r.ResolveReadAsync("EmailTemplate", It.IsAny<BsonDocument>(), null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(OsReflect.Read(Result(true), resolverFilter, projection));

        var scope = await _sut.ReadAsync(OsSchemas.EmailTemplate, UserFilter, "test");

        scope.Granted.Should().BeTrue();
        Render(scope.Filter).ToJson().Should().Be(resolverFilter.ToJson());
        scope.Projection.Should().NotBeNull();
        _resolver.Verify(r => r.ResolveReadAsync("EmailTemplate",
            It.Is<BsonDocument>(d => d.ToJson().Contains("r1")), null, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Read_Granted_WithoutProjectionFlag_DropsProjection()
    {
        _resolver.Setup(r => r.ResolveReadAsync(It.IsAny<string>(), It.IsAny<BsonDocument>(), null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(OsReflect.Read(Result(true), new BsonDocument("a", 1), new BsonDocument("a", 1)));

        var scope = await _sut.ReadAsync(OsSchemas.EmailTemplate, UserFilter, "test", useProjection: false);

        scope.Granted.Should().BeTrue();
        scope.Projection.Should().BeNull();
    }

    [Fact]
    public async Task Read_Denied_ReturnsNotGranted()
    {
        _resolver.Setup(r => r.ResolveReadAsync(It.IsAny<string>(), It.IsAny<BsonDocument>(), null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(OsReflect.Read(Result(false), null, null));

        (await _sut.ReadAsync(OsSchemas.EmailTemplate, UserFilter, "test")).Granted.Should().BeFalse();
    }

    [Fact]
    public async Task Edit_UsesResolverFilter_AndDeniedReturnsNull()
    {
        var resolverFilter = new BsonDocument("ItemId", "scoped");
        _resolver.Setup(r => r.ResolveMutationFilterAsync("EmailTemplate", PolicyOperation.EDIT, It.IsAny<BsonDocument>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ResolvedFilter(Result(true), resolverFilter));

        var filter = await _sut.EditFilterAsync(OsSchemas.EmailTemplate, UserFilter, "test");
        Render(filter!).ToJson().Should().Be(resolverFilter.ToJson());

        _resolver.Setup(r => r.ResolveMutationFilterAsync("EmailTemplate", PolicyOperation.EDIT, It.IsAny<BsonDocument>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ResolvedFilter(Result(false), null));
        (await _sut.EditFilterAsync(OsSchemas.EmailTemplate, UserFilter, "test")).Should().BeNull();
    }

    [Fact]
    public async Task Delete_UsesResolveDelete_AndDeniedReturnsNull()
    {
        var resolverFilter = new BsonDocument("ItemId", "scoped");
        _resolver.Setup(r => r.ResolveDeleteAsync("EmailTemplate", It.IsAny<BsonDocument>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ResolvedFilter(Result(true), resolverFilter));
        Render((await _sut.DeleteFilterAsync(OsSchemas.EmailTemplate, UserFilter, "test"))!).ToJson().Should().Be(resolverFilter.ToJson());

        _resolver.Setup(r => r.ResolveDeleteAsync("EmailTemplate", It.IsAny<BsonDocument>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ResolvedFilter(Result(false), null));
        (await _sut.DeleteFilterAsync(OsSchemas.EmailTemplate, UserFilter, "test")).Should().BeNull();
    }

    [Fact]
    public async Task Insert_IsAGateOnly()
    {
        _resolver.Setup(r => r.ResolveInsertAsync("ResourceLimit", It.IsAny<IDictionary<string, object?>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ResolvedInput(Result(true), new Dictionary<string, object?>(), []));
        (await _sut.InsertAllowedAsync(OsSchemas.ResourceLimit, "test")).Should().BeTrue();

        _resolver.Setup(r => r.ResolveInsertAsync("ResourceLimit", It.IsAny<IDictionary<string, object?>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ResolvedInput(Result(false), null, []));
        (await _sut.InsertAllowedAsync(OsSchemas.ResourceLimit, "test")).Should().BeFalse();
    }

    [Fact]
    public async Task MissingSchema_AllowsWithOriginalFilter_AndWarns()
    {
        _resolver.Setup(r => r.ResolveReadAsync(It.IsAny<string>(), It.IsAny<BsonDocument>(), null, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new KeyNotFoundException("Schema EmailTemplate was not found"));
        _resolver.Setup(r => r.ResolveMutationFilterAsync(It.IsAny<string>(), It.IsAny<PolicyOperation>(), It.IsAny<BsonDocument>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new KeyNotFoundException());
        _resolver.Setup(r => r.ResolveInsertAsync(It.IsAny<string>(), It.IsAny<IDictionary<string, object?>>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new KeyNotFoundException());

        var scope = await _sut.ReadAsync(OsSchemas.EmailTemplate, UserFilter, "test");
        scope.Granted.Should().BeTrue();
        scope.Filter.Should().BeSameAs(UserFilter);
        scope.Projection.Should().BeNull();
        (await _sut.EditFilterAsync(OsSchemas.EmailTemplate, UserFilter, "test")).Should().BeSameAs(UserFilter);
        (await _sut.InsertAllowedAsync(OsSchemas.EmailTemplate, "test")).Should().BeTrue();
        VerifyLogged(LogLevel.Warning, "EmailTemplate");
    }

    [Theory]
    [InlineData(false, null)]   // no authenticated user
    [InlineData(true, "other")] // another tenant's DB
    public async Task SkipPath_DoesNotCallResolver_AndLogsOnce(bool authenticated, string? targetTenant)
    {
        SetContext("t1", authenticated);

        var scope = await _sut.ReadAsync(OsSchemas.EmailTemplate, UserFilter, "site", targetTenant);
        await _sut.ReadAsync(OsSchemas.EmailTemplate, UserFilter, "site", targetTenant);
        (await _sut.EditFilterAsync(OsSchemas.EmailTemplate, UserFilter, "site2", targetTenant)).Should().BeSameAs(UserFilter);
        (await _sut.DeleteFilterAsync(OsSchemas.EmailTemplate, UserFilter, "site3", targetTenant)).Should().BeSameAs(UserFilter);
        (await _sut.InsertAllowedAsync(OsSchemas.EmailTemplate, "site4", targetTenant)).Should().BeTrue();

        scope.Granted.Should().BeTrue();
        scope.Filter.Should().BeSameAs(UserFilter);
        _resolver.VerifyNoOtherCalls();
        // "site" was hit twice but logged once.
        _logger.Verify(l => l.Log(LogLevel.Information, It.IsAny<EventId>(),
            It.Is<It.IsAnyType>((v, _) => v.ToString()!.Contains("site:") ), It.IsAny<Exception?>(),
            It.IsAny<Func<It.IsAnyType, Exception?, string>>()), Times.Once);
    }

    [Fact]
    public async Task NoContextAtAll_SkipsResolver()
    {
        BlocksContext.SetContext(null);
        (await _sut.EditFilterAsync(OsSchemas.EmailTemplate, UserFilter, "test")).Should().BeSameAs(UserFilter);
        _resolver.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task SameTenantTarget_UsesResolver()
    {
        _resolver.Setup(r => r.ResolveMutationFilterAsync(It.IsAny<string>(), PolicyOperation.EDIT, It.IsAny<BsonDocument>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ResolvedFilter(Result(true), new BsonDocument("x", 1)));
        await _sut.EditFilterAsync(OsSchemas.EmailTemplate, UserFilter, "test", "T1");
        _resolver.Verify(r => r.ResolveMutationFilterAsync("EmailTemplate", PolicyOperation.EDIT, It.IsAny<BsonDocument>(), It.IsAny<CancellationToken>()), Times.Once);
    }
}

/// <summary>ResolvedRead has an internal constructor (Genesis builds it); tests create it by reflection.</summary>
internal static class OsReflect
{
    public static ResolvedRead Read(PolicyEvaluationResult evaluation, BsonDocument? filter, BsonDocument? projection) =>
        (ResolvedRead)Activator.CreateInstance(typeof(ResolvedRead),
            BindingFlags.NonPublic | BindingFlags.Instance, null,
            new object?[] { evaluation, filter, projection, null }, null)!;
}
