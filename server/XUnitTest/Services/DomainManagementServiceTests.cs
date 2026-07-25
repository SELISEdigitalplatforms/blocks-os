using System.Collections.Generic;
using System.Net.Http;
using System.Threading.Tasks;
using Blocks.Genesis;
using DomainService.Projects;
using DomainService.Shared;
using DomainService.Shared.Entities;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using XUnitTest.TestSupport;

namespace XUnitTest.Services
{
    public class DomainManagementServiceTests
    {
        private readonly Mock<ILogger<DomainManagementService>> _logger = new();
        private readonly Mock<IBlocksSecret> _blocksSecret = new();
        private readonly Mock<IProjectRepository> _projectRepo = new();
        private readonly Mock<ITenants> _tenants = new();
        private readonly IConfiguration _configuration;

        public DomainManagementServiceTests()
        {
            _configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    { "CnameRecordDomain", "blocksapi" }
                })
                .Build();
        }

        private DomainManagementService Service(IConfiguration? config = null) => new(
            _logger.Object,
            _blocksSecret.Object,
            _projectRepo.Object,
            new HttpClient(),
            _tenants.Object,
            config ?? _configuration);

        [Fact]
        public async Task ConfigureDomainAsync_InvalidDomain_ReturnsError()
        {
            var response = await Service().ConfigureDomainAsync(new ConfigureDomainRequest
            {
                CookieDomain = "not a valid domain!!"
            });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("invalid_domain");
        }

        [Fact]
        public async Task ConfigureDomainAsync_AlreadyVerified_ReturnsSuccessWithoutProvisioning()
        {
            using var _ = new BlocksTestContext(tenantId: "t1");
            var tenant = new Tenant
            {
                DbConnectionString = "mongodb://x",
                JwtTokenParameters = new JwtTokenParameters { IssueDate = System.DateTime.UtcNow, PrivateCertificatePassword = "pwd" },
                TenantId = "t1",
                Applications = new List<Applications>
                {
                    new() { Domain = "app.example.com", IsDomainVerified = true }
                }
            };
            _tenants.Setup(t => t.GetTenantByID(It.IsAny<string>())).Returns(tenant);

            var response = await Service().ConfigureDomainAsync(new ConfigureDomainRequest
            {
                CookieDomain = "app.example.com"
            });

            response.IsSuccess.Should().BeTrue();
            // No project update because provisioning was skipped.
            _projectRepo.Verify(r => r.UpdateProjectAsync(It.IsAny<Tenant>()), Times.Never);
        }

        [Fact]
        public async Task ConfigureDomainAsync_DerivedApiDomainInvalid_ReturnsError()
        {
            // Empty CnameRecordDomain makes the derived blocksapi hostname invalid.
            var config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?> { { "CnameRecordDomain", "" } })
                .Build();

            var response = await Service(config).ConfigureDomainAsync(new ConfigureDomainRequest
            {
                CookieDomain = "app.example.com"
            });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("invalid_domain");
        }

        [Fact]
        public async Task ConfigureDomainAsync_UnverifiableDomain_ReturnsVerificationError()
        {
            using var _ = new BlocksTestContext(tenantId: "t1");
            // No tenant/application on record, so provisioning is not skipped and
            // the flow reaches DNS verification. A reserved .invalid host never
            // resolves (and yields the same failure when DNS is unreachable), so
            // verification deterministically fails before any SSH/nginx step.
            _tenants.Setup(t => t.GetTenantByID(It.IsAny<string>())).Returns((Tenant?)null);

            var response = await Service().ConfigureDomainAsync(new ConfigureDomainRequest
            {
                CookieDomain = "console.unresolvable-" + System.Guid.NewGuid().ToString("N") + ".invalid"
            });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("domain_verification_failed");
        }

        [Fact]
        public async Task DisableDomainBindingAsync_InvalidDomain_ReturnsFalse()
        {
            var (success, message) = await Service().DisableDomainBindingAsync(new DisableDomainBindingRequest
            {
                ProjectId = "p1",
                Domain = "bad domain!!"
            });

            success.Should().BeFalse();
            message.Should().Contain("not a valid domain");
        }
    }
}
