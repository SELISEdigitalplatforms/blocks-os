using Blocks.Genesis;
using DomainService.Shared;
using DomainService.Shared.Entities;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;

namespace DomainService.ManagedService.Services
{
    public class ServiceManagementRepository : IServiceManagementRepository
    {
        private const string CollectionName = "BlocksManagedServices";

        private readonly IDbContextProvider _dbContextProvider;
        private readonly IBlocksSecret _blocksSecret;
        private readonly ITenants _tenants;
        private readonly ILogger<ServiceManagementRepository> _logger;

        public ServiceManagementRepository(
            IDbContextProvider dbContextProvider,
            IBlocksSecret blocksSecret,
            ITenants tenants,
            ILogger<ServiceManagementRepository> logger)
        {
            _dbContextProvider = dbContextProvider;
            _blocksSecret = blocksSecret;
            _tenants = tenants;
            _logger = logger;
        }

        // Managed services live in the root DB for every caller.
        private IMongoDatabase RootDb()
        {
            return _dbContextProvider.GetDatabase(_blocksSecret.DatabaseConnectionString, _blocksSecret.RootDatabaseName);
        }

        public async Task<(IQueryable<BlocksManagedService>, long)> GetAllServicesAsync(GetAllServiceRequest request)
        {
            var database = RootDb();
            var collection = database.GetCollection<BlocksManagedService>(CollectionName);
            var filter = Builders<BlocksManagedService>.Filter.Eq(s => s.TenantId, BlocksContext.GetContext()?.TenantId ?? string.Empty);

            if (!string.IsNullOrWhiteSpace(request?.Filter?.ServiceName))
            {
                filter &= Builders<BlocksManagedService>.Filter.Eq(s => s.Name, request.Filter?.ServiceName);
            }

            if (!string.IsNullOrWhiteSpace(request?.Filter?.ServiceId))
            {
                filter &= Builders<BlocksManagedService>.Filter.Eq(s => s.ServiceId, request.Filter?.ServiceId);
            }

            var cursor = await collection.Find(filter)
                .Limit(request.PageSize)
                .Skip(request.PageSize * request.Page)
                .ToListAsync();

            var count = await collection.CountDocumentsAsync(filter);

            return (cursor.AsQueryable(), count);
        }

        public async Task SaveAsync(BlocksManagedService service)
        {
            var collection = RootDb().GetCollection<BlocksManagedService>(CollectionName);
            await collection.InsertOneAsync(service);

            await TryCopyToTenantDbAsync(service);
        }

        // Keeps old blocks-logic and old pods correct until the migration `cleanup` drops the tenant copy.
        // Never fails the register: the root write already succeeded and the next `apply` copies anything missing.
        private async Task TryCopyToTenantDbAsync(BlocksManagedService service)
        {
            try
            {
                var context = BlocksContext.GetContext();
                if (context == null || context.Impersonated || string.IsNullOrEmpty(context.TenantId))
                {
                    return;
                }

                // The root tenant's DB is root itself: a second insert would hit the same _id.
                if (_tenants.GetTenantByID(context.TenantId)?.IsRootTenant == true)
                {
                    return;
                }

                var tenantDb = _dbContextProvider.GetDatabase(context.TenantId);
                var exists = tenantDb
                    .ListCollectionNames(new ListCollectionNamesOptions { Filter = new BsonDocument("name", CollectionName) })
                    .Any();
                if (!exists)
                {
                    return;
                }

                await tenantDb.GetCollection<BlocksManagedService>(CollectionName).InsertOneAsync(service);
            }
            catch (MongoWriteException ex) when (ex.WriteError?.Category == ServerErrorCategory.DuplicateKey)
            {
                _logger.LogWarning(ex, "Tenant copy of managed service {ServiceId} already exists; skipped", service.ServiceId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Tenant copy of managed service {ServiceId} failed; the root write succeeded", service.ServiceId);
            }
        }
    }
}
