using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Configuration.DomainService.Actions;
using Configuration.DomainService.Webhooks;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using XUnitTest.TestSupport;

namespace XUnitTest.Webhooks
{
    public sealed class WebhookFanOutServiceTests
    {
        private const string ActionName = "iam.user.created";

        private readonly Mock<IActionsRepository> _actions = new();
        private readonly Mock<IWebhookRepository> _webhooks = new();
        private readonly Mock<IWebhookDeliveryRepository> _deliveries = new();
        private readonly Mock<IWebhookJobQueue> _jobs = new();
        private readonly FixedTimeProvider _clock = new();
        private readonly List<WebhookDelivery> _rows = new();

        public WebhookFanOutServiceTests()
        {
            SetWebhookFlag(true);
            _deliveries.Setup(d => d.InsertAsync(It.IsAny<WebhookDelivery>(), It.IsAny<CancellationToken>()))
                .Callback<WebhookDelivery, CancellationToken>((row, _) => _rows.Add(row))
                .ReturnsAsync(true);
        }

        private WebhookFanOutService Service() => new(
            _actions.Object, _webhooks.Object, _deliveries.Object, _jobs.Object, _clock, NullLogger<WebhookFanOutService>.Instance);

        private async Task FanOutAsTenantAsync(int attempt = 1)
        {
            using var _ = new BlocksTestContext(tenantId: "tenant-1");
            await Service().FanOutAsync(Action(), attempt, CancellationToken.None);
        }

        private static BlocksAction Action() => new()
        {
            Id = "evt_1",
            Action = ActionName,
            Time = new DateTime(2026, 11, 4, 9, 20, 0, DateTimeKind.Utc),
            DataJson = "{\"userId\":\"u1\"}"
        };

        private void SetWebhookFlag(bool on) => _actions.Setup(a => a.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<ActionDefinition> { new() { Name = ActionName, Webhook = on } });

        private void SetWebhooks(params WebhookEntry[] webhooks) =>
            _webhooks.Setup(w => w.GetAllAsync(It.IsAny<CancellationToken>())).ReturnsAsync(webhooks);

        private static WebhookEntry Hook(string id, bool active = true, string action = ActionName) =>
            new() { Id = id, Name = id, IsActive = active, Actions = [action], Url = "https://hooks.example.com/" + id };

        [Fact]
        public async Task WebhookFlagOff_NothingIsCreated()
        {
            SetWebhookFlag(false);
            SetWebhooks(Hook("w1"));

            await FanOutAsTenantAsync();

            _rows.Should().BeEmpty();
            _jobs.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task NoWebhookListsTheAction_NothingIsCreated()
        {
            SetWebhooks(Hook("w1", action: "iam.user.updated"));

            await FanOutAsTenantAsync();

            _rows.Should().BeEmpty();
        }

        [Fact]
        public async Task EveryActiveMatchingWebhook_GetsOneRowAndOneJob_InactiveOnesAreSkipped()
        {
            SetWebhooks(Hook("w1"), Hook("w2"), Hook("w3", active: false));

            await FanOutAsTenantAsync();

            _rows.Select(r => r.WebhookId).Should().Equal("w1", "w2");
            _rows.Should().OnlyContain(r => r.EventId == "evt_1" && r.Status == WebhookDeliveryStatus.Pending);
            _rows[0].Body.Should().NotContain("tenant-1").And.Contain("\"data\":{\"userId\":\"u1\"}");
            foreach (var row in _rows)
            {
                _jobs.Verify(j => j.EnqueueDeliveryAsync(row.ItemId, 1, null), Times.Once);
            }
        }

        [Fact]
        public async Task RedeliveredAction_CreatesNoSecondRow_AndNoSecondJobForAStartedRow()
        {
            SetWebhooks(Hook("w1"));
            _deliveries.Setup(d => d.InsertAsync(It.IsAny<WebhookDelivery>(), It.IsAny<CancellationToken>())).ReturnsAsync(false);
            _deliveries.Setup(d => d.GetByEventAsync("evt_1", "w1", It.IsAny<CancellationToken>()))
                .ReturnsAsync(new WebhookDelivery { ItemId = "d1", Status = WebhookDeliveryStatus.Delivered, RunAttempts = 1 });

            await FanOutAsTenantAsync();

            _jobs.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task KvReadFails_NoRowIsCreated_AndTheFanOutIsRetriedLater()
        {
            _actions.Setup(a => a.GetAllAsync(It.IsAny<CancellationToken>())).ThrowsAsync(new TimeoutException("db"));

            await FanOutAsTenantAsync();

            _rows.Should().BeEmpty();
            _jobs.Verify(j => j.EnqueueFanOutRetryAsync(It.Is<BlocksAction>(a => a.Id == "evt_1"), 2, _clock.Now.AddMinutes(1)), Times.Once);
        }

        [Fact]
        public async Task KvReadFailsOnTheLastAttempt_TheActionIsDropped()
        {
            _webhooks.Setup(w => w.GetAllAsync(It.IsAny<CancellationToken>())).ThrowsAsync(new TimeoutException("db"));

            await FanOutAsTenantAsync(WebhookFanOutService.MaxAttempts);

            _jobs.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task NoTenantInTheMessage_NothingIsRead()
        {
            BlocksContext.ClearContext();

            await Service().FanOutAsync(Action(), 1, CancellationToken.None);

            _actions.VerifyNoOtherCalls();
        }
    }
}
