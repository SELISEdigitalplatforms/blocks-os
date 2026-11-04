using Configuration.DomainService.Webhooks;
using FluentAssertions;
using Xunit;

namespace XUnitTest.Webhooks
{
    public class WebhookJobWaitTests
    {
        private static readonly DateTimeOffset Now = new(2026, 11, 4, 12, 0, 0, TimeSpan.Zero);

        [Fact]
        public void NoTime_DoesNotWait()
        {
            WebhookJobWait.DelayFor(null, Now).Should().Be(TimeSpan.Zero);
        }

        [Fact]
        public void PastTime_DoesNotWait()
        {
            WebhookJobWait.DelayFor(Now.AddSeconds(-5), Now).Should().Be(TimeSpan.Zero);
        }

        [Fact]
        public void FutureTime_WaitsUntilThen()
        {
            WebhookJobWait.DelayFor(Now.AddSeconds(90), Now).Should().Be(TimeSpan.FromSeconds(90));
        }

        [Fact]
        public void FarFutureTime_IsCappedAtTheLongestRetryWait()
        {
            WebhookJobWait.DelayFor(Now.AddHours(6), Now).Should().Be(WebhookJobWait.MaxWait);
        }

        [Fact]
        public async Task UntilAsync_WithoutTime_CompletesAtOnce()
        {
            var wait = WebhookJobWait.UntilAsync(null, TimeProvider.System, CancellationToken.None);

            wait.IsCompleted.Should().BeTrue();
            await wait;
        }
    }
}
