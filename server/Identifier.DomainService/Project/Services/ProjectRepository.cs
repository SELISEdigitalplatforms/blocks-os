using Blocks.Genesis;
using DomainService.Dtos;
using DomainService.Entities;
using DomainService.Shared;
using DomainService.Shared.Entities;
using DomainService.Shared.Services;
using Microsoft.Extensions.Configuration;
using MongoDB.Bson;
using MongoDB.Driver;
using Pipelines.Sockets.Unofficial.Arenas;
using System.Collections;

namespace DomainService.Projects
{
    public class ProjectRepository : IProjectRepository
    {
        private readonly IDbContextProvider _dbContextProvider;
        private readonly IBlocksSecret _blocksSecret;
        private readonly IConfiguration _configuration;
        private readonly IEncodingService _urlEncodingService;
        private IMongoDatabase _clientDb;

        private const string _projectStatusTraceCollectionName = "ProjectStatusTracers";
        private const string _legacyDefaultUserRoleSlug = "user";
        private const string _cloudUserRoleSlug = "clouduser";

        public ProjectRepository(IDbContextProvider dbContextProvider,
                                 IConfiguration configuration,
                                 IBlocksSecret blocksSecret,
                                 IEncodingService urlEncodingService)
        {
            _dbContextProvider = dbContextProvider;
            _blocksSecret = blocksSecret;
            _configuration = configuration;
            _urlEncodingService = urlEncodingService;
            _clientDb = ResolvedClientDb();
        }

        private IMongoDatabase ResolvedClientDb()
        {
            var blocksContext = BlocksContext.GetContext();

            if (blocksContext?.Impersonated ?? true)
            {
                return _dbContextProvider.GetDatabase(_blocksSecret.DatabaseConnectionString, IdentifierConstants.RootDatabaseName);
            }

            return _dbContextProvider.GetDatabase(blocksContext.TenantId);
        }

        // Genesis resolves this collection from the caller's tenant database when it maps an
        // external token's claims, so it must never be served from the impersonated root db.
        private IMongoCollection<ThirdPartyJWTClaims> ResolveThirdPartyJWTClaimsCollection()
        {
            var tenantId = BlocksContext.GetContext()?.TenantId;

            if (string.IsNullOrWhiteSpace(tenantId))
            {
                throw new InvalidOperationException("Tenant ID is missing in the current context.");
            }

            return _dbContextProvider
                .GetDatabase(tenantId)
                .GetCollection<ThirdPartyJWTClaims>(IdentifierConstants.ThirdPartyJWTClaimsCollectionName);
        }

        public async Task<Tenant> GetByIdAsync(string itemId)
        {
            var collection = _clientDb.GetCollection<Tenant>(IdentifierConstants.TenantCollectionName);

            var filter = Builders<Tenant>.Filter.Eq(mc => mc.ItemId, itemId);
            return await collection.Find(filter).FirstOrDefaultAsync();
        }

        public async Task<List<Tenant>> GetByGroupIdAsync(string tenantGroupId)
        {
            var collection = _clientDb.GetCollection<Tenant>(IdentifierConstants.TenantCollectionName);

            var filter = Builders<Tenant>.Filter.Eq(mc => mc.TenantGroupId, tenantGroupId);
            return await collection.Find(filter).ToListAsync();
        }

        public async Task<Tenant> GetByDomainAsync(string name)
        {
            var collection = _clientDb.GetCollection<Tenant>(IdentifierConstants.TenantCollectionName);
            var listDomain = new List<string> { name };
            var filter = Builders<Tenant>.Filter.ElemMatch(x => x.Applications, app => listDomain.Contains(app.Domain));
            return await collection.Find(filter).FirstOrDefaultAsync();
        }

        public async Task InsertProjectAsync(Tenant project)
        {
            var collection = _clientDb.GetCollection<Tenant>(IdentifierConstants.TenantCollectionName);

            await collection.InsertOneAsync(project);
        }

        public async Task UpdateTenantAssetAsync(TenantAsset asset)
        {
            var collection = _clientDb.GetCollection<TenantAsset>(IdentifierConstants.TenantAssetCollectionName);
            await collection.InsertOneAsync(asset);
        }

        public async Task<(TenantAsset? assets, long totalCount)> GetTenantAssetAsync(GetAssetRequest request)
        {
            var sharedProjects = await GetProjectPeoplesAsync(request.TenantGroupId);
            if (sharedProjects == null || sharedProjects.Count == 0)
            {
                return (null, 0);
            }

            var collection = _clientDb.GetCollection<TenantAsset>(IdentifierConstants.TenantAssetCollectionName);
            var documentFilter = Builders<TenantAsset>.Filter.Eq(mc => mc.TenantGroupId, request.TenantGroupId);
            var tenantAsset = await collection.Find(documentFilter).FirstOrDefaultAsync();

            if (tenantAsset == null)
                return (null, 0);

            // Deleted repositories are archived rather than removed, so every read hides them.
            var filteredResources = tenantAsset.Resources?.Where(r => !r.IsArchived)
                                    ?? Enumerable.Empty<Resource>();

            if (request.Filter != null)
            {
                // One search box on the repositories page covers both columns, so Search matches
                // either field. Name and Link stay available as individual column filters.
                if (!string.IsNullOrWhiteSpace(request.Filter.Search))
                {
                    var search = request.Filter.Search.Trim();
                    filteredResources = filteredResources.Where(r =>
                        (r.Name != null && r.Name.Contains(search, StringComparison.OrdinalIgnoreCase)) ||
                        (r.Link != null && r.Link.Contains(search, StringComparison.OrdinalIgnoreCase)));
                }

                if (!string.IsNullOrWhiteSpace(request.Filter.Name))
                {
                    filteredResources = filteredResources.Where(r =>
                        r.Name != null && r.Name.Contains(request.Filter.Name.Trim(), StringComparison.OrdinalIgnoreCase));
                }

                if (!string.IsNullOrWhiteSpace(request.Filter.Link))
                {
                    filteredResources = filteredResources.Where(r =>
                        r.Link != null && r.Link.Contains(request.Filter.Link.Trim(), StringComparison.OrdinalIgnoreCase));
                }
            }

            var totalCount = filteredResources.Count();

            var pagedResources = filteredResources
                .Skip(request.PageSize * request.Page)
                .Take(request.PageSize)
                .ToList();

            tenantAsset.Resources = pagedResources;
            return (tenantAsset, totalCount);
        }

        // GetTenantAssetAsync pages Resources down to the requested window before it returns,
        // so it must never feed a write: saving that document back drops every resource outside
        // the page. Mutations read the whole document through here instead.
        public async Task<TenantAsset?> GetTenantAssetByGroupIdAsync(string tenantGroupId)
        {
            var collection = _clientDb.GetCollection<TenantAsset>(IdentifierConstants.TenantAssetCollectionName);
            var filter = Builders<TenantAsset>.Filter.Eq(mc => mc.TenantGroupId, tenantGroupId);

            return await collection.Find(filter).FirstOrDefaultAsync();
        }

        public async Task UpdateProjectAsync(Tenant project)
        {
            var collection = _clientDb.GetCollection<Tenant>(IdentifierConstants.TenantCollectionName);
            var filter = Builders<Tenant>.Filter.Eq(mc => mc.ItemId, project.ItemId);

            await collection.ReplaceOneAsync(filter, project);
        }

        // ProjectPeople.IsCreator is the single source of truth for project ownership — see
        // docs/specs/transfer-ownership-createdby-decoupling.md. Project.CreatedBy is a
        // creation-time audit stamp only and must not be read here.
        private async Task<List<string>> GetOwnedTenantIdsAsync(string? userId)
        {
            var projectPeopleCollection = _clientDb.GetCollection<ProjectPeople>(IdentifierConstants.ProjectPeopleCollectionName);
            var filter = Builders<ProjectPeople>.Filter.Eq(p => p.UserId, userId) &
                         Builders<ProjectPeople>.Filter.Eq(p => p.IsCreator, true);

            return await projectPeopleCollection.Find(filter).Project(p => p.TenantId).ToListAsync();
        }

        public async Task<ProjectPeople?> GetGroupOwnerAsync(string tenantGroupId)
        {
            if (string.IsNullOrWhiteSpace(tenantGroupId)) return null;

            var tenantIds = await GetProjectIdsByGroupId(tenantGroupId);
            if (tenantIds.Count == 0) return null;

            var projectPeopleCollection = _clientDb.GetCollection<ProjectPeople>(IdentifierConstants.ProjectPeopleCollectionName);
            var filter = Builders<ProjectPeople>.Filter.In(p => p.TenantId, tenantIds) &
                         Builders<ProjectPeople>.Filter.Eq(p => p.IsCreator, true);

            return await projectPeopleCollection.Find(filter).FirstOrDefaultAsync();
        }

        public async Task<string?> GetOwnerUserIdAsync(string tenantId)
        {
            var projectPeopleCollection = _clientDb.GetCollection<ProjectPeople>(IdentifierConstants.ProjectPeopleCollectionName);
            var filter = Builders<ProjectPeople>.Filter.Eq(p => p.TenantId, tenantId) &
                         Builders<ProjectPeople>.Filter.Eq(p => p.IsCreator, true);

            var owner = await projectPeopleCollection.Find(filter).FirstOrDefaultAsync();
            return owner?.UserId;
        }

        public async Task<List<GroupedProjectsDto>> GetAllByLastModifiedDateAsync(GetProjectsRequest request)
        {
            var collection = _clientDb.GetCollection<Project>(IdentifierConstants.TenantCollectionName);
            var ownedTenantIds = await GetOwnedTenantIdsAsync(BlocksContext.GetContext()?.UserId);

            var filter = !string.IsNullOrEmpty(request.TenantGroupId) ?

                          Builders<Project>.Filter.And(Builders<Project>.Filter.In(mc => mc.TenantId, ownedTenantIds),
                                                       Builders<Project>.Filter.Eq(mc => mc.IsDisabled, false),
                                                       Builders<Project>.Filter.Eq(mc => mc.TenantGroupId, request.TenantGroupId)) :

                          Builders<Project>.Filter.And(Builders<Project>.Filter.In(mc => mc.TenantId, ownedTenantIds),
                                                       Builders<Project>.Filter.Eq(mc => mc.IsDisabled, false));

            var option = new FindOptions<Project>
            {
                Skip = request.PageSize * request.Page,
                Limit = request.PageSize,
                Sort = Builders<Project>.Sort.Descending(doc => doc.LastUpdatedBy)
            };

            using var cursor = await collection.FindAsync(filter, option);
            var selfProjects = await cursor.ToListAsync();
            var selfGroupedProjectsTasks = selfProjects.GroupBy(p => p.TenantGroupId ?? string.Empty)
                                               .Select(g => new GroupedProjectsDto
                                               {
                                                   TenantGroupId = g.Key,
                                                   Projects = g.OrderByDescending(p => p.LastUpdatedBy).ToList(),
                                                   IsShared = false,
                                                   NonSharedProject = []
                                               }).ToList();


            var sharedProjects = await GetSharedProjectsAsync(request.TenantGroupId);

            // One read for every shared tenant rather than one per group: the console renders
            // the whole list at once, so an N+1 here is an N+1 on every console load.
            var sharedPolicies = await GetAccessPoliciesByTenantAsync(
                BlocksContext.GetContext()?.UserId, [.. sharedProjects.Select(p => p.TenantId)]);

            var sharedGroupProjects = sharedProjects.GroupBy(p => p.TenantGroupId ?? string.Empty)
                                               .Select(async g => new GroupedProjectsDto
                                               {
                                                   TenantGroupId = g.Key,
                                                   AccessPolicies = [.. g.SelectMany(p =>
                                                           sharedPolicies.TryGetValue(p.TenantId, out var policies) ? policies : [])
                                                       .Distinct(StringComparer.Ordinal)
                                                       .OrderBy(policy => policy, StringComparer.Ordinal)],
                                                   Projects = g.OrderByDescending(p => p.LastUpdatedBy).ToList(),
                                                   IsShared = true,
                                                   NonSharedProject = await GetNosharedProjectsAsync(sharedProjects, g.Key)
                                               }).ToList();

            var groupedSharedProject = (await Task.WhenAll(sharedGroupProjects)).ToList();
            return [.. selfGroupedProjectsTasks, .. groupedSharedProject];
        }

        private async Task<List<Project>> GetNosharedProjectsAsync(List<Project> sharedProjects, string tenantGroupId)
        {
            var projectCollection = _clientDb.GetCollection<Project>(IdentifierConstants.TenantCollectionName);
            var filter = Builders<Project>.Filter.Nin(p => p.TenantId, sharedProjects?.Select(doc => doc?.TenantId)) &
                         Builders<Project>.Filter.Where(p => p.IsDisabled == false) &
                         Builders<Project>.Filter.Where(p => p.TenantGroupId == tenantGroupId);

            using var projectCursor = await projectCollection.FindAsync(filter, new FindOptions<Project>
            {
                Sort = Builders<Project>.Sort.Descending(doc => doc.LastUpdatedBy)
            });

            return await projectCursor.ToListAsync();
        }

        /// <summary>The caller's grants per tenant, for the tenants given.</summary>
        private async Task<Dictionary<string, List<string>>> GetAccessPoliciesByTenantAsync(string? userId, List<string> tenantIds)
        {
            if (string.IsNullOrWhiteSpace(userId) || tenantIds.Count == 0) return [];

            var filter = Builders<ProjectPeople>.Filter.Eq(p => p.UserId, userId) &
                         Builders<ProjectPeople>.Filter.In(p => p.TenantId, tenantIds);

            var rows = await _clientDb.GetCollection<ProjectPeople>(IdentifierConstants.ProjectPeopleCollectionName)
                .Find(filter).ToListAsync();

            return rows
                .GroupBy(row => row.TenantId)
                .ToDictionary(g => g.Key, g => g.SelectMany(row => row.AccessPolicies ?? []).ToList());
        }

        public async Task<List<Project>> GetSharedProjectsAsync(string? tenantGroupId = null)
        {
            var userId = BlocksContext.GetContext()?.UserId;
            var ownedTenantIds = await GetOwnedTenantIdsAsync(userId);

            var projectPeopleCollection = _clientDb.GetCollection<ProjectPeople>(IdentifierConstants.ProjectPeopleCollectionName);

            var projectPeopleFilter = Builders<ProjectPeople>.Filter.And(
                Builders<ProjectPeople>.Filter.Eq(mc => mc.UserId, userId),
                Builders<ProjectPeople>.Filter.Or(
                    Builders<ProjectPeople>.Filter.Eq(mc => mc.IsInvitationConfirmed, true),
                    Builders<ProjectPeople>.Filter.Eq(mc => mc.IsCreator, true)));

            var documentsCursor = await projectPeopleCollection.FindAsync(projectPeopleFilter);
            var documents = await documentsCursor.ToListAsync();

            var projectCollection = _clientDb.GetCollection<Project>(IdentifierConstants.TenantCollectionName);
            var filter = Builders<Project>.Filter.In(p => p.TenantId, documents?.Select(doc => doc?.TenantId)) &
                         Builders<Project>.Filter.Where(p => p.IsDisabled == false) &
                         Builders<Project>.Filter.Nin(p => p.TenantId, ownedTenantIds);

            if (!string.IsNullOrEmpty(tenantGroupId))
            {
                filter &= Builders<Project>.Filter.Eq(p => p.TenantGroupId, tenantGroupId);
            }

            using var projectCursor = await projectCollection.FindAsync(filter, new FindOptions<Project>
            {
                Sort = Builders<Project>.Sort.Descending(doc => doc.LastUpdatedBy)
            });

            return await projectCursor.ToListAsync();
        }

        public async Task<List<Project>> GetProjectPeoplesAsync(string tenantGroupId)
        {
            var projectPeopleCollection = _clientDb.GetCollection<ProjectPeople>(IdentifierConstants.ProjectPeopleCollectionName);

            var projectPeopleFilter = Builders<ProjectPeople>.Filter.And(
                Builders<ProjectPeople>.Filter.Eq(mc => mc.UserId, BlocksContext.GetContext()?.UserId),
                Builders<ProjectPeople>.Filter.Or(
                    Builders<ProjectPeople>.Filter.Eq(mc => mc.IsInvitationConfirmed, true),
                    Builders<ProjectPeople>.Filter.Eq(mc => mc.IsCreator, true)));

            var documentsCursor = await projectPeopleCollection.FindAsync(projectPeopleFilter);
            var documents = await documentsCursor.ToListAsync();

            var projectCollection = _clientDb.GetCollection<Project>(IdentifierConstants.TenantCollectionName);
            var filter = Builders<Project>.Filter.In(p => p.TenantId, documents?.Select(doc => doc?.TenantId)) &
                         Builders<Project>.Filter.Where(p => p.IsDisabled == false);

            filter &= Builders<Project>.Filter.Eq(p => p.TenantGroupId, tenantGroupId);

            using var projectCursor = await projectCollection.FindAsync(filter, new FindOptions<Project>
            {
                Sort = Builders<Project>.Sort.Descending(doc => doc.LastUpdatedBy)
            });

            return await projectCursor.ToListAsync();
        }

        public async Task SaveStatusTracerAsync(ProjectStatusTracer statusTrace)
        {
            var collection = _clientDb.GetCollection<ProjectStatusTracer>(_projectStatusTraceCollectionName);

            var filter = Builders<ProjectStatusTracer>.Filter.Eq(tracer => tracer.ProjectId, statusTrace.ProjectId);
            await collection.ReplaceOneAsync(filter, statusTrace, new ReplaceOptions { IsUpsert = true });
        }

        public async Task<List<ProjectStatusTracer>> GetAllUnfinishedProjectAsync()
        {
            var collection = _clientDb.GetCollection<ProjectStatusTracer>(_projectStatusTraceCollectionName);

            var filter = Builders<ProjectStatusTracer>.Filter.Eq(mc => mc.IsProjectCreationSuccess, false);
            var unfinishedList = await collection.FindAsync(filter);
            return await unfinishedList.ToListAsync();
        }

        public async Task<ProjectStatusTracer?> GetUnfinishedProjectByIdAsync(string itemId)
        {
            var collection = _clientDb.GetCollection<ProjectStatusTracer>(_projectStatusTraceCollectionName);

            var filter = Builders<ProjectStatusTracer>.Filter.Eq(mc => mc.ProjectId, itemId);
            var unfinishedList = await collection.FindAsync(filter);
            return await unfinishedList.FirstOrDefaultAsync();
        }

        public async Task CreateDefaultConfigurationAsync(ProjectStatusTracer statusTracer, Tenant project)
        {
            if (statusTracer.IsDefaultConfigurationCopied) return;

            var dataBase = _dbContextProvider.GetDatabase(_blocksSecret.DatabaseConnectionString, $"{project.DBName}");

            await InitializeDefaultConfigurationsAsync(dataBase, project);
            statusTracer.IsDefaultConfigurationCopied = true;
        }

        private async Task InitializeDefaultConfigurationsAsync(IMongoDatabase consumerDb, Tenant project)
        {
            var sourceDatabase = _dbContextProvider.GetDatabase(_blocksSecret.DatabaseConnectionString, "BlocksConfiguration");

            await Task.WhenAll(
                CopyDocumentAsync(sourceDatabase, consumerDb, "MailServerConfigurations", project),
                CopyDocumentAsync(sourceDatabase, consumerDb, "EmailTemplates", project),
                CopyDocumentAsync(sourceDatabase, consumerDb, "StorageConfigurations", project),
                // Localization collections (BlocksLanguages, UilmFiles, BlocksLanguageModules,
                // BlocksLanguageKeys) are deliberately not seeded here. DataCleanupAsync still
                // copies them from BlocksConfiguration on demand.
                CopyDocumentAsync(sourceDatabase, consumerDb, "Roles", project),
                CopyDocumentAsync(sourceDatabase, consumerDb, "Permissions", project),
                // CopyDocumentAsync(sourceDatabase, consumerDb, "SchemaDefinitions", project),
                CopyDocumentAsync(sourceDatabase, consumerDb, "TenantConfigurations", project),
                CopyAndCustomizeIdentityConfigurationAsync(sourceDatabase, consumerDb, project),
                // CopyAndCustomizeResourceLimitsAsync(sourceDatabase, consumerDb, project),
                CopyDocumentAsync(sourceDatabase, consumerDb, "LinkBasedActionConfigs", project),
                CopyDocumentAsync(sourceDatabase, consumerDb, "TemplatePluginConfigs", project),
                CopyDocumentAsync(sourceDatabase, consumerDb, "FileDirectories", project),
                CopyDocumentAsync(sourceDatabase, consumerDb, "ObjectItems", project),
                CopyDocumentAsync(sourceDatabase, consumerDb, "DataServiceConfigurations", project));

        }

        private async Task CopyDocumentAsync(IMongoDatabase sourceDb, IMongoDatabase targetDb, string collectionName, Tenant project)
        {
            var collectionExists = await targetDb.ListCollectionNames(new ListCollectionNamesOptions { Filter = new BsonDocument("name", collectionName) }).AnyAsync();

            if (collectionExists)
            {
                return;
            }

            var sourceCollection = sourceDb.GetCollection<BsonDocument>(collectionName);
            var documents = await (await sourceCollection.FindAsync(_ => true)).ToListAsync();

            var copiedCloudUserRole = false;
            foreach (var document in documents)
            {
                NormalizeCopiedDefaultRole(collectionName, document);
                if (IsCloudUserRole(collectionName, document))
                {
                    if (copiedCloudUserRole)
                    {
                        continue;
                    }

                    copiedCloudUserRole = true;
                }

                document["CreatedBy"] = project.CreatedBy;
                document["LastUpdatedBy"] = project.CreatedBy;
                var targetCollection = targetDb.GetCollection<BsonDocument>(collectionName);
                await targetCollection.InsertOneAsync(document);
            }

        }

        private static void NormalizeCopiedDefaultRole(string collectionName, BsonDocument document)
        {
            if (!collectionName.Equals("Roles", StringComparison.Ordinal))
            {
                return;
            }

            NormalizeLegacyUserRoleValues(document);
        }

        private static void NormalizeLegacyUserRoleValues(BsonDocument document)
        {
            foreach (var element in document.ToList())
            {
                if (IsLegacyUserRoleValue(element.Value))
                {
                    document[element.Name] = _cloudUserRoleSlug;
                    continue;
                }

                if (element.Value is BsonDocument nestedDocument)
                {
                    NormalizeLegacyUserRoleValues(nestedDocument);
                    continue;
                }

                if (element.Value is BsonArray array)
                {
                    NormalizeLegacyUserRoleValues(array);
                }
            }
        }

        private static void NormalizeLegacyUserRoleValues(BsonArray array)
        {
            for (var index = 0; index < array.Count; index++)
            {
                if (IsLegacyUserRoleValue(array[index]))
                {
                    array[index] = _cloudUserRoleSlug;
                    continue;
                }

                if (array[index] is BsonDocument nestedDocument)
                {
                    NormalizeLegacyUserRoleValues(nestedDocument);
                    continue;
                }

                if (array[index] is BsonArray nestedArray)
                {
                    NormalizeLegacyUserRoleValues(nestedArray);
                }
            }
        }

        private static bool IsLegacyUserRoleValue(BsonValue value) =>
            value.IsString
            && value.AsString.Equals(_legacyDefaultUserRoleSlug, StringComparison.OrdinalIgnoreCase);

        private static bool IsCloudUserRole(string collectionName, BsonDocument document)
        {
            if (!collectionName.Equals("Roles", StringComparison.Ordinal))
            {
                return false;
            }

            foreach (var fieldName in new[] { "Slug", "slug", "Fid", "fid", "FId", "FID" })
            {
                if (document.TryGetValue(fieldName, out var value)
                    && value.IsString
                    && value.AsString.Equals(_cloudUserRoleSlug, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }

            return false;
        }

        private async Task CopyAndCustomizeIdentityConfigurationAsync(IMongoDatabase sourceDb, IMongoDatabase targetDb, Tenant project)
        {
            var sourceCollection = sourceDb.GetCollection<BsonDocument>("IdentityConfigurations");
            var identityConfiguration = await sourceCollection.Find(_ => true).FirstOrDefaultAsync();
            var userId = BlocksContext.GetContext()?.UserId;

            if (identityConfiguration != null)
            {

                var collectionExists = await targetDb.ListCollectionNames(new ListCollectionNamesOptions { Filter = new BsonDocument("name", "IdentityConfigurations") }).AnyAsync();

                if (collectionExists)
                {
                    await targetDb.DropCollectionAsync("IdentityConfigurations");
                }

                identityConfiguration["AccountActionBaseUrl"] = $"{project.Applications.FirstOrDefault().Domain}";
                identityConfiguration["CreatedBy"] = userId;
                identityConfiguration["LastUpdatedBy"] = userId;

                var targetCollection = targetDb.GetCollection<BsonDocument>("IdentityConfigurations");
                await targetCollection.InsertOneAsync(identityConfiguration);
            }
        }

        private async Task CopyAndCustomizeResourceLimitsAsync(IMongoDatabase sourceDb, IMongoDatabase targetDb, Tenant project)
        {
            var sourceCollection = sourceDb.GetCollection<BsonDocument>("ResourceLimits");
            var resourceLimits = await (await sourceCollection.FindAsync(_ => true)).ToListAsync();
            var userId = BlocksContext.GetContext()?.UserId;

            foreach (var resourceLimit in resourceLimits)
            {
                resourceLimit["CreatedBy"] = userId;
                resourceLimit["LastUpdatedBy"] = userId;
                resourceLimit["CreatedDate"] = DateTime.UtcNow;
                resourceLimit["LastUpdatedDate"] = DateTime.UtcNow;
                resourceLimit["Language"] = "en-US";
                resourceLimit["TenantId"] = project.TenantId;
                resourceLimit["Lifetime"] = DateTime.UtcNow.AddMonths(1);
                resourceLimit["Language"] = "en-US";

                var targetCollection = targetDb.GetCollection<BsonDocument>("ResourceLimits");
                await targetCollection.InsertOneAsync(resourceLimit);
            }
        }

        public async Task UpdateIamConfigurationAsync(Tenant project)
        {
            var targetedDb = _dbContextProvider.GetDatabase(project.TenantId);
            var collection = targetedDb.GetCollection<BsonDocument>("IamConfigurations");

            var iamConfiguration = await collection.Find(_ => true).FirstOrDefaultAsync();

            if (iamConfiguration != null)
            {
                var filter = Builders<BsonDocument>.Filter.Eq("_id", iamConfiguration["_id"]);

                var applicationDomain = project.Applications.FirstOrDefault()?.Domain;

                var update = Builders<BsonDocument>.Update
                    .Set("AccountActivationUrl", $"{applicationDomain}/activate")
                    .Set("AccountVerificationUrl", $"{applicationDomain}/verify")
                    .Set("RecoverAccountUrl", $"{applicationDomain}/resetpassword")
                    .Set("CreatedBy", project.TenantId)
                    .Set("LastUpdatedBy", project.TenantId);

                await collection.UpdateOneAsync(filter, update);
            }
        }


        public async Task SaveRepoInfoAsync(Tenant project, List<Resource>? resources)
        {
            var targetDb = _dbContextProvider.GetDatabase(_blocksSecret.DatabaseConnectionString, $"{project.DBName}");
            var tenantSlug = await _urlEncodingService.EncodeToBase26Async(project.TenantGroupId, project.TenantGroupId, 5);

            List<BsonDocument> documents = [];
            foreach (var resource in resources)
            {
                var repoSlug = await _urlEncodingService.EncodeToBase26Async(resource.ResourceId, project.TenantGroupId, 5);
                documents.Add(GetRepoObject(resource, project, tenantSlug, repoSlug));
            }

            if (documents.Count > 0)
            {
                var applicationDomain = project.Applications.FirstOrDefault()?.Domain;
                if (applicationDomain != null)
                {
                    documents[0]["DefaultDeploymentUrl"] = applicationDomain;
                }
                var targetCollection = targetDb.GetCollection<BsonDocument>("Repos");
                await targetCollection.InsertManyAsync(documents);
            }
        }

        public async Task UpdateRepoResourceAsync(AddAssetRequest request)
        {
            var projects = await GetByGroupIdAsync(request.TenantGroupId);
            var repoSlug = await _urlEncodingService.EncodeToBase26Async(request.Resource.ResourceId, request.TenantGroupId, 5);

            foreach (var project in projects)
            {
                var tenantSlug = await _urlEncodingService.EncodeToBase26Async(project.TenantGroupId, request.TenantGroupId, 5);
                var targetedDb = _dbContextProvider.GetDatabase(project.TenantId);
                var reposCollection = targetedDb.GetCollection<BsonDocument>("Repos");
                await reposCollection.InsertOneAsync(GetRepoObject(request.Resource, project, tenantSlug, repoSlug));
            }
        }

        // A repository keeps its ResourceId across a rename, so the copy held by every tenant in
        // the group is refreshed in place. UpdateMany because a group can hold more than one row
        // per SourceRepoId. The deployment url is derived from the id, not the name, so it stands.
        // IsArchived is cleared here because every caller means "this repository is present and
        // this is what it looks like now" — a rename leaves it false, a restore flips it back.
        public async Task UpdateRepoResourceInfoAsync(AddAssetRequest request)
        {
            var update = Builders<BsonDocument>.Update
                .Set("RepoName", request.Resource.Name)
                .Set("RepoUrl", request.Resource.Link)
                .Set("IsArchived", false)
                .Set("LastUpdatedDate", DateTime.UtcNow)
                .Set("LastUpdatedBy", BlocksContext.GetContext()?.UserId ?? string.Empty);

            await UpdateGroupReposAsync(request.TenantGroupId, request.Resource.ResourceId, update);
        }

        // Deleting a repository archives it rather than dropping the row, so the tenant copies are
        // flagged the same way the group's asset entry is. Restoring goes back through
        // UpdateRepoResourceInfoAsync, which clears the flag again.
        public async Task ArchiveRepoResourceAsync(DeleteAssetRequest request)
        {
            var update = Builders<BsonDocument>.Update
                .Set("IsArchived", true)
                .Set("LastUpdatedDate", DateTime.UtcNow)
                .Set("LastUpdatedBy", BlocksContext.GetContext()?.UserId ?? string.Empty);

            await UpdateGroupReposAsync(request.TenantGroupId, request.ResourceId, update);
        }

        private async Task UpdateGroupReposAsync(string tenantGroupId, string resourceId, UpdateDefinition<BsonDocument> update)
        {
            var projects = await GetByGroupIdAsync(tenantGroupId);
            var filter = Builders<BsonDocument>.Filter.Eq("SourceRepoId", resourceId);

            foreach (var project in projects)
            {
                var targetedDb = _dbContextProvider.GetDatabase(project.TenantId);
                var reposCollection = targetedDb.GetCollection<BsonDocument>("Repos");
                await reposCollection.UpdateManyAsync(filter, update);
            }
        }

        private BsonDocument GetRepoObject(Resource resource, Tenant project, string tenantSlug, string repoSlug)
        {
            string deployDomain = $"https://{IdentifierHelper.EnvironmentMapper(project.Environment)}{tenantSlug}-{repoSlug}{_configuration["KbtclIdentifier"]}";

            return new BsonDocument
            {
                ["_id"] = Guid.NewGuid().ToString(),
                ["SourceRepoId"] = resource.ResourceId,
                ["RepoName"] = resource.Name,
                ["RepoUrl"] = resource.Link,
                ["IsArchived"] = false,
                ["CreatedDate"] = DateTime.UtcNow,
                ["LastUpdatedDate"] = DateTime.UtcNow,
                ["CreatedBy"] = BlocksContext.GetContext()?.UserId ?? string.Empty,
                ["Branch"] = project.Environment == "prod" ? "main" : project.Environment,
                ["ProjectId"] = project.TenantId,
                ["ProjectName"] = project.Name,
                ["DeploymentType"] = "Manual",
                ["DefaultDeploymentUrl"] = deployDomain.ToLower()
            };
        }

        public async Task<long> GetProjectCountAsync()
        {
            var ownedTenantIds = await GetOwnedTenantIdsAsync(BlocksContext.GetContext()?.UserId);

            var collection = _clientDb.GetCollection<Project>(IdentifierConstants.TenantCollectionName);

            var filter = Builders<Project>.Filter.And(Builders<Project>.Filter.In(mc => mc.TenantId, ownedTenantIds),
                                                      Builders<Project>.Filter.Eq(mc => mc.IsDisabled, false));

            return await collection.CountDocumentsAsync(filter);
        }

        public async Task<bool> IsExistingEnviroment(List<string> enviroments, string tenantGroupId)
        {
            var collection = _clientDb.GetCollection<Project>(IdentifierConstants.TenantCollectionName);
            var filter = Builders<Project>.Filter.And(Builders<Project>.Filter.In(mc => mc.Environment, enviroments),
                                                      Builders<Project>.Filter.Eq(mc => mc.TenantGroupId, tenantGroupId),
                                                      Builders<Project>.Filter.Eq(mc => mc.IsDisabled, false));
            var count = await collection.CountDocumentsAsync(filter);
            return count > 0;
        }

        public async Task InsertPeopleAsync(ProjectPeople projectPeople)
        {
            await _clientDb.GetCollection<ProjectPeople>("ProjectPeoples").InsertOneAsync(projectPeople);
        }

        public async Task<bool> SaveTenantCertificateAsync(TenantCertificate tenantCertificate)
        {
            await _clientDb.GetCollection<TenantCertificate>("TenantCertificates")
                .ReplaceOneAsync(x => x.ItemId == tenantCertificate.ItemId, tenantCertificate, new ReplaceOptions { IsUpsert = true });

            return true;
        }

        public async Task<Tenant> GetByTenantIdAsync(string tenantId)
        {
            var collection = _clientDb.GetCollection<Tenant>(IdentifierConstants.TenantCollectionName);

            var filter = Builders<Tenant>.Filter.And(Builders<Tenant>.Filter.Eq(mc => mc.TenantId, tenantId),
                                                     Builders<Tenant>.Filter.Eq(mc => mc.IsDisabled, false));

            return await (await collection.FindAsync(filter)).FirstOrDefaultAsync();
        }

        public async Task<List<SsoInfo>> GetSsoInfoAsync()
        {
            var collection = _clientDb.GetCollection<SsoInfo>("SocialLoginCredentials");

            var filter = Builders<SsoInfo>.Filter.Eq(mc => mc.IsDisabled, false);
            return await (await collection.FindAsync(filter)).ToListAsync();
        }

        public async Task SaveTenantAssetAsync(TenantAsset asset)
        {
            var collection = _clientDb.GetCollection<TenantAsset>(IdentifierConstants.TenantAssetCollectionName);
            var filter = Builders<TenantAsset>.Filter.Eq(mc => mc.TenantGroupId, asset.TenantGroupId);
            await collection.ReplaceOneAsync(filter, asset, new ReplaceOptions { IsUpsert = true });
        }

        public async Task<BlocksGuid> GetBlocksGuidAsync(string tenantGroupId)
        {
            var collection = _clientDb.GetCollection<BlocksGuid>($"{nameof(BlocksGuid)}s");
            var filter = Builders<BlocksGuid>.Filter.Eq(mc => mc.TenantGroupId, tenantGroupId);
            return await collection.Find(filter).FirstOrDefaultAsync();
        }

        public async Task<BaseResponse> SaveJWTClaimsAsync(ThirdPartyJWTClaims mapper)
        {
            var collection = ResolveThirdPartyJWTClaimsCollection();
            var filter = Builders<ThirdPartyJWTClaims>.Filter.Eq(m => m.ItemId, mapper.ItemId);
            await collection.ReplaceOneAsync(filter, mapper, new ReplaceOptions { IsUpsert = true });

            return new BaseResponse { IsSuccess = true };
        }

        public async Task<ThirdPartyJWTClaims> GetThirdPartyJWTClaimsAsync(string itemId)
        {
            var collection = ResolveThirdPartyJWTClaimsCollection();

            var filter = !string.IsNullOrWhiteSpace(itemId) ?
                         Builders<ThirdPartyJWTClaims>.Filter.Eq(mc => mc.ItemId, itemId) :
                         Builders<ThirdPartyJWTClaims>.Filter.Empty;

            return await collection.Find(filter).FirstOrDefaultAsync();
        }

        public async Task<List<string>> GetProjectIdsByGroupId(string projectGroupId)
        {
            var filter = Builders<Tenant>.Filter.Eq(x => x.TenantGroupId, projectGroupId);

            var tenantIds = await _clientDb.GetCollection<Tenant>(IdentifierConstants.TenantCollectionName)
                .Find(filter)
                .Project(x => x.TenantId)
                .ToListAsync();

            return tenantIds;
        }

        public async Task UpdateTenantGroupAsync(UpdateTenantGroupRequest request)
        {
            var tenantIds = await GetProjectIdsByGroupId(request.TenantGroupId);
            var collection = _clientDb.GetCollection<Tenant>(IdentifierConstants.TenantCollectionName);

            await collection.UpdateManyAsync(
                 Builders<Tenant>.Filter.In(t => t.TenantId, tenantIds),
                 Builders<Tenant>.Update.Set(t => t.Name, request.Name)
                                        .Set(t => t.LastUpdatedBy, BlocksContext.GetContext()?.UserId)
                                        .Set(t => t.LastUpdatedDate, DateTime.UtcNow));
        }

        // `_clientDb`, not `_dbContextProvider`, exactly like every other ProjectPeoples access in
        // this repository. Disable runs impersonated -- the controller passes the impersonated
        // TenantId as the project to disable -- so the raw provider resolves to the project's own
        // tenant database, where these rows have never lived, and the delete matched nothing while
        // reporting success. The rows survived their project.
        public async Task DeletePrjectPeopleAsync(string tenantId)
        {
            var collection = _clientDb.GetCollection<ProjectPeople>(IdentifierConstants.ProjectPeopleCollectionName);
            await collection.DeleteManyAsync(Builders<ProjectPeople>.Filter.Eq(p => p.TenantId, tenantId));
        }
    }
}
