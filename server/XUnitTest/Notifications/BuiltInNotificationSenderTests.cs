using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Blocks.Genesis;
using Blocks.Genesis.Notifications;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Os.DataAccess.Notifications;
using XUnitTest.TestSupport;

namespace XUnitTest.Notifications
{
    /// <summary>The one sender every os action uses: what it publishes, tenant and organization choice, skips, and that it never throws.</summary>
    public class BuiltInNotificationSenderTests
    {
        private readonly Mock<INotificationPublisher> _publisher = new();
        private NotificationRequest? _published;

        public BuiltInNotificationSenderTests()
        {
            _publisher.Setup(p => p.Publish(It.IsAny<NotificationRequest>())).Callback<NotificationRequest>(r => _published = r);
        }

        private BuiltInNotificationSender Sender() => new(_publisher.Object, NullLogger<BuiltInNotificationSender>.Instance);

        private static BuiltInNotification Notification(string? tenantId = "tenant-x", string? organizationId = null, params string?[] userIds) => new()
        {
            ConfigurationName = BuiltInNotificationNames.ProjectAccessChanged,
            Event = "project-access-changed",
            Title = "Access changed",
            Description = "short text",
            Ids = new Dictionary<string, string?> { ["projectGroupId"] = "g-1", ["missing"] = null },
            UserIds = userIds.Length == 0 ? ["u-1"] : userIds,
            TenantId = tenantId,
            OrganizationId = organizationId
        };

        [Fact]
        public async Task Publishes_the_config_name_tenant_and_a_short_ids_only_payload()
        {
            var sent = await Sender().SendAsync(Notification());

            sent.Should().BeTrue();
            _published!.Name.Should().Be("os-project-access-changed");
            _published.TenantId.Should().Be("tenant-x");
            _published.ResponseKey.Should().Be("os-project-access-changed");
            _published.ResponseValue.Should().Be("project-access-changed");

            using var payload = JsonDocument.Parse((string)_published.Payload!);
            var root = payload.RootElement;
            root.GetProperty("event").GetString().Should().Be("project-access-changed");
            root.GetProperty("title").GetString().Should().Be("Access changed");
            root.GetProperty("projectGroupId").GetString().Should().Be("g-1");
            root.TryGetProperty("occurredAt", out _).Should().BeTrue();
            root.TryGetProperty("missing", out _).Should().BeFalse();
            root.TryGetProperty("isSuccess", out _).Should().BeFalse("it is left out when not set");
        }

        [Fact]
        public async Task Blank_and_repeated_recipients_are_dropped()
        {
            await Sender().SendAsync(Notification("tenant-x", null, "u-1", "u-1", " ", null, "u-2"));

            _published!.NamedUserIds.Should().Equal("u-1", "u-2");
        }

        [Fact]
        public async Task A_send_without_recipients_is_still_published_because_the_audience_may_be_everyone_or_a_selection()
        {
            var sent = await Sender().SendAsync(Notification("tenant-x", null, null, ""));

            sent.Should().BeTrue();
            _published!.NamedUserIds.Should().BeEmpty();
        }

        [Fact]
        public async Task Every_send_carries_the_organization_of_the_callers_token()
        {
            using var _ = new BlocksTestContext(tenantId: "project-1");

            await Sender().SendAsync(Notification(tenantId: null));

            _published!.OrganizationId.Should().Be("org-1");
        }

        [Fact]
        public async Task A_console_user_in_a_project_sends_in_the_root_tenant_without_the_projects_organization()
        {
            // The project's organization would filter out every root user, so the send would reach nobody.
            using var _ = new BlocksTestContext(tenantId: "project-1", userId: "root-admin", impersonated: true, originalTenantId: "portal-root");

            await Sender().SendAsync(Notification(tenantId: null, organizationId: null, "root-admin"));

            _published!.TenantId.Should().Be("portal-root");
            _published.OrganizationId.Should().BeNull();
        }

        [Fact]
        public async Task An_explicit_organization_wins_over_the_token()
        {
            using var _ = new BlocksTestContext();

            await Sender().SendAsync(Notification(organizationId: "org-record"));

            _published!.OrganizationId.Should().Be("org-record");
        }

        [Fact]
        public async Task An_impersonating_console_user_is_added_as_a_named_user()
        {
            using var _ = new BlocksTestContext(tenantId: "project-1", userId: "root-admin", impersonated: true, originalTenantId: "portal-root");

            await Sender().SendAsync(Notification(tenantId: "project-1", organizationId: null, "u-1"));

            _published!.NamedUserIds.Should().Equal("u-1", "root-admin");
        }

        [Fact]
        public async Task Without_impersonation_the_caller_is_not_added()
        {
            using var _ = new BlocksTestContext(userId: "someone");

            await Sender().SendAsync(Notification());

            _published!.NamedUserIds.Should().Equal("u-1");
        }

        [Fact]
        public async Task Without_an_explicit_tenant_it_sends_in_the_callers_original_tenant()
        {
            using var _ = new BlocksTestContext(tenantId: "project-1", originalTenantId: "portal-root");

            await Sender().SendAsync(Notification(tenantId: null));

            _published!.TenantId.Should().Be("portal-root");
        }

        [Fact]
        public async Task Without_an_original_tenant_it_falls_back_to_the_context_tenant()
        {
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

            _published!.TenantId.Should().Be("project-1");
        }

        [Fact]
        public async Task No_tenant_anywhere_skips_the_send()
        {
            BlocksContext.SetContext(null);

            var sent = await Sender().SendAsync(Notification(tenantId: null));

            sent.Should().BeFalse();
            _publisher.Verify(p => p.Publish(It.IsAny<NotificationRequest>()), Times.Never);
        }

        [Fact]
        public async Task A_publisher_exception_is_swallowed()
        {
            _publisher.Setup(p => p.Publish(It.IsAny<NotificationRequest>())).Throws(new InvalidOperationException("down"));

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
        public void Every_name_is_an_os_config_from_the_seed_and_none_was_dropped()
        {
            var names = typeof(BuiltInNotificationNames).GetFields()
                .Select(f => (string)f.GetRawConstantValue()!)
                .ToList();

            names.Should().HaveCount(6).And.OnlyHaveUniqueItems().And.OnlyContain(n => n.StartsWith("os-"));
            names.Should().OnlyContain(n => !RetiredNotificationNames.Contains(n));
        }
    }
}
