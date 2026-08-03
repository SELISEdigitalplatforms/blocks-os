using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DomainService.Entities;
using DomainService.Subscription.Services;
using FluentAssertions;
using Secrets.DomainService.Entities;
using Secrets.DomainService.Services;

namespace XUnitTest.Integration
{
    [Collection(MongoIntegrationCollection.Name)]
    public class SecretRepositoryTests
    {
        private readonly MongoIntegrationFixture _fixture;

        public SecretRepositoryTests(MongoIntegrationFixture fixture)
        {
            _fixture = fixture;
        }

        private SecretRepository NewRepository() => new(_fixture.DbContextProvider);

        private static Secret NewSecret(string itemId, string key)
            => new()
            {
                ItemId = itemId,
                SecretKey = key,
                KeyValuePairs = new Dictionary<string, string> { { "k", "v" } }
            };

        [Fact]
        public async Task SaveGetByIdAndDelete()
        {
            var id = "sec-" + Guid.NewGuid().ToString("N");
            var repo = NewRepository();
            await repo.SaveSecretAsync(NewSecret(id, "key-" + id));

            (await repo.GetSecretByIdAsync(id))!.SecretKey.Should().Be("key-" + id);

            await repo.DeleteSecretAsync(id);
            (await repo.GetSecretByIdAsync(id)).Should().BeNull();
        }

        [Fact]
        public async Task SaveUpsertsExisting()
        {
            var id = "sec-" + Guid.NewGuid().ToString("N");
            var repo = NewRepository();
            await repo.SaveSecretAsync(NewSecret(id, "before"));
            await repo.SaveSecretAsync(NewSecret(id, "after"));

            (await repo.GetSecretByIdAsync(id))!.SecretKey.Should().Be("after");
        }

        [Fact]
        public async Task GetSecretsAsync_FiltersByKeyAndPaginates()
        {
            var key = "grp-" + Guid.NewGuid().ToString("N");
            var repo = NewRepository();
            for (var i = 0; i < 3; i++)
            {
                await repo.SaveSecretAsync(NewSecret("sec-" + key + "-" + i, key));
            }
            await repo.SaveSecretAsync(NewSecret("other-" + key, "different-key"));

            var (page0, total) = await repo.GetSecretsAsync(key, 0, 2);
            var (page1, _) = await repo.GetSecretsAsync(key, 1, 2);

            total.Should().Be(3);
            page0.Should().HaveCount(2);
            page1.Should().HaveCount(1);
            page0.Should().OnlyContain(s => s.SecretKey == key);
        }
    }

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
