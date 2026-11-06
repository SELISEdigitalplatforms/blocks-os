using DomainService.Entities;
using Blocks.Genesis.Entities.Os;

namespace DomainService.Subscription.Services
{
    public interface ISubscriptionRepository
    {
        public Task<List<ResourceLimit>> GetSubscriptionsAsync();
    }
}
