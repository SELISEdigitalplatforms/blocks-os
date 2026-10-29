using Blocks.Genesis;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Cloud.LmtService.Repositories.ArchiveAndDelete
{
    public class ArchiveRepository : IArchiveRepository
    {
        private readonly IMongoDatabase _database;
        private readonly ILogger<ArchiveRepository> _logger;
        private readonly ICacheClient _cacheClient;
        private const string TenantIdsCacheKey = "archive:tenant_ids";
        private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(30);

        public ArchiveRepository(
            IBlocksSecret blocksSecret,
            IDbContextProvider dbContextProvider,
            ILogger<ArchiveRepository> logger,
            ICacheClient cacheClient)
        {
            _database = dbContextProvider.GetDatabase(blocksSecret.TraceConnectionString, blocksSecret.TraceDatabaseName);
            _logger = logger;
            _cacheClient = cacheClient;
        }

        public async Task<List<string>> GetDistinctTenantIdsAsync()
        {
            try
            {
                var cachedTenantIds = await _cacheClient.GetStringValueAsync(TenantIdsCacheKey);
                if (!string.IsNullOrEmpty(cachedTenantIds))
                {
                    var tenantIdsList = System.Text.Json.JsonSerializer.Deserialize<List<string>>(cachedTenantIds);
                    if (tenantIdsList != null && tenantIdsList.Count > 0)
                        return tenantIdsList;
                }

                var collectionFilter = new BsonDocument("name", new BsonDocument(
                    "$not", new BsonRegularExpression("^system\\.", "i")));

                using var cursor = await _database.ListCollectionNamesAsync(
                    new ListCollectionNamesOptions { Filter = collectionFilter });
                var tenantIds = await cursor.ToListAsync();

                if (tenantIds.Count > 0)
                {
                    var serialized = System.Text.Json.JsonSerializer.Serialize(tenantIds);
                    await _cacheClient.AddStringValueAsync(TenantIdsCacheKey, serialized, (long)CacheDuration.TotalSeconds);
                }

                return tenantIds;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get distinct tenant IDs");
                return [];
            }
        }
    }
}
