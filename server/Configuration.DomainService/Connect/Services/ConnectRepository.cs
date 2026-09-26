using Blocks.Genesis;
using Configuration.DomainService.Connect.Entities;
using MongoDB.Driver;

namespace Configuration.DomainService.Connect.Services
{
    public class ConnectRepository : IConnectRepository
    {
        private const string _configurationDatabaseName = "BlocksConfiguration";
        private const string _templateCollectionName = "ConnectTemplates";
        private const string _setupCollectionName = "ConnectSetups";

        private readonly IDbContextProvider _dbContextProvider;
        private readonly IBlocksSecret _blocksSecret;

        public ConnectRepository(IDbContextProvider dbContextProvider, IBlocksSecret blocksSecret)
        {
            _dbContextProvider = dbContextProvider;
            _blocksSecret = blocksSecret;
        }

        public async Task<List<ConnectTemplate>> GetActiveTemplatesAsync()
        {
            var filter = Builders<ConnectTemplate>.Filter.Eq(t => t.IsActive, true);
            var options = new FindOptions<ConnectTemplate> { Sort = Builders<ConnectTemplate>.Sort.Ascending(t => t.DisplayName) };
            return await (await Templates().FindAsync(filter, options)).ToListAsync();
        }

        public async Task<ConnectTemplate?> GetActiveTemplateByKeyAsync(string key)
        {
            var filter = Builders<ConnectTemplate>.Filter.Eq(t => t.Key, key)
                & Builders<ConnectTemplate>.Filter.Eq(t => t.IsActive, true);
            return await (await Templates().FindAsync(filter)).FirstOrDefaultAsync();
        }

        public async Task<ConnectSetup?> GetSetupAsync()
        {
            var filter = Builders<ConnectSetup>.Filter.Eq(s => s.ItemId, ConnectSetup.SingletonId);
            return await (await Setups().FindAsync(filter)).FirstOrDefaultAsync();
        }

        public async Task<bool> TryInsertSetupAsync(ConnectSetup setup)
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
        private IMongoCollection<ConnectTemplate> Templates() =>
            _dbContextProvider
                .GetDatabase(_blocksSecret.DatabaseConnectionString, _configurationDatabaseName)
                .GetCollection<ConnectTemplate>(_templateCollectionName);

        private IMongoCollection<ConnectSetup> Setups() =>
            _dbContextProvider.GetCollection<ConnectSetup>(_setupCollectionName);
    }
}
