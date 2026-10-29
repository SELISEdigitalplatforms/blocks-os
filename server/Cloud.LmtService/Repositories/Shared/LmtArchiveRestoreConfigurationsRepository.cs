using Blocks.Genesis;
using Cloud.LmtService.Models.Shared;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace Cloud.LmtService.Repositories.Shared
{
    public class LmtArchiveRestoreConfigurationsRepository: ILmtArchiveRestoreConfigurationRepository
    {
        private readonly IMongoDatabase _database;
        private readonly ILogger<LmtArchiveRestoreConfigurationsRepository> _logger;
        private const string LmtArchiveRestoreConfigurations = "LmtArchiveRestoreConfigurations";
        public LmtArchiveRestoreConfigurationsRepository(
            IBlocksSecret blocksSecret,
            IDbContextProvider dbContextProvider,
            ILogger<LmtArchiveRestoreConfigurationsRepository> logger)
        {
            _database = dbContextProvider.GetDatabase(blocksSecret.DatabaseConnectionString, blocksSecret.RootDatabaseName);
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<LmtArchiveRestoreConfigurations> GetLmtArchiveRestoreConfigurationsAsync(CancellationToken ct = default)
        {
            var collection = _database.GetCollection<LmtArchiveRestoreConfigurations>(LmtArchiveRestoreConfigurations);
            var config = await collection.Find(_ => true).FirstOrDefaultAsync(ct);
            if (config == null)
            {
                _logger.LogWarning("No LMT configuration found in the database.");
                throw new InvalidOperationException("LMT configuration is missing.");
            }
            return config;
        }
    }
}
