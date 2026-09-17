using Blocks.Genesis;
using DomainService.Certificate;
using DomainService.Dtos;
using DomainService.Entities;
using DomainService.Shared;
using DomainService.Shared.Entities;
using DomainService.Shared.Services;
using DomainService.Storage;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using MongoDB.Driver;
using Storage.DomainService.Enums;
using StorageDriver;
using System.Net.Http.Headers;
using System.Security.Cryptography.X509Certificates;

namespace DomainService.Projects
{
    public class ProjectManagementService : IProjectManagementService
    {
        private readonly IProjectRepository _projectRepository;
        private readonly ITenants _tenants;
        private readonly ICertificateManager _certificateManager;
        private readonly IBlocksSecret _blocksSecret;
        private readonly IMessageClient _messageClient;
        private readonly IConfiguration _configuration;
        private readonly IStorageDriverService _storageDriverService;
        private readonly IEncodingService _urlEncodingService;
        private readonly ICacheClient _cacheClient;
        private readonly ICryptoService _cryptoService;

        private const string _tenantTokenPublicCertificateCachePrefix = "tetocertpublic::";


        public ProjectManagementService(IProjectRepository projectRepository,
                                        IBlocksSecret blocksSecret,
                                        IMessageClient messageClient,
                                        IConfiguration configuration,
                                        IStorageDriverService storageDriverService,
                                        ITenants tenants,
                                        ICertificateManager certificateManager,
                                        IEncodingService urlEncodingService,
                                        ICacheClient cacheClient,
                                        ICryptoService cryptoService)
        {
            _projectRepository = projectRepository;
            _blocksSecret = blocksSecret;
            _messageClient = messageClient;
            _configuration = configuration;
            _storageDriverService = storageDriverService;
            _tenants = tenants;
            _certificateManager = certificateManager;
            _urlEncodingService = urlEncodingService;
            _cacheClient = cacheClient;
            _cryptoService = cryptoService;
        }

        public async Task ConfigureProjectAsync(Tenant project, ProjectStatusTracer? projectStatus = null)
        {
            projectStatus ??= new ProjectStatusTracer { ProjectId = project.ItemId };

            try
            {
                await InsertIntoProjectPeopleAsync(projectStatus, project);

                (X509Certificate2 publicKeyCertificate, X509Certificate2 privateKeyCertificate) = _certificateManager.GenerateCertificates(project.JwtTokenParameters);

                await Task.WhenAll( UploadPrivateCertificateIfNeeded(projectStatus, privateKeyCertificate, project),
                                    UploadPublicCertificateIfNeeded(projectStatus, publicKeyCertificate, project));

                await Task.WhenAll(UpdateProjectIfNeeded(projectStatus, project),
                                   _projectRepository.CreateDefaultConfigurationAsync(projectStatus, project));

                await AnnounceTenantUpdateIfNeeded(project);
            }
            catch (Exception ex)
            {
                await HandleConfigurationErrorAsync(projectStatus, ex.Message);
            }
        }

        /// <summary>
        /// Broadcasts the provisioned tenant so every service replaces the copy it may have
        /// cached while the certificate was still being generated.
        /// </summary>
        /// <remarks>
        /// Provisioning is the only write that sets <c>JwtTokenParameters.PublicCertificatePath</c>,
        /// and it was the only project write that never announced itself. Any service that read
        /// this tenant between <c>InsertProjectAsync</c> and here holds a copy with no certificate
        /// path, and cannot validate tokens for the tenant until that process restarts.
        /// </remarks>
        private async Task AnnounceTenantUpdateIfNeeded(Tenant project)
        {
            // A resumed run whose certificates were already marked uploaded never re-assigns the
            // path, so the in-memory project can still be blank here. Broadcasting that would
            // replace good cached copies with a useless one, which is worse than staying quiet.
            if (string.IsNullOrWhiteSpace(project.JwtTokenParameters?.PublicCertificatePath))
            {
                return;
            }

            await _tenants.UpdateTenantVersionAsync(new TenantCacheUpdateMessage
            {
                Action = "upsert",
                TenantId = project.TenantId,
                Tenant = project
            });
        }

        private async Task InsertIntoProjectPeopleAsync(ProjectStatusTracer statusTracer, Tenant project)
        {
            if (statusTracer.InsertedIntoProjectPeople) return;

            // Idempotent per environment, which the tracer flag alone does not make it: a
            // brand-new group's environments are claimed by the API before they are queued, and
            // a resumed run can arrive here with the row already written and the flag not yet
            // saved. Both used to leave the same person holding two creator rows on one tenant.
            if (await _projectRepository.GetOwnerUserIdAsync(project.TenantId) is not null)
            {
                statusTracer.InsertedIntoProjectPeople = true;
                return;
            }

            // Ownership of a new environment belongs to the group's existing owner, never to
            // whoever created it. Ownership is "IsCreator on every tenant in the group", so
            // stamping the caller here would hand the whole group to anyone who could add an
            // environment to it. Creating an environment is owner-only today, which makes this
            // a no-op — and a permanent guard if that ever changes.
            var groupOwner = await _projectRepository.GetGroupOwnerAsync(project.TenantGroupId);

            await InsertCreatorRowAsync(project,
                groupOwner?.UserId ?? project.CreatedBy,
                // Taken from the owner's existing row rather than the caller's context: on the
                // restore path those are two different people, which used to stamp the
                // restorer's address onto the creator's row.
                groupOwner?.Email ?? BlocksContext.GetContext()?.UserName ?? "");

            statusTracer.InsertedIntoProjectPeople = true;

        }

        /// <summary>
        /// Records who owns one environment. <c>ProjectPeople.IsCreator</c> is the only place
        /// ownership is ever written — see docs/specs/transfer-ownership-createdby-decoupling.md
        /// — so both the API and the provisioning worker go through here rather than each
        /// composing the row themselves.
        /// </summary>
        private Task InsertCreatorRowAsync(Tenant project, string? userId, string email) =>
            _projectRepository.InsertPeopleAsync(new ProjectPeople
            {
                ItemId = Guid.NewGuid().ToString(),
                UserId = userId,
                TenantId = project.TenantId,
                IsCreator = true,
                CreatedDate = DateTime.UtcNow,
                LastUpdatedDate = DateTime.UtcNow,
                IsInvitationConfirmed = true,
                IsInvitationSent = true,
                Email = email
            });

        private async Task UploadPrivateCertificateIfNeeded(ProjectStatusTracer statusTracer, X509Certificate2 privateKeyCertificate, Tenant project)
        {
            if (statusTracer.IsCertificatesUploaded) return;

            await _certificateManager.UploadPrivateCertificateAsync(project.JwtTokenParameters.CertificateStorageType, privateKeyCertificate, project.JwtTokenParameters.PrivateCertificatePassword,
                _certificateManager.GeneratePrivateCertificateName(project.TenantId, project.ItemId));
        }

        private async Task UploadPublicCertificateIfNeeded(ProjectStatusTracer statusTracer, X509Certificate2 publicKeyCertificate, Tenant project)
        {
            if (statusTracer.IsCertificatesUploaded) return;

            var downloadUrl = await UploadPublicCertificateAsync(publicKeyCertificate, project);
            project.JwtTokenParameters.PublicCertificatePath = downloadUrl;
            statusTracer.IsCertificatesUploaded = true;
        }

        private async Task UpdateProjectIfNeeded(ProjectStatusTracer statusTracer, Tenant project)
        {
            if (statusTracer.IsProjectUpdated) return;

            await _projectRepository.UpdateProjectAsync(project);
            statusTracer.IsProjectUpdated = true;
        }

        private async Task HandleConfigurationErrorAsync(ProjectStatusTracer statusTracer, string errorMessage)
        {
            statusTracer.ErrorMessage = errorMessage;
            await _projectRepository.SaveStatusTracerAsync(statusTracer);
        }

        public async Task<string> UploadPublicCertificateAsync(X509Certificate2 publicKeyCertificate, Tenant project)
        {
            return project.JwtTokenParameters.CertificateStorageType switch
            {
                CertificateStorageType.Azure => await UploadPublicCertificateIntoCloudAsync(publicKeyCertificate, project),
                CertificateStorageType.Mongodb => await UploadPublicCertificateIntoCloudAsync(publicKeyCertificate, project),
                CertificateStorageType.Filefilesystem => await UploadPublicCertificateIntoFileSystemAsync(publicKeyCertificate, project),
                _ => throw new NotSupportedException($"Unsupported certificate storage type: {project.JwtTokenParameters.CertificateStorageType}"),
            };
        }

        public async Task<string> UploadPublicCertificateIntoFileSystemAsync(X509Certificate2 publicKeyCertificate, Tenant project)
        {
            FileResponse? fileResponse = new();
            string fileId = Guid.NewGuid().ToString();

            // Export the certificate to PFX bytes
            byte[] pfxBytes = publicKeyCertificate.Export(X509ContentType.Pkcs12, project.JwtTokenParameters.PublicCertificatePassword);

            // Create a memory stream from the bytes
            var memoryStream = new MemoryStream(pfxBytes);

            // Create IFormFile directly
            var formFile = new FormFile(memoryStream, 0, memoryStream.Length, "Certificate", "publicCertificate.pfx")
            {
                Headers = new HeaderDictionary(),
                ContentType = "application/x-pkcs12"
            };

            // Upload directly
            var response = await _storageDriverService.UploadFileToLocalStorageAsync(new LocalStorageUploadRequest
            {
                ItemId = fileId,
                File = formFile,
                Name = "PublicCert.pfx",
                AccessModifier = "Public"
            });

            if (response.IsSuccess)
            {
                fileResponse = await _storageDriverService.GetUrlForDownloadFileAsync(new GetFileRequest
                {
                    FileId = fileId
                });
            }

            return fileResponse?.Url ?? "";
        }

        private async Task<string> UploadPublicCertificateIntoCloudAsync(X509Certificate2 publicKeyCertificate, Tenant project)
        {
            var fileName = $"{project.TenantId}.pfx";
            var fileId = Guid.NewGuid().ToString();
            var presignedUrlResponse = await GetPreSingedUriForUpload(fileId, fileName);

            var content = GetByteArrayContent(publicKeyCertificate, project.JwtTokenParameters.PublicCertificatePassword);

            await UploadContentAsync(content, presignedUrlResponse.UploadUrl);

            if (presignedUrlResponse.UploadCompletionRequired)
            {
                var completion = await _storageDriverService.CompleteUploadAsync(new CompleteUploadRequest
                {
                    FileId = fileId,
                    FileVersionId = presignedUrlResponse.FileVersionId,
                });

                if (completion?.VerificationStatus != FileVerificationStatus.Verified)
                {
                    throw new InvalidOperationException(
                        $"Certificate upload was not verified: {completion?.RejectionReason}");
                }
            }

            var getFileResponse = await _storageDriverService.GetUrlForDownloadFileAsync(new GetFileRequest { FileId = fileId });
            if (getFileResponse == null || string.IsNullOrWhiteSpace(getFileResponse.Url))
                throw new InvalidOperationException("Storage service did not return a valid download URL.");

            return getFileResponse.Url;
        }

        private static async Task UploadContentAsync(ByteArrayContent content, string preSignedUri)
        {
            using var request = new HttpRequestMessage(HttpMethod.Put, preSignedUri)
            {
                Content = content
            };

            request.Headers.TryAddWithoutValidation("x-ms-blob-type", "BlockBlob");

            using var httpClient = new HttpClient();
            using var response = await httpClient.SendAsync(request);
            response.EnsureSuccessStatusCode();
        }

        private async Task<GetPreSignedUrlForUploadResponse> GetPreSingedUriForUpload(string fileId, string fileName)
        {
            var preSignedUriRequest = new GetPreSignedUrlForUploadRequest
            {
                ItemId = fileId,
                MetaData = "{\"Title\":{\"Type\":\"String\",\"Value\":\"certificate\"}," + "\"OriginalName\":{\"Type\":\"String\",\"Value\":\"publicCertificate.pfx\"}}",
                Name = fileName,
                Tags = "[\"File\"]",
                ParentDirectoryId = string.Empty,
                AccessModifier = "Public"
            };

            return await _storageDriverService.GetPerSignedUrlForUploadAsync(preSignedUriRequest);
        }

        private static ByteArrayContent GetByteArrayContent(X509Certificate2 certificate, string password)
        {
            byte[] bytes = certificate.Export(X509ContentType.Pkcs12, password);
            var content = new ByteArrayContent(bytes);
            content.Headers.ContentType = new MediaTypeHeaderValue("application/x-pkcs12");
            content.Headers.ContentLength = bytes.Length;
            return content;
        }

        public async Task<CreateProjectResponse> SaveProjectAsync(CreateProjectRequest project)
        {
            var isNewGroup = string.IsNullOrEmpty(project.TenantGroupId);
            var groupId = isNewGroup ? Guid.NewGuid().ToString("n") : project.TenantGroupId;
            await ManageTenantAssetAsync(project, groupId);

            foreach (var applicationContext in project.applicationContexts)
            {
                var tenant = await MapAsync(project, applicationContext, groupId);
                await Task.WhenAll(_projectRepository.SaveRepoInfoAsync(tenant, project.Resources),
                                   _projectRepository.InsertProjectAsync(tenant));

                // Ownership is recorded here rather than being left to the worker. Provisioning
                // is asynchronous, so the creator row appeared only once the worker had picked
                // the project up; until then the group had environments and no owner, and every
                // [ProjectPolicy(OwnerOnly)] endpoint refused the person who had just created
                // it — adding an environment and deleting the project among them.
                //
                // Only for a brand-new group, where the caller is the creator by definition.
                // Appending an environment to an existing group must leave ownership exactly
                // where it is, which is what the worker's GetGroupOwnerAsync goes on to do.
                if (isNewGroup)
                {
                    await InsertCreatorRowAsync(tenant, tenant.CreatedBy, BlocksContext.GetContext()?.UserName ?? "");
                }

                await Task.WhenAll(_messageClient.SendToConsumerAsync(new ConsumerMessage<Tenant> { ConsumerName = IdentifierConstants.IdentifierQueueName, Payload = tenant }));
            }

            return new CreateProjectResponse { IsSuccess = true, TenantGroupId = groupId };
        }

        private async Task<string> GetDefaultDomainAsync(Resource? resource, ApplicationContext application, string tenantIdGroupId)
        {
            var tenantSlug = await _urlEncodingService.EncodeToBase26Async(tenantIdGroupId, tenantIdGroupId, 5);
            var repoSlug = await _urlEncodingService.EncodeToBase26Async(resource?.ResourceId ?? string.Empty, tenantIdGroupId, 5);
            return IdentifierHelper.BuildPlatformSubdomain(application.Environment, tenantSlug, repoSlug, _configuration["KbtclIdentifier"] ?? string.Empty);
        }

        // Every repository the group owns gets its own generated host in this environment, and
        // each of those has to be a registered application or it fails the origin allow-list the
        // moment it serves a request. A project created with several repositories, and every
        // environment added to a group that already has them, both land here — which is why this
        // walks the whole list rather than the first entry. The first resource stays first: several
        // callers still read Applications[0] as the project's own domain.
        private async Task<List<string>> GetDefaultDomainsAsync(List<Resource>? resources, ApplicationContext application, string tenantIdGroupId)
        {
            // No repositories yet. The project still needs one host of its own, derived from the
            // group alone — the same domain GetDefaultDomainAsync returns for a null resource.
            if (resources is null || resources.Count == 0)
            {
                return [await GetDefaultDomainAsync(null, application, tenantIdGroupId)];
            }

            var domains = new List<string>(resources.Count);

            foreach (var resource in resources)
            {
                domains.Add(await GetDefaultDomainAsync(resource, application, tenantIdGroupId));
            }

            return domains;
        }

        private async Task ManageTenantAssetAsync(CreateProjectRequest project, string customGroupId)
        {
            if (string.IsNullOrEmpty(project.TenantGroupId))
            {
                var asset = GetTenantAsset(project, customGroupId);
                await _projectRepository.UpdateTenantAssetAsync(asset);
                return;
            }

           // Unpaged: a new environment has to inherit every repository the group owns, not the
           // first page of them. Archived ones were deleted from the project, so they stay out.
           var assets = await _projectRepository.GetTenantAssetByGroupIdAsync(project.TenantGroupId);
           project.Resources = assets?.Resources?.Where(r => !r.IsArchived).ToList() ?? [];

        }

        private static TenantAsset GetTenantAsset(CreateProjectRequest createProjectRequest, string groupId)
        {
            return new TenantAsset
            {
                ItemId = Guid.NewGuid().ToString(),
                TenantGroupId = groupId,
                Resources = createProjectRequest.Resources ?? [],
                CreatedDate = DateTime.UtcNow,
                LastUpdatedDate = DateTime.UtcNow,
                CreatedBy = BlocksContext.GetContext()?.UserId,
                LastUpdatedBy = BlocksContext.GetContext()?.UserId,
            };
        }

        // The generated host of every repository in the group, plus the platform apps that must
        // be able to sign in against the new tenant. Studio's host is not an appsettings value:
        // it is deployed into the "FrontendRuntime" section from the Mongo secrets document
        // (see ApplyFrontendRuntimeSettings), so it is read from the same key the
        // frontend is served with. A deployment without that secret simply leaves
        // Studio out instead of writing an empty domain.
        //
        // The repository hosts are PlatformSubdomain and the two platform apps are
        // PlatformDefault: the former are unique to this tenant, while IAM and Studio are the
        // same hosts in every tenant's list. The type is set here rather than derived from the
        // host, so a deployment whose KbtclIdentifier sits outside the platform domains still
        // labels its own generated hosts correctly.
        private List<Applications> BuildDefaultApplications(IReadOnlyList<string> applicationDomains)
        {
            var applications = new List<Applications>();

            foreach (var domain in applicationDomains)
            {
                if (string.IsNullOrWhiteSpace(domain) || ContainsDomain(applications, domain))
                {
                    continue;
                }

                applications.Add(new Applications
                {
                    Domain = domain,
                    CookieDomain = IdentifierConstants.ConstructCookieDomain,
                    IsDomainVerified = true,
                    DomainType = DomainType.PlatformSubdomain
                });
            }

            applications.Add(new Applications
            {
                Domain = _configuration["IamDomain"],
                CookieDomain = _configuration["IamCookieDomain"],
                IsDomainVerified = true,
                DomainType = DomainType.PlatformDefault
            });

            var studioDomain = Environment.GetEnvironmentVariable("FrontendRuntime__BLOCKS_STUDIO_BASE_URL") is { Length: > 0 } fromEnv
                ? fromEnv
                : _configuration["FrontendRuntime:BLOCKS_STUDIO_BASE_URL"];

            if (!string.IsNullOrWhiteSpace(studioDomain))
            {
                studioDomain = studioDomain.TrimEnd('/');
                applications.Add(new Applications
                {
                    Domain = studioDomain,
                    CookieDomain = IdentifierHelper.ExtractMainDomain(studioDomain),
                    IsDomainVerified = true,
                    DomainType = DomainType.PlatformDefault
                });
            }

            return applications;
        }

        // Stored domains vary by protocol, case and trailing slash, so membership is decided on
        // the normalized form. Nothing is ever removed from Applications — a deleted repository
        // is archived, not dropped — so every append has to check first or a repository that is
        // removed and added back leaves a second copy behind.
        private static bool ContainsDomain(IEnumerable<Applications> applications, string domain)
        {
            var normalized = NormalizeDomain(domain);

            return applications.Any(a => NormalizeDomain(a.Domain) == normalized);
        }

        private async Task<Tenant> MapAsync(CreateProjectRequest createProjectRequest, ApplicationContext applicationContext, string groupId)
        {
            var certificateStorageType = GetCertificateStorageType();
            var applicationDomains = await GetDefaultDomainsAsync(createProjectRequest.Resources, applicationContext, groupId);

            // The first repository's host is the project's own: it is what the token audience
            // and the IAM account-action urls are built from, and what Applications[0] means to
            // every caller that reads it.
            var applicationDomain = applicationDomains[0];

            var project = new Tenant
            {
                ItemId = Guid.NewGuid().ToString(),
                TenantId = IdentifierHelper.EnvironmentMapper(applicationContext.Environment).ToUpper() + groupId,
                TenantGroupId = groupId,
                Environment = applicationContext.Environment,
                CreatedDate = DateTime.UtcNow,
                Name = createProjectRequest.Name,
                CreatedBy = BlocksContext.GetContext()?.UserId,
                LastUpdatedBy = BlocksContext.GetContext()?.UserId,
                LastUpdatedDate = DateTime.UtcNow,
                IsAcceptBlocksTerms = createProjectRequest.IsAcceptBlocksTerms,
                IsUseBlocksExclusively = createProjectRequest.IsUseBlocksExclusively,
               // ApplicationDomain = applicationDomain,
                DbConnectionString = _blocksSecret.DatabaseConnectionString,
               // CookieDomain = applicationContext.CookieDomain,
               // IsDomainVerified = applicationContext.CookieDomain == IdentifierConstants.BlocsDomain,

                Applications = BuildDefaultApplications(applicationDomains),

                JwtTokenParameters = new JwtTokenParameters
                {
                    Issuer = IdentifierConstants.Issuer,
                    Subject = IdentifierConstants.Subject,
                    CertificateValidForNumberOfDays = 2 * 365,
                    IssueDate = DateTime.UtcNow,
                    Audiences = [applicationDomain],
                    PrivateCertificatePassword = Guid.NewGuid().ToString("n").Substring(7),
                    PublicCertificatePassword = Guid.NewGuid().ToString("n").Substring(7),
                    CertificateStorageType = certificateStorageType
                }
            };

            return project;
        }

        private CertificateStorageType GetCertificateStorageType()
        {
            var configuration = new ConfigurationBuilder().AddEnvironmentVariables().Build();
            var certificateStorageTypeString = configuration.GetValue<string>("CertificateStorageType");
           if (string.IsNullOrEmpty(certificateStorageTypeString))
           {
            certificateStorageTypeString = _configuration["CertificateStorageType"];
           }
          if (!Enum.TryParse<CertificateStorageType>(certificateStorageTypeString, out var certificateStorageType))
            {
                certificateStorageType = CertificateStorageType.Azure;
            }

            return certificateStorageType;
        }

        public async Task<List<GroupedProjectsDto>> GetAllAsync(GetProjectsRequest request)
        {
            var groups = await _projectRepository.GetAllByLastModifiedDateAsync(request);

            foreach (var project in groups.SelectMany(g => g.Projects.Concat(g.NonSharedProject ?? [])))
            {
                project.Applications = VisibleApplications(project.Applications);
            }

            return groups;
        }

        /// <summary>
        /// The applications a project owns, as opposed to the ones it merely has to trust. IAM
        /// and Studio are written into every tenant's list so their hosts pass the origin
        /// allow-list, but they are the same two hosts everywhere and no project can act on
        /// them — showing them made every environment look like it had two domains it did not.
        /// <para>
        /// Only PlatformDefault is dropped. Entries written before the type existed read back as
        /// Unspecified and are kept, so nothing disappears from a project until it is
        /// backfilled.
        /// </para>
        /// </summary>
        private static List<ApplicationDto> VisibleApplications(IEnumerable<ApplicationDto>? applications) =>
            [.. (applications ?? []).Where(a => a.DomainType != DomainType.PlatformDefault)];

        // The detail endpoint reads a Tenant rather than a Project, so its applications arrive
        // as the Genesis type and are copied across. A copy, not the list itself: the entries
        // belong to a Tenant that may have come from the cache, and filtering must not reach it.
        private static List<ApplicationDto> VisibleApplications(IEnumerable<Applications>? applications) =>
            VisibleApplications((applications ?? []).Select(a => new ApplicationDto
            {
                Domain = a.Domain,
                CookieDomain = a.CookieDomain,
                IsDomainVerified = a.IsDomainVerified,
                DomainType = a.DomainType
            }));

        public async Task RestoreUnfinishedProjectAsync()
        {
            var projectStatusTracers = await _projectRepository.GetAllUnfinishedProjectAsync();

            foreach (var projectStatusTracer in projectStatusTracers)
            {
                var project = await _projectRepository.GetByIdAsync(projectStatusTracer.ProjectId);
                projectStatusTracer.ErrorMessage = string.Empty;

                if(project is not null)
                await ConfigureProjectAsync(project, projectStatusTracer);

                if (string.IsNullOrWhiteSpace(projectStatusTracer.ErrorMessage))
                {
                    projectStatusTracer.IsProjectCreationSuccess = true;
                    await _projectRepository.SaveStatusTracerAsync(projectStatusTracer);
                }
            }
        }

        public async Task<RestoreProjectResponse> RestoreProjectAsync(RestoreProjectRequest restoreProjectRequest)
        {
           //await _messageClient.SendToConsumerAsync(new ConsumerMessage<RestoreProjectRequest> { ConsumerName = IdentifierConstants.IdentifierQueueName, Payload = restoreProjectRequest });

           var project = await _projectRepository.GetByIdAsync(restoreProjectRequest.ItemId);
           ProjectStatusTracer? projectStatusTracer = await _projectRepository.GetUnfinishedProjectByIdAsync(restoreProjectRequest.ItemId);

           if(project != null && projectStatusTracer == null)
           {
              projectStatusTracer = new ProjectStatusTracer { ProjectId = restoreProjectRequest.ItemId };
           }

           if (project is not null && !projectStatusTracer.IsProjectCreationSuccess)
           {
              projectStatusTracer.ErrorMessage = string.Empty;
              await ConfigureProjectAsync(project, projectStatusTracer);        
           }
           

           if (string.IsNullOrWhiteSpace(projectStatusTracer.ErrorMessage))
           {
             projectStatusTracer.IsProjectCreationSuccess = true;
             await _projectRepository.SaveStatusTracerAsync(projectStatusTracer);
           }

            return new RestoreProjectResponse { IsSuccess = true };
         }

        public async Task<bool> GetProjectStatusAsync(string itemId)
        {
            var statusTracer = await _projectRepository.GetUnfinishedProjectByIdAsync(itemId);

            if (statusTracer is not null)
            {
               return statusTracer.IsProjectCreationSuccess;
            }

            return true;
        }

        public async Task<GetProjectResponse> GetAsync()
        {
           var tenant = await _projectRepository.GetByTenantIdAsync(BlocksContext.GetContext()?.TenantId);

            string tenantSlug = string.Empty;
            var blocksGuid = await _projectRepository.GetBlocksGuidAsync(tenant.TenantGroupId);

            if (blocksGuid is not null)
            {
                tenantSlug = $"{IdentifierHelper.EnvironmentMapper(tenant.Environment)}{blocksGuid.EncodedValue}";
            }

            // The owner can change via People/TransferOwnerShip, which only updates
            // ProjectPeople.IsCreator — CreatedBy is a creation-time audit stamp, not the
            // current owner. See docs/specs/transfer-ownership-createdby-decoupling.md.
            var ownerUserId = await _projectRepository.GetOwnerUserIdAsync(tenant.TenantId);

            var project = new GetProjectResponseData
            {
                Name = tenant.Name,
                Applications = VisibleApplications(tenant.Applications),
                ItemId = tenant.ItemId,
                CreatedDate = tenant.CreatedDate,
                LastUpdatedDate = tenant.LastUpdatedDate,
                LastUpdatedBy = tenant.LastUpdatedBy,
              //  OrganizationIds = tenant.OrganizationIds,
                CreatedBy = ownerUserId ?? tenant.CreatedBy,
                Tags = tenant.Tags,
                TenantId = tenant.TenantId,
                IsDomainVerified = tenant.Applications.FirstOrDefault()?.IsDomainVerified ?? false,
                CookieDomain = tenant.Applications.FirstOrDefault()?.CookieDomain ?? "",
                IsDisabled = tenant.IsDisabled,
                Environment = tenant.Environment,
                TenantGroupId = tenant.TenantGroupId,
                TenantSlug = tenantSlug
            };

            return new GetProjectResponse { Data = project };

        }

        public async Task<BaseResponse> UpdateProjectAsync(UpdateProjectRequest request)
        {
            var blocksContext = BlocksContext.GetContext();
            var project = await _projectRepository.GetByTenantIdAsync(blocksContext.TenantId);

            // Null before root-tenant: the root-tenant guard was added above this one and
            // dereferenced a project that may not exist, so an unknown tenant threw instead of
            // being reported as one.
            if (project == null)
            {
                return new BaseResponse() { IsSuccess = false, Errors = new Dictionary<string, string> { { "project_not_found", $"No project found with id {blocksContext.TenantId}" } } };
            }

            if(project.IsRootTenant)
            {
             return new BaseResponse() { IsSuccess = false, Errors = new Dictionary<string, string> { { "root_tenant", $"Root tenant cannot be updated" } } };
            }

            project.LastUpdatedDate = DateTime.UtcNow;
            project.LastUpdatedBy = blocksContext.UserId;

            // Snapshotted before the switch runs: Edit mutates this record in
            // place, so afterwards there is no way to tell which host the
            // application used to answer on. Deleting an application, or moving it
            // to a different host, leaves the nginx vhost and Let's Encrypt
            // certificate provisioned for the old host stranded on the proxy.
            var applicationBeforeUpdate = request.Action == ApplicationAction.Add
                ? null
                : project.Applications?.FirstOrDefault(a => a.Domain == request.ApplicationDomain);
            var previousDomain = applicationBeforeUpdate?.Domain;
            var previousCookieDomain = applicationBeforeUpdate?.CookieDomain;
            var previousDomainWasProvisioned = applicationBeforeUpdate is not null && IsSelfProvisioned(applicationBeforeUpdate);

            switch (request.Action)
            {
                case ApplicationAction.Add:
                    var addResult = AddApplication(project, request);
                    if (!addResult.IsSuccess)
                        return addResult;
                    break;

                case ApplicationAction.Edit:
                    var editResult = EditApplication(project, request);
                    if (!editResult.IsSuccess)
                        return editResult;
                    break;

                case ApplicationAction.Delete:
                    var deleteResult = DeleteApplication(project, request);
                    if (!deleteResult.IsSuccess)
                        return deleteResult;
                    break;
            }

            await _projectRepository.UpdateProjectAsync(project);
            await _tenants.UpdateTenantVersionAsync(new TenantCacheUpdateMessage
            {
                Action = "upsert",
                TenantId = project.TenantId,
                Tenant = project
            });

            // Released only once the change is persisted — tearing the vhost and
            // certificate down for an update that failed to save would take a live
            // site offline.
            if (previousDomainWasProvisioned && ReleasesPreviousHost(request, previousDomain))
            {
                // Delete means delete: the certificate goes with the vhost, so
                // nothing is left renewing for a host the project no longer has. A
                // rename is a move, not a removal, so its lineage survives for the
                // domain it may well be moved back to.
                var isDelete = request.Action == ApplicationAction.Delete;

                await SendDisableDomainBindingAsync(project.TenantId, previousDomain!, deleteCertificate: isDelete);

                if (isDelete && request.DeleteSharedApiHost)
                {
                    await ReleaseSharedApiHostAsync(project.TenantId, previousDomain!, previousCookieDomain);
                }
            }

            return new BaseResponse { IsSuccess = true };
        }

        // The API host serves every application under the same cookie domain, so
        // this only runs when the caller ticked the box that says so in as many
        // words. It is derived here rather than in the worker because the
        // application record — and with it the cookie domain the host is built
        // from — is already gone by the time the worker picks the message up.
        private async Task ReleaseSharedApiHostAsync(string tenantId, string domain, string? cookieDomain)
        {
            var cnameLabel = _configuration["CnameRecordDomain"];
            var resolvedCookieDomain = IdentifierHelper.ResolveCookieDomain(NormalizeDomain(domain), NormalizeDomain(cookieDomain));

            // Without both halves the result is something like ".example.com" —
            // a string that must never reach a shell command on the proxy. The
            // worker rejects malformed hostnames too; this just stops the message
            // from being sent at all.
            if (string.IsNullOrWhiteSpace(cnameLabel) || string.IsNullOrWhiteSpace(resolvedCookieDomain))
            {
                return;
            }

            var apiHost = IdentifierHelper.BuildApiHost(cnameLabel, NormalizeDomain(domain), resolvedCookieDomain);

            await SendDisableDomainBindingAsync(tenantId, apiHost, deleteCertificate: true);
        }

        // A delete always leaves the old host with nothing pointing at it; an edit
        // only when the host itself moved (changing just the cookie domain keeps
        // the same vhost in use).
        private static bool ReleasesPreviousHost(UpdateProjectRequest request, string? previousDomain) =>
            request.Action == ApplicationAction.Delete
            || (request.Action == ApplicationAction.Edit
                && NormalizeDomain(request.Application?.Domain) != NormalizeDomain(previousDomain));

        // Only hosts this platform put on the reverse proxy have a vhost and a
        // certificate lineage to remove. Applications on the platform's own
        // domains are served by shared infrastructure that no single project may
        // tear down, and a host that never passed verification was never
        // provisioned in the first place.
        private static bool IsSelfProvisioned(Applications application)
        {
            var mainDomain = IdentifierHelper.ExtractMainDomain(application.Domain);

            return application.IsDomainVerified
                && mainDomain != IdentifierConstants.ConstructCookieDomain
                && mainDomain != IdentifierConstants.BlocksDomain;
        }

        // Handing the teardown to the worker keeps the SSH/certbot round trip off
        // the request thread; ProjectId carries the tenant id, which is what the
        // consumer needs to find the project again.
        private Task SendDisableDomainBindingAsync(string tenantId, string domain, bool deleteCertificate) =>
            _messageClient.SendToConsumerAsync(new ConsumerMessage<DisableDomainBindingRequest>
            {
                ConsumerName = IdentifierConstants.IdentifierQueueName,
                Payload = new DisableDomainBindingRequest
                {
                    ProjectId = tenantId,
                    Domain = domain,
                    DeleteCertificate = deleteCertificate
                }
            });

        // Tells blocks-release to destroy the deployments behind whatever was just deleted. Deliberately
        // best-effort: the delete is already committed by the time this runs, so a broker that is down
        // must not turn a completed delete into an error the user is asked to retry. The cost of a lost
        // message is a deployment left running, which the same message re-sent later still settles.
        private async Task SendReleaseTeardownAsync(ProjectDeleteQueue payload)
        {
            if (string.IsNullOrWhiteSpace(payload.TenantGroupId))
            {
                // The consumer drops a message with no group, so sending one only costs a round trip.
                return;
            }

            try
            {
                await _messageClient.SendToConsumerAsync(new ConsumerMessage<ProjectDeleteQueue>
                {
                    ConsumerName = IdentifierConstants.ReleaseProjectDeleteQueue,
                    Payload = payload
                });
            }
            catch (Exception)
            {
                // Swallowed on purpose — see above. Nothing here is recoverable by the caller.
            }
        }

        // Domains are stored inconsistently ("https://x", "x", trailing slash,
        // mixed case) — normalize before comparing so duplicates can't sneak in
        private static string NormalizeDomain(string? domain) =>
            (domain ?? string.Empty)
                .Trim()
                .Replace("https://", string.Empty, StringComparison.OrdinalIgnoreCase)
                .Replace("http://", string.Empty, StringComparison.OrdinalIgnoreCase)
                .TrimEnd('/')
                .ToLowerInvariant();

        private BaseResponse AddApplication(Tenant project, UpdateProjectRequest request)
        {
            var incomingDomain = NormalizeDomain(request.Application.Domain);
            if (project.Applications.Any(a => NormalizeDomain(a.Domain) == incomingDomain))
            {
                return new BaseResponse { IsSuccess = false, Errors = new Dictionary<string, string> { { "duplicate_domain", $"The domain {request.Application.Domain} is already configured for this project" } } };
            }

            var mainDomain = IdentifierHelper.ExtractMainDomain(request.Application.Domain);

            // Derived here, never read from the request: a caller that could name its own type
            // could pass its domain off as one of the platform's.
            var newApp = new Applications
            {
                Domain = request.Application.Domain,
                CookieDomain = request.Application.CookieDomain,
                IsDomainVerified = IdentifierHelper.IsPlatformOwnedDomain(mainDomain),
                DomainType = IdentifierHelper.ResolveDomainType(request.Application.Domain)
            };
            project.Applications.Add(newApp);
            return new BaseResponse { IsSuccess = true };
        }

        private BaseResponse EditApplication(Tenant project, UpdateProjectRequest request)
        {
            var existingApp = project.Applications.FirstOrDefault(a => a.Domain == request.ApplicationDomain);
            if (existingApp == null)
            {
                return new BaseResponse { IsSuccess = false, Errors = new Dictionary<string, string> { { "application_not_found", $"No application found with domain {request.ApplicationDomain}" } } };
            }

            var incomingDomain = NormalizeDomain(request.Application.Domain);
            if (project.Applications.Any(a => !ReferenceEquals(a, existingApp) && NormalizeDomain(a.Domain) == incomingDomain))
            {
                return new BaseResponse { IsSuccess = false, Errors = new Dictionary<string, string> { { "duplicate_domain", $"The domain {request.Application.Domain} is already configured for this project" } } };
            }

            // An edit re-runs the same classification an add would, so moving a domain on or off
            // a platform host retypes it. This used to test ConstructCookieDomain alone, which
            // left a seliseblocks.com host verified on add and unverified on the next edit.
            var mainDomain = IdentifierHelper.ExtractMainDomain(request.Application.Domain);
            existingApp.Domain = request.Application.Domain;
            existingApp.CookieDomain = request.Application.CookieDomain;
            existingApp.IsDomainVerified = IdentifierHelper.IsPlatformOwnedDomain(mainDomain);
            existingApp.DomainType = IdentifierHelper.ResolveDomainType(request.Application.Domain);

            return new BaseResponse { IsSuccess = true };
        }

        private BaseResponse DeleteApplication(Tenant project, UpdateProjectRequest request)
        {
            var existingApp = project.Applications.FirstOrDefault(a => a.Domain == request.ApplicationDomain);
            if (existingApp == null)
            {
                return new BaseResponse { IsSuccess = false, Errors = new Dictionary<string, string> { { "application_not_found", $"No application found with domain {request.ApplicationDomain}" } } };
            }

            project.Applications.Remove(existingApp);
            return new BaseResponse { IsSuccess = true };
        }

        public async Task<BaseResponse> DisableProjectAsync(string projectId)
        {
            var project = _tenants.GetTenantByID(projectId);

            if (project == null)
            {
                return new BaseResponse { IsSuccess = false, Errors = new Dictionary<string, string> { { "project_not_found", $"No project exist with {projectId}" } } };
            }

            project.IsDisabled = true;
            project.LastUpdatedBy = BlocksContext.GetContext()?.UserId;
            project.LastUpdatedDate = DateTime.UtcNow;

            await _projectRepository.UpdateProjectAsync(project);
            await _projectRepository.DeletePrjectPeopleAsync(project.TenantId);

            await _tenants.UpdateTenantVersionAsync(new TenantCacheUpdateMessage
            {
                Action = "upsert",
                TenantId = project.TenantId,
                Tenant = project
            });

            // Every host this project put on the reverse proxy loses its vhost —
            // all of them, not just the first application. The blocksapi host is
            // deliberately left alone: it is shared by every application under the
            // same root domain, including other projects', so disabling one project
            // must not take it down.
            //
            // Certificates stay put. Disabling is reversible, and keeping the
            // lineages means a restored project re-uses them instead of re-issuing
            // every host against Let's Encrypt's weekly limit.
            foreach (var application in project.Applications?.Where(IsSelfProvisioned) ?? [])
            {
                await SendDisableDomainBindingAsync(project.TenantId, application.Domain, deleteCertificate: false);
            }

            // Group + project, which reaches every repository of this one project. No ResourceId: a
            // project delete retires all of them, and naming one would narrow the teardown to that
            // repository across the whole group — other projects included.
            await SendReleaseTeardownAsync(new ProjectDeleteQueue
            {
                TenantGroupId = project.TenantGroupId,
                ProjectId = project.TenantId
            });

            return new BaseResponse { IsSuccess = true };
        }

        public async Task<GetAssetResponse> GetAssetAsync(GetAssetRequest request)
        {
            var (assets, totalCount) = await _projectRepository.GetTenantAssetAsync(request);
            return new GetAssetResponse { Assets = assets, TotalCount = totalCount, IsSuccess = true };
        }

        public async Task<AddAssetResponse> AddAssetAsync(AddAssetRequest asset)
        {
            var tenantAsset = await _projectRepository.GetTenantAssetByGroupIdAsync(asset.TenantGroupId);

            tenantAsset ??= new TenantAsset
            {
                ItemId = Guid.NewGuid().ToString(),
                TenantGroupId = asset.TenantGroupId,
                Resources = [],
                CreatedDate = DateTime.UtcNow,
                LastUpdatedDate = DateTime.UtcNow,
                CreatedBy = BlocksContext.GetContext()?.UserId,
                LastUpdatedBy = BlocksContext.GetContext()?.UserId
            };

            tenantAsset.Resources ??= [];

            // A renamed repository comes back with the same ResourceId and a new name and link,
            // so an id that is already known is an update, not a duplicate to discard.
            var existingResource = tenantAsset.Resources.FirstOrDefault(r => r.ResourceId == asset.Resource.ResourceId);

            if (existingResource == null)
            {
                // The timestamps and the archive flag belong to the server, never to the request.
                asset.Resource.CreatedDate = DateTime.UtcNow;
                asset.Resource.LastUpdatedDate = DateTime.UtcNow;
                asset.Resource.IsArchived = false;

                tenantAsset.Resources.Add(asset.Resource);
                StampTenantAsset(tenantAsset);
                await Task.WhenAll(_projectRepository.SaveTenantAssetAsync(tenantAsset),
                               _projectRepository.UpdateRepoResourceAsync(asset));

                await RegisterRepositoryDomainsAsync(asset.TenantGroupId, asset.Resource);

                return AssetResponse(AssetMutationStatus.Added);
            }

            // A deleted repository is archived, not removed, so adding it again revives that row
            // instead of creating a second entry for the same id.
            var wasArchived = existingResource.IsArchived;
            var hasNewDetails = existingResource.Name != asset.Resource.Name
                             || existingResource.Link != asset.Resource.Link;

            if (!wasArchived && !hasNewDetails)
            {
                return AssetResponse(AssetMutationStatus.Unchanged);
            }

            existingResource.Name = asset.Resource.Name;
            existingResource.Link = asset.Resource.Link;
            existingResource.IsArchived = false;
            existingResource.LastUpdatedDate = DateTime.UtcNow;
            StampTenantAsset(tenantAsset);
            // The per-tenant Repos rows survive a delete, so this refreshes them; it never inserts.
            await Task.WhenAll(_projectRepository.SaveTenantAssetAsync(tenantAsset),
                           _projectRepository.UpdateRepoResourceInfoAsync(asset));

            // A restore brings a repository's deployments back, so its hosts have to be
            // registered again. They are normally still there — deleting a repository archives
            // it and leaves Applications alone — but a repository that predates this, or one
            // whose entry was removed by hand, is put right here. A rename changes neither the
            // resource id nor the domain, so an Updated has nothing to register.
            if (wasArchived)
            {
                await RegisterRepositoryDomainsAsync(asset.TenantGroupId, asset.Resource);
            }

            return AssetResponse(wasArchived ? AssetMutationStatus.Restored : AssetMutationStatus.Updated);
        }

        // One generated host per environment, because the environment letter is the only part of
        // the domain that varies across a group — the tenant and repo slugs are keyed on the
        // group and resource ids. Each tenant is saved and its cache entry republished on its
        // own: the allow-list these entries feed is read from the tenant cache, so a project
        // that is not republished keeps refusing the host it was just given.
        private async Task RegisterRepositoryDomainsAsync(string tenantGroupId, Resource resource)
        {
            var projects = await _projectRepository.GetByGroupIdAsync(tenantGroupId);

            if (projects is null || projects.Count == 0)
            {
                return;
            }

            var tenantSlug = await _urlEncodingService.EncodeToBase26Async(tenantGroupId, tenantGroupId, 5);
            var repoSlug = await _urlEncodingService.EncodeToBase26Async(resource.ResourceId, tenantGroupId, 5);
            var identifier = _configuration["KbtclIdentifier"] ?? string.Empty;

            foreach (var project in projects)
            {
                var domain = IdentifierHelper.BuildPlatformSubdomain(project.Environment, tenantSlug, repoSlug, identifier);

                project.Applications ??= [];

                if (ContainsDomain(project.Applications, domain))
                {
                    continue;
                }

                project.Applications.Add(new Applications
                {
                    Domain = domain,
                    CookieDomain = IdentifierConstants.ConstructCookieDomain,
                    IsDomainVerified = true,
                    DomainType = DomainType.PlatformSubdomain
                });

                project.LastUpdatedBy = BlocksContext.GetContext()?.UserId;
                project.LastUpdatedDate = DateTime.UtcNow;

                await _projectRepository.UpdateProjectAsync(project);
                await _tenants.UpdateTenantVersionAsync(new TenantCacheUpdateMessage
                {
                    Action = "upsert",
                    TenantId = project.TenantId,
                    Tenant = project
                });
            }
        }

        public async Task<BaseResponse> DeleteAssetAsync(DeleteAssetRequest request)
        {
            var tenantAsset = await _projectRepository.GetTenantAssetByGroupIdAsync(request.TenantGroupId);
            var resource = tenantAsset?.Resources?
                .FirstOrDefault(r => r.ResourceId == request.ResourceId && !r.IsArchived);

            if (tenantAsset == null || resource == null)
            {
                return new BaseResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string> { { "resource_not_found", $"No repository found with id {request.ResourceId}" } }
                };
            }

            // Archived, not removed: keeping the row is what lets a later re-add restore it. The
            // copy each tenant in the group holds is flagged the same way.
            resource.IsArchived = true;
            resource.LastUpdatedDate = DateTime.UtcNow;
            StampTenantAsset(tenantAsset);
            await Task.WhenAll(_projectRepository.SaveTenantAssetAsync(tenantAsset),
                           _projectRepository.ArchiveRepoResourceAsync(request));

            // Group + resource, which reaches this repository in every project of the group — the same
            // set the archive above just wrote to. Published only once those writes have landed, so a
            // delete that failed here never tears a running deployment down.
            await SendReleaseTeardownAsync(new ProjectDeleteQueue
            {
                TenantGroupId = request.TenantGroupId,
                ResourceId = request.ResourceId
            });

            return new BaseResponse { IsSuccess = true, Errors = new Dictionary<string, string>() };
        }

        private static void StampTenantAsset(TenantAsset tenantAsset)
        {
            tenantAsset.LastUpdatedBy = BlocksContext.GetContext()?.UserId;
            tenantAsset.LastUpdatedDate = DateTime.UtcNow;
        }

        private static AddAssetResponse AssetResponse(AssetMutationStatus status)
        {
            return new AddAssetResponse { IsSuccess = true, Status = status, Errors = new Dictionary<string, string>() };
        }

        public async Task<BaseResponse> UpdateTokenValidationParametersAsync(UpdateTokenValidationParametersRequest request)
        {

            var tenantId = BlocksContext.GetContext()?.TenantId ?? string.Empty;
            var project = await _projectRepository.GetByTenantIdAsync(tenantId);

            if (project == null)
            {
                return new BaseResponse { IsSuccess = false, Errors = new Dictionary<string, string> { { "project_not_found", $"No project found with id {tenantId}" } } };
            }

            project.ThirdPartyJwtTokenParameters ??= new();

            project.ThirdPartyJwtTokenParameters.ProviderName = request.ProviderName;
            project.ThirdPartyJwtTokenParameters.Audiences = request.Audiences;
            project.ThirdPartyJwtTokenParameters.Issuer = request.Issuer;
            project.ThirdPartyJwtTokenParameters.PublicCertificatePath = request.PublicCertificatePath;
            project.ThirdPartyJwtTokenParameters.PublicCertificatePassword = request.PublicCertificatePassword;
            project.ThirdPartyJwtTokenParameters.JwksUrl = request.JwksUrl;

            project.LastUpdatedBy = BlocksContext.GetContext()?.UserId;
            project.LastUpdatedDate = DateTime.UtcNow;
            await _projectRepository.UpdateProjectAsync(project);

            await Task.WhenAll( _tenants.UpdateTenantVersionAsync(new TenantCacheUpdateMessage
            {
                Action = "upsert",
                TenantId = project.TenantId,
                Tenant = project
            }), _cacheClient.RemoveKeyAsync($"{_tenantTokenPublicCertificateCachePrefix}{tenantId}"));

            return new BaseResponse { IsSuccess = true };
        }

        public async Task<IActionResult> GetProjectTokenValidationParametersAsync(string projectId)
        {
            var project = await _projectRepository.GetByTenantIdAsync(projectId);

            if (project == null)
            {
                return new NotFoundObjectResult(new { error = "Project not found" });
            }

            // Tenant initializes ThirdPartyJwtTokenParameters, so a project that never configured a
            // provider still deserializes to an empty instance. Only a key source proves configuration.
            var thirdPartyJwtTokenParameters = project.ThirdPartyJwtTokenParameters;
            var isConfigured = thirdPartyJwtTokenParameters is not null
                               && (!string.IsNullOrWhiteSpace(thirdPartyJwtTokenParameters.JwksUrl)
                                   || !string.IsNullOrWhiteSpace(thirdPartyJwtTokenParameters.PublicCertificatePath));

            if (!isConfigured)
            {
                thirdPartyJwtTokenParameters = null;
            }

            var tokenParams = new
            {
                IsConfigured = isConfigured,
                ProviderName = thirdPartyJwtTokenParameters?.ProviderName,
                Issuer = thirdPartyJwtTokenParameters?.Issuer,
                Audiences = thirdPartyJwtTokenParameters?.Audiences,
                PublicCertificatePath = thirdPartyJwtTokenParameters?.PublicCertificatePath,
                JwksUrl = thirdPartyJwtTokenParameters?.JwksUrl,
                CookieKey = thirdPartyJwtTokenParameters?.CookieKey
            };
            return new OkObjectResult(tokenParams);
        }

        public async Task<SaveThirdPartyJWTClaimsResponse> SaveThirdPartyJWTClaimsAsync(SaveThirdPartyJWTClaimsRequest request)
        {
            var claimsMapper = await MapJWTClaims(request);
            await _projectRepository.SaveJWTClaimsAsync(claimsMapper);
            return new SaveThirdPartyJWTClaimsResponse { IsSuccess = true , ItemId = claimsMapper.ItemId};
        }

        public async Task<ThirdPartyJWTClaims?> GetThirdPartyJWTClaimsAsync()
        {
            return await _projectRepository.GetThirdPartyJWTClaimsAsync(string.Empty);
        }

        private async Task<ThirdPartyJWTClaims> MapJWTClaims(SaveThirdPartyJWTClaimsRequest request)
        {
            var thirdPartyClaims = !string.IsNullOrWhiteSpace(request.ItemId)?
                                    await _projectRepository.GetThirdPartyJWTClaimsAsync(request.ItemId):
                                    new ThirdPartyJWTClaims { ItemId = Guid.NewGuid().ToString(), CreatedBy = BlocksContext.GetContext()?.UserId , CreatedDate = DateTime.UtcNow};


            thirdPartyClaims.UserId = request.UserId;
            thirdPartyClaims.UserName = request.UserName;
            thirdPartyClaims.Email = request.Email;
            thirdPartyClaims.Roles = request.Roles;
            thirdPartyClaims.Name = request.Name;
            thirdPartyClaims.LastUpdatedBy = BlocksContext.GetContext()?.UserId;
            thirdPartyClaims.LastUpdatedDate = DateTime.UtcNow;

            return thirdPartyClaims;

        }

        #region Third-party JWT providers

        public async Task<List<ThirdPartyJwtProviderResult>> GetThirdPartyJwtProvidersAsync()
        {
            var tenantId = BlocksContext.GetContext()?.TenantId ?? string.Empty;
            var providers = await _projectRepository.GetThirdPartyJwtProvidersAsync(tenantId);

            return [.. providers.Select(ToResult)];
        }

        public async Task<SaveThirdPartyJwtProviderResponse> SaveThirdPartyJwtProviderAsync(SaveThirdPartyJwtProviderRequest request)
        {
            ArgumentNullException.ThrowIfNull(request);

            var tenantId = BlocksContext.GetContext()?.TenantId ?? string.Empty;
            var tenant = await _projectRepository.GetByTenantIdAsync(tenantId);

            if (tenant == null)
            {
                return Failed("project_not_found", $"No project found with id {tenantId}");
            }

            var siblings = await _projectRepository.GetThirdPartyJwtProvidersAsync(tenantId);
            var existing = string.IsNullOrWhiteSpace(request.ItemId)
                ? null
                : siblings.FirstOrDefault(p => p.ItemId == request.ItemId);

            if (!string.IsNullOrWhiteSpace(request.ItemId) && existing == null)
            {
                return Failed("provider_not_found", $"No provider found with id {request.ItemId}");
            }

            // Two ways an untouched key reaches here, both meaning "leave it alone": blank, from a
            // form that starts empty the way the signing-secret field does, and the mask itself,
            // from a caller echoing back what it was shown. Resolving both here means validation
            // and the write see the real key.
            if (existing != null
                && (string.IsNullOrWhiteSpace(request.Key)
                    || string.Equals(request.Key.Trim(), MaskProviderKey(existing.Key), StringComparison.Ordinal)))
            {
                request.Key = existing.Key;
            }

            var validation = ValidateProvider(request, existing, siblings);
            if (validation != null)
            {
                return validation;
            }

            var isSymmetric = request.Algorithms[0].IsSymmetric();
            var provider = existing ?? new ThirdPartyJwtProvider
            {
                ItemId = Guid.NewGuid().ToString(),
                TenantId = tenantId,
                CreatedBy = BlocksContext.GetContext()?.UserId,
                CreatedDate = DateTime.UtcNow
            };

            provider.Key = request.Key.Trim();
            provider.ProviderName = request.ProviderName?.Trim() ?? string.Empty;
            provider.IsActive = request.IsActive;
            provider.Issuer = request.Issuer.Trim();
            provider.Audiences = request.Audiences ?? [];
            provider.Algorithms = request.Algorithms;
            provider.CookieKey = request.CookieKey?.Trim() ?? string.Empty;
            provider.ClaimsMapping = ToMapping(request.ClaimsMapping);
            provider.LastUpdatedBy = BlocksContext.GetContext()?.UserId;
            provider.LastUpdatedDate = DateTime.UtcNow;

            if (isSymmetric)
            {
                provider.JwksUrl = string.Empty;

                // Empty means untouched, never cleared: a masked field round-trips as "" from most
                // frontends, and treating that as a clear would silently break authentication.
                if (!string.IsNullOrEmpty(request.SigningSecret))
                {
                    provider.SigningSecretCipher = _cryptoService.Encrypt(request.SigningSecret, tenant.TenantSalt);
                }
            }
            else
            {
                provider.JwksUrl = request.JwksUrl!.Trim();

                // Switching a provider away from the HMAC family drops the stored secret. Leaving
                // it would keep a dormant signing authority alive for the moment someone switches
                // the algorithm back.
                provider.SigningSecretCipher = string.Empty;
            }

            await _projectRepository.SaveThirdPartyJwtProviderAsync(provider);

            return new SaveThirdPartyJwtProviderResponse { IsSuccess = true, ItemId = provider.ItemId };
        }

        public async Task<BaseResponse> DeleteThirdPartyJwtProviderAsync(DeleteThirdPartyJwtProviderRequest request)
        {
            ArgumentNullException.ThrowIfNull(request);

            var tenantId = BlocksContext.GetContext()?.TenantId ?? string.Empty;
            var deleted = await _projectRepository.DeleteThirdPartyJwtProviderAsync(tenantId, request.ItemId);

            // The encrypted secret lives on the row, so deleting the row is what revokes it —
            // there is no separate vault entry left behind.
            return deleted
                ? new BaseResponse { IsSuccess = true }
                : new BaseResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string> { { "provider_not_found", $"No provider found with id {request.ItemId}" } }
                };
        }

        public async Task<BaseResponse> UpdateThirdPartyJwtEnabledAsync(UpdateThirdPartyJwtEnabledRequest request)
        {
            ArgumentNullException.ThrowIfNull(request);

            var tenantId = BlocksContext.GetContext()?.TenantId ?? string.Empty;
            var project = await _projectRepository.GetByTenantIdAsync(tenantId);

            if (project == null)
            {
                return new BaseResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string> { { "project_not_found", $"No project found with id {tenantId}" } }
                };
            }

            project.IsThirdPartyJwtEnabled = request.IsEnabled;
            project.LastUpdatedBy = BlocksContext.GetContext()?.UserId;
            project.LastUpdatedDate = DateTime.UtcNow;

            await _projectRepository.UpdateProjectAsync(project);

            // The flag rides on the cached Tenant, so a write alone would take effect only when
            // that cache happened to expire.
            await _tenants.UpdateTenantVersionAsync(new TenantCacheUpdateMessage
            {
                Action = "upsert",
                TenantId = project.TenantId,
                Tenant = project
            });

            return new BaseResponse { IsSuccess = true };
        }

        /// <summary>
        /// Enforces the rules that cannot be recovered at validation time: one key source per
        /// provider, a usable subject mapping, and audiences wherever two providers share an issuer.
        /// </summary>
        private static SaveThirdPartyJwtProviderResponse? ValidateProvider(
            SaveThirdPartyJwtProviderRequest request,
            ThirdPartyJwtProvider? existing,
            List<ThirdPartyJwtProvider> siblings)
        {
            if (string.IsNullOrWhiteSpace(request.Key))
            {
                return Failed("key_required", "Key is required; it is what the x-blocks-idp header names.");
            }

            if (siblings.Any(p => p.ItemId != existing?.ItemId
                                  && string.Equals(p.Key, request.Key.Trim(), StringComparison.Ordinal)))
            {
                return Failed("duplicate_key", $"Another provider already uses the key '{request.Key}'.");
            }

            if (string.IsNullOrWhiteSpace(request.Issuer))
            {
                return Failed("issuer_required", "Issuer is required; it is how a token is routed to this provider.");
            }

            if (!request.Algorithms.IsSingleKeySource())
            {
                return Failed(
                    "invalid_algorithms",
                    "Configure at least one algorithm, none of them Unspecified, and all from the same family. " +
                    "Mixing families would give one provider two independent signing authorities.");
            }

            var isSymmetric = request.Algorithms[0].IsSymmetric();

            if (isSymmetric)
            {
                var hasStoredSecret = !string.IsNullOrWhiteSpace(existing?.SigningSecretCipher);

                if (string.IsNullOrEmpty(request.SigningSecret) && !hasStoredSecret)
                {
                    return Failed("signing_secret_required", "An HMAC provider needs a signing secret.");
                }

                if (!string.IsNullOrWhiteSpace(request.JwksUrl))
                {
                    return Failed("unexpected_jwks_url", "An HMAC provider must not carry a JWKS URL.");
                }
            }
            else
            {
                if (string.IsNullOrWhiteSpace(request.JwksUrl))
                {
                    return Failed("jwks_url_required", "An asymmetric provider needs a JWKS URL.");
                }

                if (!string.IsNullOrEmpty(request.SigningSecret))
                {
                    return Failed("unexpected_signing_secret", "An asymmetric provider must not carry a signing secret.");
                }
            }

            if (string.IsNullOrWhiteSpace(request.ClaimsMapping?.UserId))
            {
                return Failed(
                    "user_id_mapping_required",
                    "ClaimsMapping.UserId is required. Without it every token collapses onto the same principal.");
            }

            // Two providers sharing an issuer AND an audience validate identically, so nothing
            // cryptographic tells their tokens apart and the caller's header alone selects the
            // claim mapping. Requiring audiences keeps that choice out of the caller's hands.
            var sharesIssuer = siblings.Any(p => p.ItemId != existing?.ItemId
                                                 && p.IsActive
                                                 && string.Equals(p.Issuer, request.Issuer.Trim(), StringComparison.Ordinal));

            if (sharesIssuer && (request.Audiences == null || request.Audiences.Count == 0))
            {
                return Failed(
                    "audiences_required_for_shared_issuer",
                    "Another active provider already uses this issuer, so both must declare audiences. " +
                    "Without them the two cannot be told apart and the caller chooses which mapping applies.");
            }

            return null;
        }

        private static SaveThirdPartyJwtProviderResponse Failed(string code, string message) => new()
        {
            IsSuccess = false,
            Errors = new Dictionary<string, string> { { code, message } }
        };

        private static ThirdPartyClaimsMapping ToMapping(ThirdPartyClaimsMappingRequest? request) => new()
        {
            UserId = request?.UserId?.Trim() ?? string.Empty,
            Email = request?.Email?.Trim() ?? string.Empty,
            UserName = request?.UserName?.Trim() ?? string.Empty,
            Name = request?.Name?.Trim() ?? string.Empty,
            Roles = request?.Roles?.Trim() ?? string.Empty
        };

        /// <summary>
        /// Masks a provider key for display: <c>abc***xyz</c>. Anything six characters or shorter
        /// has no middle to hide, so it is masked whole rather than leaked by a partial reveal.
        /// </summary>
        public static string MaskProviderKey(string? key)
        {
            if (string.IsNullOrEmpty(key))
            {
                return string.Empty;
            }

            return key.Length <= 6
                ? new string('*', key.Length)
                : $"{key[..3]}***{key[^3..]}";
        }

        // Deliberately omits SigningSecretCipher: the stored ciphertext is no more the UI's
        // business than the plaintext is.
        private static ThirdPartyJwtProviderResult ToResult(ThirdPartyJwtProvider provider) => new()
        {
            ItemId = provider.ItemId,
            Key = MaskProviderKey(provider.Key),
            ProviderName = provider.ProviderName,
            IsActive = provider.IsActive,
            Issuer = provider.Issuer,
            Audiences = provider.Audiences,
            Algorithms = provider.Algorithms,
            JwksUrl = provider.JwksUrl,
            CookieKey = provider.CookieKey,
            HasSigningSecret = !string.IsNullOrWhiteSpace(provider.SigningSecretCipher),
            ClaimsMapping = new ThirdPartyClaimsMappingRequest
            {
                UserId = provider.ClaimsMapping?.UserId ?? string.Empty,
                Email = provider.ClaimsMapping?.Email ?? string.Empty,
                UserName = provider.ClaimsMapping?.UserName ?? string.Empty,
                Name = provider.ClaimsMapping?.Name ?? string.Empty,
                Roles = provider.ClaimsMapping?.Roles ?? string.Empty
            }
        };

        #endregion

        public async Task<BaseResponse> UpdateTenantGroupAsync(UpdateTenantGroupRequest request)
        {
            await _projectRepository.UpdateTenantGroupAsync(request);

            return new BaseResponse { IsSuccess = true };
        }

    }

}
