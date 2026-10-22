using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Os.DataAccess.Notifications;
using XUnitTest.TestSupport;

namespace XUnitTest.Notifications
{
    /// <summary>The one sender every os action uses: headers, body, tenant choice, skips, and that it never throws.</summary>
    public class BuiltInNotificationSenderTests
    {
        private const string Url = "https://notify.test/send";

        private readonly Mock<IHttpService> _http = new();
        private readonly Mock<ICryptoService> _crypto = new();
        private readonly Mock<ITenants> _tenants = new();

        private object? _body;
        private Dictionary<string, string>? _headers;
        private int? _timeoutSeconds;

        public BuiltInNotificationSenderTests()
        {
            _crypto.Setup(c => c.Hash(It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<bool>()))
                   .Returns<string, string?, bool>((value, salt, _) => $"hash({value},{salt})");
            _tenants.Setup(t => t.GetTenantByID(It.IsAny<string>()))
                    .Returns<string>(id => new Tenant { TenantId = id, TenantSalt = $"salt-{id}", DbConnectionString = "x", JwtTokenParameters = new JwtTokenParameters { PrivateCertificatePassword = "p", IssueDate = DateTime.UtcNow } });
        }

        private BuiltInNotificationSender Sender(string? url = Url) => new(
            _http.Object, _crypto.Object, _tenants.Object,
            new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { [BuiltInNotificationSender.UrlConfigKey] = url }).Build(),
            NullLogger<BuiltInNotificationSender>.Instance);

        private void NotifierAnswers(bool isSuccess) =>
            _http.Setup(h => h.Post<BuiltInNotificationSender.NotifierResponse>(
                    It.IsAny<object>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>?>(),
                    It.IsAny<CancellationToken>(), It.IsAny<int?>()))
                 .Callback<object, string, string, Dictionary<string, string>?, CancellationToken, int?>((body, _, _, headers, _, timeout) =>
                 {
                     _body = body;
                     _headers = headers;
                     _timeoutSeconds = timeout;
                 })
                 .ReturnsAsync((new BuiltInNotificationSender.NotifierResponse { isSuccess = isSuccess }, string.Empty));

        private static BuiltInNotification Notification(string? tenantId = "tenant-x", params string?[] userIds) => new()
        {
            ConfigurationName = BuiltInNotificationNames.SecretChanged,
            Event = "secret-rotated",
            Title = "Secret rotated",
            Description = "short text",
            Ids = new Dictionary<string, string?> { ["secretId"] = "s-1", ["missing"] = null },
            UserIds = userIds.Length == 0 ? ["u-1"] : userIds,
            TenantId = tenantId,
            ConnectionId = "conn-1"
        };

        private void VerifyNoCall() =>
            _http.Verify(h => h.Post<BuiltInNotificationSender.NotifierResponse>(
                It.IsAny<object>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>?>(),
                It.IsAny<CancellationToken>(), It.IsAny<int?>()), Times.Never);

        [Fact]
        public async Task Posts_to_the_notifier_with_the_tenant_key_and_its_hashed_secret()
        {
            NotifierAnswers(true);

            var sent = await Sender().SendAsync(Notification());

            sent.Should().BeTrue();
            _headers.Should().Contain("x-blocks-key", "tenant-x");
            _headers.Should().Contain("Secret", "hash(tenant-x,salt-tenant-x)");
            _timeoutSeconds.Should().Be(5);
            _http.Verify(h => h.Post<BuiltInNotificationSender.NotifierResponse>(
                It.IsAny<object>(), Url, "application/json", It.IsAny<Dictionary<string, string>?>(),
                It.IsAny<CancellationToken>(), It.IsAny<int?>()), Times.Once);
        }

        [Fact]
        public async Task The_body_names_the_config_and_carries_a_short_ids_only_payload()
        {
            NotifierAnswers(true);

            await Sender().SendAsync(Notification("tenant-x", "u-1", "u-1", " ", null, "u-2"));

            var body = _body.Should().BeOfType<BuiltInNotificationSender.NotifierRequest>().Subject;
            body.ConfigurationName.Should().Be("os-secret-changed");
            body.UserIds.Should().Equal("u-1", "u-2");
            body.ConnectionId.Should().Be("conn-1");
            body.ContentAvailable.Should().BeTrue();
            body.SaveDenormalizedPayloadAsAnObject.Should().BeFalse();
            body.Roles.Should().BeEmpty();
            body.ResponseKey.Should().Be("os-secret-changed");
            body.ResponseValue.Should().Be("secret-rotated");

            using var payload = JsonDocument.Parse(body.DenormalizedPayload);
            var root = payload.RootElement;
            root.GetProperty("event").GetString().Should().Be("secret-rotated");
            root.GetProperty("title").GetString().Should().Be("Secret rotated");
            root.GetProperty("description").GetString().Should().Be("short text");
            root.GetProperty("secretId").GetString().Should().Be("s-1");
            root.TryGetProperty("occurredAt", out _).Should().BeTrue();
            root.TryGetProperty("missing", out _).Should().BeFalse();
            root.TryGetProperty("isSuccess", out _).Should().BeFalse("it is left out when not set");
        }

        [Fact]
        public void The_payload_carries_isSuccess_when_it_is_set()
        {
            var json = BuiltInNotificationSender.BuildPayload(new BuiltInNotification
            {
                ConfigurationName = "c", Event = "e", Title = "t", IsSuccess = false
            });

            using var payload = JsonDocument.Parse(json);
            payload.RootElement.GetProperty("isSuccess").GetBoolean().Should().BeFalse();
        }

        [Fact]
        public async Task Without_an_explicit_tenant_it_sends_in_the_callers_original_tenant()
        {
            NotifierAnswers(true);
            using var _ = new BlocksTestContext(tenantId: "project-1", originalTenantId: "portal-root");

            await Sender().SendAsync(Notification(tenantId: null));

            _headers.Should().Contain("x-blocks-key", "portal-root");
        }

        [Fact]
        public async Task Without_an_original_tenant_it_falls_back_to_the_context_tenant()
        {
            NotifierAnswers(true);
            BlocksContext.SetContext(BlocksContext.Create("project-1", [], "u", true, "/", "o", DateTime.UtcNow.AddHours(1),
                "", [], "", "", "", "", originalTenantId: ""));
            try
            {
                await Sender().SendAsync(Notification(tenantId: null));
            }
            finally
            {
                BlocksContext.ClearContext();
            }

            _headers.Should().Contain("x-blocks-key", "project-1");
        }

        [Fact]
        public async Task No_tenant_anywhere_skips_the_send()
        {
            NotifierAnswers(true);
            BlocksContext.SetContext(null);

            var sent = await Sender().SendAsync(Notification(tenantId: null));

            sent.Should().BeFalse();
            VerifyNoCall();
        }

        [Fact]
        public async Task No_recipient_skips_the_send()
        {
            NotifierAnswers(true);

            var sent = await Sender().SendAsync(Notification("tenant-x", null, "", "  "));

            sent.Should().BeFalse();
            VerifyNoCall();
        }

        [Fact]
        public async Task A_missing_url_skips_the_send()
        {
            NotifierAnswers(true);

            var sent = await Sender(url: "").SendAsync(Notification());

            sent.Should().BeFalse();
            VerifyNoCall();
        }

        [Fact]
        public async Task An_unknown_tenant_skips_the_send()
        {
            NotifierAnswers(true);
            _tenants.Setup(t => t.GetTenantByID("ghost")).Returns((Tenant?)null);

            var sent = await Sender().SendAsync(Notification("ghost"));

            sent.Should().BeFalse();
            VerifyNoCall();
        }

        [Fact]
        public async Task A_rejected_send_returns_false()
        {
            NotifierAnswers(false);

            (await Sender().SendAsync(Notification())).Should().BeFalse();
        }

        [Fact]
        public async Task A_notifier_exception_is_swallowed()
        {
            _http.Setup(h => h.Post<BuiltInNotificationSender.NotifierResponse>(
                    It.IsAny<object>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>?>(),
                    It.IsAny<CancellationToken>(), It.IsAny<int?>()))
                 .ThrowsAsync(new InvalidOperationException("down"));

            var act = () => Sender().SendAsync(Notification());

            (await act.Should().NotThrowAsync()).Subject.Should().BeFalse();
        }

        [Fact]
        public async Task A_null_notification_is_swallowed()
        {
            var act = () => Sender().SendAsync(null!);

            (await act.Should().NotThrowAsync()).Subject.Should().BeFalse();
        }

        [Fact]
        public async Task A_notifier_that_never_answers_is_abandoned_after_the_timeout()
        {
            _http.Setup(h => h.Post<BuiltInNotificationSender.NotifierResponse>(
                    It.IsAny<object>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>?>(),
                    It.IsAny<CancellationToken>(), It.IsAny<int?>()))
                 .Returns(new TaskCompletionSource<(BuiltInNotificationSender.NotifierResponse, string)>().Task);

            var watch = Stopwatch.StartNew();
            var sent = await Sender().SendAsync(Notification());
            watch.Stop();

            sent.Should().BeFalse();
            watch.Elapsed.Should().BeLessThan(TimeSpan.FromSeconds(10));
            watch.Elapsed.Should().BeGreaterThanOrEqualTo(TimeSpan.FromSeconds(4));
        }

        [Fact]
        public async Task A_cancelled_caller_is_swallowed()
        {
            _http.Setup(h => h.Post<BuiltInNotificationSender.NotifierResponse>(
                    It.IsAny<object>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>?>(),
                    It.IsAny<CancellationToken>(), It.IsAny<int?>()))
                 .Returns<object, string, string, Dictionary<string, string>?, CancellationToken, int?>((_, _, _, _, ct, _) =>
                     Task.FromCanceled<(BuiltInNotificationSender.NotifierResponse, string)>(ct));

            using var cts = new CancellationTokenSource();
            cts.Cancel();

            var act = () => Sender().SendAsync(Notification(), cts.Token);

            (await act.Should().NotThrowAsync()).Subject.Should().BeFalse();
        }

        [Fact]
        public void Every_name_is_an_os_config_from_the_seed()
        {
            var names = typeof(BuiltInNotificationNames).GetFields()
                .Select(f => (string)f.GetRawConstantValue()!)
                .ToList();

            names.Should().HaveCount(10).And.OnlyHaveUniqueItems().And.OnlyContain(n => n.StartsWith("os-"));
        }
    }
}
