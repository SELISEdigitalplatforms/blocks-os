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
using Microsoft.Extensions.Logging.Abstractions;
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

        private static Tenant TenantWithSalt(string salt) => new()
        {
            TenantSalt = salt,
            DbConnectionString = "mongodb://x",
            JwtTokenParameters = new JwtTokenParameters
            {
                IssueDate = System.DateTime.UtcNow,
                PrivateCertificatePassword = "pwd"
            }
        };

        private ServiceManagement Service() => new(
            NullLogger<ServiceManagement>.Instance,
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

        [Fact]
        public async Task GetAllServicesAsync_FallsBackToLmtKey_WhenStoredWithUnresolvedTenant()
        {
            using var _ = new BlocksTestContext(tenantId: "tenant-x");
            _tenants.Setup(t => t.GetTenantByID(It.IsAny<string>())).Returns(TenantWithSalt("salt-x"));

            var services = new List<BlocksManagedService>
            {
                new()
                {
                    ServiceId = "s1",
                    // Written while the tenant lookup was unresolved, so the fallback key was used.
                    ServiceBusConnectionString = EncryptionHelper.Encrypt("amqp://logs", "LMT")
                }
            }.AsQueryable();

            _repo.Setup(r => r.GetAllServicesAsync(It.IsAny<GetAllServiceRequest>()))
                 .ReturnsAsync((services, 1L));

            var response = await Service().GetAllServicesAsync(new GetAllServiceRequest());

            response.Data.Single().ServiceBusConnectionString.Should().Be("amqp://logs");
        }

        [Fact]
        public async Task GetAllServicesAsync_WhenImpersonating_UsesOriginalTenantSalt()
        {
            // The console browses a project while authenticated as its own tenant, which is
            // the tenant whose salt encrypted the row.
            using var _ = new BlocksTestContext(tenantId: "project-p", impersonated: true, originalTenantId: "root-t");
            _tenants.Setup(t => t.GetTenantByID("root-t")).Returns(TenantWithSalt("root-salt"));
            _tenants.Setup(t => t.GetTenantByID("project-p")).Returns(TenantWithSalt("project-salt"));

            var services = new List<BlocksManagedService>
            {
                new()
                {
                    ServiceId = "s1",
                    ServiceBusConnectionString = EncryptionHelper.Encrypt("amqp://logs", "root-salt")
                }
            }.AsQueryable();

            _repo.Setup(r => r.GetAllServicesAsync(It.IsAny<GetAllServiceRequest>()))
                 .ReturnsAsync((services, 1L));

            var response = await Service().GetAllServicesAsync(new GetAllServiceRequest());

            response.Data.Single().ServiceBusConnectionString.Should().Be("amqp://logs");
            _tenants.Verify(t => t.GetTenantByID("project-p"), Times.Never);
        }

        [Fact]
        public async Task GetAllServicesAsync_WhenNotImpersonating_UsesContextTenantSalt()
        {
            using var _ = new BlocksTestContext(tenantId: "project-p");
            _tenants.Setup(t => t.GetTenantByID("project-p")).Returns(TenantWithSalt("project-salt"));

            var services = new List<BlocksManagedService>
            {
                new()
                {
                    ServiceId = "s1",
                    ServiceBusConnectionString = EncryptionHelper.Encrypt("amqp://logs", "project-salt")
                }
            }.AsQueryable();

            _repo.Setup(r => r.GetAllServicesAsync(It.IsAny<GetAllServiceRequest>()))
                 .ReturnsAsync((services, 1L));

            var response = await Service().GetAllServicesAsync(new GetAllServiceRequest());

            response.Data.Single().ServiceBusConnectionString.Should().Be("amqp://logs");
        }

        [Fact]
        public async Task GetAllServicesAsync_BlanksUnreadableConnectionString_InsteadOfThrowing()
        {
            using var _ = new BlocksTestContext(tenantId: "tenant-x");
            _tenants.Setup(t => t.GetTenantByID(It.IsAny<string>())).Returns(TenantWithSalt("salt-x"));

            var services = new List<BlocksManagedService>
            {
                new()
                {
                    ServiceId = "s1",
                    // Neither the current salt nor the fallback key opens this (rotated salt).
                    ServiceBusConnectionString = UnreadableCipher("amqp://logs", "salt-x", "LMT")
                },
                new()
                {
                    ServiceId = "s2",
                    ServiceBusConnectionString = EncryptionHelper.Encrypt("amqp://traces", "salt-x")
                }
            }.AsQueryable();

            _repo.Setup(r => r.GetAllServicesAsync(It.IsAny<GetAllServiceRequest>()))
                 .ReturnsAsync((services, 2L));

            var response = await Service().GetAllServicesAsync(new GetAllServiceRequest());

            var list = response.Data.ToList();
            list[0].ServiceBusConnectionString.Should().BeEmpty();
            list[1].ServiceBusConnectionString.Should().Be("amqp://traces");
        }

        // A wrong key can, by chance, yield valid padding and so "decrypt" to junk. Pick a cipher that
        // none of the given salts opens, so the test is deterministic.
        private static string UnreadableCipher(string plain, params string[] salts)
        {
            while (true)
            {
                var cipher = EncryptionHelper.Encrypt(plain, "retired-salt");
                if (salts.All(salt => !EncryptionHelper.TryDecrypt(cipher, salt, out _))) return cipher;
            }
        }

        private ServiceManagement ServiceWithRootTenant(Microsoft.Extensions.Logging.ILogger<ServiceManagement> logger) => new(
            logger,
            _repo.Object,
            new RegisterServiceRequestValidator(),
            _blocksSecret.Object,
            _cache.Object,
            _tenants.Object,
            new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["RootTenantId"] = "root-t" }).Build());

        [Fact]
        public async Task GetAllServicesAsync_RowsOfBothSalts_AllDecrypt_AndNothingIsLogged()
        {
            // After the root move one TenantId has rows of the project salt and of the root (console) salt.
            using var _ = new BlocksTestContext(tenantId: "project-p");
            _tenants.Setup(t => t.GetTenantByID("project-p")).Returns(TenantWithSalt("project-salt"));
            _tenants.Setup(t => t.GetTenantByID("root-t")).Returns(TenantWithSalt("root-salt"));

            var services = new List<BlocksManagedService>
            {
                new() { ServiceId = "s1", ServiceBusConnectionString = EncryptionHelper.Encrypt("amqp://project", "project-salt") },
                new() { ServiceId = "s2", ServiceBusConnectionString = EncryptionHelper.Encrypt("amqp://console", "root-salt") }
            }.AsQueryable();
            _repo.Setup(r => r.GetAllServicesAsync(It.IsAny<GetAllServiceRequest>())).ReturnsAsync((services, 2L));

            var logger = new RecordingLogger<ServiceManagement>();
            var response = await ServiceWithRootTenant(logger).GetAllServicesAsync(new GetAllServiceRequest());

            var list = response.Data.ToList();
            list[0].ServiceBusConnectionString.Should().Be("amqp://project");
            list[1].ServiceBusConnectionString.Should().Be("amqp://console");
            logger.Entries.Should().NotContain(e => e.Level == Microsoft.Extensions.Logging.LogLevel.Error);
        }

        [Fact]
        public async Task GetAllServicesAsync_WhenBothSaltsFail_BlanksAndLogsTheError()
        {
            using var _ = new BlocksTestContext(tenantId: "project-p");
            _tenants.Setup(t => t.GetTenantByID("project-p")).Returns(TenantWithSalt("project-salt"));
            _tenants.Setup(t => t.GetTenantByID("root-t")).Returns(TenantWithSalt("root-salt"));

            var services = new List<BlocksManagedService>
            {
                new() { ServiceId = "s1", ServiceBusConnectionString = UnreadableCipher("amqp://x", "project-salt", "root-salt", "LMT") }
            }.AsQueryable();
            _repo.Setup(r => r.GetAllServicesAsync(It.IsAny<GetAllServiceRequest>())).ReturnsAsync((services, 1L));

            var logger = new RecordingLogger<ServiceManagement>();
            var response = await ServiceWithRootTenant(logger).GetAllServicesAsync(new GetAllServiceRequest());

            response.Data.Single().ServiceBusConnectionString.Should().BeEmpty();
            logger.Entries.Count(e => e.Level == Microsoft.Extensions.Logging.LogLevel.Error).Should().Be(1);
        }

        [Fact]
        public async Task GetAllServicesAsync_WithoutRootTenantConfig_BehavesAsBefore()
        {
            using var _ = new BlocksTestContext(tenantId: "project-p");
            _tenants.Setup(t => t.GetTenantByID("project-p")).Returns(TenantWithSalt("project-salt"));

            var services = new List<BlocksManagedService>
            {
                new() { ServiceId = "s1", ServiceBusConnectionString = EncryptionHelper.Encrypt("amqp://console", "root-salt") }
            }.AsQueryable();
            _repo.Setup(r => r.GetAllServicesAsync(It.IsAny<GetAllServiceRequest>())).ReturnsAsync((services, 1L));

            var response = await Service().GetAllServicesAsync(new GetAllServiceRequest());

            response.Data.Single().ServiceBusConnectionString.Should().BeEmpty();
        }

        [Fact]
        public async Task GetAllServicesAsync_WhenImpersonating_ProjectSaltRowsAlsoDecrypt()
        {
            // Console view: step 1 = console (original tenant) salt, step 2 = the project's own salt.
            using var _ = new BlocksTestContext(tenantId: "project-p", impersonated: true, originalTenantId: "root-t");
            _tenants.Setup(t => t.GetTenantByID("root-t")).Returns(TenantWithSalt("root-salt"));
            _tenants.Setup(t => t.GetTenantByID("project-p")).Returns(TenantWithSalt("project-salt"));

            var services = new List<BlocksManagedService>
            {
                new() { ServiceId = "s1", ServiceBusConnectionString = EncryptionHelper.Encrypt("amqp://console", "root-salt") },
                new() { ServiceId = "s2", ServiceBusConnectionString = EncryptionHelper.Encrypt("amqp://project", "project-salt") }
            }.AsQueryable();
            _repo.Setup(r => r.GetAllServicesAsync(It.IsAny<GetAllServiceRequest>())).ReturnsAsync((services, 2L));

            var logger = new RecordingLogger<ServiceManagement>();
            var response = await ServiceWithRootTenant(logger).GetAllServicesAsync(new GetAllServiceRequest());

            var list = response.Data.ToList();
            list[0].ServiceBusConnectionString.Should().Be("amqp://console");
            list[1].ServiceBusConnectionString.Should().Be("amqp://project");
            logger.Entries.Should().NotContain(e => e.Level == Microsoft.Extensions.Logging.LogLevel.Error);
        }
    }
}
