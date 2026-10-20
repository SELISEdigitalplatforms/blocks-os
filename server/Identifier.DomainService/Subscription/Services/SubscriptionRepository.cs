using Blocks.Genesis;
using DomainService.Entities;
using DomainService.Subscription.Services;
using MongoDB.Driver;
using Blocks.Genesis.Entities.Os;
using Os.DataAccess;

namespace DomainService.Subscription.Services
{
    public class SubscriptionRepository : ISubscriptionRepository
    {
        private readonly IDbContextProvider  _dbContextProvider;

        private readonly IOsDataAccess _dataAccess;

        public SubscriptionRepository(IDbContextProvider dbContextProvider, IOsDataAccess dataAccess)
        {
            _dbContextProvider = dbContextProvider;
            _dataAccess = dataAccess;
        }

        public async Task<List<ResourceLimit>> GetSubscriptionsAsync()
        {
            var collection = _dbContextProvider.GetCollection<ResourceLimit>("ResourceLimits");
            var scope = await _dataAccess.ReadAsync(OsSchemas.ResourceLimit, FilterDefinition<ResourceLimit>.Empty, "SubscriptionRepository.GetSubscriptionsAsync");
            return scope.Granted ? await scope.Apply(collection).ToListAsync() : new List<ResourceLimit>();
        }
    }
}
