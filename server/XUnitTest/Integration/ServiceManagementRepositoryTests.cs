using System;
using System.Linq;
using System.Threading.Tasks;
using Blocks.Genesis;
using DomainService.ManagedService;
using DomainService.ManagedService.Services;
using DomainService.Shared;
using DomainService.Shared.Entities;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Driver;
using Moq;
using XUnitTest.TestSupport;

namespace XUnitTest.Integration
{
    [Collection(MongoIntegrationCollection.Name)]
    public class ServiceManagementRepositoryTests
    {
        private readonly MongoIntegrationFixture _fixture;

        public ServiceManagementRepositoryTests(MongoIntegrationFixture fixture)
        {
            _fixture = fixture;
        }

        private ServiceManagementRepository NewRepository()
        {
            var secret = new Mock<IBlocksSecret>();
            secret.SetupGet(s => s.DatabaseConnectionString).Returns("mongodb://localhost:27017");
            secret.SetupGet(s => s.RootDatabaseName).Returns(IdentifierConstants.RootDatabaseName);
            // The shared fixture resolves root and tenant to one database, so every caller is the
            // root tenant here: no tenant copy (it would hit the same _id).
            var tenants = new Mock<ITenants>();
            tenants.Setup(t => t.GetTenantByID(It.IsAny<string>())).Returns(new Tenant
            {
                IsRootTenant = true,
                DbConnectionString = "mongodb://x",
                JwtTokenParameters = new JwtTokenParameters { IssueDate = DateTime.UtcNow, PrivateCertificatePassword = "p" }
            });
            return new ServiceManagementRepository(
                _fixture.DbContextProvider, secret.Object, tenants.Object, NullLogger<ServiceManagementRepository>.Instance);
        }

        private sealed class RootAndTenantDbs : IDisposable
        {
            private readonly SplitDatabaseContextProvider _provider;
            public RootAndTenantDbs(MongoIntegrationFixture fixture, string tenant)
            {
                TenantDbName = "tenantdb_" + tenant;
                _provider = new SplitDatabaseContextProvider(fixture.Client, fixture.Database, TenantDbName);
                Root = fixture.Database.GetCollection<BlocksManagedService>("BlocksManagedServices");
                Tenant = fixture.Client.GetDatabase(TenantDbName).GetCollection<BlocksManagedService>("BlocksManagedServices");
                Db = fixture.Client.GetDatabase(TenantDbName);
            }
            public string TenantDbName { get; }
            public SplitDatabaseContextProvider Provider => _provider;
            public IMongoCollection<BlocksManagedService> Root { get; }
            public IMongoCollection<BlocksManagedService> Tenant { get; }
            public IMongoDatabase Db { get; }
            public void Dispose() => _provider.Drop();
        }

        private static ServiceManagementRepository SplitRepository(IDbContextProvider provider, bool tenantIsRoot, ILogger<ServiceManagementRepository>? logger = null)
        {
            var secret = new Mock<IBlocksSecret>();
            secret.SetupGet(s => s.DatabaseConnectionString).Returns("mongodb://localhost:27017");
            secret.SetupGet(s => s.RootDatabaseName).Returns(IdentifierConstants.RootDatabaseName);
            var tenants = new Mock<ITenants>();
            tenants.Setup(t => t.GetTenantByID(It.IsAny<string>())).Returns(new Tenant
            {
                IsRootTenant = tenantIsRoot,
                DbConnectionString = "mongodb://x",
                JwtTokenParameters = new JwtTokenParameters { IssueDate = DateTime.UtcNow, PrivateCertificatePassword = "p" }
            });
            return new ServiceManagementRepository(provider, secret.Object, tenants.Object, logger ?? NullLogger<ServiceManagementRepository>.Instance);
        }

        [Fact]
        public async Task SaveAsync_WritesRoot_AndCopiesToTenantDbWhileThatCollectionExists()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            using var _ = new IntegrationContext(tenant);
            using var dbs = new RootAndTenantDbs(_fixture, tenant);
            await dbs.Db.CreateCollectionAsync("BlocksManagedServices"); // old collection still there
            var repo = SplitRepository(dbs.Provider, tenantIsRoot: false);

            var service = Service(tenant, "orders", "sb-copy");
            await repo.SaveAsync(service);

            (await dbs.Root.Find(s => s.ItemId == service.ItemId).CountDocumentsAsync()).Should().Be(1);
            (await dbs.Tenant.Find(s => s.ItemId == service.ItemId).CountDocumentsAsync()).Should().Be(1);
        }

        [Fact]
        public async Task SaveAsync_AfterCleanup_TenantCollectionGone_WritesRootOnly_AndDoesNotRecreateIt()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            using var _ = new IntegrationContext(tenant);
            using var dbs = new RootAndTenantDbs(_fixture, tenant);
            var repo = SplitRepository(dbs.Provider, tenantIsRoot: false);

            var service = Service(tenant, "orders", "sb-nocopy");
            await repo.SaveAsync(service);

            (await dbs.Root.Find(s => s.ItemId == service.ItemId).CountDocumentsAsync()).Should().Be(1);
            var names = await (await dbs.Db.ListCollectionNamesAsync()).ToListAsync();
            names.Should().NotContain("BlocksManagedServices");
        }

        [Fact]
        public async Task SaveAsync_Impersonated_WritesRootOnly()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            using var _ = new BlocksTestContext(tenantId: tenant, impersonated: true);
            using var dbs = new RootAndTenantDbs(_fixture, tenant);
            await dbs.Db.CreateCollectionAsync("BlocksManagedServices");
            var repo = SplitRepository(dbs.Provider, tenantIsRoot: false);

            var service = Service(tenant, "orders", "sb-imp");
            await repo.SaveAsync(service);

            (await dbs.Root.Find(s => s.ItemId == service.ItemId).CountDocumentsAsync()).Should().Be(1);
            (await dbs.Tenant.Find(s => s.ItemId == service.ItemId).CountDocumentsAsync()).Should().Be(0);
        }

        [Fact]
        public async Task SaveAsync_RootTenant_SkipsTenantCopy_NoDuplicateKey()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            using var _ = new IntegrationContext(tenant);
            using var dbs = new RootAndTenantDbs(_fixture, tenant);
            await dbs.Db.CreateCollectionAsync("BlocksManagedServices");
            var logger = new RecordingLogger<ServiceManagementRepository>();
            var repo = SplitRepository(dbs.Provider, tenantIsRoot: true, logger);

            var service = Service(tenant, "orders", "sb-roottenant");
            await repo.SaveAsync(service);

            (await dbs.Root.Find(s => s.ItemId == service.ItemId).CountDocumentsAsync()).Should().Be(1);
            (await dbs.Tenant.Find(s => s.ItemId == service.ItemId).CountDocumentsAsync()).Should().Be(0);
            logger.Entries.Should().BeEmpty();
        }

        [Fact]
        public async Task SaveAsync_TenantCopyDuplicateKey_RegisterStillSucceeds_AndLogsAWarning()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            using var _ = new IntegrationContext(tenant);
            using var dbs = new RootAndTenantDbs(_fixture, tenant);
            var service = Service(tenant, "orders", "sb-dup");
            await dbs.Tenant.InsertOneAsync(service); // the copy already exists
            var logger = new RecordingLogger<ServiceManagementRepository>();
            var repo = SplitRepository(dbs.Provider, tenantIsRoot: false, logger);

            await repo.SaveAsync(service);

            (await dbs.Root.Find(s => s.ItemId == service.ItemId).CountDocumentsAsync()).Should().Be(1);
            logger.Entries.Should().ContainSingle(e => e.Level == LogLevel.Warning);
        }

        [Fact]
        public async Task SaveAsync_TenantCopyFails_RegisterStillSucceeds_AndLogsAnError()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            using var _ = new IntegrationContext(tenant);
            var provider = new Mock<IDbContextProvider>();
            provider.Setup(p => p.GetDatabase(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool>())).Returns(_fixture.Database);
            provider.Setup(p => p.GetDatabase(tenant)).Throws(new InvalidOperationException("tenant db down"));
            var logger = new RecordingLogger<ServiceManagementRepository>();
            var repo = SplitRepository(provider.Object, tenantIsRoot: false, logger);

            var service = Service(tenant, "orders", "sb-fail");
            var act = async () => await repo.SaveAsync(service);

            await act.Should().NotThrowAsync();
            (await _fixture.Database.GetCollection<BlocksManagedService>("BlocksManagedServices")
                .Find(s => s.ItemId == service.ItemId).CountDocumentsAsync()).Should().Be(1);
            logger.Entries.Should().ContainSingle(e => e.Level == LogLevel.Error);
        }

        [Fact]
        public async Task GetAllServicesAsync_ReadsRoot_ForProjectUserAndConsole_FilteredByTenantId()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            using var dbs = new RootAndTenantDbs(_fixture, tenant);
            await dbs.Root.InsertManyAsync(new[]
            {
                Service(tenant, "by-project", "sb-p"),
                Service(tenant, "by-console", "sb-c"),
                Service("other-" + tenant, "intruder", "sb-x")
            });
            // a leftover in the tenant DB must not be read any more
            await dbs.Tenant.InsertOneAsync(Service(tenant, "tenant-only", "sb-t"));
            var repo = SplitRepository(dbs.Provider, tenantIsRoot: false);

            foreach (var impersonated in new[] { false, true })
            {
                using var _ = new BlocksTestContext(tenantId: tenant, impersonated: impersonated);
                var (data, count) = await repo.GetAllServicesAsync(new GetAllServiceRequest { Page = 0, PageSize = 10 });

                count.Should().Be(2);
                data.Select(d => d.Name).Should().BeEquivalentTo("by-project", "by-console");
            }
        }

        private static BlocksManagedService Service(string tenant, string name, string serviceId)
            => new()
            {
                ItemId = Guid.NewGuid().ToString("N"),
                TenantId = tenant,
                Name = name,
                ServiceId = serviceId,
                Description = "desc",
                ServiceBusConnectionString = "cs",
                ServiceType = "backend"
            };

        [Fact]
        public async Task SaveAsync_ThenGetAllServicesAsync_ScopedToTenant()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            using var _ = new IntegrationContext(tenant);
            var repo = NewRepository();

            await repo.SaveAsync(Service(tenant, "orders", "sb-1"));
            await repo.SaveAsync(Service(tenant, "billing", "sb-2"));
            await repo.SaveAsync(Service("other-tenant", "intruder", "sb-3"));

            var (data, count) = await repo.GetAllServicesAsync(new GetAllServiceRequest { Page = 0, PageSize = 10 });

            count.Should().Be(2);
            data.Should().OnlyContain(s => s.TenantId == tenant);
        }

        [Fact]
        public async Task GetAllServicesAsync_FiltersByServiceNameAndId()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            using var _ = new IntegrationContext(tenant);
            var repo = NewRepository();

            await repo.SaveAsync(Service(tenant, "alpha", "sb-alpha"));
            await repo.SaveAsync(Service(tenant, "beta", "sb-beta"));

            var (byName, nameCount) = await repo.GetAllServicesAsync(new GetAllServiceRequest
            {
                Page = 0,
                PageSize = 10,
                Filter = new GetAllServiceFilter { ServiceName = "alpha" }
            });
            nameCount.Should().Be(1);
            byName.Single().Name.Should().Be("alpha");

            var (byId, idCount) = await repo.GetAllServicesAsync(new GetAllServiceRequest
            {
                Page = 0,
                PageSize = 10,
                Filter = new GetAllServiceFilter { ServiceId = "sb-beta" }
            });
            idCount.Should().Be(1);
            byId.Single().ServiceId.Should().Be("sb-beta");
        }

        [Fact]
        public async Task GetAllServicesAsync_Paginates()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            using var _ = new IntegrationContext(tenant);
            var repo = NewRepository();
            for (var i = 0; i < 5; i++)
            {
                await repo.SaveAsync(Service(tenant, "svc" + i, "sb-" + i));
            }

            var (page0, count) = await repo.GetAllServicesAsync(new GetAllServiceRequest { Page = 0, PageSize = 2 });
            var (page2, _) = await repo.GetAllServicesAsync(new GetAllServiceRequest { Page = 2, PageSize = 2 });

            count.Should().Be(5);
            page0.Should().HaveCount(2);
            page2.Should().HaveCount(1);
        }
    }
}
