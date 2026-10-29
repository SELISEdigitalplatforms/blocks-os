using System;
using System.Collections.Generic;
using System.Linq;
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
    public class DomainManagementServiceSetupTests
    {
        private readonly Mock<ILogger<DomainManagementService>> _logger = new();
        private readonly Mock<IBlocksSecret> _blocksSecret = new();
        private readonly Mock<IProjectRepository> _projectRepo = new();
        private readonly Mock<ITenants> _tenants = new();

        private readonly IConfiguration _configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                { "CnameRecordDomain", "dev-blocksapi" },
                { "KbtclIdentifier", ".dev.slsblx.com" },
                // Resolves without a network, so the apex record gets a real address.
                { "FrontendRuntime:BLOCKS_CNAME_BASE_URL", "localhost" },
            })
            .Build();

        private DomainManagementService Service() => new(
            _logger.Object,
            _blocksSecret.Object,
            _projectRepo.Object,
            new HttpClient(),
            _tenants.Object,
            _configuration);

        private void GivenApplications(params Applications[] applications)
        {
            _tenants.Setup(t => t.GetTenantByID(It.IsAny<string>())).Returns(new Tenant
            {
                DbConnectionString = "mongodb://x",
                JwtTokenParameters = new JwtTokenParameters { IssueDate = DateTime.UtcNow, PrivateCertificatePassword = "pwd" },
                TenantId = "t1",
                Applications = applications.ToList(),
            });
        }

        [Fact]
        public async Task GetDomainSetupGuideAsync_NoTenant_ReturnsError()
        {
            using var _ = new BlocksTestContext(tenantId: "t1");
            _tenants.Setup(t => t.GetTenantByID(It.IsAny<string>())).Returns((Tenant?)null);

            var response = await Service().GetDomainSetupGuideAsync();

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("project_not_found");
        }

        [Fact]
        public async Task GetDomainSetupGuideAsync_PlatformDomain_UsesDefaultApiAndNoRecords()
        {
            using var _ = new BlocksTestContext(tenantId: "t1");
            GivenApplications(new Applications
            {
                Domain = "https://djskjb-ehxqx.dev.slsblx.com",
                CookieDomain = "slsblx.com",
                IsDomainVerified = true,
                DomainType = DomainType.PlatformSubdomain,
            });

            var item = (await Service().GetDomainSetupGuideAsync()).Applications.Single();

            item.IsPlatformDomain.Should().BeTrue();
            item.ApiBaseUrl.Should().Be("https://blocksapi.dev.slsblx.com");
            item.Records.Should().BeEmpty();
        }

        [Fact]
        public async Task GetDomainSetupGuideAsync_Subdomain_ReturnsTwoCnameRecords()
        {
            using var _ = new BlocksTestContext(tenantId: "t1");
            GivenApplications(new Applications
            {
                Domain = "https://asif.asifrafeen.shop",
                CookieDomain = "asifrafeen.shop",
                DomainType = DomainType.Custom,
            });

            var item = (await Service().GetDomainSetupGuideAsync()).Applications.Single();

            item.Domain.Should().Be("https://asif.asifrafeen.shop");
            item.IsApex.Should().BeFalse();
            item.ApiBaseUrl.Should().Be("https://dev-blocksapi.asifrafeen.shop");
            item.Records.Should().HaveCount(2);

            item.Records[0].Purpose.Should().Be("app");
            item.Records[0].Type.Should().Be("CNAME");
            item.Records[0].Name.Should().Be("asif");
            item.Records[0].Host.Should().Be("asif.asifrafeen.shop");
            item.Records[0].Value.Should().Be("localhost");

            item.Records[1].Purpose.Should().Be("api");
            item.Records[1].Type.Should().Be("CNAME");
            item.Records[1].Name.Should().Be("dev-blocksapi");
            item.Records[1].Host.Should().Be("dev-blocksapi.asifrafeen.shop");
            item.Records[1].Value.Should().Be("localhost");
        }

        [Fact]
        public async Task GetDomainSetupGuideAsync_ApexDomain_ReturnsARecordWithTargetIp()
        {
            using var _ = new BlocksTestContext(tenantId: "t1");
            GivenApplications(new Applications
            {
                Domain = "https://lhj.com",
                CookieDomain = "lhj.com",
                DomainType = DomainType.Custom,
            });

            var item = (await Service().GetDomainSetupGuideAsync()).Applications.Single();

            item.IsApex.Should().BeTrue();
            item.Records[0].Type.Should().Be("A");
            item.Records[0].Name.Should().Be("@");
            item.Records[0].Value.Should().Be("127.0.0.1");
            item.Records[1].Name.Should().Be("dev-blocksapi");
            item.Records[1].Host.Should().Be("dev-blocksapi.lhj.com");
        }

        [Fact]
        public async Task GetDomainSetupGuideAsync_UnclassifiedDomain_IsResolvedFromHost()
        {
            using var _ = new BlocksTestContext(tenantId: "t1");
            GivenApplications(new Applications
            {
                Domain = "app.customer.com",
                CookieDomain = "customer.com",
                DomainType = DomainType.Unspecified,
            });

            var item = (await Service().GetDomainSetupGuideAsync()).Applications.Single();

            item.IsPlatformDomain.Should().BeFalse();
            item.Records.Should().HaveCount(2);
        }

        [Fact]
        public async Task ConfigureDomainWithProgressAsync_InvalidDomain_ReturnsErrorWithoutProgress()
        {
            var progress = new List<DomainSetupProgress>();

            var response = await Service().ConfigureDomainWithProgressAsync(
                new ConfigureDomainRequest { CookieDomain = "not a valid domain!!" },
                p => { progress.Add(p); return Task.CompletedTask; });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("invalid_domain");
            progress.Should().BeEmpty();
        }

        [Fact]
        public async Task ConfigureDomainWithProgressAsync_DomainNotOnProject_IsRefused()
        {
            using var _ = new BlocksTestContext(tenantId: "t1");
            GivenApplications(new Applications { Domain = "other.example.com", CookieDomain = "example.com" });

            var response = await Service().ConfigureDomainWithProgressAsync(
                new ConfigureDomainRequest { CookieDomain = "app.example.com" },
                _ => Task.CompletedTask);

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("domain_not_found");
        }

        [Fact]
        public async Task ConfigureDomainWithProgressAsync_AlreadyVerified_SucceedsWithoutProvisioning()
        {
            using var _ = new BlocksTestContext(tenantId: "t1");
            GivenApplications(new Applications { Domain = "https://app.example.com", CookieDomain = "example.com", IsDomainVerified = true });
            var progress = new List<DomainSetupProgress>();

            var response = await Service().ConfigureDomainWithProgressAsync(
                new ConfigureDomainRequest { CookieDomain = "app.example.com" },
                p => { progress.Add(p); return Task.CompletedTask; });

            response.IsSuccess.Should().BeTrue();
            progress.Should().BeEmpty();
            _projectRepo.Verify(r => r.UpdateProjectAsync(It.IsAny<Tenant>()), Times.Never);
        }

        [Fact]
        public async Task ConfigureDomainWithProgressAsync_UnresolvableDomain_ReportsFailedDnsStep()
        {
            using var _ = new BlocksTestContext(tenantId: "t1");
            // A reserved .invalid host never resolves, so the run stops at the first DNS check
            // before any SSH/nginx step.
            var host = "app.unresolvable-" + Guid.NewGuid().ToString("N") + ".invalid";
            GivenApplications(new Applications { Domain = host });
            var progress = new List<DomainSetupProgress>();

            var response = await Service().ConfigureDomainWithProgressAsync(
                new ConfigureDomainRequest { CookieDomain = host },
                p => { progress.Add(p); return Task.CompletedTask; });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("domain_verification_failed");
            progress.Should().HaveCount(2);
            progress[0].Should().Be(new DomainSetupProgress(DomainSetupSteps.AppDns, DomainSetupStepStatus.Running, host));
            progress[1].Step.Should().Be(DomainSetupSteps.AppDns);
            progress[1].Status.Should().Be(DomainSetupStepStatus.Failed);
            progress[1].Message.Should().Contain(host);
        }

        [Fact]
        public async Task ConfigureDomainWithProgressAsync_ListenerThrows_RunStillFinishes()
        {
            using var _ = new BlocksTestContext(tenantId: "t1");
            var host = "app.unresolvable-" + Guid.NewGuid().ToString("N") + ".invalid";
            GivenApplications(new Applications { Domain = host });

            var response = await Service().ConfigureDomainWithProgressAsync(
                new ConfigureDomainRequest { CookieDomain = host },
                _ => throw new InvalidOperationException("stream closed"));

            response.Errors.Should().ContainKey("domain_verification_failed");
        }

        [Fact]
        public async Task ConfigureDomainWithProgressAsync_SameHostTwice_SecondRunIsRefused()
        {
            using var _ = new BlocksTestContext(tenantId: "t1");
            var host = "app.unresolvable-" + Guid.NewGuid().ToString("N") + ".invalid";
            GivenApplications(new Applications { Domain = host });
            var service = Service();
            var release = new TaskCompletionSource();
            BaseResponse? second = null;

            // The first run parks inside its first progress report, holding the host.
            var first = service.ConfigureDomainWithProgressAsync(
                new ConfigureDomainRequest { CookieDomain = host },
                async _ =>
                {
                    second ??= await service.ConfigureDomainWithProgressAsync(
                        new ConfigureDomainRequest { CookieDomain = host },
                        _ => Task.CompletedTask);
                    await release.Task;
                });

            release.SetResult();
            await first;

            second!.Errors.Should().ContainKey("setup_in_progress");
        }
    }
}
