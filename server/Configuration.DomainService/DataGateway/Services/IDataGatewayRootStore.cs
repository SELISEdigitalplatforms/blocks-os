using Blocks.Genesis;
using Configuration.DomainService.DataGateway.Entities;
using MongoDB.Bson;
using MongoDB.Driver;
using StackExchange.Redis;

namespace Configuration.DomainService.DataGateway.Services
{
    /// <summary>
    /// Storage of the data-source root doc (<c>BlocksRootDb.DataServiceConfigurations</c>, <c>_id = TenantId</c>) and of the
    /// routing hash blocks-data reads from Redis (key = TenantId).
    /// </summary>
    public interface IDataGatewayRootStore
    {
        /// <summary>The tenant's root doc, or null. Soft-deleted docs only when <paramref name="includeDeleted"/>.</summary>
        Task<DataServiceConfiguration?> GetRootAsync(string tenantId, bool includeDeleted = false);

        /// <summary>Insert only. <c>false</c> when the doc already exists (DuplicateKey).</summary>
        Task<bool> TryInsertRootAsync(DataServiceConfiguration root);

        /// <summary>Field <c>$set</c> on the live root doc, never a whole-doc replace, no upsert. <c>false</c> = no such doc.</summary>
        Task<bool> SetRootFieldsAsync(string tenantId, BsonDocument set);

        /// <summary>RemoveKey (if present), then AddHash: DbConnectionSecretId, DatabaseName, ConnectionType, Version.</summary>
        Task WriteHashAsync(string tenantId, string secretId, string databaseName, bool isCustom, DateTime lastUpdatedUtc);
    }

    public sealed class DataGatewayRootStore : IDataGatewayRootStore
    {
        public const string CollectionName = "DataServiceConfigurations";

        // Names blocks-data reads (GqlDbRepository.HashField* / ConnectionType*).
        public const string HashFieldSecretId = "DbConnectionSecretId";
        public const string HashFieldDatabaseName = "DatabaseName";
        public const string HashFieldConnectionType = "ConnectionType";
        public const string HashFieldVersion = "Version";
        public const string ConnectionTypeDefault = "Default";
        public const string ConnectionTypeCustom = "Custom";

        private readonly IDbContextProvider _dbContextProvider;
        private readonly IBlocksSecret _blocksSecret;
        private readonly ICacheClient _cacheClient;

        public DataGatewayRootStore(IDbContextProvider dbContextProvider, IBlocksSecret blocksSecret, ICacheClient cacheClient)
        {
            _dbContextProvider = dbContextProvider;
            _blocksSecret = blocksSecret;
            _cacheClient = cacheClient;
        }

        /// <summary>The version of a doc: its <c>LastUpdatedDate</c> ticks truncated to ms (Mongo precision).</summary>
        public static long VersionOf(DateTime lastUpdatedUtc) =>
            lastUpdatedUtc.Ticks - lastUpdatedUtc.Ticks % TimeSpan.TicksPerMillisecond;

        private IMongoCollection<DataServiceConfiguration> Collection() =>
            _dbContextProvider
                .GetDatabase(_blocksSecret.DatabaseConnectionString, _blocksSecret.RootDatabaseName)
                .GetCollection<DataServiceConfiguration>(CollectionName);

        public async Task<DataServiceConfiguration?> GetRootAsync(string tenantId, bool includeDeleted = false)
        {
            if (string.IsNullOrWhiteSpace(tenantId))
                return null;

            var builder = Builders<DataServiceConfiguration>.Filter;
            var filter = builder.Eq(x => x.ItemId, tenantId);
            if (!includeDeleted)
                filter &= builder.Eq(x => x.IsDeleted, false);
            return await Collection().Find(filter).FirstOrDefaultAsync();
        }

        public async Task<bool> TryInsertRootAsync(DataServiceConfiguration root)
        {
            try
            {
                await Collection().InsertOneAsync(root);
                return true;
            }
            catch (MongoWriteException ex) when (ex.WriteError?.Category == ServerErrorCategory.DuplicateKey)
            {
                return false;
            }
        }

        public async Task<bool> SetRootFieldsAsync(string tenantId, BsonDocument set)
        {
            var builder = Builders<DataServiceConfiguration>.Filter;
            var result = await Collection().UpdateOneAsync(
                builder.Eq(x => x.ItemId, tenantId) & builder.Eq(x => x.IsDeleted, false),
                new BsonDocumentUpdateDefinition<DataServiceConfiguration>(new BsonDocument("$set", set)),
                new UpdateOptions { IsUpsert = false });
            return result.MatchedCount > 0;
        }

        public async Task WriteHashAsync(string tenantId, string secretId, string databaseName, bool isCustom, DateTime lastUpdatedUtc)
        {
            if (string.IsNullOrWhiteSpace(tenantId))
                return;

            if (await _cacheClient.KeyExistsAsync(tenantId))
                await _cacheClient.RemoveKeyAsync(tenantId);

            await _cacheClient.AddHashValueAsync(tenantId, [
                new HashEntry(HashFieldSecretId, secretId),
                new HashEntry(HashFieldDatabaseName, databaseName),
                new HashEntry(HashFieldConnectionType, isCustom ? ConnectionTypeCustom : ConnectionTypeDefault),
                new HashEntry(HashFieldVersion, VersionOf(lastUpdatedUtc))
            ]);
        }
    }
}
