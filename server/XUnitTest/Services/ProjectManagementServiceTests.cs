using System.Collections.Generic;
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

        private ProjectManagementService Service() => new(
            _repo.Object, _blocksSecret.Object, _messageClient.Object, _configuration,
            _storage.Object, _tenants.Object, _certManager.Object, _encoding.Object, _cache.Object);

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
        public async Task SaveProjectAsync_ExistingGroup_LoadsAssetsInsteadOfCreating()
        {
            using var _ = new BlocksTestContext();
            _repo.Setup(r => r.GetTenantAssetAsync(It.IsAny<GetAssetRequest>()))
                 .ReturnsAsync((new TenantAsset { Resources = new List<Resource>() }, 0L));

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
            _repo.Verify(r => r.GetTenantAssetAsync(It.IsAny<GetAssetRequest>()), Times.Once);
        }

        [Fact]
        public async Task GetProjectStatusAsync_UnfinishedTracer_ReturnsItsSuccessFlag()
        {
            _repo.Setup(r => r.GetUnfinishedProjectByIdAsync("p1"))
                 .ReturnsAsync(new ProjectStatusTracer { ProjectId = "p1", IsProjectCreationSuccess = true });

            (await Service().GetProjectStatusAsync("p1")).Should().BeTrue();
        }

        [Fact]
        public async Task GetProjectStatusAsync_NoTracerButTenantExists_ReturnsFalse()
        {
            _repo.Setup(r => r.GetUnfinishedProjectByIdAsync("p1")).ReturnsAsync((ProjectStatusTracer?)null);
            _repo.Setup(r => r.GetByIdAsync("p1")).ReturnsAsync(new Tenant
            {
                DbConnectionString = "x",
                JwtTokenParameters = new JwtTokenParameters { IssueDate = System.DateTime.UtcNow, PrivateCertificatePassword = "p" }
            });

            (await Service().GetProjectStatusAsync("p1")).Should().BeFalse();
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
        public async Task DisableProjectAsync_Found_DisablesAndNotifies()
        {
            using var _ = new BlocksTestContext();
            var tenant = new Tenant
            { DbConnectionString = "mongodb://x", JwtTokenParameters = new JwtTokenParameters { IssueDate = System.DateTime.UtcNow, PrivateCertificatePassword = "pwd" },
                TenantId = "t1",
                Applications = new List<Applications> { new() { CookieDomain = "example.com" } }
            };
            _tenants.Setup(t => t.GetTenantByID("t1")).Returns(tenant);
            _tenants.Setup(t => t.UpdateTenantVersionAsync(It.IsAny<TenantCacheUpdateMessage>())).Returns(Task.CompletedTask);

            var response = await Service().DisableProjectAsync("t1");

            response.IsSuccess.Should().BeTrue();
            tenant.IsDisabled.Should().BeTrue();
            _repo.Verify(r => r.DeletePrjectPeopleAsync("t1"), Times.Once);
            _messageClient.Verify(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<DisableDomainBindingRequest>>()), Times.Once);
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
            _repo.Setup(r => r.GetTenantAssetAsync(It.IsAny<GetAssetRequest>())).ReturnsAsync((asset, 0L));

            var response = await Service().AddAssetAsync(new AddAssetRequest
            {
                TenantGroupId = "g",
                Resource = new Resource { ResourceId = "r1", Name = "repo" }
            });

            response.IsSuccess.Should().BeTrue();
            asset.Resources.Should().ContainSingle(r => r.ResourceId == "r1");
            _repo.Verify(r => r.SaveTenantAssetAsync(asset), Times.Once);
        }

        [Fact]
        public async Task AddAssetAsync_ExistingResource_DoesNotDuplicate()
        {
            using var _ = new BlocksTestContext();
            var asset = new TenantAsset
            {
                TenantGroupId = "g",
                Resources = new List<Resource> { new() { ResourceId = "r1" } }
            };
            _repo.Setup(r => r.GetTenantAssetAsync(It.IsAny<GetAssetRequest>())).ReturnsAsync((asset, 0L));

            var response = await Service().AddAssetAsync(new AddAssetRequest
            {
                TenantGroupId = "g",
                Resource = new Resource { ResourceId = "r1" }
            });

            response.IsSuccess.Should().BeTrue();
            asset.Resources.Should().HaveCount(1);
            _repo.Verify(r => r.SaveTenantAssetAsync(It.IsAny<TenantAsset>()), Times.Never);
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
