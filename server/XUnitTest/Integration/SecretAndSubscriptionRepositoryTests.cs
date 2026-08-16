using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DomainService.Entities;
using DomainService.Subscription.Services;
using FluentAssertions;

namespace XUnitTest.Integration
{
    // The old SecretRepositoryTests covered the SecretKey + KeyValuePairs store, which stored
    // secret values directly in Mongo and has been removed. Blocks.Secrets carries its own
    // repository tests.

    [Collection(MongoIntegrationCollection.Name)]
    public class SubscriptionRepositoryTests
    {
        private readonly MongoIntegrationFixture _fixture;

        public SubscriptionRepositoryTests(MongoIntegrationFixture fixture)
        {
            _fixture = fixture;
        }

        [Fact]
        public async Task GetSubscriptionsAsync_ReturnsResourceLimits()
        {
            var tag = Guid.NewGuid().ToString("N");
            await _fixture.Collection<ResourceLimit>("ResourceLimits").InsertOneAsync(new ResourceLimit
            {
                ItemId = "rl-" + tag,
                Resource = "storage",
                ResourceType = "gb",
                Limit = 100,
                TenantId = "t-" + tag
            });

            var repo = new SubscriptionRepository(_fixture.DbContextProvider);
            var result = await repo.GetSubscriptionsAsync();

            result.Should().Contain(r => r.ItemId == "rl-" + tag);
        }
    }
}
