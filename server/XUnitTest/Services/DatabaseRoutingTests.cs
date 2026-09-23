using Blocks.Genesis;
using DomainService.Entities;
using DomainService.ManagedService.Services;
using DomainService.Migration.Entities;
using DomainService.Migration.Services;
using DomainService.Projects;
using DomainService.Shared;
using DomainService.Shared.Entities;
using DomainService.Shared.Services;
using Microsoft.Extensions.Configuration;
using MongoDB.Bson;
using MongoDB.Driver;
using Moq;
using XUnitTest.TestSupport;

namespace XUnitTest.Services;

public class DatabaseRoutingTests
{
    [Fact]
    public async Task ProjectProvisioning_KeepsRegistryAndTemplatesOnMain_AndWritesStoredPlacement()
    {
        using var context = new BlocksTestContext(tenantId: "unrelated-dev-caller");
        var provider = new Mock<IDbContextProvider>(MockBehavior.Strict);
        var secret = new BlocksSecret { DatabaseConnectionString = "mongodb://main", RootDatabaseName = "custom-root" };
        var root = new Mock<IMongoDatabase>(MockBehavior.Strict);
        var source = new Mock<IMongoDatabase>(MockBehavior.Strict);
        var target = new Mock<IMongoDatabase>(MockBehavior.Strict);
        var registry = new Mock<IMongoCollection<Tenant>>();
        var writes = new List<string>();
        provider.Setup(p => p.GetDatabase("mongodb://main", "custom-root", false)).Returns(root.Object);
        provider.Setup(p => p.GetDatabase("mongodb://main", "BlocksConfiguration", false)).Returns(source.Object);
        provider.Setup(p => p.GetDatabase("mongodb://other", "environment-db", false)).Returns(target.Object);
        root.Setup(d => d.GetCollection<Tenant>("Tenants", null)).Returns(registry.Object);
        source.Setup(d => d.GetCollection<BsonDocument>(It.IsAny<string>(), null))
            .Returns((string name, MongoCollectionSettings _) =>
            {
                var collection = new Mock<IMongoCollection<BsonDocument>>();
                collection.Setup(c => c.FindAsync(It.IsAny<FilterDefinition<BsonDocument>>(), It.IsAny<FindOptions<BsonDocument, BsonDocument>>(), default))
                    .ReturnsAsync(() => Cursor(name is "Roles" or "Permissions" or "StorageConfigurations"
                        ? new[] { new BsonDocument("_id", name) } : Array.Empty<BsonDocument>()));
                return collection.Object;
            });
        target.Setup(d => d.ListCollectionNames(It.IsAny<ListCollectionNamesOptions>(), default))
            .Returns(() => Cursor(Array.Empty<string>()));
        target.Setup(d => d.GetCollection<BsonDocument>(It.IsAny<string>(), null))
            .Returns((string name, MongoCollectionSettings _) =>
            {
                var collection = new Mock<IMongoCollection<BsonDocument>>();
                collection.Setup(c => c.InsertOneAsync(It.IsAny<BsonDocument>(), null, default))
                    .Callback(() => { lock (writes) writes.Add(name); }).Returns(Task.CompletedTask);
                collection.Setup(c => c.InsertManyAsync(It.IsAny<IEnumerable<BsonDocument>>(), null, default))
                    .Callback(() => { lock (writes) writes.Add(name); }).Returns(Task.CompletedTask);
                return collection.Object;
            });
        var encoding = new Mock<IEncodingService>();
        encoding.Setup(e => e.EncodeToBase26Async(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int>())).ReturnsAsync("abc");
        var repository = new ProjectRepository(provider.Object, new ConfigurationBuilder().Build(), secret, encoding.Object);
        var tenant = new Tenant
        {
            TenantId = "new-stg", TenantGroupId = "group", Environment = "stg", Name = "Placement test",
            DbConnectionString = "mongodb://other", DBName = "environment-db", CreatedBy = "creator",
            JwtTokenParameters = new JwtTokenParameters { PrivateCertificatePassword = "", IssueDate = DateTime.UtcNow }
        };

        // Repos are seeded before registry insertion; tenant-id lookup cannot be used yet.
        await repository.SaveRepoInfoAsync(tenant, [new Resource { ResourceId = "repo", Name = "Repo", Link = "https://example.com/repo" }]);
        await repository.InsertProjectAsync(tenant);
        await repository.CreateDefaultConfigurationAsync(new ProjectStatusTracer { ProjectId = tenant.TenantId }, tenant);

        Assert.Contains("Repos", writes);
        Assert.Contains("Roles", writes);
        Assert.Contains("Permissions", writes);
        Assert.Contains("StorageConfigurations", writes);
        registry.Verify(c => c.InsertOneAsync(tenant, null, default), Times.Once);
        provider.Verify(p => p.GetDatabase(It.IsAny<string>()), Times.Never);
        root.Verify(d => d.GetCollection<BsonDocument>(It.IsAny<string>(), null), Times.Never);
        provider.Verify(p => p.GetDatabase("mongodb://main", "environment-db", false), Times.Never);
    }

    [Fact]
    public async Task MigrationRepository_ReusedInstance_ResolvesEachOperationsOwner()
    {
        var provider = new Mock<IDbContextProvider>(MockBehavior.Strict);
        var first = new Mock<IMongoCollection<MigrationTracker>>();
        var second = new Mock<IMongoCollection<MigrationTracker>>();
        provider.Setup(p => p.GetCollection<MigrationTracker>(IdentifierConstants.MigrationTrackerCollectionName))
            .Returns(() => BlocksContext.GetContext().TenantId == "dev" ? first.Object : second.Object);
        var repository = new MigrationRepository(provider.Object, new BlocksSecret());
        provider.VerifyNoOtherCalls(); // Construction must not capture a tenant collection.
        var gate = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        async Task Write(string tenant)
        {
            using var context = new BlocksTestContext(tenantId: tenant);
            await gate.Task;
            await repository.CreateMigrationTrackerAsync(new MigrationTracker
            {
                ItemId = tenant, ProjectKey = "source", TargetedProjectKey = "target", TenantGroupId = "group"
            });
        }
        var pending = new[] { Write("dev"), Write("stg") };
        gate.SetResult(true);
        await Task.WhenAll(pending);

        first.Verify(c => c.InsertOneAsync(It.Is<MigrationTracker>(t => t.ItemId == "dev"), null, default), Times.Once);
        second.Verify(c => c.InsertOneAsync(It.Is<MigrationTracker>(t => t.ItemId == "stg"), null, default), Times.Once);
        first.Verify(c => c.InsertOneAsync(It.Is<MigrationTracker>(t => t.ItemId == "stg"), null, default), Times.Never);
        second.Verify(c => c.InsertOneAsync(It.Is<MigrationTracker>(t => t.ItemId == "dev"), null, default), Times.Never);
    }

    [Fact]
    public async Task ManagedServiceRepository_ReusedInstance_RoutesTenantsAndImpersonationSeparately()
    {
        var provider = new Mock<IDbContextProvider>(MockBehavior.Strict);
        var secret = new BlocksSecret { DatabaseConnectionString = "mongodb://main", RootDatabaseName = "custom-root" };
        var destinations = new Dictionary<string, Mock<IMongoCollection<BlocksManagedService>>>();
        foreach (var owner in new[] { "dev", "stg", "root" })
        {
            var collection = new Mock<IMongoCollection<BlocksManagedService>>();
            var database = new Mock<IMongoDatabase>();
            database.Setup(d => d.GetCollection<BlocksManagedService>("BlocksManagedServices", null)).Returns(collection.Object);
            destinations.Add(owner, collection);
            if (owner == "root") provider.Setup(p => p.GetDatabase("mongodb://main", "custom-root", false)).Returns(database.Object);
            else provider.Setup(p => p.GetDatabase(owner)).Returns(database.Object);
        }
        var repository = new ServiceManagementRepository(provider.Object, secret);
        var gate = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        async Task Write(string owner)
        {
            using var context = new BlocksTestContext(tenantId: owner == "root" ? "dev" : owner, impersonated: owner == "root");
            await gate.Task;
            await repository.SaveAsync(new BlocksManagedService { ItemId = owner });
        }
        var tasks = destinations.Keys.Select(Write).ToArray();
        gate.SetResult(true);
        await Task.WhenAll(tasks);

        foreach (var (owner, collection) in destinations)
        {
            collection.Verify(c => c.InsertOneAsync(It.Is<BlocksManagedService>(s => s.ItemId == owner), null, default), Times.Once);
            collection.Verify(c => c.InsertOneAsync(It.Is<BlocksManagedService>(s => s.ItemId != owner), null, default), Times.Never);
        }
    }

    private static IAsyncCursor<T> Cursor<T>(IEnumerable<T> items)
    {
        var cursor = new Mock<IAsyncCursor<T>>();
        cursor.SetupGet(c => c.Current).Returns(items);
        cursor.SetupSequence(c => c.MoveNext(default)).Returns(true).Returns(false);
        cursor.SetupSequence(c => c.MoveNextAsync(default)).ReturnsAsync(true).ReturnsAsync(false);
        return cursor.Object;
    }
}
