using Blocks.Genesis;
using DomainService.Dtos;
using DomainService.Entities;
using DomainService.Projects;
using DomainService.Shared;
using MongoDB.Bson;
using MongoDB.Driver;
using System.Text.RegularExpressions;

namespace DomainService.People
{
    public class PeopleRepository : IPeopleRepository
    {
        private readonly IDbContextProvider _dbContextProvider;
        private readonly ITenants _tenants;
        private readonly IProjectRepository _projectRepository;
        private readonly IMongoDatabase _rootDb;

        private const string _userCollectionName = "Users";
        private const string _peopleCollectionName = "ProjectPeoples";

        /// <summary>
        /// ProjectPeoples lives in the root database and nowhere else: every write to it — the
        /// creator row provisioning stamps, the invite inserts, the disable cleanup — goes
        /// through <see cref="IProjectRepository"/>, which pins the collection to BlocksRootDb.
        /// </summary>
        /// <remarks>
        /// Read through the plain <see cref="IDbContextProvider.GetCollection{T}(string)"/>
        /// instead and the handle resolves to <c>BlocksContext.TenantId</c>'s own database. Once
        /// the console has impersonated a project — which Project/Disable relies on, since it
        /// takes the impersonated tenant as the project to disable — that is the project's own
        /// tenant database, where these rows have never been written. Every read came back
        /// empty, and because <c>ProjectAccessService</c> decides ownership from exactly these
        /// rows, the owner of a project was refused as a non-member of it: "Only the project
        /// owner can do this", with <c>rows=0; ownerRows=0</c>.
        ///
        /// The writes were wrong in the same direction and less visibly: an invite, an access
        /// grant or a remove-access issued from inside a project landed in (or matched nothing
        /// in) the project's tenant database, leaving rows split across two databases.
        /// </remarks>
        private IMongoCollection<ProjectPeople> PeopleCollection =>
            _rootDb.GetCollection<ProjectPeople>(_peopleCollectionName);

        // Shortest search term that will actually query; below this the filter is ignored (all people returned).
        private const int MinSearchTermLength = 3;

        // One document per person: _id is the UserId, Email is carried along to give the page a stable order.
        private static readonly BsonDocument GroupByPersonStage = new("$group", new BsonDocument
        {
            { "_id", "$UserId" },
            { "Email", new BsonDocument("$min", "$Email") }
        });

        // Email is unique per user, so _id only breaks ties between rows that never got an email.
        private static readonly BsonDocument SortByPersonStage = new("$sort", new BsonDocument
        {
            { "Email", 1 },
            { "_id", 1 }
        });

        public PeopleRepository(IDbContextProvider dbContextProvider,
                               ITenants tenants,
                               IProjectRepository projectRepository,
                               IBlocksSecret blocksSecret)
        {
            _dbContextProvider = dbContextProvider;
            _tenants = tenants;
            _projectRepository = projectRepository;
            _rootDb = dbContextProvider.GetDatabase(blocksSecret.DatabaseConnectionString, IdentifierConstants.RootDatabaseName);
        }

        public async Task<(List<GetProjectPeople> peoples, long totalCount, long peoplesTotalCount, bool isOwner)> GetPeoplesAsync(GetPeoplesRequest request)
        {
            var peopleCollection = PeopleCollection;
            var userCollection = _dbContextProvider.GetCollection<User>(_userCollectionName);

            var projectIds = await _projectRepository.GetProjectIdsByGroupId(request.ProjectGroupId);
            FilterDefinition<ProjectPeople> projectPeopleFilter = Builders<ProjectPeople>.Filter.In("TenantId", projectIds);

            if (request.EnvironmentIds is { Count: > 0 })
            {
                projectPeopleFilter &= Builders<ProjectPeople>.Filter.In("TenantId", request.EnvironmentIds);
            }

            if (request.IsInvitationConfirmed.HasValue)
            {
                projectPeopleFilter &= Builders<ProjectPeople>.Filter.Eq(x => x.IsInvitationConfirmed, request.IsInvitationConfirmed.Value);
            }

            var searchTerm = request?.Filter?.Trim() ?? string.Empty;

            // Require a minimum length so short, over-broad terms don't scan the whole collection. Enforced
            // here too (not just the client) since the request can be crafted directly.
            if (searchTerm.Length >= MinSearchTermLength)
            {
                // Escape the user input so it is matched as a literal substring, not a regex. Passing raw input
                // to BsonRegularExpression allowed regex injection and catastrophic-backtracking (ReDoS).
                var regex = new BsonRegularExpression(Regex.Escape(searchTerm), "i");
                var field = request.SearchField?.Trim().ToLowerInvariant();

                if (field == PeopleSearchFields.Email)
                {
                    // Email is denormalized onto ProjectPeople, so match it on the already project-scoped rows.
                    // No scan of the (tenant-wide) Users collection at all.
                    projectPeopleFilter &= Builders<ProjectPeople>.Filter.Regex(x => x.Email, regex);
                }
                else
                {
                    // Name (and the all-fields fallback) needs the Users collection. A case-insensitive regex
                    // cannot use an index, so first narrow to this project's members and run the regex only over
                    // them, instead of scanning every user in the tenant.
                    var memberUserIds = await peopleCollection.Distinct(x => x.UserId, projectPeopleFilter).ToListAsync();

                    var scopedToMembers = Builders<User>.Filter.In(x => x.ItemId, memberUserIds);
                    var textMatch = field == PeopleSearchFields.Name
                        ? Builders<User>.Filter.Or(
                            Builders<User>.Filter.Regex(x => x.FirstName, regex),
                            Builders<User>.Filter.Regex(x => x.LastName, regex))
                        : Builders<User>.Filter.Or(
                            Builders<User>.Filter.Regex(x => x.Email, regex),
                            Builders<User>.Filter.Regex(x => x.FirstName, regex),
                            Builders<User>.Filter.Regex(x => x.LastName, regex));

                    var matchingUserIds = await userCollection.Find(scopedToMembers & textMatch)
                        .Project(x => x.ItemId).ToListAsync();
                    projectPeopleFilter &= Builders<ProjectPeople>.Filter.In(x => x.UserId, matchingUserIds);
                }
            }

            var isOwner = await IsOwner(BlocksContext.GetContext()?.UserId ?? "", projectIds);

            // TotalCount counts (person, environment) rows; the list itself is paged by distinct person.
            var totalCount = await peopleCollection.CountDocumentsAsync(projectPeopleFilter);

            var distinctPeopleCount = await peopleCollection
                .Aggregate()
                .Match(projectPeopleFilter)
                .AppendStage<BsonDocument>(GroupByPersonStage)
                .Count()
                .FirstOrDefaultAsync();

            var peoplesTotalCount = distinctPeopleCount?.Count ?? 0;

            var pagedPeople = await peopleCollection
                .Aggregate()
                .Match(projectPeopleFilter)
                .AppendStage<BsonDocument>(GroupByPersonStage)
                .AppendStage<BsonDocument>(SortByPersonStage)
                .Skip(request.PageSize * request.Page)
                .Limit(request.PageSize)
                .ToListAsync();

            var pagedUserIds = pagedPeople.Select(x => x["_id"].AsString).ToList();

            if (pagedUserIds.Count == 0)
            {
                return ([], totalCount, peoplesTotalCount, isOwner);
            }

            // Every environment row of the people on this page, so nobody is split across pages.
            var pagedRowsFilter = projectPeopleFilter & Builders<ProjectPeople>.Filter.In(x => x.UserId, pagedUserIds);
            var projectPeoples = await peopleCollection.Find(pagedRowsFilter).ToListAsync();

            var personOrder = pagedUserIds
                .Select((userId, index) => (userId, index))
                .ToDictionary(x => x.userId, x => x.index);

            var filter = Builders<User>.Filter.In(x => x.ItemId, pagedUserIds);
            var users = (await userCollection.Find(filter).ToListAsync()).ToDictionary(x => x.ItemId, x => x);

            var peoples = projectPeoples
                .OrderBy(x => personOrder[x.UserId])
                .ThenBy(x => x.ItemId)
                .Select(x =>
                {
                    var projectPeople = new GetProjectPeople
                    {
                        ItemId = x.ItemId,
                        peopleDetails = new PeopleDetails { UserId = x.UserId },
                        TenantId = x.TenantId,
                        IsInvitationSent = x.IsInvitationSent,
                        IsInvitationConfirmed = x.IsInvitationConfirmed,
                        IsCreator = x.IsCreator,
                        AccessPolicies = x.AccessPolicies ?? [],
                        Enviroment = _tenants.GetTenantByID(x.TenantId)?.Environment ?? string.Empty,
                    };

                    var user = users.ContainsKey(x.UserId) ? users[x.UserId] : null; if (user != null)
                    {
                        projectPeople.peopleDetails.Email = user.Email;
                        projectPeople.peopleDetails.FirstName = user.FirstName;
                        projectPeople.peopleDetails.LastName = user.LastName;
                        projectPeople.peopleDetails.Salutation = user.Salutation;
                        projectPeople.peopleDetails.ProfileImageUrl = user.ProfileImageUrl;
                        projectPeople.peopleDetails.AllowResendActivation = !user.Active || !user.IsVerified;
                    }
                    return projectPeople;
                });

            return (peoples.ToList(), totalCount, peoplesTotalCount, isOwner);
        }

        public async Task<Tenant> GetProjectByIdAsync(string tenantId)
        {
            var filter = Builders<Tenant>.Filter.Eq(mc => mc.TenantId, tenantId);
            return await _dbContextProvider.GetCollection<Tenant>(IdentifierConstants.TenantCollectionName).Find(filter).FirstOrDefaultAsync();
        }

        public async Task<List<User>> GetUsersByEmailAsync(List<string> emails)
        {
            var filter = Builders<User>.Filter.In(x => x.Email, emails);
            return await _dbContextProvider.GetCollection<User>(_userCollectionName).Find(filter).ToListAsync();
        }

        public async Task<User> GetUserByIdAsync(string userId)
        {
            var filter = Builders<User>.Filter.Eq(x => x.ItemId, userId);
            return await _dbContextProvider.GetCollection<User>(_userCollectionName).Find(filter).FirstOrDefaultAsync();
        }

        public async Task<bool> InsertPeoplesAsync(List<ProjectPeople> projectPeoples)
        {
            await PeopleCollection.InsertManyAsync(projectPeoples);
            return true;
        }

        public async Task<bool> RemovePeoplesAsync(string email, List<string> tenantIds)
        {
            var filter = Builders<ProjectPeople>.Filter.Eq(x => x.Email, email)
                & Builders<ProjectPeople>.Filter.In(x => x.TenantId, tenantIds);
            var result = await PeopleCollection.DeleteManyAsync(filter);
            return result.IsAcknowledged;
        }

        public async Task<bool> UpdateProjectPeoples(List<string> ids)
        {
            var filter = Builders<ProjectPeople>.Filter.In(x => x.ItemId, ids);
            var update = Builders<ProjectPeople>.Update.Set(x => x.IsInvitationConfirmed, true);
            var result = await PeopleCollection.UpdateManyAsync(filter, update);
            return result.IsAcknowledged;
        }

        public async Task<List<ProjectPeople>> GetProjectPeoplesAsync(string userId, List<string> tenantIds)
        {
            var filter = Builders<ProjectPeople>.Filter.Eq(x => x.UserId, userId) & Builders<ProjectPeople>.Filter.In(x => x.TenantId, tenantIds);
            return await PeopleCollection.Find(filter).ToListAsync();
        }

        public async Task<ProjectPeople> GetProjectPeopleAsync(string id)
        {
            var filter = Builders<ProjectPeople>.Filter.Eq(x => x.ItemId, id);
            return await PeopleCollection.Find(filter).FirstOrDefaultAsync();
        }

        /// <summary>
        /// Holds an <c>IsCreator</c> row on any tenant in the group. Matches what the
        /// authorization filter decides, so a button this list shows is one the server honours.
        /// </summary>
        public async Task<bool> IsOwner(string userId, List<string> tenantIds)
        {
            if (tenantIds is null || tenantIds.Count == 0 || string.IsNullOrWhiteSpace(userId)) return false;

            var filter = Builders<ProjectPeople>.Filter.Eq(x => x.UserId, userId)
                       & Builders<ProjectPeople>.Filter.In(x => x.TenantId, tenantIds)
                       & Builders<ProjectPeople>.Filter.Eq(x => x.IsCreator, true);

            return await PeopleCollection
                .CountDocumentsAsync(filter) > 0;
        }

        public async Task<bool> UpdateAccessPoliciesAsync(List<string> itemIds, List<string> accessPolicies)
        {
            if (itemIds is null || itemIds.Count == 0) return false;

            var filter = Builders<ProjectPeople>.Filter.In(x => x.ItemId, itemIds);
            var update = Builders<ProjectPeople>.Update
                .Set(x => x.AccessPolicies, accessPolicies ?? [])
                .Set(x => x.LastUpdatedDate, DateTime.UtcNow)
                .Set(x => x.LastUpdatedBy, BlocksContext.GetContext()?.UserId);

            var result = await PeopleCollection
                .UpdateManyAsync(filter, update);

            return result.MatchedCount > 0;
        }

        public async Task<bool> UpdateProjectPeopleOwnerShipAsync(List<string> ids, bool ownerShipStatus)
        {
            var filter = Builders<ProjectPeople>.Filter.In(x => x.ItemId, ids);
            var update = Builders<ProjectPeople>.Update.Set(x => x.IsCreator, ownerShipStatus)
                                                       .Set(x => x.IsInvitationConfirmed, true)
                                                       .Set(x => x.IsInvitationSent, true);
            var result = await PeopleCollection.UpdateManyAsync(filter, update);
            return result.IsAcknowledged;
        }

        public async Task<ProjectPeople> GetProjectPeopleByTenantIdAndUserIdAsync(string tenantId, string userId)
        {
            var filter = Builders<ProjectPeople>.Filter.Eq(x => x.TenantId, tenantId) & Builders<ProjectPeople>.Filter.Eq(x => x.UserId, userId);
            return await PeopleCollection.Find(filter).FirstOrDefaultAsync();
        }

        public async Task<User> GetUserByEmailAsync(string email)
        {
            var filter = Builders<User>.Filter.Eq(x => x.Email, email);
            return await _dbContextProvider.GetCollection<User>("Users").Find(filter).FirstOrDefaultAsync();
        }
    }
}