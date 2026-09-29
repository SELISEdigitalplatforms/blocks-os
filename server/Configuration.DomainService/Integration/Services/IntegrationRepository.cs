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

        public async Task<List<IntegrationTemplate>> GetActiveTemplatesAsync()
        {
            var filter = Builders<IntegrationTemplate>.Filter.Eq(t => t.IsActive, true);
            var options = new FindOptions<IntegrationTemplate> { Sort = Builders<IntegrationTemplate>.Sort.Ascending(t => t.DisplayName) };
            return await (await Templates().FindAsync(filter, options)).ToListAsync();
        }

        public async Task<IntegrationTemplate?> GetActiveTemplateByKeyAsync(string key)
        {
            var filter = Builders<IntegrationTemplate>.Filter.Eq(t => t.Key, key)
                & Builders<IntegrationTemplate>.Filter.Eq(t => t.IsActive, true);
            return await (await Templates().FindAsync(filter)).FirstOrDefaultAsync();
        }

        public async Task<IntegrationSetup?> GetSetupAsync()
        {
            var filter = Builders<IntegrationSetup>.Filter.Eq(s => s.ItemId, IntegrationSetup.SingletonId);
            return await (await Setups().FindAsync(filter)).FirstOrDefaultAsync();
        }

        public async Task<bool> TryInsertSetupAsync(IntegrationSetup setup)
        {
            try
            {
                await Setups().InsertOneAsync(setup);
                return true;
            }
            catch (MongoWriteException ex) when (ex.WriteError?.Category == ServerErrorCategory.DuplicateKey)
            {
                return false;
            }
        }

        // Resolved per call: this repository is a singleton, and the shared database must never be
        // confused with whichever tenant happened to call first.
        private IMongoCollection<IntegrationTemplate> Templates() =>
            _dbContextProvider
                .GetDatabase(_blocksSecret.DatabaseConnectionString, _configurationDatabaseName)
                .GetCollection<IntegrationTemplate>(_templateCollectionName);

        private IMongoCollection<IntegrationSetup> Setups() =>
            _dbContextProvider.GetCollection<IntegrationSetup>(_setupCollectionName);
    }
}
