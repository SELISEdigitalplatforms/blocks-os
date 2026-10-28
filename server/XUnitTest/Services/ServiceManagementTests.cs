using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Blocks.Secrets;
using DomainService.ManagedService;
using DomainService.ManagedService.Services;
using DomainService.ManagedService.Validator;
using DomainService.Shared;
using DomainService.Shared.Entities;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Bson;
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

        // Strict, but strictness alone does not fail a test: the per-row read and the unsaved-secret
        // retire catch every exception, including the MockException an unexpected call throws.
        // What catches such a call is VerifyNoOtherCalls (Moq records the invocation before the
        // strict check), so every test that can reach the store ends with it.
        private readonly Mock<ISecretService> _secrets = new(MockBehavior.Strict);

        /// <summary>How many DI scopes resolved ISecretService: one per secret call.</summary>
        private int _secretScopes;

        private IServiceScopeFactory ScopeFactory() =>
            new ServiceCollection()
                .AddScoped(_ =>
                {
                    _secretScopes++;
                    return _secrets.Object;
                })
                .BuildServiceProvider()
                .GetRequiredService<IServiceScopeFactory>();

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
            _configuration,
            ScopeFactory());

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
                    ServiceBusConnectionString = CipherUnderSaltUnreadableBy("amqp://logs", "LMT", "salt-x")
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
        private static string UnreadableCipher(string plain, params string[] salts) =>
            CipherUnderSaltUnreadableBy(plain, "retired-salt", salts);

        // A ciphertext under encryptingSalt that none of the salts the ladder tries first can "open" by chance.
        private static string CipherUnderSaltUnreadableBy(string plain, string encryptingSalt, params string[] salts)
        {
            while (true)
            {
                var cipher = EncryptionHelper.Encrypt(plain, encryptingSalt);
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
            new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["RootTenantId"] = "root-t" }).Build(),
            ScopeFactory());

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
                new() { ServiceId = "s2", ServiceBusConnectionString = CipherUnderSaltUnreadableBy("amqp://console", "root-salt", "project-salt", "LMT") }
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
                // Still the root salt's ciphertext; only a draw that the tried keys happen to "open"
                // with valid padding is skipped, which made this test fail about once in a hundred runs.
                new() { ServiceId = "s1", ServiceBusConnectionString = CipherUnderSaltUnreadableBy("amqp://console", "root-salt", "project-salt", "LMT") }
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
                new() { ServiceId = "s2", ServiceBusConnectionString = CipherUnderSaltUnreadableBy("amqp://project", "project-salt", "root-salt", "LMT") }
            }.AsQueryable();
            _repo.Setup(r => r.GetAllServicesAsync(It.IsAny<GetAllServiceRequest>())).ReturnsAsync((services, 2L));

            var logger = new RecordingLogger<ServiceManagement>();
            var response = await ServiceWithRootTenant(logger).GetAllServicesAsync(new GetAllServiceRequest());

            var list = response.Data.ToList();
            list[0].ServiceBusConnectionString.Should().Be("amqp://console");
            list[1].ServiceBusConnectionString.Should().Be("amqp://project");
            logger.Entries.Should().NotContain(e => e.Level == Microsoft.Extensions.Logging.LogLevel.Error);
        }

        // ---------- blocks-os#710: connection strings in Blocks Secrets ----------

        /// <summary>
        /// The platform's RabbitMQ string, which RabbitMQ mode hands every service. The log
        /// connection string points nowhere so the LMT collection step fails fast (and is
        /// swallowed, as in production) instead of touching a real database.
        /// </summary>
        private const string PlatformBusConnection = "amqp://<username>:<password>@localhost:5672";

        private ServiceManagement RegisteringService(RecordingLogger<ServiceManagement> logger)
        {
            _blocksSecret.SetupGet(s => s.LogConnectionString)
                         .Returns("mongodb://127.0.0.1:9/?serverSelectionTimeoutMS=50&connectTimeoutMS=50");
            return new ServiceManagement(
                logger,
                _repo.Object,
                new RegisterServiceRequestValidator(),
                _blocksSecret.Object,
                _cache.Object,
                _tenants.Object,
                _configuration,
                ScopeFactory());
        }

        private static RegisterServiceRequest OrdersRequest() => new() { ServiceName = "orders", ServiceType = "backend" };

        [Fact]
        public async Task RegisterServiceAsync_StoresTheConnectionStringAsAServiceSecretAndOnlyItsReference()
        {
            using var _ = new BlocksTestContext(tenantId: "tenant-x");
            SetSecretRequest? created = null;
            string? secretTenant = null;
            _secrets.Setup(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()))
                    .Callback<SetSecretRequest, CancellationToken>((request, _) =>
                    {
                        created = request;
                        secretTenant = BlocksContext.GetContext()?.TenantId;
                    })
                    .ReturnsAsync("sb-ref-1");
            BlocksManagedService? saved = null;
            _repo.Setup(r => r.SaveAsync(It.IsAny<BlocksManagedService>()))
                 .Callback<BlocksManagedService>(service => saved = service)
                 .Returns(Task.CompletedTask);

            var response = await RegisteringService(new RecordingLogger<ServiceManagement>()).RegisterServiceAsync(OrdersRequest());

            response.IsSuccess.Should().BeTrue();
            response.LogsServiceBusConnectionString.Should().Be(PlatformBusConnection);
            response.ServiceId.Should().Be(saved!.ServiceId);

            saved.ServiceBusConnectionString.Should().BeEmpty("the row no longer holds the TenantSalt ciphertext");
            saved.ServiceBusConnectionStringReference.Should().Be("sb-ref-1");
            saved.TenantId.Should().Be("tenant-x");

            created!.Name.Should().Be("service-bus-connection");
            created.Type.Should().Be(SecretTypes.Service);
            created.Value.Should().Be(PlatformBusConnection);
            created.Description.Should().Be($"Managed service {saved.ServiceId}");

            // C12: written in the row's tenant, which is the caller's own context.
            secretTenant.Should().Be("tenant-x");

            // §5: one SetAsync, in one scope; the tenant salt is no longer looked up.
            _secrets.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
            _secretScopes.Should().Be(1);
            _tenants.Verify(t => t.GetTenantByID(It.IsAny<string>()), Times.Never);
            _cache.Verify(c => c.PublishAsync("service::activity", It.Is<string>(m => m.Contains(saved.ServiceId))), Times.Once);
        }

        [Fact]
        public async Task RegisterServiceAsync_InvalidRequest_MakesNoSecretCall()
        {
            var response = await Service().RegisterServiceAsync(new RegisterServiceRequest { ServiceName = "", ServiceType = "unknown" });

            response.IsSuccess.Should().BeFalse();
            _secrets.VerifyNoOtherCalls();
            _secretScopes.Should().Be(0);
        }

        [Fact]
        public async Task RegisterServiceAsync_VaultDown_ReturnsSecretStoreUnavailableSavesNoRowAndLogsTheServiceId()
        {
            using var _ = new BlocksTestContext(tenantId: "tenant-x");
            _secrets.Setup(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()))
                    .ThrowsAsync(new SecretVaultException("down", "Set", "sb-ref-1"));
            var logger = new RecordingLogger<ServiceManagement>();

            var response = await RegisteringService(logger).RegisterServiceAsync(OrdersRequest());

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().Equal(new Dictionary<string, string>
            {
                ["secret_store_unavailable"] = "The secret store is unavailable. Try again later."
            });
            response.LogsServiceBusConnectionString.Should().BeNull();
            _repo.Verify(r => r.SaveAsync(It.IsAny<BlocksManagedService>()), Times.Never);
            _cache.Verify(c => c.PublishAsync(It.IsAny<string>(), It.IsAny<string>()), Times.Never);

            var warning = logger.Entries.Should().ContainSingle(e => e.Level == LogLevel.Warning).Subject;
            warning.Message.Should().MatchRegex("service SB-[0-9A-F]{32} was not saved");
            warning.Message.Should().NotContain("sb-ref-1").And.NotContain(PlatformBusConnection);
            warning.Exception.Should().BeNull("the exception can name the secret");

            _secrets.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task RegisterServiceAsync_OtherSecretFailure_PropagatesAndSavesNoRow()
        {
            using var _ = new BlocksTestContext(tenantId: "tenant-x");
            _secrets.Setup(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()))
                    .ThrowsAsync(new SecretAccessDeniedException("not_permitted"));

            await Assert.ThrowsAsync<SecretAccessDeniedException>(
                () => RegisteringService(new RecordingLogger<ServiceManagement>()).RegisterServiceAsync(OrdersRequest()));

            _repo.Verify(r => r.SaveAsync(It.IsAny<BlocksManagedService>()), Times.Never);
            _secrets.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        private void GivenRegistrationWhoseSaveFails(Exception failure)
        {
            _secrets.Setup(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>())).ReturnsAsync("sb-ref-1");
            _repo.Setup(r => r.SaveAsync(It.IsAny<BlocksManagedService>())).ThrowsAsync(failure);
        }

        [Fact]
        public async Task RegisterServiceAsync_SaveFails_RetiresTheNewSecretAndPropagates()
        {
            using var _ = new BlocksTestContext(tenantId: "tenant-x");
            var failure = new InvalidOperationException("mongo down");
            GivenRegistrationWhoseSaveFails(failure);
            _repo.Setup(r => r.GetAllServicesAsync(It.IsAny<GetAllServiceRequest>()))
                 .ReturnsAsync((Enumerable.Empty<BlocksManagedService>().AsQueryable(), 0L));
            _secrets.Setup(s => s.DeleteAsync("sb-ref-1", It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

            var thrown = await Assert.ThrowsAsync<InvalidOperationException>(
                () => RegisteringService(new RecordingLogger<ServiceManagement>()).RegisterServiceAsync(OrdersRequest()));

            thrown.Should().BeSameAs(failure);
            _repo.Verify(r => r.GetAllServicesAsync(It.Is<GetAllServiceRequest>(q => q.Filter!.ServiceId!.StartsWith("SB-"))), Times.Once);
            _secrets.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Once);
            _secrets.Verify(s => s.DeleteAsync("sb-ref-1", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
            _secretScopes.Should().Be(2, "one scope per secret call");
            _cache.Verify(c => c.PublishAsync(It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task RegisterServiceAsync_SaveReportsAFailureButTheRowWasWritten_KeepsTheSecret()
        {
            using var _ = new BlocksTestContext(tenantId: "tenant-x");
            GivenRegistrationWhoseSaveFails(new TimeoutException("acknowledgement lost"));
            _repo.Setup(r => r.GetAllServicesAsync(It.IsAny<GetAllServiceRequest>()))
                 .ReturnsAsync((GetAllServiceRequest request) => (
                     new List<BlocksManagedService>
                     {
                         new() { ServiceId = request.Filter!.ServiceId!, ServiceBusConnectionStringReference = "sb-ref-1" }
                     }.AsQueryable(),
                     1L));
            var logger = new RecordingLogger<ServiceManagement>();

            await Assert.ThrowsAsync<TimeoutException>(() => RegisteringService(logger).RegisterServiceAsync(OrdersRequest()));

            logger.Entries.Should().ContainSingle(e => e.Level == LogLevel.Warning && e.Message.Contains("the row was written"));
            _secrets.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task RegisterServiceAsync_ReadBackAfterAFailedSaveFails_KeepsTheSecret()
        {
            using var _ = new BlocksTestContext(tenantId: "tenant-x");
            GivenRegistrationWhoseSaveFails(new InvalidOperationException("mongo down"));
            _repo.Setup(r => r.GetAllServicesAsync(It.IsAny<GetAllServiceRequest>())).ThrowsAsync(new TimeoutException("still down"));
            var logger = new RecordingLogger<ServiceManagement>();

            await Assert.ThrowsAsync<InvalidOperationException>(() => RegisteringService(logger).RegisterServiceAsync(OrdersRequest()));

            logger.Entries.Should().ContainSingle(e => e.Level == LogLevel.Warning && e.Message.Contains(nameof(TimeoutException)));
            _secrets.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task RegisterServiceAsync_RetirementThatFails_IsLoggedWithoutTheReferenceAndTheSaveFailurePropagates()
        {
            using var _ = new BlocksTestContext(tenantId: "tenant-x");
            GivenRegistrationWhoseSaveFails(new InvalidOperationException("mongo down"));
            _repo.Setup(r => r.GetAllServicesAsync(It.IsAny<GetAllServiceRequest>()))
                 .ReturnsAsync((Enumerable.Empty<BlocksManagedService>().AsQueryable(), 0L));
            _secrets.Setup(s => s.DeleteAsync("sb-ref-1", It.IsAny<CancellationToken>()))
                    .ThrowsAsync(new SecretVaultException("down", "Delete", "sb-ref-1"));
            var logger = new RecordingLogger<ServiceManagement>();

            await Assert.ThrowsAsync<InvalidOperationException>(() => RegisteringService(logger).RegisterServiceAsync(OrdersRequest()));

            var error = logger.Entries.Should().ContainSingle(e => e.Level == LogLevel.Error).Subject;
            error.Message.Should().Contain("could not be retired").And.Contain(nameof(SecretVaultException)).And.NotContain("sb-ref-1");
            error.Exception.Should().BeNull("the exception names the secret");
            _secrets.Verify(s => s.SetAsync(It.IsAny<SetSecretRequest>(), It.IsAny<CancellationToken>()), Times.Once);
            _secrets.Verify(s => s.DeleteAsync("sb-ref-1", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task GetAllServicesAsync_ReadsReferencedRowsFromSecretsAndLegacyRowsByDecryption()
        {
            using var _ = new BlocksTestContext(tenantId: "tenant-x");
            _tenants.Setup(t => t.GetTenantByID("tenant-x")).Returns(TenantWithSalt("salt-x"));
            var readTenants = new List<string?>();
            _secrets.Setup(s => s.GetValueAsync("ref-s", It.IsAny<CancellationToken>()))
                    .Callback(() => readTenants.Add(BlocksContext.GetContext()?.TenantId))
                    .ReturnsAsync("amqp://from-secrets");
            _secrets.Setup(s => s.GetValueAsync("ref-blank-tenant", It.IsAny<CancellationToken>()))
                    .Callback(() => readTenants.Add(BlocksContext.GetContext()?.TenantId))
                    .ReturnsAsync("amqp://no-row-tenant");

            var services = new List<BlocksManagedService>
            {
                new()
                {
                    ServiceId = "S",
                    TenantId = "tenant-x",
                    ServiceType = null!,
                    // A reference is authoritative even when the legacy field still holds a value.
                    ServiceBusConnectionString = EncryptionHelper.Encrypt("amqp://stale", "salt-x"),
                    ServiceBusConnectionStringReference = "ref-s"
                },
                new() { ServiceId = "T", TenantId = "tenant-x", ServiceBusConnectionString = EncryptionHelper.Encrypt("amqp://legacy", "salt-x") },
                new() { ServiceId = "U", TenantId = "", ServiceBusConnectionString = "", ServiceBusConnectionStringReference = "ref-blank-tenant" }
            }.AsQueryable();
            _repo.Setup(r => r.GetAllServicesAsync(It.IsAny<GetAllServiceRequest>())).ReturnsAsync((services, 3L));

            var response = await Service().GetAllServicesAsync(new GetAllServiceRequest());

            var list = response.Data.ToList();
            list.Select(s => s.ServiceBusConnectionString).Should().Equal("amqp://from-secrets", "amqp://legacy", "amqp://no-row-tenant");
            list.Should().OnlyContain(s => s.ServiceBusConnectionStringReference == null);
            list[0].ServiceType.Should().Be("backend");

            // C12: every read ran in the caller's tenant, which is the rows' tenant.
            readTenants.Should().Equal("tenant-x", "tenant-x");

            // §5: one value read per referenced row, none for the legacy row, one scope each.
            _secrets.Verify(s => s.GetValueAsync("ref-s", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.Verify(s => s.GetValueAsync("ref-blank-tenant", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
            _secretScopes.Should().Be(2);
        }

        [Fact]
        public async Task GetAllServicesAsync_WhenImpersonating_ReadsInTheBrowsedProjectsTenant()
        {
            // Rows are registered, and so their secrets written, in the project tenant the console
            // browses; the console's own tenant only matters for the legacy salt.
            using var _ = new BlocksTestContext(tenantId: "project-p", impersonated: true, originalTenantId: "root-t");
            string? readTenant = null;
            _secrets.Setup(s => s.GetValueAsync("ref-p", It.IsAny<CancellationToken>()))
                    .Callback(() => readTenant = BlocksContext.GetContext()?.TenantId)
                    .ReturnsAsync("amqp://project");
            var services = new List<BlocksManagedService>
            {
                new() { ServiceId = "S", TenantId = "project-p", ServiceBusConnectionString = "", ServiceBusConnectionStringReference = "ref-p" }
            }.AsQueryable();
            _repo.Setup(r => r.GetAllServicesAsync(It.IsAny<GetAllServiceRequest>())).ReturnsAsync((services, 1L));

            var response = await Service().GetAllServicesAsync(new GetAllServiceRequest());

            response.Data.Single().ServiceBusConnectionString.Should().Be("amqp://project");
            readTenant.Should().Be("project-p");
            _secrets.Verify(s => s.GetValueAsync("ref-p", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        public static TheoryData<Exception> UnreadableSecrets => new()
        {
            new SecretNotFoundException("ref-bad"),
            new SecretStateException("Locked", "read value", "STATUS_LOCKED"),
            new SecretAccessDeniedException("not_permitted"),
            new SecretVaultException("down", "Get", "ref-bad"),
            new TimeoutException("metadata read timed out")
        };

        [Theory]
        [MemberData(nameof(UnreadableSecrets))]
        public async Task GetAllServicesAsync_OneUnreadableSecret_BlanksOnlyThatRowAndLogsItsServiceId(Exception failure)
        {
            using var _ = new BlocksTestContext(tenantId: "tenant-x");
            _secrets.Setup(s => s.GetValueAsync("ref-bad", It.IsAny<CancellationToken>())).ThrowsAsync(failure);
            _secrets.Setup(s => s.GetValueAsync("ref-good", It.IsAny<CancellationToken>())).ReturnsAsync("amqp://good");
            var services = new List<BlocksManagedService>
            {
                new() { ServiceId = "BAD", TenantId = "tenant-x", ServiceBusConnectionString = "", ServiceBusConnectionStringReference = "ref-bad" },
                new() { ServiceId = "GOOD", TenantId = "tenant-x", ServiceBusConnectionString = "", ServiceBusConnectionStringReference = "ref-good" }
            }.AsQueryable();
            _repo.Setup(r => r.GetAllServicesAsync(It.IsAny<GetAllServiceRequest>())).ReturnsAsync((services, 2L));
            var logger = new RecordingLogger<ServiceManagement>();

            var response = await ServiceWithRootTenant(logger).GetAllServicesAsync(new GetAllServiceRequest());

            var rows = response.Data.ToList();
            rows.Select(s => (s.ServiceId, s.ServiceBusConnectionString)).Should().Equal(("BAD", ""), ("GOOD", "amqp://good"));
            rows.Should().OnlyContain(s => s.ServiceBusConnectionStringReference == null);

            var error = logger.Entries.Should().ContainSingle(e => e.Level == LogLevel.Error).Subject;
            error.Message.Should().Contain("BAD").And.Contain(failure.GetType().Name).And.NotContain("ref-bad");
            error.Exception.Should().BeNull("a not-found message carries the reference");

            _secrets.Verify(s => s.GetValueAsync("ref-bad", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.Verify(s => s.GetValueAsync("ref-good", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task GetAllServicesAsync_ARowOfAnotherTenant_IsBlankedAndLoggedWithoutAnyRead()
        {
            using var _ = new BlocksTestContext(tenantId: "tenant-a");
            var services = new List<BlocksManagedService>
            {
                new() { ServiceId = "FOREIGN", TenantId = "tenant-b", ServiceBusConnectionString = "", ServiceBusConnectionStringReference = "ref-b" }
            }.AsQueryable();
            _repo.Setup(r => r.GetAllServicesAsync(It.IsAny<GetAllServiceRequest>())).ReturnsAsync((services, 1L));
            var logger = new RecordingLogger<ServiceManagement>();

            var response = await ServiceWithRootTenant(logger).GetAllServicesAsync(new GetAllServiceRequest());

            var row = response.Data.Single();
            row.ServiceBusConnectionString.Should().BeEmpty();
            row.ServiceBusConnectionStringReference.Should().BeNull();
            var error = logger.Entries.Should().ContainSingle(e => e.Level == LogLevel.Error).Subject;
            error.Message.Should().Contain("FOREIGN").And.Contain("tenant-b").And.Contain("tenant-a").And.NotContain("ref-b");
            _secrets.VerifyNoOtherCalls();
            _secretScopes.Should().Be(0);
        }

        [Fact]
        public async Task GetAllServicesAsync_WithoutACallerTenant_ReadsNoSecret()
        {
            var services = new List<BlocksManagedService>
            {
                new() { ServiceId = "S", TenantId = "", ServiceBusConnectionString = "", ServiceBusConnectionStringReference = "ref-s" }
            }.AsQueryable();
            _repo.Setup(r => r.GetAllServicesAsync(It.IsAny<GetAllServiceRequest>())).ReturnsAsync((services, 1L));

            var response = await Service().GetAllServicesAsync(new GetAllServiceRequest());

            response.Data.Single().ServiceBusConnectionString.Should().BeEmpty();
            _secrets.VerifyNoOtherCalls();
            _secretScopes.Should().Be(0);
        }

        [Fact]
        public async Task GetAllServicesAsync_ACancelledRead_IsNotSwallowed()
        {
            using var _ = new BlocksTestContext(tenantId: "tenant-x");
            _secrets.Setup(s => s.GetValueAsync("ref-s", It.IsAny<CancellationToken>())).ThrowsAsync(new OperationCanceledException());
            var services = new List<BlocksManagedService>
            {
                new() { ServiceId = "S", TenantId = "tenant-x", ServiceBusConnectionString = "", ServiceBusConnectionStringReference = "ref-s" }
            }.AsQueryable();
            _repo.Setup(r => r.GetAllServicesAsync(It.IsAny<GetAllServiceRequest>())).ReturnsAsync((services, 1L));

            await Assert.ThrowsAsync<OperationCanceledException>(() => Service().GetAllServicesAsync(new GetAllServiceRequest()));

            _secrets.Verify(s => s.GetValueAsync("ref-s", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
            _secretScopes.Should().Be(1);
        }

        [Fact]
        public async Task GetAllServicesAsync_LegacyRowsOnly_MakeNoSecretCall()
        {
            using var _ = new BlocksTestContext(tenantId: "tenant-x");
            _tenants.Setup(t => t.GetTenantByID("tenant-x")).Returns(TenantWithSalt("salt-x"));
            var services = new List<BlocksManagedService>
            {
                new() { ServiceId = "T1", TenantId = "tenant-x", ServiceBusConnectionString = EncryptionHelper.Encrypt("amqp://one", "salt-x") },
                new() { ServiceId = "T2", TenantId = "tenant-x", ServiceBusConnectionString = EncryptionHelper.Encrypt("amqp://two", "salt-x") }
            }.AsQueryable();
            _repo.Setup(r => r.GetAllServicesAsync(It.IsAny<GetAllServiceRequest>())).ReturnsAsync((services, 2L));

            var response = await Service().GetAllServicesAsync(new GetAllServiceRequest());

            response.Data.Select(s => s.ServiceBusConnectionString).Should().Equal("amqp://one", "amqp://two");
            _secrets.VerifyNoOtherCalls();
            _secretScopes.Should().Be(0);
        }

        [Fact]
        public async Task GetAllServicesAsync_UnresolvedTenant_CountsOnlyLegacyRowsInTheFallbackWarning()
        {
            using var _ = new BlocksTestContext(tenantId: "tenant-x");
            _tenants.Setup(t => t.GetTenantByID(It.IsAny<string>())).Returns((Tenant?)null);
            _secrets.Setup(s => s.GetValueAsync("ref-s", It.IsAny<CancellationToken>())).ReturnsAsync("amqp://s");
            var services = new List<BlocksManagedService>
            {
                new() { ServiceId = "S", TenantId = "tenant-x", ServiceBusConnectionString = "", ServiceBusConnectionStringReference = "ref-s" },
                new() { ServiceId = "T", TenantId = "tenant-x", ServiceBusConnectionString = EncryptionHelper.Encrypt("amqp://t", "LMT") }
            }.AsQueryable();
            _repo.Setup(r => r.GetAllServicesAsync(It.IsAny<GetAllServiceRequest>())).ReturnsAsync((services, 2L));
            var logger = new RecordingLogger<ServiceManagement>();

            await ServiceWithRootTenant(logger).GetAllServicesAsync(new GetAllServiceRequest());

            logger.Entries.Should().ContainSingle(e => e.Level == LogLevel.Warning).Which.Message.Should().Contain("decrypting 1 service(s)");

            // The referenced row is read from the store once; the legacy row never is.
            _secrets.Verify(s => s.GetValueAsync("ref-s", It.IsAny<CancellationToken>()), Times.Once);
            _secrets.VerifyNoOtherCalls();
            _secretScopes.Should().Be(1);
        }

        [Fact]
        public void BlocksManagedService_ReferenceIsStoredUnderItsReaderNameAndOmittedForLegacyRows()
        {
            var legacy = new BlocksManagedService { ServiceId = "T", ServiceBusConnectionString = "cipher" }.ToBsonDocument();
            var referenced = new BlocksManagedService { ServiceId = "S", ServiceBusConnectionString = "", ServiceBusConnectionStringReference = "ref-s" }.ToBsonDocument();

            // blocks-logic reads exactly this element name.
            legacy.Contains("ServiceBusConnectionStringReference").Should().BeFalse();
            referenced["ServiceBusConnectionStringReference"].AsString.Should().Be("ref-s");
            referenced["ServiceBusConnectionString"].AsString.Should().BeEmpty();
        }
    }
}
