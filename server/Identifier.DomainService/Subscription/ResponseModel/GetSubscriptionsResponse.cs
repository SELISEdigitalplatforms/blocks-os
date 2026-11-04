using Blocks.Genesis;
using DomainService.Entities;
using Blocks.Genesis.Entities.Os;

namespace DomainService.Subscription.ResponseModel
{
    public class GetSubscriptionsResponse : BaseResponse
    {
        public List<ResourceLimit> Subscriptions { get; set; } = [];
    }
}
