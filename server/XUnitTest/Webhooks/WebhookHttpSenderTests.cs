using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Configuration.DomainService.Webhooks;
using FluentAssertions;

namespace XUnitTest.Webhooks
{
    public class WebhookHttpSenderTests
    {
        private const string Secret = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
        private const string Body = "{\"id\":\"evt_1\",\"action\":\"x\",\"time\":\"2026-11-04T09:20:00.000Z\",\"organizationId\":null,\"data\":{}}";
        private static readonly WebhookSendRequest Request = new("https://hooks.example.com/in", "evt_1", Body, Secret);

        private readonly FixedTimeProvider _clock = new();

        [Fact]
        public async Task Post_IsSignedTheStandardWebhooksWay_WithExactlyJsonContent()
        {
            var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK));
            using var sender = new WebhookHttpSender(handler, _clock);

            var result = await sender.SendAsync(Request, CancellationToken.None);

            result.HttpStatus.Should().Be(200);
            var sent = handler.Requests.Single();
            sent.Method.Should().Be("POST");
            sent.Content.Should().Be(Body);
            sent.ContentType.Should().Be("application/json");
            var timestamp = _clock.Now.ToUnixTimeSeconds();
            sent.Headers["webhook-id"].Should().Be("evt_1");
            sent.Headers["webhook-timestamp"].Should().Be(timestamp.ToString(System.Globalization.CultureInfo.InvariantCulture));
            sent.Headers["webhook-signature"].Should().Be(WebhookSignature.Sign(Secret, "evt_1", timestamp, Body));
        }

        [Fact]
        public async Task Post_CarriesNoTraceHeaders_EvenInsideAnActiveTrace()
        {
            using var listener = new ActivityListener
            {
                ShouldListenTo = _ => true,
                Sample = (ref ActivityCreationOptions<ActivityContext> _) => ActivitySamplingResult.AllDataAndRecorded
            };
            ActivitySource.AddActivityListener(listener);
            using var source = new ActivitySource("webhook-test");
            using var activity = source.StartActivity("parent");
            activity.Should().NotBeNull();
            activity.AddBaggage("tenant", "t1");

            var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK));
            using var sender = new WebhookHttpSender(handler, _clock);
            await sender.SendAsync(Request, CancellationToken.None);

            handler.Requests.Single().Headers.Keys.Should().NotContain(k =>
                k.Equals("traceparent", StringComparison.OrdinalIgnoreCase) ||
                k.Equals("tracestate", StringComparison.OrdinalIgnoreCase) ||
                k.Equals("baggage", StringComparison.OrdinalIgnoreCase) ||
                k.Equals("Request-Id", StringComparison.OrdinalIgnoreCase));

            // The real handler's propagator writes nothing either.
            using var real = WebhookHttpHandler.Create(new WebhookAddressGuard(new TableDnsResolver()));
            var written = new List<string>();
            real.ActivityHeadersPropagator!.Inject(activity, written, (carrier, name, _) => ((List<string>)carrier!).Add(name));
            written.Should().BeEmpty();
            real.AllowAutoRedirect.Should().BeFalse();
            real.UseProxy.Should().BeFalse();
        }

        [Fact]
        public async Task HugeAnswer_IsReadOnlyUpTo4Kb()
        {
            var stream = new CountingStream(1024 * 1024);
            var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK) { Content = new StreamContent(stream) });
            using var sender = new WebhookHttpSender(handler, _clock);

            var result = await sender.SendAsync(Request, CancellationToken.None);

            result.HttpStatus.Should().Be(200);
            stream.BytesRead.Should().BeLessThanOrEqualTo(WebhookHttpSender.MaxResponseBytes);
        }

        [Fact]
        public async Task SlowReceiver_TimesOut()
        {
            var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK), delay: Timeout.InfiniteTimeSpan);
            using var sender = new WebhookHttpSender(handler, _clock, TimeSpan.FromMilliseconds(50));

            var result = await sender.SendAsync(Request, CancellationToken.None);

            result.Should().BeEquivalentTo(new { HttpStatus = (int?)null, ErrorCode = WebhookAttemptErrors.Timeout });
        }

        [Fact]
        public async Task TooManyRequests_ReportsRetryAfter()
        {
            var handler = new RecordingHandler(_ =>
            {
                var response = new HttpResponseMessage(HttpStatusCode.TooManyRequests);
                response.Headers.RetryAfter = new System.Net.Http.Headers.RetryConditionHeaderValue(TimeSpan.FromSeconds(600));
                return response;
            });
            using var sender = new WebhookHttpSender(handler, _clock);

            var result = await sender.SendAsync(Request, CancellationToken.None);

            result.RetryAfter.Should().Be(TimeSpan.FromMinutes(10));
        }

        [Fact]
        public async Task HttpUrl_IsNeverCalled()
        {
            var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK));
            using var sender = new WebhookHttpSender(handler, _clock);

            var result = await sender.SendAsync(Request with { Url = "http://hooks.example.com/in" }, CancellationToken.None);

            result.ErrorCode.Should().Be(WebhookAttemptErrors.UrlNotAllowed);
            handler.Requests.Should().BeEmpty();
        }

        /// <summary>DNS that turned internal after the save: the real handler refuses before it connects.</summary>
        [Fact]
        public async Task HostNowResolvingToAPrivateAddress_IsRefusedAtConnect()
        {
            var dns = new TableDnsResolver();
            dns.Hosts["hooks.example.com"] = [IPAddress.Parse("10.0.0.7")];
            using var sender = new WebhookHttpSender(WebhookHttpHandler.Create(new WebhookAddressGuard(dns)), _clock);

            var result = await sender.SendAsync(Request, CancellationToken.None);

            result.ErrorCode.Should().Be(WebhookAttemptErrors.UrlNotAllowed);
            WebhookRetryPolicy.Decide(result, 1).Should().Be(WebhookAttemptDecision.Failed);
        }

        private sealed record SentRequest(string Method, string Content, string? ContentType, Dictionary<string, string> Headers);

        private sealed class RecordingHandler(Func<HttpRequestMessage, HttpResponseMessage> answer, TimeSpan? delay = null) : HttpMessageHandler
        {
            public List<SentRequest> Requests { get; } = new();

            protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            {
                var headers = request.Headers.ToDictionary(h => h.Key, h => string.Join(",", h.Value), StringComparer.OrdinalIgnoreCase);
                Requests.Add(new SentRequest(
                    request.Method.Method,
                    await request.Content!.ReadAsStringAsync(cancellationToken),
                    request.Content.Headers.ContentType?.ToString(),
                    headers));
                if (delay is { } wait)
                {
                    await Task.Delay(wait, cancellationToken);
                }

                return answer(request);
            }
        }

        /// <summary>An endless-looking body that counts what the reader took.</summary>
        private sealed class CountingStream(long length) : Stream
        {
            public long BytesRead { get; private set; }

            public override bool CanRead => true;
            public override bool CanSeek => false;
            public override bool CanWrite => false;
            public override long Length => length;
            public override long Position { get => BytesRead; set => throw new NotSupportedException(); }

            public override int Read(byte[] buffer, int offset, int count)
            {
                var read = (int)Math.Min(count, length - BytesRead);
                BytesRead += read;
                return read;
            }

            public override void Flush()
            {
                // Read-only stream: nothing to flush.
            }

            public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
            public override void SetLength(long value) => throw new NotSupportedException();
            public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        }
    }
}
