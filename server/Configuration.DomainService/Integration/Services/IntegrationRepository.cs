using Blocks.Genesis;
using MongoDB.Driver;
using Blocks.Genesis.Entities.Os;
using Os.DataAccess;

namespace Configuration.DomainService.Integration.Services
{
    public class IntegrationRepository : IIntegrationRepository
    {
        private const string _configurationDatabaseName = "BlocksConfiguration";
        private const string _templateCollectionName = "IntegrationTemplates";
        private const string _setupCollectionName = "IntegrationSetups";

        private readonly IDbContextProvider _dbContextProvider;
        private readonly IBlocksSecret _blocksSecret;
        private readonly IOsDataAccess _dataAccess;

        public IntegrationRepository(IDbContextProvider dbContextProvider, IBlocksSecret blocksSecret, IOsDataAccess dataAccess)
        {
            _dbContextProvider = dbContextProvider;
            _blocksSecret = blocksSecret;
            _dataAccess = dataAccess;
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
            if (!await _dataAccess.InsertAllowedAsync(OsSchemas.IntegrationSetup, "IntegrationRepository.TryInsertSetupAsync"))
                throw new UnauthorizedAccessException("Access to the integration connection was denied by the data access policy.");

            setup = await _dataAccess.PrepareWriteAsync(OsSchemas.IntegrationSetup, setup, isInsert: true, "IntegrationRepository.TryInsertSetupAsync");
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

        public async Task<bool> HasActiveConnectionNamedAsync(string connectionName)
        {
            var filter = Builders<IntegrationSetup>.Filter.Eq(s => s.ConnectionName, connectionName)
                & (Builders<IntegrationSetup>.Filter.Eq(s => s.Status, "active")
                    | Builders<IntegrationSetup>.Filter.Eq(s => s.Status, "")
                    | Builders<IntegrationSetup>.Filter.Exists(s => s.Status, false));
            var scope = await _dataAccess.ReadAsync(OsSchemas.IntegrationSetup, filter, "IntegrationRepository.HasActiveConnectionNamedAsync");
            return scope.Granted && await scope.Apply(Setups()).AnyAsync();
        }

        public async Task<List<IntegrationSetup>> GetConnectionsAsync()
        {
            var scope = await _dataAccess.ReadAsync(OsSchemas.IntegrationSetup, FilterDefinition<IntegrationSetup>.Empty, "IntegrationRepository.GetConnectionsAsync");
            return scope.Granted
                ? await scope.Apply(Setups()).SortByDescending(s => s.CreatedDate).ToListAsync()
                : new List<IntegrationSetup>();
        }

        public async Task<bool> RevokeConnectionAsync(string connectionId, string? revokedBy)
        {
            var update = Builders<IntegrationSetup>.Update.Set(s => s.Status, "revoked")
                .Set(s => s.RevokedBy, revokedBy).Set(s => s.RevokedDate, DateTime.UtcNow)
                .Set(s => s.LastUpdatedBy, revokedBy).Set(s => s.LastUpdatedDate, DateTime.UtcNow);
            var editFilter = await _dataAccess.EditFilterAsync(OsSchemas.IntegrationSetup,
                Builders<IntegrationSetup>.Filter.Eq(s => s.ItemId, connectionId), "IntegrationRepository.RevokeConnectionAsync");
            if (editFilter is null)
            {
                return false;
            }

            await _dataAccess.CheckUpdateAsync(OsSchemas.IntegrationSetup, update, "IntegrationRepository.RevokeConnectionAsync");
            var result = await Setups().UpdateOneAsync(editFilter, update);
            return result.MatchedCount == 1;
        }

        public async Task MarkConnectionNeverDeliveredAsync(string environmentTenantId, string connectionId)
        {
            // Anonymous exchange path: no user, and the target is the recorded environment DB, so the
            // data access helper takes its skip path here (no-user-context / other-tenant-db).
            var editFilter = await _dataAccess.EditFilterAsync(OsSchemas.IntegrationSetup,
                Builders<IntegrationSetup>.Filter.Eq(s => s.ItemId, connectionId), "IntegrationRepository.MarkConnectionNeverDeliveredAsync", environmentTenantId);
            if (editFilter is null)
            {
                return;
            }

            var update = Builders<IntegrationSetup>.Update.Set(s => s.NeverDelivered, true).Set(s => s.LastUpdatedDate, DateTime.UtcNow);
            await _dataAccess.CheckUpdateAsync(OsSchemas.IntegrationSetup, update, "IntegrationRepository.MarkConnectionNeverDeliveredAsync", environmentTenantId);
            await Setups(environmentTenantId).UpdateOneAsync(editFilter, update);
        }

        public async Task<IntegrationSetup?> GetConnectionAsync(string connectionId)
        {
            var scope = await _dataAccess.ReadAsync(OsSchemas.IntegrationSetup,
                Builders<IntegrationSetup>.Filter.Eq(s => s.ItemId, connectionId), "IntegrationRepository.GetConnectionAsync");
            return scope.Granted ? await scope.Apply(Setups()).FirstOrDefaultAsync() : null;
        }

        private static async Task EnsureConnectionIndexesAsync(IMongoCollection<IntegrationSetup> setups)
        {
            try { await setups.Indexes.DropOneAsync("TemplateKey_unique"); }
            catch (MongoCommandException ex) when (ex.CodeName == "IndexNotFound") { /* The legacy index is already gone; nothing to drop. */ }
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
