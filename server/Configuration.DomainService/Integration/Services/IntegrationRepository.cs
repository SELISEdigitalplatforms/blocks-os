using Blocks.Genesis;
using Configuration.DomainService.Integration.Entities;
using MongoDB.Driver;

namespace Configuration.DomainService.Integration.Services
{
    public class IntegrationRepository : IIntegrationRepository
    {
        private const string _configurationDatabaseName = "BlocksConfiguration";
        private const string _templateCollectionName = "IntegrationTemplates";
        private const string _setupCollectionName = "IntegrationSetups";

        private readonly IDbContextProvider _dbContextProvider;
        private readonly IBlocksSecret _blocksSecret;

        public IntegrationRepository(IDbContextProvider dbContextProvider, IBlocksSecret blocksSecret)
        {
            _dbContextProvider = dbContextProvider;
            _blocksSecret = blocksSecret;
        }

        public async Task<List<IntegrationTemplate>> GetActiveTemplatesAsync(string? family = null)
        {
            var filter = Builders<IntegrationTemplate>.Filter.Eq(t => t.IsActive, true);
            if (!string.IsNullOrWhiteSpace(family))
            {
                filter &= Builders<IntegrationTemplate>.Filter.Eq(t => t.Family, family.Trim());
            }

            var options = new FindOptions<IntegrationTemplate>
            {
                Sort = Builders<IntegrationTemplate>.Sort.Ascending(t => t.SortOrder)
                    .Ascending(t => t.DisplayName)
            };
            return await (await Templates().FindAsync(filter, options)).ToListAsync();
        }

        public async Task<IntegrationTemplate?> GetTemplateByKeyAsync(string key, bool includeInactive = false)
        {
            var filter = Builders<IntegrationTemplate>.Filter.Eq(t => t.Key, key);
            if (!includeInactive)
            {
                filter &= Builders<IntegrationTemplate>.Filter.Eq(t => t.IsActive, true);
            }

            return await (await Templates().FindAsync(filter)).FirstOrDefaultAsync();
        }

        public async Task<bool> TryInsertSetupAsync(IntegrationSetup setup)
        {
            var setups = Setups();

            // Each tenant has its own database, so there is no startup hook to build this in; it
            // is ensured on the (rare) write path instead. Idempotent when it already exists.
            await EnsureConnectionIndexesAsync(setups);

            try
            {
                await setups.InsertOneAsync(setup);
                return true;
            }
            catch (MongoWriteException ex) when (ex.WriteError?.Category == ServerErrorCategory.DuplicateKey)
            {
                return false;
            }
        }

        public async Task<bool> HasActiveConnectionNamedAsync(string connectionName) =>
            await (await Setups().FindAsync(Builders<IntegrationSetup>.Filter.Eq(s => s.ConnectionName, connectionName)
                & (Builders<IntegrationSetup>.Filter.Eq(s => s.Status, "active")
                    | Builders<IntegrationSetup>.Filter.Eq(s => s.Status, "")
                    | Builders<IntegrationSetup>.Filter.Exists(s => s.Status, false)))).AnyAsync();

        public async Task<List<IntegrationSetup>> GetConnectionsAsync() =>
            await (await Setups().FindAsync(FilterDefinition<IntegrationSetup>.Empty,
                new FindOptions<IntegrationSetup> { Sort = Builders<IntegrationSetup>.Sort.Descending(s => s.CreatedDate) })).ToListAsync();

        public async Task<bool> RevokeConnectionAsync(string connectionId, string? revokedBy)
        {
            var update = Builders<IntegrationSetup>.Update.Set(s => s.Status, "revoked")
                .Set(s => s.RevokedBy, revokedBy).Set(s => s.RevokedDate, DateTime.UtcNow)
                .Set(s => s.LastUpdatedBy, revokedBy).Set(s => s.LastUpdatedDate, DateTime.UtcNow);
            var result = await Setups().UpdateOneAsync(Builders<IntegrationSetup>.Filter.Eq(s => s.ItemId, connectionId), update);
            return result.MatchedCount == 1;
        }

        public async Task MarkConnectionNeverDeliveredAsync(string environmentTenantId, string connectionId)
        {
            await Setups(environmentTenantId).UpdateOneAsync(Builders<IntegrationSetup>.Filter.Eq(s => s.ItemId, connectionId),
                Builders<IntegrationSetup>.Update.Set(s => s.NeverDelivered, true).Set(s => s.LastUpdatedDate, DateTime.UtcNow));
        }

        public async Task<IntegrationSetup?> GetConnectionAsync(string connectionId) =>
            await (await Setups().FindAsync(Builders<IntegrationSetup>.Filter.Eq(s => s.ItemId, connectionId))).FirstOrDefaultAsync();

        private static async Task EnsureConnectionIndexesAsync(IMongoCollection<IntegrationSetup> setups)
        {
            try { await setups.Indexes.DropOneAsync("TemplateKey_unique"); }
            catch (MongoCommandException ex) when (ex.CodeName == "IndexNotFound") { }
            await setups.Indexes.CreateOneAsync(new CreateIndexModel<IntegrationSetup>(Builders<IntegrationSetup>.IndexKeys.Ascending(s => s.ClientCredentialId), new CreateIndexOptions { Name = "ClientCredentialId_unique", Unique = true }));
            await setups.Indexes.CreateOneAsync(new CreateIndexModel<IntegrationSetup>(Builders<IntegrationSetup>.IndexKeys.Ascending(s => s.TemplateKey), new CreateIndexOptions { Name = "TemplateKey" }));
        }

        // Resolved per call: this repository is a singleton, and the shared database must never be
        // confused with whichever tenant happened to call first.
        private IMongoCollection<IntegrationTemplate> Templates() =>
            _dbContextProvider
                .GetDatabase(_blocksSecret.DatabaseConnectionString, _configurationDatabaseName)
                .GetCollection<IntegrationTemplate>(_templateCollectionName);

        private IMongoCollection<IntegrationSetup> Setups() =>
            _dbContextProvider.GetCollection<IntegrationSetup>(_setupCollectionName);

        // Exchange requests execute without an impersonated BlocksContext. Use their recorded
        // environment explicitly instead of the root database that stores the request itself.
        private IMongoCollection<IntegrationSetup> Setups(string environmentTenantId) =>
            _dbContextProvider.GetDatabase(environmentTenantId).GetCollection<IntegrationSetup>(_setupCollectionName);
    }
}
