using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Blocks.Genesis;
using DomainService.ManagedService;
using DomainService.ManagedService.Services;
using DomainService.ManagedService.Validator;
using DomainService.Shared;
using DomainService.Shared.Entities;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Moq;
using XUnitTest.TestSupport;

namespace XUnitTest.Services
{
    public class ServiceManagementTests
    {
        private readonly Mock<IServiceManagementRepository> _repo = new();
        private readonly Mock<IBlocksSecret> _blocksSecret = new();
        private readonly Mock<ICacheClient> _cache = new();
        private readonly Mock<ITenants> _tenants = new();
        private readonly IConfiguration _configuration = new ConfigurationBuilder().Build();

        public ServiceManagementTests()
        {
            // A RabbitMQ connection string keeps the constructor out of the Azure
            // ServiceBus/ARM client path so the service can be built in tests.
            _blocksSecret.SetupGet(s => s.LmtMessageConnectionString).Returns("amqp://<username>:<password>@localhost:5672");
            _blocksSecret.SetupGet(s => s.LogConnectionString).Returns("mongodb://localhost");
        }

        private ServiceManagement Service() => new(
            _repo.Object,
            new RegisterServiceRequestValidator(),
            _blocksSecret.Object,
            _cache.Object,
            _tenants.Object,
            _configuration);

        [Fact]
        public void Map_BuildsManagedServiceFromRequestAndContext()
        {
            using var _ = new BlocksTestContext(tenantId: "tenant-x", userId: "user-x");

            var request = new RegisterServiceRequest
            {
                ServiceName = "orders",
                ServiceType = "backend",
                Description = "Orders service",
                Tags = new List<string> { "core" }
            };

            var result = Service().Map(request);

            result.Name.Should().Be("orders");
            result.ServiceType.Should().Be("backend");
            result.Description.Should().Be("Orders service");
            result.TenantId.Should().Be("tenant-x");
            result.CreatedBy.Should().Be("user-x");
            result.ServiceId.Should().StartWith("SB-");
            result.ItemId.Should().NotBeNullOrEmpty();
        }

        [Fact]
        public async Task RegisterServiceAsync_InvalidRequest_ReturnsValidationErrors()
        {
            var request = new RegisterServiceRequest { ServiceName = "", ServiceType = "unknown" };

            var response = await Service().RegisterServiceAsync(request);

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().NotBeEmpty();
            _repo.Verify(r => r.SaveAsync(It.IsAny<BlocksManagedService>()), Times.Never);
        }

        [Fact]
        public async Task GetAllServicesAsync_DecryptsConnectionStringsAndDefaultsServiceType()
        {
            using var _ = new BlocksTestContext(tenantId: "tenant-x");
            _tenants.Setup(t => t.GetTenantByID(It.IsAny<string>())).Returns((Tenant?)null);

            var services = new List<BlocksManagedService>
            {
                new() { ServiceId = "s1", ServiceBusConnectionString = "", ServiceType = null! },
                new() { ServiceId = "s2", ServiceBusConnectionString = "", ServiceType = "frontend" }
            }.AsQueryable();

            _repo.Setup(r => r.GetAllServicesAsync(It.IsAny<GetAllServiceRequest>()))
                 .ReturnsAsync((services, 2L));

            var response = await Service().GetAllServicesAsync(new GetAllServiceRequest());

            response.TotalCount.Should().Be(2);
            var list = response.Data.ToList();
            list.Should().HaveCount(2);
            list[0].ServiceType.Should().Be("backend"); // defaulted from null
            list[1].ServiceType.Should().Be("frontend");
        }
    }
}
