using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Blocks.Genesis;
using DomainService.Certificate;
using DomainService.Dtos;
using DomainService.Entities;
using DomainService.Projects;
using DomainService.Shared;
using DomainService.Shared.Entities;
using DomainService.Shared.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Moq;
using StorageDriver;
using DomainService.Storage;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using XUnitTest.TestSupport;

namespace XUnitTest.Services
{
    public class ProjectManagementServiceTests
    {
        private readonly Mock<IProjectRepository> _repo = new();
        private readonly Mock<IBlocksSecret> _blocksSecret = new();
        private readonly Mock<IMessageClient> _messageClient = new();
        private readonly Mock<IStorageDriverService> _storage = new();
        private readonly Mock<ITenants> _tenants = new();
        private readonly Mock<ICertificateManager> _certManager = new();
        private readonly Mock<IEncodingService> _encoding = new();
        private readonly Mock<ICacheClient> _cache = new();
        private readonly IConfiguration _configuration;

        public ProjectManagementServiceTests()
        {
            _configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    { "KbtclIdentifier", ".blocks.dev" },
                    { "IamDomain", "https://iam.blocks.dev" },
                    { "IamCookieDomain", "blocks.dev" },
                    { "CertificateStorageType", "Azure" }
                })
                .Build();

            _blocksSecret.SetupGet(s => s.DatabaseConnectionString).Returns("mongodb://localhost");
            _encoding.Setup(e => e.EncodeToBase26Async(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int>()))
                     .ReturnsAsync("abcde");
        }

        private ProjectManagementService Service(IConfiguration? configuration = null) => new(
            _repo.Object, _blocksSecret.Object, _messageClient.Object, configuration ?? _configuration,
            _storage.Object, _tenants.Object, _certManager.Object, _encoding.Object, _cache.Object);

        // The environment's CNAME label, which the shared API host is built from.
        private static IConfiguration WithCnameRecordDomain(string label) =>
            new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?> { { "CnameRecordDomain", label } })
                .Build();

        [Fact]
        public async Task SaveProjectAsync_NewGroup_InsertsProjectsAndReturnsGroupId()
        {
            using var _ = new BlocksTestContext();
            var request = new CreateProjectRequest
            {
                Name = "Proj",
                applicationContexts = new List<ApplicationContext>
                {
                    new() { Environment = "dev", Domain = "https://dev.example.com" }
                }
            };

            var response = await Service().SaveProjectAsync(request);

            response.IsSuccess.Should().BeTrue();
            response.TenantGroupId.Should().NotBeNullOrEmpty();
            _repo.Verify(r => r.UpdateTenantAssetAsync(It.IsAny<TenantAsset>()), Times.Once);
            _repo.Verify(r => r.InsertProjectAsync(It.IsAny<Tenant>()), Times.Once);
            _messageClient.Verify(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<Tenant>>()), Times.Once);
        }

        [Fact]
        public async Task SaveProjectAsync_NewGroup_RecordsTheCreatorBeforeQueueingTheProject()
        {
            // Provisioning is asynchronous, so the creator row used to be written only once the
            // worker picked the project up. Until it did, the group had environments and no
            // owner, and every [ProjectPolicy(OwnerOnly)] endpoint refused the person who had
            // just created it -- adding an environment and deleting the project among them.
            using var _ = new BlocksTestContext(userId: "creator-1", userName: "creator@blocks.com");

            var written = new List<ProjectPeople>();
            _repo.Setup(r => r.InsertPeopleAsync(It.IsAny<ProjectPeople>()))
                 .Callback<ProjectPeople>(written.Add)
                 .Returns(Task.CompletedTask);

            var request = new CreateProjectRequest
            {
                Name = "Proj",
                applicationContexts = new List<ApplicationContext>
                {
                    new() { Environment = "dev", Domain = "https://dev.example.com" },
                    new() { Environment = "prod", Domain = "https://example.com" }
                }
            };

            await Service().SaveProjectAsync(request);

            // One per environment, so ownership survives any single environment being disabled.
            written.Should().HaveCount(2);
            written.Should().OnlyContain(row => row.IsCreator
                                                && row.UserId == "creator-1"
                                                && row.Email == "creator@blocks.com"
                                                && row.IsInvitationConfirmed);
            written.Select(row => row.TenantId).Should().OnlyHaveUniqueItems();
        }

        [Fact]
        public async Task SaveProjectAsync_ExistingGroup_DoesNotStampTheCallerAsOwner()
        {
            // Appending an environment must leave ownership where it is. Stamping the caller
            // here would hand the whole group to anyone who could add an environment to it.
            using var _ = new BlocksTestContext(userId: "not-the-owner");
            _repo.Setup(r => r.GetTenantAssetByGroupIdAsync("existing-group"))
                 .ReturnsAsync(new TenantAsset { Resources = new List<Resource>() });

            var request = new CreateProjectRequest
            {
                Name = "Proj",
                TenantGroupId = "existing-group",
                applicationContexts = new List<ApplicationContext>
                {
                    new() { Environment = "test", Domain = "https://test.example.com" }
                }
            };

            await Service().SaveProjectAsync(request);

            _repo.Verify(r => r.InsertPeopleAsync(It.IsAny<ProjectPeople>()), Times.Never);
        }

        [Fact]
        public async Task SaveProjectAsync_ExistingGroup_LoadsAssetsInsteadOfCreating()
        {
            using var _ = new BlocksTestContext();
            _repo.Setup(r => r.GetTenantAssetByGroupIdAsync("existing-group"))
                 .ReturnsAsync(new TenantAsset { Resources = new List<Resource>() });

            var request = new CreateProjectRequest
            {
                Name = "Proj",
                TenantGroupId = "existing-group",
                applicationContexts = new List<ApplicationContext>
                {
                    new() { Environment = "test", Domain = "https://test.example.com" }
                }
            };

            var response = await Service().SaveProjectAsync(request);

            response.TenantGroupId.Should().Be("existing-group");
            _repo.Verify(r => r.UpdateTenantAssetAsync(It.IsAny<TenantAsset>()), Times.Never);
            _repo.Verify(r => r.GetTenantAssetByGroupIdAsync("existing-group"), Times.Once);
        }

        [Fact]
        public async Task GetProjectStatusAsync_UnfinishedTracer_ReturnsItsSuccessFlag()
        {
            _repo.Setup(r => r.GetUnfinishedProjectByIdAsync("p1"))
                 .ReturnsAsync(new ProjectStatusTracer { ProjectId = "p1", IsProjectCreationSuccess = true });

            (await Service().GetProjectStatusAsync("p1")).Should().BeTrue();
        }

        [Fact]
        public async Task GetProjectStatusAsync_NoTracerButTenantExists_ReturnsTrue()
        {
            _repo.Setup(r => r.GetUnfinishedProjectByIdAsync("p1")).ReturnsAsync((ProjectStatusTracer?)null);
            _repo.Setup(r => r.GetByIdAsync("p1")).ReturnsAsync(new Tenant
            {
                DbConnectionString = "x",
                JwtTokenParameters = new JwtTokenParameters { IssueDate = System.DateTime.UtcNow, PrivateCertificatePassword = "p" }
            });

            (await Service().GetProjectStatusAsync("p1")).Should().BeTrue();
        }

        [Fact]
        public async Task GetProjectStatusAsync_NoTracerNoTenant_ReturnsTrue()
        {
            _repo.Setup(r => r.GetUnfinishedProjectByIdAsync("p1")).ReturnsAsync((ProjectStatusTracer?)null);
            _repo.Setup(r => r.GetByIdAsync("p1")).ReturnsAsync((Tenant?)null);

            (await Service().GetProjectStatusAsync("p1")).Should().BeTrue();
        }

        [Fact]
        public async Task GetAllAsync_DelegatesToRepository()
        {
            var expected = new List<GroupedProjectsDto> { new() { TenantGroupId = "g1" } };
            _repo.Setup(r => r.GetAllByLastModifiedDateAsync(It.IsAny<GetProjectsRequest>())).ReturnsAsync(expected);

            var result = await Service().GetAllAsync(new GetProjectsRequest());

            result.Should().BeSameAs(expected);
        }

        [Fact]
        public async Task RestoreProjectAsync_ConfiguresProjectAndMarksSuccess()
        {
            using var _ = new BlocksTestContext();
            SetupCertificatePipeline();
            _repo.Setup(r => r.GetByIdAsync("p1")).ReturnsAsync(NewTenantForConfigure());
            _repo.Setup(r => r.GetUnfinishedProjectByIdAsync("p1")).ReturnsAsync((ProjectStatusTracer?)null);

            var response = await Service().RestoreProjectAsync(new RestoreProjectRequest { ItemId = "p1" });

            response.IsSuccess.Should().BeTrue();
            _repo.Verify(r => r.SaveStatusTracerAsync(It.Is<ProjectStatusTracer>(t => t.IsProjectCreationSuccess)), Times.Once);
        }

        [Fact]
        public async Task RestoreProjectAsync_WithExistingTracer_ReusesItAndMarksSuccess()
        {
            using var _ = new BlocksTestContext();
            SetupCertificatePipeline();
            var existing = new ProjectStatusTracer { ProjectId = "p1", InsertedIntoProjectPeople = true };
            _repo.Setup(r => r.GetByIdAsync("p1")).ReturnsAsync(NewTenantForConfigure());
            _repo.Setup(r => r.GetUnfinishedProjectByIdAsync("p1")).ReturnsAsync(existing);

            var response = await Service().RestoreProjectAsync(new RestoreProjectRequest { ItemId = "p1" });

            response.IsSuccess.Should().BeTrue();
            _repo.Verify(r => r.InsertPeopleAsync(It.IsAny<ProjectPeople>()), Times.Never);
        }

        [Fact]
        public async Task GetAsync_WithBlocksGuid_BuildsTenantSlug()
        {
            using var _ = new BlocksTestContext();
            var tenant = new Tenant
            { DbConnectionString = "mongodb://x", JwtTokenParameters = new JwtTokenParameters { IssueDate = System.DateTime.UtcNow, PrivateCertificatePassword = "pwd" },
                TenantGroupId = "grp",
                Environment = "dev",
                Name = "Proj",
                Applications = new List<Applications> { new() { CookieDomain = "example.com", IsDomainVerified = true } }
            };
            _repo.Setup(r => r.GetByTenantIdAsync(It.IsAny<string>())).ReturnsAsync(tenant);
            _repo.Setup(r => r.GetBlocksGuidAsync("grp")).ReturnsAsync(new BlocksGuid { EncodedValue = "xyz" });

            var response = await Service().GetAsync();

            response.Data.Name.Should().Be("Proj");
            response.Data.TenantSlug.Should().Be("dxyz"); // env 'dev' => 'd' + encoded
            response.Data.IsDomainVerified.Should().BeTrue();
        }

        [Fact]
        public async Task GetAsync_WithoutBlocksGuid_EmptySlug()
        {
            using var _ = new BlocksTestContext();
            var tenant = new Tenant
            { DbConnectionString = "mongodb://x", JwtTokenParameters = new JwtTokenParameters { IssueDate = System.DateTime.UtcNow, PrivateCertificatePassword = "pwd" },
                TenantGroupId = "grp",
                Environment = "dev",
                Name = "Proj",
                Applications = new List<Applications>()
            };
            _repo.Setup(r => r.GetByTenantIdAsync(It.IsAny<string>())).ReturnsAsync(tenant);
            _repo.Setup(r => r.GetBlocksGuidAsync("grp")).ReturnsAsync((BlocksGuid?)null);

            var response = await Service().GetAsync();

            response.Data.TenantSlug.Should().BeEmpty();
        }

        [Fact]
        public async Task UpdateProjectAsync_ProjectNotFound_ReturnsError()
        {
            using var _ = new BlocksTestContext();
            _repo.Setup(r => r.GetByTenantIdAsync(It.IsAny<string>())).ReturnsAsync((Tenant?)null);

            var response = await Service().UpdateProjectAsync(new UpdateProjectRequest { Action = ApplicationAction.Add });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("project_not_found");
        }

        [Fact]
        public async Task UpdateProjectAsync_AddNewApplication_Succeeds()
        {
            using var _ = new BlocksTestContext();
            var tenant = new Tenant { DbConnectionString = "mongodb://x", JwtTokenParameters = new JwtTokenParameters { IssueDate = System.DateTime.UtcNow, PrivateCertificatePassword = "pwd" }, TenantId = "t1", Applications = new List<Applications>() };
            _repo.Setup(r => r.GetByTenantIdAsync(It.IsAny<string>())).ReturnsAsync(tenant);
            _tenants.Setup(t => t.UpdateTenantVersionAsync(It.IsAny<TenantCacheUpdateMessage>())).Returns(Task.CompletedTask);

            var response = await Service().UpdateProjectAsync(new UpdateProjectRequest
            {
                Action = ApplicationAction.Add,
                Application = new Application { Domain = "https://new.example.com", CookieDomain = "example.com" }
            });

            response.IsSuccess.Should().BeTrue();
            tenant.Applications.Should().ContainSingle();
            _repo.Verify(r => r.UpdateProjectAsync(tenant), Times.Once);
        }

        [Fact]
        public async Task UpdateProjectAsync_AddDuplicateDomain_ReturnsError()
        {
            using var _ = new BlocksTestContext();
            var tenant = new Tenant
            { DbConnectionString = "mongodb://x", JwtTokenParameters = new JwtTokenParameters { IssueDate = System.DateTime.UtcNow, PrivateCertificatePassword = "pwd" },
                TenantId = "t1",
                Applications = new List<Applications> { new() { Domain = "https://dup.example.com" } }
            };
            _repo.Setup(r => r.GetByTenantIdAsync(It.IsAny<string>())).ReturnsAsync(tenant);

            var response = await Service().UpdateProjectAsync(new UpdateProjectRequest
            {
                Action = ApplicationAction.Add,
                Application = new Application { Domain = "dup.example.com" } // normalizes to same
            });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("duplicate_domain");
        }

        [Fact]
        public async Task UpdateProjectAsync_EditMissingApplication_ReturnsError()
        {
            using var _ = new BlocksTestContext();
            var tenant = new Tenant { DbConnectionString = "mongodb://x", JwtTokenParameters = new JwtTokenParameters { IssueDate = System.DateTime.UtcNow, PrivateCertificatePassword = "pwd" }, TenantId = "t1", Applications = new List<Applications>() };
            _repo.Setup(r => r.GetByTenantIdAsync(It.IsAny<string>())).ReturnsAsync(tenant);

            var response = await Service().UpdateProjectAsync(new UpdateProjectRequest
            {
                Action = ApplicationAction.Edit,
                ApplicationDomain = "https://missing.example.com",
                Application = new Application { Domain = "https://x.example.com" }
            });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("application_not_found");
        }

        [Fact]
        public async Task UpdateProjectAsync_EditExistingApplication_Succeeds()
        {
            using var _ = new BlocksTestContext();
            var tenant = new Tenant
            { DbConnectionString = "mongodb://x", JwtTokenParameters = new JwtTokenParameters { IssueDate = System.DateTime.UtcNow, PrivateCertificatePassword = "pwd" },
                TenantId = "t1",
                Applications = new List<Applications> { new() { Domain = "https://old.example.com" } }
            };
            _repo.Setup(r => r.GetByTenantIdAsync(It.IsAny<string>())).ReturnsAsync(tenant);
            _tenants.Setup(t => t.UpdateTenantVersionAsync(It.IsAny<TenantCacheUpdateMessage>())).Returns(Task.CompletedTask);

            var response = await Service().UpdateProjectAsync(new UpdateProjectRequest
            {
                Action = ApplicationAction.Edit,
                ApplicationDomain = "https://old.example.com",
                Application = new Application { Domain = "https://new.example.com", CookieDomain = "example.com" }
            });

            response.IsSuccess.Should().BeTrue();
            tenant.Applications[0].Domain.Should().Be("https://new.example.com");
        }

        [Fact]
        public async Task UpdateProjectAsync_DeleteApplication_Succeeds()
        {
            using var _ = new BlocksTestContext();
            var tenant = new Tenant
            { DbConnectionString = "mongodb://x", JwtTokenParameters = new JwtTokenParameters { IssueDate = System.DateTime.UtcNow, PrivateCertificatePassword = "pwd" },
                TenantId = "t1",
                Applications = new List<Applications> { new() { Domain = "https://del.example.com" } }
            };
            _repo.Setup(r => r.GetByTenantIdAsync(It.IsAny<string>())).ReturnsAsync(tenant);
            _tenants.Setup(t => t.UpdateTenantVersionAsync(It.IsAny<TenantCacheUpdateMessage>())).Returns(Task.CompletedTask);

            var response = await Service().UpdateProjectAsync(new UpdateProjectRequest
            {
                Action = ApplicationAction.Delete,
                ApplicationDomain = "https://del.example.com"
            });

            response.IsSuccess.Should().BeTrue();
            tenant.Applications.Should().BeEmpty();
        }

        private static Tenant TenantWith(params Applications[] applications) => new()
        {
            DbConnectionString = "mongodb://x",
            JwtTokenParameters = new JwtTokenParameters { IssueDate = System.DateTime.UtcNow, PrivateCertificatePassword = "pwd" },
            TenantId = "t1",
            Applications = new List<Applications>(applications)
        };

        [Fact]
        public async Task UpdateProjectAsync_DeleteProvisionedApplication_UnbindsItsOwnHost()
        {
            using var _ = new BlocksTestContext();
            var tenant = TenantWith(new Applications
            {
                Domain = "https://del.example.com",
                CookieDomain = "example.com",
                IsDomainVerified = true
            });
            _repo.Setup(r => r.GetByTenantIdAsync(It.IsAny<string>())).ReturnsAsync(tenant);
            _tenants.Setup(t => t.UpdateTenantVersionAsync(It.IsAny<TenantCacheUpdateMessage>())).Returns(Task.CompletedTask);

            ConsumerMessage<DisableDomainBindingRequest>? sent = null;
            _messageClient
                .Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<DisableDomainBindingRequest>>()))
                .Callback<ConsumerMessage<DisableDomainBindingRequest>>(m => sent = m)
                .Returns(Task.CompletedTask);

            var response = await Service().UpdateProjectAsync(new UpdateProjectRequest
            {
                Action = ApplicationAction.Delete,
                ApplicationDomain = "https://del.example.com"
            });

            response.IsSuccess.Should().BeTrue();
            sent.Should().NotBeNull();
            // The application's own host — never the shared blocksapi one, which
            // still serves every other app under example.com.
            sent!.Payload.Domain.Should().Be("https://del.example.com");
            // The tenant id, which is what the consumer looks the project up by.
            sent.Payload.ProjectId.Should().Be("t1");
            // Delete means delete: the certificate goes with the vhost.
            sent.Payload.DeleteCertificate.Should().BeTrue();
        }

        [Fact]
        public async Task UpdateProjectAsync_DeleteApplication_LeavesTheSharedApiHostAloneByDefault()
        {
            using var _ = new BlocksTestContext();
            var tenant = TenantWith(new Applications
            {
                Domain = "https://del.example.com",
                CookieDomain = "example.com",
                IsDomainVerified = true
            });
            _repo.Setup(r => r.GetByTenantIdAsync(It.IsAny<string>())).ReturnsAsync(tenant);
            _tenants.Setup(t => t.UpdateTenantVersionAsync(It.IsAny<TenantCacheUpdateMessage>())).Returns(Task.CompletedTask);

            var sent = new List<DisableDomainBindingRequest>();
            _messageClient
                .Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<DisableDomainBindingRequest>>()))
                .Callback<ConsumerMessage<DisableDomainBindingRequest>>(m => sent.Add(m.Payload))
                .Returns(Task.CompletedTask);

            var response = await Service().UpdateProjectAsync(new UpdateProjectRequest
            {
                Action = ApplicationAction.Delete,
                ApplicationDomain = "https://del.example.com"
            });

            response.IsSuccess.Should().BeTrue();
            sent.Select(p => p.Domain).Should().BeEquivalentTo("https://del.example.com");
        }

        [Fact]
        public async Task UpdateProjectAsync_DeleteApplication_ReleasesTheSharedApiHostWhenAsked()
        {
            using var _ = new BlocksTestContext();
            var tenant = TenantWith(new Applications
            {
                Domain = "https://del.example.com",
                CookieDomain = "example.com",
                IsDomainVerified = true
            });
            _repo.Setup(r => r.GetByTenantIdAsync(It.IsAny<string>())).ReturnsAsync(tenant);
            _tenants.Setup(t => t.UpdateTenantVersionAsync(It.IsAny<TenantCacheUpdateMessage>())).Returns(Task.CompletedTask);

            var sent = new List<DisableDomainBindingRequest>();
            _messageClient
                .Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<DisableDomainBindingRequest>>()))
                .Callback<ConsumerMessage<DisableDomainBindingRequest>>(m => sent.Add(m.Payload))
                .Returns(Task.CompletedTask);

            var response = await Service(WithCnameRecordDomain("blocksapi")).UpdateProjectAsync(new UpdateProjectRequest
            {
                Action = ApplicationAction.Delete,
                ApplicationDomain = "https://del.example.com",
                DeleteSharedApiHost = true
            });

            response.IsSuccess.Should().BeTrue();
            // The API host is built from the cookie domain captured before the
            // record was removed — the worker can no longer look it up.
            sent.Select(p => p.Domain).Should().BeEquivalentTo("https://del.example.com", "blocksapi.example.com");
            sent.Should().OnlyContain(p => p.DeleteCertificate);
        }

        [Fact]
        public async Task UpdateProjectAsync_DeleteApplication_SkipsTheSharedApiHostWithoutACnameLabel()
        {
            using var _ = new BlocksTestContext();
            var tenant = TenantWith(new Applications
            {
                Domain = "https://del.example.com",
                CookieDomain = "example.com",
                IsDomainVerified = true
            });
            _repo.Setup(r => r.GetByTenantIdAsync(It.IsAny<string>())).ReturnsAsync(tenant);
            _tenants.Setup(t => t.UpdateTenantVersionAsync(It.IsAny<TenantCacheUpdateMessage>())).Returns(Task.CompletedTask);

            var sent = new List<DisableDomainBindingRequest>();
            _messageClient
                .Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<DisableDomainBindingRequest>>()))
                .Callback<ConsumerMessage<DisableDomainBindingRequest>>(m => sent.Add(m.Payload))
                .Returns(Task.CompletedTask);

            // No CnameRecordDomain configured would build ".example.com".
            var response = await Service().UpdateProjectAsync(new UpdateProjectRequest
            {
                Action = ApplicationAction.Delete,
                ApplicationDomain = "https://del.example.com",
                DeleteSharedApiHost = true
            });

            response.IsSuccess.Should().BeTrue();
            sent.Select(p => p.Domain).Should().BeEquivalentTo("https://del.example.com");
        }

        [Fact]
        public async Task UpdateProjectAsync_RenameApplication_KeepsTheCertificate()
        {
            using var _ = new BlocksTestContext();
            var tenant = TenantWith(new Applications
            {
                Domain = "https://old.example.com",
                CookieDomain = "example.com",
                IsDomainVerified = true
            });
            _repo.Setup(r => r.GetByTenantIdAsync(It.IsAny<string>())).ReturnsAsync(tenant);
            _tenants.Setup(t => t.UpdateTenantVersionAsync(It.IsAny<TenantCacheUpdateMessage>())).Returns(Task.CompletedTask);

            ConsumerMessage<DisableDomainBindingRequest>? sent = null;
            _messageClient
                .Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<DisableDomainBindingRequest>>()))
                .Callback<ConsumerMessage<DisableDomainBindingRequest>>(m => sent = m)
                .Returns(Task.CompletedTask);

            var response = await Service().UpdateProjectAsync(new UpdateProjectRequest
            {
                Action = ApplicationAction.Edit,
                ApplicationDomain = "https://old.example.com",
                Application = new Application { Domain = "https://new.example.com", CookieDomain = "example.com" }
            });

            response.IsSuccess.Should().BeTrue();
            // A rename is a move, not a removal — the lineage survives.
            sent.Should().NotBeNull();
            sent!.Payload.DeleteCertificate.Should().BeFalse();
        }

        [Fact]
        public async Task UpdateProjectAsync_DeletePlatformHostedApplication_IgnoresTheCertificateChoice()
        {
            using var _ = new BlocksTestContext();
            // Served by shared platform infrastructure, so its certificate is not
            // this project's to remove no matter what the caller asks for.
            var tenant = TenantWith(new Applications
            {
                Domain = "https://xyz.slsblx.com",
                CookieDomain = "slsblx.com",
                IsDomainVerified = true
            });
            _repo.Setup(r => r.GetByTenantIdAsync(It.IsAny<string>())).ReturnsAsync(tenant);
            _tenants.Setup(t => t.UpdateTenantVersionAsync(It.IsAny<TenantCacheUpdateMessage>())).Returns(Task.CompletedTask);

            var response = await Service().UpdateProjectAsync(new UpdateProjectRequest
            {
                Action = ApplicationAction.Delete,
                ApplicationDomain = "https://xyz.slsblx.com",
                DeleteSharedApiHost = true
            });

            response.IsSuccess.Should().BeTrue();
            _messageClient.Verify(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<DisableDomainBindingRequest>>()), Times.Never);
        }

        [Fact]
        public async Task UpdateProjectAsync_DeleteUnprovisionedApplication_DoesNotUnbind()
        {
            using var _ = new BlocksTestContext();
            // Never verified, so nothing was ever written to the proxy for it.
            var tenant = TenantWith(new Applications { Domain = "https://del.example.com", IsDomainVerified = false });
            _repo.Setup(r => r.GetByTenantIdAsync(It.IsAny<string>())).ReturnsAsync(tenant);
            _tenants.Setup(t => t.UpdateTenantVersionAsync(It.IsAny<TenantCacheUpdateMessage>())).Returns(Task.CompletedTask);

            var response = await Service().UpdateProjectAsync(new UpdateProjectRequest
            {
                Action = ApplicationAction.Delete,
                ApplicationDomain = "https://del.example.com"
            });

            response.IsSuccess.Should().BeTrue();
            _messageClient.Verify(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<DisableDomainBindingRequest>>()), Times.Never);
        }

        [Fact]
        public async Task UpdateProjectAsync_EditMovesHost_UnbindsPreviousHost()
        {
            using var _ = new BlocksTestContext();
            var tenant = TenantWith(new Applications
            {
                Domain = "https://old.example.com",
                CookieDomain = "example.com",
                IsDomainVerified = true
            });
            _repo.Setup(r => r.GetByTenantIdAsync(It.IsAny<string>())).ReturnsAsync(tenant);
            _tenants.Setup(t => t.UpdateTenantVersionAsync(It.IsAny<TenantCacheUpdateMessage>())).Returns(Task.CompletedTask);

            ConsumerMessage<DisableDomainBindingRequest>? sent = null;
            _messageClient
                .Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<DisableDomainBindingRequest>>()))
                .Callback<ConsumerMessage<DisableDomainBindingRequest>>(m => sent = m)
                .Returns(Task.CompletedTask);

            var response = await Service().UpdateProjectAsync(new UpdateProjectRequest
            {
                Action = ApplicationAction.Edit,
                ApplicationDomain = "https://old.example.com",
                Application = new Application { Domain = "https://new.example.com", CookieDomain = "example.com" }
            });

            response.IsSuccess.Should().BeTrue();
            // The record has already been rewritten in place; the unbind still has
            // to name the host the application answered on before the edit.
            sent.Should().NotBeNull();
            sent!.Payload.Domain.Should().Be("https://old.example.com");
        }

        [Fact]
        public async Task UpdateProjectAsync_EditKeepsHost_DoesNotUnbind()
        {
            using var _ = new BlocksTestContext();
            var tenant = TenantWith(new Applications
            {
                Domain = "https://app.example.com",
                CookieDomain = "example.com",
                IsDomainVerified = true
            });
            _repo.Setup(r => r.GetByTenantIdAsync(It.IsAny<string>())).ReturnsAsync(tenant);
            _tenants.Setup(t => t.UpdateTenantVersionAsync(It.IsAny<TenantCacheUpdateMessage>())).Returns(Task.CompletedTask);

            var response = await Service().UpdateProjectAsync(new UpdateProjectRequest
            {
                Action = ApplicationAction.Edit,
                ApplicationDomain = "https://app.example.com",
                // Only the cookie domain moves — the vhost stays in use.
                Application = new Application { Domain = "https://app.example.com", CookieDomain = "sub.example.com" }
            });

            response.IsSuccess.Should().BeTrue();
            _messageClient.Verify(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<DisableDomainBindingRequest>>()), Times.Never);
        }

        [Fact]
        public async Task DisableProjectAsync_NotFound_ReturnsError()
        {
            using var _ = new BlocksTestContext();
            _tenants.Setup(t => t.GetTenantByID(It.IsAny<string>())).Returns((Tenant?)null);

            var response = await Service().DisableProjectAsync("missing");

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("project_not_found");
        }

        [Fact]
        public async Task DisableProjectAsync_Found_DisablesAndUnbindsEveryProvisionedHost()
        {
            using var _ = new BlocksTestContext();
            var tenant = TenantWith(
                new Applications { Domain = "https://app.example.com", CookieDomain = "example.com", IsDomainVerified = true },
                new Applications { Domain = "https://admin.example.com", CookieDomain = "example.com", IsDomainVerified = true },
                // Platform-hosted and never provisioned by this project — both stay put.
                new Applications { Domain = "https://xyz.slsblx.com", CookieDomain = "slsblx.com", IsDomainVerified = true },
                new Applications { Domain = "https://unverified.example.com", CookieDomain = "example.com" });
            _tenants.Setup(t => t.GetTenantByID("t1")).Returns(tenant);
            _tenants.Setup(t => t.UpdateTenantVersionAsync(It.IsAny<TenantCacheUpdateMessage>())).Returns(Task.CompletedTask);

            var sent = new List<DisableDomainBindingRequest>();
            _messageClient
                .Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<DisableDomainBindingRequest>>()))
                .Callback<ConsumerMessage<DisableDomainBindingRequest>>(m => sent.Add(m.Payload))
                .Returns(Task.CompletedTask);

            var response = await Service().DisableProjectAsync("t1");

            response.IsSuccess.Should().BeTrue();
            tenant.IsDisabled.Should().BeTrue();
            _repo.Verify(r => r.DeletePrjectPeopleAsync("t1"), Times.Once);
            // Each application's own host, not just the first one, and never the
            // shared blocksapi host that other projects under example.com rely on.
            sent.Select(p => p.Domain).Should().BeEquivalentTo("https://app.example.com", "https://admin.example.com");
            // Disabling is reversible, so the certificates are left for a restore.
            sent.Should().OnlyContain(p => !p.DeleteCertificate);
        }

        [Fact]
        public async Task GetAssetAsync_DelegatesToRepository()
        {
            var asset = new TenantAsset { TenantGroupId = "g" };
            _repo.Setup(r => r.GetTenantAssetAsync(It.IsAny<GetAssetRequest>())).ReturnsAsync((asset, 3L));

            var response = await Service().GetAssetAsync(new GetAssetRequest { TenantGroupId = "g" });

            response.IsSuccess.Should().BeTrue();
            response.Assets.Should().BeSameAs(asset);
            response.TotalCount.Should().Be(3);
        }

        [Fact]
        public async Task AddAssetAsync_NewResource_SavesAndUpdatesRepo()
        {
            using var _ = new BlocksTestContext();
            var asset = new TenantAsset { TenantGroupId = "g", Resources = new List<Resource>() };
            _repo.Setup(r => r.GetTenantAssetByGroupIdAsync("g")).ReturnsAsync(asset);

            var response = await Service().AddAssetAsync(new AddAssetRequest
            {
                TenantGroupId = "g",
                Resource = new Resource { ResourceId = "r1", Name = "repo" }
            });

            response.IsSuccess.Should().BeTrue();
            response.Status.Should().Be(AssetMutationStatus.Added);
            asset.Resources.Should().ContainSingle(r => r.ResourceId == "r1");
            _repo.Verify(r => r.SaveTenantAssetAsync(asset), Times.Once);
            _repo.Verify(r => r.UpdateRepoResourceAsync(It.IsAny<AddAssetRequest>()), Times.Once);
            _repo.Verify(r => r.UpdateRepoResourceInfoAsync(It.IsAny<AddAssetRequest>()), Times.Never);
        }

        [Fact]
        public async Task AddAssetAsync_NewResource_StampsServerOwnedFields()
        {
            using var _ = new BlocksTestContext();
            var asset = new TenantAsset { TenantGroupId = "g", Resources = new List<Resource>() };
            _repo.Setup(r => r.GetTenantAssetByGroupIdAsync("g")).ReturnsAsync(asset);

            await Service().AddAssetAsync(new AddAssetRequest
            {
                TenantGroupId = "g",
                // A caller must not be able to import a repository that is already archived.
                Resource = new Resource { ResourceId = "r1", Name = "repo", IsArchived = true }
            });

            var stored = asset.Resources.Single();
            stored.IsArchived.Should().BeFalse();
            stored.CreatedDate.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromMinutes(1));
            stored.LastUpdatedDate.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromMinutes(1));
        }

        // Deleting archives the row, so re-adding the same repository has to revive it rather
        // than leave a second entry behind for the same id.
        [Fact]
        public async Task AddAssetAsync_ArchivedResource_RestoresWithoutDuplicating()
        {
            using var _ = new BlocksTestContext();
            var created = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            var asset = new TenantAsset
            {
                TenantGroupId = "g",
                Resources = new List<Resource>
                {
                    new()
                    {
                        ResourceId = "r1",
                        Name = "owner/repo",
                        Link = "https://github.com/owner/repo",
                        CreatedDate = created,
                        IsArchived = true
                    }
                }
            };
            _repo.Setup(r => r.GetTenantAssetByGroupIdAsync("g")).ReturnsAsync(asset);

            var response = await Service().AddAssetAsync(new AddAssetRequest
            {
                TenantGroupId = "g",
                Resource = new Resource { ResourceId = "r1", Name = "owner/repo", Link = "https://github.com/owner/repo" }
            });

            response.Status.Should().Be(AssetMutationStatus.Restored);
            asset.Resources.Should().HaveCount(1);
            asset.Resources[0].IsArchived.Should().BeFalse();
            asset.Resources[0].CreatedDate.Should().Be(created);
            _repo.Verify(r => r.SaveTenantAssetAsync(asset), Times.Once);
            // The per-tenant Repos rows were never removed, so restoring must not insert more.
            _repo.Verify(r => r.UpdateRepoResourceAsync(It.IsAny<AddAssetRequest>()), Times.Never);
            _repo.Verify(r => r.UpdateRepoResourceInfoAsync(It.IsAny<AddAssetRequest>()), Times.Once);
        }

        [Fact]
        public async Task AddAssetAsync_ArchivedResourceRenamedWhileGone_RestoresWithTheNewDetails()
        {
            using var _ = new BlocksTestContext();
            var asset = new TenantAsset
            {
                TenantGroupId = "g",
                Resources = new List<Resource>
                {
                    new() { ResourceId = "r1", Name = "owner/old", Link = "https://github.com/owner/old", IsArchived = true }
                }
            };
            _repo.Setup(r => r.GetTenantAssetByGroupIdAsync("g")).ReturnsAsync(asset);

            var response = await Service().AddAssetAsync(new AddAssetRequest
            {
                TenantGroupId = "g",
                Resource = new Resource { ResourceId = "r1", Name = "owner/new", Link = "https://github.com/owner/new" }
            });

            response.Status.Should().Be(AssetMutationStatus.Restored);
            asset.Resources[0].Name.Should().Be("owner/new");
            asset.Resources[0].Link.Should().Be("https://github.com/owner/new");
            asset.Resources[0].IsArchived.Should().BeFalse();
        }

        [Fact]
        public async Task DeleteAssetAsync_ArchivesTheResourceInsteadOfRemovingIt()
        {
            using var _ = new BlocksTestContext();
            var asset = new TenantAsset
            {
                TenantGroupId = "g",
                Resources = new List<Resource>
                {
                    new() { ResourceId = "r1", Name = "repo" },
                    new() { ResourceId = "r2", Name = "other" }
                }
            };
            _repo.Setup(r => r.GetTenantAssetByGroupIdAsync("g")).ReturnsAsync(asset);

            var response = await Service().DeleteAssetAsync(new DeleteAssetRequest
            {
                TenantGroupId = "g",
                ResourceId = "r1"
            });

            response.IsSuccess.Should().BeTrue();
            asset.Resources.Should().HaveCount(2);
            asset.Resources.Single(r => r.ResourceId == "r1").IsArchived.Should().BeTrue();
            asset.Resources.Single(r => r.ResourceId == "r2").IsArchived.Should().BeFalse();
            _repo.Verify(r => r.SaveTenantAssetAsync(asset), Times.Once);
            // The copy every tenant in the group holds is flagged too.
            _repo.Verify(r => r.ArchiveRepoResourceAsync(It.Is<DeleteAssetRequest>(
                d => d.TenantGroupId == "g" && d.ResourceId == "r1")), Times.Once);
        }

        [Theory]
        [InlineData("missing")]
        [InlineData("r1")]
        public async Task DeleteAssetAsync_UnknownOrAlreadyArchivedResource_ReturnsError(string resourceId)
        {
            using var _ = new BlocksTestContext();
            var asset = new TenantAsset
            {
                TenantGroupId = "g",
                Resources = new List<Resource> { new() { ResourceId = "r1", IsArchived = true } }
            };
            _repo.Setup(r => r.GetTenantAssetByGroupIdAsync("g")).ReturnsAsync(asset);

            var response = await Service().DeleteAssetAsync(new DeleteAssetRequest
            {
                TenantGroupId = "g",
                ResourceId = resourceId
            });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("resource_not_found");
            _repo.Verify(r => r.SaveTenantAssetAsync(It.IsAny<TenantAsset>()), Times.Never);
            _repo.Verify(r => r.ArchiveRepoResourceAsync(It.IsAny<DeleteAssetRequest>()), Times.Never);
        }

        [Fact]
        public async Task DeleteAssetAsync_NoAssetForGroup_ReturnsError()
        {
            using var _ = new BlocksTestContext();
            _repo.Setup(r => r.GetTenantAssetByGroupIdAsync("g")).ReturnsAsync((TenantAsset?)null);

            var response = await Service().DeleteAssetAsync(new DeleteAssetRequest
            {
                TenantGroupId = "g",
                ResourceId = "r1"
            });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("resource_not_found");
        }

        private List<ConsumerMessage<ProjectDeleteQueue>> CaptureTeardownMessages()
        {
            var sent = new List<ConsumerMessage<ProjectDeleteQueue>>();
            _messageClient
                .Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<ProjectDeleteQueue>>()))
                .Callback<ConsumerMessage<ProjectDeleteQueue>>(sent.Add)
                .Returns(Task.CompletedTask);
            return sent;
        }

        /// <summary>
        /// Group + resource and nothing else. A ProjectId here would narrow blocks-release to one
        /// project, leaving the same repository deployed in every other project of the group.
        /// </summary>
        [Fact]
        public async Task DeleteAssetAsync_AsksReleaseToTearTheResourceDownAcrossTheGroup()
        {
            using var _ = new BlocksTestContext();
            var asset = new TenantAsset
            {
                TenantGroupId = "g",
                Resources = new List<Resource> { new() { ResourceId = "r1", Name = "repo" } }
            };
            _repo.Setup(r => r.GetTenantAssetByGroupIdAsync("g")).ReturnsAsync(asset);
            var sent = CaptureTeardownMessages();

            var response = await Service().DeleteAssetAsync(new DeleteAssetRequest
            {
                TenantGroupId = "g",
                ResourceId = "r1"
            });

            response.IsSuccess.Should().BeTrue();
            sent.Should().ContainSingle();
            sent[0].ConsumerName.Should().Be("blocks_release_project_delete_listener");
            sent[0].Payload.TenantGroupId.Should().Be("g");
            sent[0].Payload.ResourceId.Should().Be("r1");
            sent[0].Payload.ProjectId.Should().BeNull();
        }

        [Theory]
        [InlineData("missing")]
        [InlineData("r1")]
        public async Task DeleteAssetAsync_NothingWasDeleted_AsksReleaseForNothing(string resourceId)
        {
            using var _ = new BlocksTestContext();
            var asset = new TenantAsset
            {
                TenantGroupId = "g",
                Resources = new List<Resource> { new() { ResourceId = "r1", IsArchived = true } }
            };
            _repo.Setup(r => r.GetTenantAssetByGroupIdAsync("g")).ReturnsAsync(asset);
            var sent = CaptureTeardownMessages();

            await Service().DeleteAssetAsync(new DeleteAssetRequest { TenantGroupId = "g", ResourceId = resourceId });

            sent.Should().BeEmpty();
        }

        /// <summary>
        /// The rows are already written by the time the message goes out, so a broker that is down must
        /// not report a completed delete back to the user as a failure.
        /// </summary>
        [Fact]
        public async Task DeleteAssetAsync_ReleaseUnreachable_StillReportsTheDeleteAsDone()
        {
            using var _ = new BlocksTestContext();
            var asset = new TenantAsset
            {
                TenantGroupId = "g",
                Resources = new List<Resource> { new() { ResourceId = "r1", Name = "repo" } }
            };
            _repo.Setup(r => r.GetTenantAssetByGroupIdAsync("g")).ReturnsAsync(asset);
            _messageClient
                .Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<ProjectDeleteQueue>>()))
                .ThrowsAsync(new System.InvalidOperationException("broker down"));

            var response = await Service().DeleteAssetAsync(new DeleteAssetRequest
            {
                TenantGroupId = "g",
                ResourceId = "r1"
            });

            response.IsSuccess.Should().BeTrue();
            asset.Resources[0].IsArchived.Should().BeTrue();
            _repo.Verify(r => r.ArchiveRepoResourceAsync(It.IsAny<DeleteAssetRequest>()), Times.Once);
        }

        /// <summary>
        /// Group + project and no ResourceId: every repository of this project goes, and naming one
        /// would instead single that repository out across every project in the group.
        /// </summary>
        [Fact]
        public async Task DisableProjectAsync_AsksReleaseToTearDownEveryRepoOfThatProject()
        {
            using var _ = new BlocksTestContext();
            var tenant = TenantWith();
            tenant.TenantGroupId = "g";
            _tenants.Setup(t => t.GetTenantByID("t1")).Returns(tenant);
            _tenants.Setup(t => t.UpdateTenantVersionAsync(It.IsAny<TenantCacheUpdateMessage>())).Returns(Task.CompletedTask);
            var sent = CaptureTeardownMessages();

            var response = await Service().DisableProjectAsync("t1");

            response.IsSuccess.Should().BeTrue();
            sent.Should().ContainSingle();
            sent[0].ConsumerName.Should().Be("blocks_release_project_delete_listener");
            sent[0].Payload.TenantGroupId.Should().Be("g");
            sent[0].Payload.ProjectId.Should().Be("t1");
            sent[0].Payload.ResourceId.Should().BeNull();
        }

        /// <summary>
        /// A message with no group is dropped by the consumer, so it is not worth the round trip.
        /// </summary>
        [Fact]
        public async Task DisableProjectAsync_ProjectWithoutAGroup_AsksReleaseForNothing()
        {
            using var _ = new BlocksTestContext();
            var tenant = TenantWith();
            _tenants.Setup(t => t.GetTenantByID("t1")).Returns(tenant);
            _tenants.Setup(t => t.UpdateTenantVersionAsync(It.IsAny<TenantCacheUpdateMessage>())).Returns(Task.CompletedTask);
            var sent = CaptureTeardownMessages();

            await Service().DisableProjectAsync("t1");

            sent.Should().BeEmpty();
        }

        [Fact]
        public async Task AddAssetAsync_RenamedResource_UpdatesInPlaceWithoutDuplicating()
        {
            using var _ = new BlocksTestContext();
            var asset = new TenantAsset
            {
                TenantGroupId = "g",
                Resources = new List<Resource>
                {
                    new() { ResourceId = "r1", Name = "owner/old-name", Link = "https://github.com/owner/old-name" }
                }
            };
            _repo.Setup(r => r.GetTenantAssetByGroupIdAsync("g")).ReturnsAsync(asset);

            var response = await Service().AddAssetAsync(new AddAssetRequest
            {
                TenantGroupId = "g",
                Resource = new Resource { ResourceId = "r1", Name = "owner/new-name", Link = "https://github.com/owner/new-name" }
            });

            response.IsSuccess.Should().BeTrue();
            response.Status.Should().Be(AssetMutationStatus.Updated);
            asset.Resources.Should().HaveCount(1);
            asset.Resources[0].Name.Should().Be("owner/new-name");
            asset.Resources[0].Link.Should().Be("https://github.com/owner/new-name");
            _repo.Verify(r => r.SaveTenantAssetAsync(asset), Times.Once);
            _repo.Verify(r => r.UpdateRepoResourceInfoAsync(It.IsAny<AddAssetRequest>()), Times.Once);
            _repo.Verify(r => r.UpdateRepoResourceAsync(It.IsAny<AddAssetRequest>()), Times.Never);
        }

        [Fact]
        public async Task AddAssetAsync_UnchangedResource_DoesNotWrite()
        {
            using var _ = new BlocksTestContext();
            var asset = new TenantAsset
            {
                TenantGroupId = "g",
                Resources = new List<Resource> { new() { ResourceId = "r1", Name = "repo", Link = "link" } }
            };
            _repo.Setup(r => r.GetTenantAssetByGroupIdAsync("g")).ReturnsAsync(asset);

            var response = await Service().AddAssetAsync(new AddAssetRequest
            {
                TenantGroupId = "g",
                Resource = new Resource { ResourceId = "r1", Name = "repo", Link = "link" }
            });

            response.IsSuccess.Should().BeTrue();
            response.Status.Should().Be(AssetMutationStatus.Unchanged);
            asset.Resources.Should().HaveCount(1);
            _repo.Verify(r => r.SaveTenantAssetAsync(It.IsAny<TenantAsset>()), Times.Never);
            _repo.Verify(r => r.UpdateRepoResourceInfoAsync(It.IsAny<AddAssetRequest>()), Times.Never);
        }

        // The paged read truncates Resources to a single page, so saving its result back would
        // delete every resource past that page.
        [Fact]
        public async Task AddAssetAsync_ReadsTheAssetUnpaged()
        {
            using var _ = new BlocksTestContext();
            _repo.Setup(r => r.GetTenantAssetByGroupIdAsync("g"))
                 .ReturnsAsync(new TenantAsset { TenantGroupId = "g", Resources = new List<Resource>() });

            await Service().AddAssetAsync(new AddAssetRequest
            {
                TenantGroupId = "g",
                Resource = new Resource { ResourceId = "r1" }
            });

            _repo.Verify(r => r.GetTenantAssetAsync(It.IsAny<GetAssetRequest>()), Times.Never);
        }

        [Fact]
        public async Task AddAssetAsync_NoExistingAsset_CreatesGroupAsset()
        {
            using var _ = new BlocksTestContext();
            _repo.Setup(r => r.GetTenantAssetByGroupIdAsync("g")).ReturnsAsync((TenantAsset?)null);

            TenantAsset? saved = null;
            _repo.Setup(r => r.SaveTenantAssetAsync(It.IsAny<TenantAsset>()))
                 .Callback<TenantAsset>(a => saved = a)
                 .Returns(Task.CompletedTask);

            var response = await Service().AddAssetAsync(new AddAssetRequest
            {
                TenantGroupId = "g",
                Resource = new Resource { ResourceId = "r1", Name = "repo" }
            });

            response.Status.Should().Be(AssetMutationStatus.Added);
            saved.Should().NotBeNull();
            saved!.TenantGroupId.Should().Be("g");
            saved.Resources.Should().ContainSingle(r => r.ResourceId == "r1");
        }

        [Fact]
        public async Task UpdateTokenValidationParametersAsync_NotFound_ReturnsError()
        {
            using var _ = new BlocksTestContext();
            _repo.Setup(r => r.GetByTenantIdAsync(It.IsAny<string>())).ReturnsAsync((Tenant?)null);

            var response = await Service().UpdateTokenValidationParametersAsync(new UpdateTokenValidationParametersRequest());

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("project_not_found");
        }

        [Fact]
        public async Task UpdateTokenValidationParametersAsync_Found_UpdatesAndClearsCache()
        {
            using var _ = new BlocksTestContext(tenantId: "t1");
            var tenant = new Tenant { DbConnectionString = "mongodb://x", JwtTokenParameters = new JwtTokenParameters { IssueDate = System.DateTime.UtcNow, PrivateCertificatePassword = "pwd" }, TenantId = "t1" };
            _repo.Setup(r => r.GetByTenantIdAsync(It.IsAny<string>())).ReturnsAsync(tenant);
            _tenants.Setup(t => t.UpdateTenantVersionAsync(It.IsAny<TenantCacheUpdateMessage>())).Returns(Task.CompletedTask);
            _cache.Setup(c => c.RemoveKeyAsync(It.IsAny<string>())).ReturnsAsync(true);

            var response = await Service().UpdateTokenValidationParametersAsync(new UpdateTokenValidationParametersRequest
            {
                ProviderName = "auth0",
                Issuer = "https://issuer",
                JwksUrl = "https://jwks"
            });

            response.IsSuccess.Should().BeTrue();
            tenant.ThirdPartyJwtTokenParameters.ProviderName.Should().Be("auth0");
            _cache.Verify(c => c.RemoveKeyAsync(It.IsAny<string>()), Times.Once);
        }

        [Fact]
        public async Task GetProjectTokenValidationParametersAsync_NotFound_ReturnsNotFound()
        {
            _repo.Setup(r => r.GetByTenantIdAsync("missing")).ReturnsAsync((Tenant?)null);

            var result = await Service().GetProjectTokenValidationParametersAsync("missing");

            result.Should().BeOfType<NotFoundObjectResult>();
        }

        [Fact]
        public async Task GetProjectTokenValidationParametersAsync_Configured_ReturnsOk()
        {
            var tenant = new Tenant
            { DbConnectionString = "mongodb://x", JwtTokenParameters = new JwtTokenParameters { IssueDate = System.DateTime.UtcNow, PrivateCertificatePassword = "pwd" },
                TenantId = "t1",
                ThirdPartyJwtTokenParameters = new ThirdPartyJwtTokenParameters { JwksUrl = "https://jwks" }
            };
            _repo.Setup(r => r.GetByTenantIdAsync("t1")).ReturnsAsync(tenant);

            var result = await Service().GetProjectTokenValidationParametersAsync("t1");

            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task GetProjectTokenValidationParametersAsync_NotConfigured_ReturnsOkWithFalse()
        {
            var tenant = new Tenant
            { DbConnectionString = "mongodb://x", JwtTokenParameters = new JwtTokenParameters { IssueDate = System.DateTime.UtcNow, PrivateCertificatePassword = "pwd" },
                TenantId = "t1",
                ThirdPartyJwtTokenParameters = new ThirdPartyJwtTokenParameters()
            };
            _repo.Setup(r => r.GetByTenantIdAsync("t1")).ReturnsAsync(tenant);

            var result = await Service().GetProjectTokenValidationParametersAsync("t1");

            var ok = result.Should().BeOfType<OkObjectResult>().Subject;
            ok.Value.Should().NotBeNull();
        }

        [Fact]
        public async Task SaveThirdPartyJWTClaimsAsync_New_SavesAndReturnsItemId()
        {
            using var _ = new BlocksTestContext();

            var response = await Service().SaveThirdPartyJWTClaimsAsync(new SaveThirdPartyJWTClaimsRequest
            {
                UserId = "u1",
                Email = "e@x.com",
                Name = "N"
            });

            response.IsSuccess.Should().BeTrue();
            response.ItemId.Should().NotBeNullOrEmpty();
            _repo.Verify(r => r.SaveJWTClaimsAsync(It.IsAny<ThirdPartyJWTClaims>()), Times.Once);
        }

        [Fact]
        public async Task SaveThirdPartyJWTClaimsAsync_Existing_LoadsThenSaves()
        {
            using var _ = new BlocksTestContext();
            _repo.Setup(r => r.GetThirdPartyJWTClaimsAsync("c-1"))
                 .ReturnsAsync(new ThirdPartyJWTClaims { ItemId = "c-1" });

            var response = await Service().SaveThirdPartyJWTClaimsAsync(new SaveThirdPartyJWTClaimsRequest
            {
                ItemId = "c-1",
                UserId = "u1"
            });

            response.IsSuccess.Should().BeTrue();
            response.ItemId.Should().Be("c-1");
        }

        [Fact]
        public async Task GetThirdPartyJWTClaimsAsync_DelegatesToRepository()
        {
            var claims = new ThirdPartyJWTClaims { ItemId = "c-1" };
            _repo.Setup(r => r.GetThirdPartyJWTClaimsAsync(string.Empty)).ReturnsAsync(claims);

            var result = await Service().GetThirdPartyJWTClaimsAsync();

            result.Should().BeSameAs(claims);
        }

        [Fact]
        public async Task UpdateTenantGroupAsync_UpdatesAndReturnsSuccess()
        {
            var response = await Service().UpdateTenantGroupAsync(new UpdateTenantGroupRequest
            {
                TenantGroupId = "g",
                Name = "New Name"
            });

            response.IsSuccess.Should().BeTrue();
            _repo.Verify(r => r.UpdateTenantGroupAsync(It.IsAny<UpdateTenantGroupRequest>()), Times.Once);
        }

        [Fact]
        public async Task ConfigureProjectAsync_FileSystemStorage_UploadsCertificatesAndUpdatesProject()
        {
            using var _ = new BlocksTestContext();
            SetupCertificatePipeline();

            var project = NewTenantForConfigure();

            await Service().ConfigureProjectAsync(project);

            _repo.Verify(r => r.InsertPeopleAsync(It.IsAny<ProjectPeople>()), Times.Once);
            _certManager.Verify(c => c.UploadPrivateCertificateAsync(
                CertificateStorageType.Filefilesystem, It.IsAny<X509Certificate2>(), It.IsAny<string>(), It.IsAny<string>()), Times.Once);
            _repo.Verify(r => r.UpdateProjectAsync(project), Times.Once);
            _repo.Verify(r => r.CreateDefaultConfigurationAsync(It.IsAny<ProjectStatusTracer>(), project), Times.Once);
            // Public certificate download URL should be persisted on the project.
            project.JwtTokenParameters.PublicCertificatePath.Should().Be("https://download/cert");
        }

        [Fact]
        public async Task ConfigureProjectAsync_DoesNotWriteASecondCreatorRow_WhenTheEnvironmentAlreadyHasAnOwner()
        {
            // The API now records ownership of a brand-new group before queueing it, so the
            // worker arrives at an environment that already has a creator row. The tracer flag
            // does not cover this -- it is a fresh tracer -- and neither does it cover a resumed
            // run that wrote the row and crashed before the flag was saved. Two creator rows for
            // one person on one tenant is what both used to produce.
            using var _ = new BlocksTestContext();
            SetupCertificatePipeline();
            _repo.Setup(r => r.GetOwnerUserIdAsync("t1")).ReturnsAsync("creator-1");

            await Service().ConfigureProjectAsync(NewTenantForConfigure());

            _repo.Verify(r => r.InsertPeopleAsync(It.IsAny<ProjectPeople>()), Times.Never);
        }

        [Fact]
        public async Task ConfigureProjectAsync_AnnouncesTenantUpdate_SoCachedCopiesAreReplaced()
        {
            using var _ = new BlocksTestContext();
            SetupCertificatePipeline();

            var project = NewTenantForConfigure();

            await Service().ConfigureProjectAsync(project);

            // Provisioning is the only write that sets PublicCertificatePath. Without this
            // broadcast, any service that cached the tenant while the certificate was being
            // generated keeps a copy that cannot validate the tenant's tokens.
            _tenants.Verify(t => t.UpdateTenantVersionAsync(It.Is<TenantCacheUpdateMessage>(m =>
                m.Action == "upsert" &&
                m.TenantId == "t1" &&
                m.Tenant!.JwtTokenParameters!.PublicCertificatePath == "https://download/cert")), Times.Once);
        }

        [Fact]
        public async Task ConfigureProjectAsync_DoesNotAnnounce_WhenResumedRunHasNoCertificatePath()
        {
            using var _ = new BlocksTestContext();
            SetupCertificatePipeline();

            var project = NewTenantForConfigure();

            // A resumed run: the certificates are already marked uploaded, so the upload step
            // short-circuits and never re-assigns the path. Broadcasting the blank project here
            // would replace good cached copies with a useless one.
            var tracer = new ProjectStatusTracer
            {
                ProjectId = project.ItemId,
                IsCertificatesUploaded = true
            };

            await Service().ConfigureProjectAsync(project, tracer);

            project.JwtTokenParameters.PublicCertificatePath.Should().BeNullOrEmpty();
            _tenants.Verify(t => t.UpdateTenantVersionAsync(It.IsAny<TenantCacheUpdateMessage>()), Times.Never);
        }

        [Fact]
        public async Task ConfigureProjectAsync_WhenCertificateGenerationThrows_RecordsError()
        {
            using var _ = new BlocksTestContext();
            _certManager.Setup(c => c.GenerateCertificates(It.IsAny<JwtTokenParameters>()))
                        .Throws(new System.InvalidOperationException("boom"));

            var project = NewTenantForConfigure();

            await Service().ConfigureProjectAsync(project);

            _repo.Verify(r => r.SaveStatusTracerAsync(It.Is<ProjectStatusTracer>(t => t.ErrorMessage == "boom")), Times.Once);
        }

        [Fact]
        public async Task RestoreUnfinishedProjectAsync_ConfiguresEachUnfinishedProjectAndMarksSuccess()
        {
            using var _ = new BlocksTestContext();
            SetupCertificatePipeline();

            var tracer = new ProjectStatusTracer { ProjectId = "p1" };
            _repo.Setup(r => r.GetAllUnfinishedProjectAsync()).ReturnsAsync(new List<ProjectStatusTracer> { tracer });
            _repo.Setup(r => r.GetByIdAsync("p1")).ReturnsAsync(NewTenantForConfigure());

            await Service().RestoreUnfinishedProjectAsync();

            // Configured without error, so it is marked successful and saved.
            _repo.Verify(r => r.SaveStatusTracerAsync(It.Is<ProjectStatusTracer>(t => t.IsProjectCreationSuccess)), Times.Once);
        }

        private void SetupCertificatePipeline()
        {
            var cert = CreateSelfSignedCertificate();
            _certManager.Setup(c => c.GenerateCertificates(It.IsAny<JwtTokenParameters>()))
                        .Returns((cert, cert));
            _certManager.Setup(c => c.GeneratePrivateCertificateName(It.IsAny<string>(), It.IsAny<string>()))
                        .Returns("private-cert-name");
            _certManager.Setup(c => c.UploadPrivateCertificateAsync(
                It.IsAny<CertificateStorageType>(), It.IsAny<X509Certificate2>(), It.IsAny<string>(), It.IsAny<string>()))
                        .Returns(Task.CompletedTask);
            _storage.Setup(s => s.UploadFileToLocalStorageAsync(It.IsAny<LocalStorageUploadRequest>()))
                    .ReturnsAsync(new LocalStorageUploadResponse { IsSuccess = true, FileId = "f1" });
            _storage.Setup(s => s.GetUrlForDownloadFileAsync(It.IsAny<GetFileRequest>()))
                    .ReturnsAsync(new FileResponse { IsSuccess = true, Url = "https://download/cert" });
        }

        private static Tenant NewTenantForConfigure() => new()
        {
            DbConnectionString = "mongodb://x",
            TenantId = "t1",
            ItemId = "item-1",
            CreatedBy = "creator",
            Applications = new List<Applications>(),
            JwtTokenParameters = new JwtTokenParameters
            {
                IssueDate = System.DateTime.UtcNow,
                PrivateCertificatePassword = "priv",
                PublicCertificatePassword = "pub",
                CertificateStorageType = CertificateStorageType.Filefilesystem
            }
        };

        private static X509Certificate2 CreateSelfSignedCertificate()
        {
            using var rsa = RSA.Create(2048);
            var request = new CertificateRequest("CN=Test", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
            return request.CreateSelfSigned(System.DateTimeOffset.UtcNow.AddDays(-1), System.DateTimeOffset.UtcNow.AddDays(1));
        }
    }
}
