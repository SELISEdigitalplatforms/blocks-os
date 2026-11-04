using System;
using System.Threading;
using System.Threading.Tasks;
using Configuration.DomainService.Shared.Services;
using Configuration.DomainService.Webhooks;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace XUnitTest.Webhooks
{
    public class WebhookHistoryServiceTests
    {
        private readonly Mock<IWebhookDeliveryRepository> _deliveries = new();
        private readonly Mock<IWebhookRepository> _webhooks = new();
        private readonly Mock<IWebhookJobQueue> _jobs = new();
        private readonly WebhookDelivery _row = new() { ItemId = "d1", WebhookId = "w1", Status = WebhookDeliveryStatus.Failed };

        public WebhookHistoryServiceTests()
        {
            _deliveries.Setup(d => d.GetAsync("d1", It.IsAny<CancellationToken>())).ReturnsAsync(_row);
            _deliveries.Setup(d => d.TryStartResendAsync("d1", It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new WebhookDelivery { ItemId = "d1", Status = WebhookDeliveryStatus.Failed });
            _webhooks.Setup(w => w.GetAsync("w1", It.IsAny<CancellationToken>())).ReturnsAsync(new WebhookEntry { Id = "w1", IsActive = true });
        }

        private WebhookHistoryService Service() =>
            new(_deliveries.Object, _webhooks.Object, _jobs.Object, new FixedTimeProvider(), NullLogger<WebhookHistoryService>.Instance);

        [Fact]
        public async Task Resend_OfAFailedRow_QueuesTheFirstAttemptOfANewRun()
        {
            var outcome = await Service().ResendAsync("d1", CancellationToken.None);

            outcome.IsOk.Should().BeTrue();
            _jobs.Verify(j => j.EnqueueDeliveryAsync("d1", 1, null), Times.Once);
        }

        [Fact]
        public async Task Resend_WhileInFlight_IsAConflict()
        {
            _deliveries.Setup(d => d.TryStartResendAsync("d1", It.IsAny<DateTime>(), It.IsAny<CancellationToken>())).ReturnsAsync((WebhookDelivery?)null);

            var outcome = await Service().ResendAsync("d1", CancellationToken.None);

            outcome.Status.Should().Be(OutcomeStatus.Conflict);
            outcome.ErrorCode.Should().Be(WebhookErrorCodes.DeliveryInFlight);
            _jobs.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Resend_ForADeletedOrInactiveWebhook_IsRefused()
        {
            _webhooks.Setup(w => w.GetAsync("w1", It.IsAny<CancellationToken>())).ReturnsAsync((WebhookEntry?)null);
            (await Service().ResendAsync("d1", CancellationToken.None)).ErrorCode.Should().Be(WebhookErrorCodes.WebhookDeleted);

            _webhooks.Setup(w => w.GetAsync("w1", It.IsAny<CancellationToken>())).ReturnsAsync(new WebhookEntry { Id = "w1", IsActive = false });
            (await Service().ResendAsync("d1", CancellationToken.None)).ErrorCode.Should().Be(WebhookErrorCodes.WebhookInactive);

            _jobs.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Resend_OfASkippedRow_IsRefused()
        {
            _row.Status = WebhookDeliveryStatus.Skipped;

            var outcome = await Service().ResendAsync("d1", CancellationToken.None);

            outcome.ErrorCode.Should().Be(WebhookErrorCodes.DeliveryNotResendable);
        }

        [Fact]
        public async Task Resend_NotQueued_PutsTheOldStatusBack()
        {
            _jobs.Setup(j => j.EnqueueDeliveryAsync("d1", 1, null)).ThrowsAsync(new InvalidOperationException("bus down"));

            var act = () => Service().ResendAsync("d1", CancellationToken.None);

            await act.Should().ThrowAsync<InvalidOperationException>();
            _deliveries.Verify(d => d.RestoreStatusAsync("d1", WebhookDeliveryStatus.Failed, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Deliveries_NeedAWebhookId_AndClampThePageSize()
        {
            (await Service().GetDeliveriesAsync(new WebhookDeliveriesQuery(), CancellationToken.None)).ErrorCode
                .Should().Be(WebhookErrorCodes.WebhookIdRequired);

            _deliveries.Setup(d => d.ListAsync(It.IsAny<WebhookDeliveriesQuery>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new WebhookDeliveryPage(0, []));
            await Service().GetDeliveriesAsync(new WebhookDeliveriesQuery { WebhookId = "w1", Page = 0, PageSize = 5000 }, CancellationToken.None);

            _deliveries.Verify(d => d.ListAsync(It.Is<WebhookDeliveriesQuery>(q => q.Page == 1 && q.PageSize == WebhookDeliveryPaging.MaxPageSize), It.IsAny<CancellationToken>()));
        }
    }
}
