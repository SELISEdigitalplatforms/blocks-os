using System.Collections.Generic;
using System.Threading.Tasks;
using DomainService.Entities;
using DomainService.Subscription.RequestModel;
using DomainService.Subscription.Services;
using FluentAssertions;
using Moq;

namespace XUnitTest.Services
{
    public class SubscriptionServiceTests
    {
        [Fact]
        public async Task GetSubscriptionsAsync_ReturnsSubscriptionsFromRepository()
        {
            var repo = new Mock<ISubscriptionRepository>();
            var limits = new List<ResourceLimit> { new(), new() };
            repo.Setup(r => r.GetSubscriptionsAsync()).ReturnsAsync(limits);

            var service = new SubscriptionService(repo.Object);

            var response = await service.GetSubscriptionsAsync(new GetSubscriptionsRequest());

            response.IsSuccess.Should().BeTrue();
            response.Subscriptions.Should().BeSameAs(limits);
        }

        [Fact]
        public async Task GetSubscriptionsAsync_WhenNoneExist_ReturnsEmptySuccess()
        {
            var repo = new Mock<ISubscriptionRepository>();
            repo.Setup(r => r.GetSubscriptionsAsync()).ReturnsAsync(new List<ResourceLimit>());

            var service = new SubscriptionService(repo.Object);

            var response = await service.GetSubscriptionsAsync(new GetSubscriptionsRequest());

            response.IsSuccess.Should().BeTrue();
            response.Subscriptions.Should().BeEmpty();
        }
    }
}
