using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Configuration.DomainService.Webhooks;
using FluentAssertions;
using Moq;
using XUnitTest.TestSupport;

namespace XUnitTest.Webhooks
{
    public class WebhookDeliveryProcessorTests
    {
        private const string SecretValue = "plain-secret-value-that-is-long-enough-123";
        private const string Body = "{\"id\":\"evt_1\",\"action\":\"iam.user.created\",\"data\":{\"userId\":\"u-secret-data\"}}";
        private const string UrlWithToken = "https://hooks.example.com/in?token=abc123";

        private readonly Mock<IWebhookDeliveryRepository> _deliveries = new();
        private readonly Mock<IWebhookRepository> _webhooks = new();
        private readonly Mock<IWebhookJobQueue> _jobs = new();
        private readonly Mock<IWebhookSender> _sender = new();
        private readonly InMemoryWebhookSecretStore _secrets = new();
        private readonly FixedTimeProvider _clock = new();
        private readonly RecordingLogger<WebhookDeliveryProcessor> _processorLog = new();
        private readonly RecordingLogger<WebhookAttemptRunner> _runnerLog = new();
        private readonly WebhookDelivery _row = new()
        {
            ItemId = "d1", EventId = "evt_1", Action = "iam.user.created", WebhookId = "w1",
            Status = WebhookDeliveryStatus.Pending, Body = Body, RunAttempts = 1
        };

        public WebhookDeliveryProcessorTests()
        {
            _secrets.Values["sec-1"] = SecretValue;
            _deliveries.Setup(d => d.TryStartAttemptAsync("d1", It.IsAny<int>(), It.IsAny<CancellationToken>())).ReturnsAsync(_row);
            _webhooks.Setup(w => w.GetAsync("w1", It.IsAny<CancellationToken>())).ReturnsAsync(new WebhookEntry
            {
                Id = "w1", Url = UrlWithToken, SecretRef = "sec-1", IsActive = true, Actions = ["iam.user.created"]
            });
            _webhooks.Setup(w => w.RecordFinalFailureAsync("w1", 20, It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new WebhookFailureCount(1, false));
        }

        private Task RunAsync(int attempt = 1)
        {
            var runner = new WebhookAttemptRunner(_secrets, _sender.Object, new ActivitySource("test"), _runnerLog);
            var processor = new WebhookDeliveryProcessor(_deliveries.Object, _webhooks.Object, runner, _jobs.Object, _clock, _processorLog);
            return processor.ProcessAsync(new WebhookDeliveryJob { DeliveryId = "d1", Attempt = attempt }, CancellationToken.None);
        }

        private void Answer(int? status, string? errorCode = null, TimeSpan? retryAfter = null) =>
            _sender.Setup(s => s.SendAsync(It.IsAny<WebhookSendRequest>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new WebhookSendResult(status, 12, errorCode, retryAfter));

        private void VerifyRecorded(string status, int? httpStatus, string? errorCode, DateTime? nextAttemptAt) =>
            _deliveries.Verify(d => d.RecordAttemptAsync(
                "d1",
                It.Is<WebhookAttempt>(a => a.No == 1 && a.HttpStatus == httpStatus && a.ErrorCode == errorCode && a.DurationMs == 12),
                status,
                nextAttemptAt,
                It.IsAny<CancellationToken>()), Times.Once);

        [Fact]
        public async Task Answer2xx_IsDelivered_AndResetsTheFailureCounter()
        {
            Answer(204);

            await RunAsync();

            VerifyRecorded(WebhookDeliveryStatus.Delivered, 204, null, null);
            _webhooks.Verify(w => w.ResetFailuresAsync("w1", It.IsAny<CancellationToken>()), Times.Once);
            _jobs.VerifyNoOtherCalls();
        }

        [Theory]
        [InlineData(400)]
        [InlineData(404)]
        public async Task Answer4xx_FailsWithoutRetry_AndCountsAFailure(int status)
        {
            Answer(status);

            await RunAsync();

            VerifyRecorded(WebhookDeliveryStatus.Failed, status, WebhookAttemptErrors.HttpError, null);
            _jobs.VerifyNoOtherCalls();
            _webhooks.Verify(w => w.RecordFinalFailureAsync("w1", 20, WebhookDeliveryProcessor.AutoOffReason, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Redirect_IsAFailure_NotFollowed()
        {
            Answer(302);

            await RunAsync();

            VerifyRecorded(WebhookDeliveryStatus.Failed, 302, WebhookAttemptErrors.Redirect, null);
        }

        [Theory]
        [InlineData(500, null)]
        [InlineData(408, null)]
        [InlineData(null, WebhookAttemptErrors.Timeout)]
        [InlineData(null, WebhookAttemptErrors.NetworkError)]
        public async Task ServerErrorTimeoutOrNetwork_RetriesAfterThirtySeconds(int? status, string? error)
        {
            Answer(status, error);

            await RunAsync();

            var next = _clock.Now.AddSeconds(30);
            VerifyRecorded(WebhookDeliveryStatus.Retrying, status, error ?? WebhookAttemptErrors.HttpError, next.UtcDateTime);
            _jobs.Verify(j => j.EnqueueDeliveryAsync("d1", 2, next), Times.Once);
        }

        [Theory]
        [InlineData(2, 90)]
        [InlineData(3, 180)]
        public async Task Retries_WaitLongerEachTime(int runAttempts, int waitSeconds)
        {
            _row.RunAttempts = runAttempts;
            Answer(503);

            await RunAsync(runAttempts);

            _jobs.Verify(j => j.EnqueueDeliveryAsync("d1", runAttempts + 1, _clock.Now.AddSeconds(waitSeconds)), Times.Once);
        }

        [Fact]
        public async Task FourthAttemptFails_EndsTheRowAsFailed()
        {
            _row.RunAttempts = WebhookRetryPolicy.MaxAttempts;
            Answer(503);

            await RunAsync(WebhookRetryPolicy.MaxAttempts);

            _jobs.VerifyNoOtherCalls();
            _deliveries.Verify(d => d.RecordAttemptAsync("d1", It.IsAny<WebhookAttempt>(), WebhookDeliveryStatus.Failed, null, It.IsAny<CancellationToken>()));
        }

        [Fact]
        public async Task TooManyRequests_UsesALongerRetryAfter()
        {
            Answer(429, retryAfter: TimeSpan.FromSeconds(60));

            await RunAsync();

            _jobs.Verify(j => j.EnqueueDeliveryAsync("d1", 2, _clock.Now.AddSeconds(60)), Times.Once);
        }

        [Fact]
        public async Task TooManyRequests_RetryAfterIsCappedAt180Seconds()
        {
            Answer(429, retryAfter: TimeSpan.FromMinutes(10));

            await RunAsync();

            _jobs.Verify(j => j.EnqueueDeliveryAsync("d1", 2, _clock.Now.AddSeconds(180)), Times.Once);
        }

        [Fact]
        public async Task MissingSecret_NeverSends_AndFails()
        {
            _secrets.Values.Clear();

            await RunAsync();

            _sender.VerifyNoOtherCalls();
            _deliveries.Verify(d => d.MarkAsync("d1", WebhookDeliveryStatus.Failed, WebhookDeliveryProcessor.SecretMissingReason, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task DeletedOrInactiveWebhook_IsSkipped_WithoutSending()
        {
            _webhooks.Setup(w => w.GetAsync("w1", It.IsAny<CancellationToken>())).ReturnsAsync((WebhookEntry?)null);

            await RunAsync();

            _sender.VerifyNoOtherCalls();
            _deliveries.Verify(d => d.MarkAsync("d1", WebhookDeliveryStatus.Skipped, WebhookDeliveryProcessor.WebhookDeletedReason, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UnexpectedAttemptError_IsRetried_SoTheRowNeverStaysInFlight()
        {
            _sender.Setup(s => s.SendAsync(It.IsAny<WebhookSendRequest>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new InvalidOperationException("boom"));

            await RunAsync();

            _jobs.Verify(j => j.EnqueueDeliveryAsync("d1", 2, _clock.Now.AddSeconds(30)), Times.Once);
        }

        [Fact]
        public async Task JobForAFinishedRow_DoesNothing()
        {
            _deliveries.Setup(d => d.TryStartAttemptAsync("d1", It.IsAny<int>(), It.IsAny<CancellationToken>())).ReturnsAsync((WebhookDelivery?)null);

            await RunAsync();

            _sender.VerifyNoOtherCalls();
            _webhooks.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task TwentiethFailure_TurnsTheWebhookOff_WithAWarning()
        {
            _webhooks.Setup(w => w.RecordFinalFailureAsync("w1", 20, It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new WebhookFailureCount(20, true));
            Answer(410);

            await RunAsync();

            _processorLog.Entries.Should().Contain(e => e.Level == Microsoft.Extensions.Logging.LogLevel.Warning && e.Message.Contains("turned off"));
        }

        [Fact]
        public async Task Logs_HoldNoBodySecretOrFullUrl()
        {
            Answer(500);

            await RunAsync();

            var logs = _runnerLog.Entries.Select(e => e.Message).Concat(_processorLog.Entries.Select(e => e.Message)).ToList();
            logs.Should().NotBeEmpty();
            logs.Should().OnlyContain(m => !m.Contains("u-secret-data") && !m.Contains(SecretValue) && !m.Contains("token=abc123") && !m.Contains("v1,"));
            _runnerLog.Entries.Should().Contain(e => e.Message.Contains("hooks.example.com"));
        }

        [Fact]
        public async Task SentRequest_CarriesTheStoredBodyAndTheCurrentSecret()
        {
            Answer(200);

            await RunAsync();

            _sender.Verify(s => s.SendAsync(It.Is<WebhookSendRequest>(r => r.Body == Body && r.Secret == SecretValue && r.EventId == "evt_1"), It.IsAny<CancellationToken>()));
        }
    }
}
