using System;
using System.Linq;
using System.Threading.Tasks;
using Blocks.Genesis;
using DomainService.ManagedService;
using DomainService.ManagedService.Services;
using DomainService.Shared.Entities;
using FluentAssertions;
using Moq;

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
            return new ServiceManagementRepository(_fixture.DbContextProvider, secret.Object);
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
