using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Blocks.Genesis.Entities.Os;
using Configuration.DomainService.Integration.Services;
using Configuration.DomainService.Notification.Propagation;
using Configuration.DomainService.Notification.RequestModel;
using Configuration.DomainService.Notification.Services;
using Configuration.DomainService.Notification.Validators;
using Configuration.DomainService.Shared.Services;
using Configuration.DomainService.Shared.Utilities;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using XUnitTest.TestSupport;

namespace XUnitTest.Services
{
    /// <summary>
    /// Who may change receivers, channels and the push message of a notification configuration, and what stays locked.
    /// Runs through the real validator and the real save rules; only the repository, tenants and IAM are fakes.
    /// </summary>
    public class NotificationSaveRulesTests
    {
        private const string RootTenant = "root-tenant";
        private const string OtherTenant = "other-tenant";

        private readonly Mock<IConfigurationRepository> _repo = new();
        private readonly Mock<IMessageClient> _messageClient = new();
        private readonly Mock<ITenants> _tenants = new();
        private readonly Mock<IIamClient> _iam = new();
        private readonly List<BuiltInNotificationConfigurationChangedEvent> _published = [];
        private NotificationConfiguration? _saved;

        public NotificationSaveRulesTests()
        {
            _repo.Setup(r => r.SaveNotificationConfigurationAsync(It.IsAny<NotificationConfiguration>()))
                 .Callback<NotificationConfiguration>(c => _saved = c).Returns(Task.CompletedTask);
            _messageClient.Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<BuiltInNotificationConfigurationChangedEvent>>()))
                          .Callback<ConsumerMessage<BuiltInNotificationConfigurationChangedEvent>>(m => _published.Add(m.Payload))
                          .Returns(Task.CompletedTask);
            _tenants.Setup(t => t.GetTenantByID(RootTenant)).Returns(NewTenant(RootTenant, true));
            _tenants.Setup(t => t.GetTenantByID(OtherTenant)).Returns(NewTenant(OtherTenant, false));
        }

        private ConfigurationService Service() => new(
            _repo.Object,
            new NotificationConfigurationValidator(_repo.Object),
            _messageClient.Object,
            _tenants.Object,
            new NotificationAudienceGrantGuard(_iam.Object),
            NullLogger<ConfigurationService>.Instance);

        private static Tenant NewTenant(string id, bool isRoot) => new()
        {
            TenantId = id,
            IsRootTenant = isRoot,
            DbConnectionString = "mongodb://localhost/test",
            JwtTokenParameters = new JwtTokenParameters { IssueDate = DateTime.UtcNow, PrivateCertificatePassword = string.Empty }
        };

        private static NotificationConfiguration BuiltIn(bool locked = false) => new()
        {
            ItemId = "b-1",
            Name = "iam-account-locked",
            NotifyMethod = "iam-account-locked",
            NotificationType = NotificationReceiverTypes.UserSpecificReceiverType,
            EnablePersistence = true,
            IsBuiltIn = true,
            Kind = NotificationKind.Security,
            AudienceLocked = locked,
            LiveEnabled = true,
            PushEnabled = true,
            PushTemplate = new NotificationPushTemplate { TitleKey = "FIXED_T", BodyKey = "FIXED_B" },
            Audience = new NotificationAudience { Level = NotificationAudienceLevel.AllUsers }
        };

        private void Stored(NotificationConfiguration config) =>
            _repo.Setup(r => r.GetNotificationConfigurationByNameAsync(config.Name)).ReturnsAsync(config);

        private static SaveNotificationConfigurationRequest SameAs(NotificationConfiguration c) => new()
        {
            Name = c.Name,
            ChannelToNotify = c.ChannelToNotify,
            NotificationType = c.NotificationType,
            EnablePersistence = c.EnablePersistence,
            NotifyMethod = c.NotifyMethod,
            IsUpdateRequest = true
        };

        private static NotificationAudience Roles(params string[] roles) => new() { Level = NotificationAudienceLevel.Selected, Roles = [.. roles] };

        private void GrantScope(bool isSystemUser, string[]? heldRoles = null, string[]? managedRoles = null, string[]? heldPermissions = null) =>
            _iam.Setup(i => i.GetGrantScopeAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(new IamGrantScope(isSystemUser, heldRoles ?? [], managedRoles ?? [], heldPermissions ?? []));

        private async Task AssertRefusedAsync(SaveNotificationConfigurationRequest request, string key)
        {
            var response = await Service().SaveNotificationConfigurationAsync(request);

            response.IsSuccess.Should().BeFalse();
            response.Errors!.Values.Should().Contain(key);
            _repo.Verify(r => r.SaveNotificationConfigurationAsync(It.IsAny<NotificationConfiguration>()), Times.Never);
        }

        // ---------------- root-only fields ----------------

        [Theory]
        [InlineData(true)]
        [InlineData(false)]
        public async Task Only_the_root_tenant_sets_the_default_audience_or_the_lock(bool setLock)
        {
            using var _ = new BlocksTestContext(tenantId: OtherTenant);
            var stored = BuiltIn();
            Stored(stored);
            var request = SameAs(stored);
            if (setLock) request.AudienceLocked = true;
            else request.DefaultAudience = Roles("admin");

            await AssertRefusedAsync(request, Constants.OnlyRootTenantCanSetDefaultAudience);
        }

        [Fact]
        public async Task Root_sets_the_default_audience_and_the_lock_and_the_change_travels_to_tenants()
        {
            using var _ = new BlocksTestContext(tenantId: RootTenant);
            var stored = BuiltIn();
            Stored(stored);
            var request = SameAs(stored);
            request.DefaultAudience = Roles(" admin ", "admin", "");
            request.AudienceLocked = true;

            var response = await Service().SaveNotificationConfigurationAsync(request);

            response.IsSuccess.Should().BeTrue();
            _saved!.AudienceLocked.Should().BeTrue();
            _saved.DefaultAudience!.Roles.Should().Equal("admin");
            _published.Should().ContainSingle();
        }

        // ---------------- built-in, non-root ----------------

        [Fact]
        public async Task A_tenant_may_tune_scope_audience_channels_inbox_push_message_and_rate_limit_of_a_built_in()
        {
            using var _ = new BlocksTestContext(tenantId: OtherTenant);
            var stored = BuiltIn();
            Stored(stored);
            GrantScope(isSystemUser: true);
            var request = SameAs(stored);
            request.Scope = NotificationScope.Console;
            request.Audience = Roles("support");
            request.LiveEnabled = false;
            request.PushEnabled = true;
            request.EnablePersistence = false;
            request.RateLimitPerMinute = 30;
            request.PushTemplate = new NotificationPushTemplate { TitleKey = "MY_T", BodyKey = "MY_B", Link = " /x " };

            var response = await Service().SaveNotificationConfigurationAsync(request);

            response.IsSuccess.Should().BeTrue();
            _saved!.Scope.Should().Be(NotificationScope.Console);
            _saved.Audience!.Roles.Should().Equal("support");
            _saved.LiveEnabled.Should().BeFalse();
            _saved.PushEnabled.Should().BeTrue();
            _saved.EnablePersistence.Should().BeFalse();
            _saved.RateLimitPerMinute.Should().Be(30);
            _saved.PushTemplate!.Link.Should().Be("/x");
            _published.Should().BeEmpty("a tenant change never reaches other tenants");
        }

        // ---------------- locked (personal) notices ----------------

        [Fact]
        public async Task A_locked_notice_refuses_a_new_audience()
        {
            using var _ = new BlocksTestContext(tenantId: OtherTenant);
            var stored = BuiltIn(locked: true);
            Stored(stored);
            var request = SameAs(stored);
            request.Audience = new NotificationAudience { Level = NotificationAudienceLevel.AffectedOnly };

            await AssertRefusedAsync(request, Constants.NotificationAudienceIsLocked);
        }

        [Fact]
        public async Task A_locked_notice_refuses_a_new_push_message()
        {
            using var _ = new BlocksTestContext(tenantId: OtherTenant);
            var stored = BuiltIn(locked: true);
            Stored(stored);
            var request = SameAs(stored);
            request.PushTemplate = new NotificationPushTemplate { TitleKey = "OTHER_T", BodyKey = "OTHER_B" };

            await AssertRefusedAsync(request, Constants.NotificationAudienceIsLocked);
        }

        [Fact]
        public async Task A_locked_notice_still_allows_on_off_channels_and_rate_limit_and_ignores_fields_it_was_sent_unchanged()
        {
            using var _ = new BlocksTestContext(tenantId: OtherTenant);
            var stored = BuiltIn(locked: true);
            Stored(stored);
            var request = SameAs(stored);
            request.IsDisabled = true;
            request.LiveEnabled = false;
            request.RateLimitPerMinute = 5;
            request.Audience = stored.Audience;
            request.PushTemplate = new NotificationPushTemplate { TitleKey = "FIXED_T", BodyKey = "FIXED_B" };

            var response = await Service().SaveNotificationConfigurationAsync(request);

            response.IsSuccess.Should().BeTrue();
            _saved!.IsDisabled.Should().BeTrue();
            _saved.LiveEnabled.Should().BeFalse();
            _saved.RateLimitPerMinute.Should().Be(5);
            _saved.PushTemplate!.TitleKey.Should().Be("FIXED_T");
        }

        [Fact]
        public async Task A_locked_notice_keeps_audience_and_push_message_when_the_request_leaves_them_out()
        {
            using var _ = new BlocksTestContext(tenantId: OtherTenant);
            var stored = BuiltIn(locked: true);
            Stored(stored);

            var response = await Service().SaveNotificationConfigurationAsync(SameAs(stored));

            response.IsSuccess.Should().BeTrue();
            _saved!.Audience!.Level.Should().Be(NotificationAudienceLevel.AllUsers);
            _saved.PushTemplate!.BodyKey.Should().Be("FIXED_B");
        }

        [Fact]
        public async Task Root_can_unlock_a_notice_and_change_its_audience_in_the_same_save()
        {
            using var _ = new BlocksTestContext(tenantId: RootTenant);
            var stored = BuiltIn(locked: true);
            Stored(stored);
            var request = SameAs(stored);
            request.AudienceLocked = false;
            request.Audience = Roles("admin");

            var response = await Service().SaveNotificationConfigurationAsync(request);

            response.IsSuccess.Should().BeTrue();
            _saved!.AudienceLocked.Should().BeFalse();
            _saved.Audience!.Roles.Should().Equal("admin");
        }

        // ---------------- roles and permissions the editor may pick ----------------

        [Fact]
        public async Task A_non_root_editor_may_not_add_a_role_they_neither_hold_nor_manage()
        {
            using var _ = new BlocksTestContext(tenantId: OtherTenant);
            Stored(new NotificationConfiguration { ItemId = "c-1", Name = "mine", NotifyMethod = "mine" });
            GrantScope(isSystemUser: false, heldRoles: ["editor"], managedRoles: ["reviewer"]);
            var request = new SaveNotificationConfigurationRequest { Name = "mine", NotifyMethod = "mine", IsUpdateRequest = true, Audience = Roles("editor", "owner") };

            await AssertRefusedAsync(request, Constants.NotificationAudienceNotAllowed);
        }

        [Fact]
        public async Task An_editor_may_pick_roles_they_hold_or_manage_and_permissions_they_hold()
        {
            using var _ = new BlocksTestContext(tenantId: OtherTenant);
            Stored(new NotificationConfiguration { ItemId = "c-1", Name = "mine", NotifyMethod = "mine" });
            GrantScope(isSystemUser: false, heldRoles: ["editor"], managedRoles: ["reviewer"], heldPermissions: ["blocks-iam::iam::users"]);
            var audience = Roles("editor", "reviewer");
            audience.Permissions = ["blocks-iam::iam::users"];

            var response = await Service().SaveNotificationConfigurationAsync(
                new SaveNotificationConfigurationRequest { Name = "mine", NotifyMethod = "mine", IsUpdateRequest = true, Audience = audience });

            response.IsSuccess.Should().BeTrue();
        }

        [Fact]
        public async Task An_editor_may_not_add_a_permission_they_do_not_hold()
        {
            using var _ = new BlocksTestContext(tenantId: OtherTenant);
            Stored(new NotificationConfiguration { ItemId = "c-1", Name = "mine", NotifyMethod = "mine" });
            GrantScope(isSystemUser: false, heldPermissions: ["blocks-iam::iam::users"]);
            var audience = new NotificationAudience { Level = NotificationAudienceLevel.Selected, Permissions = ["blocks-os::secret::delete"] };

            await AssertRefusedAsync(
                new SaveNotificationConfigurationRequest { Name = "mine", NotifyMethod = "mine", IsUpdateRequest = true, Audience = audience },
                Constants.NotificationAudienceNotAllowed);
        }

        [Fact]
        public async Task A_role_already_in_the_stored_audience_is_not_checked_again()
        {
            using var _ = new BlocksTestContext(tenantId: OtherTenant);
            Stored(new NotificationConfiguration { ItemId = "c-1", Name = "mine", NotifyMethod = "mine", Audience = Roles("owner") });
            var request = new SaveNotificationConfigurationRequest { Name = "mine", NotifyMethod = "mine", IsUpdateRequest = true, Audience = Roles("owner") };

            var response = await Service().SaveNotificationConfigurationAsync(request);

            response.IsSuccess.Should().BeTrue();
            _iam.Verify(i => i.GetGrantScopeAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task When_IAM_does_not_answer_no_new_role_is_handed_out()
        {
            using var _ = new BlocksTestContext(tenantId: OtherTenant);
            Stored(new NotificationConfiguration { ItemId = "c-1", Name = "mine", NotifyMethod = "mine" });
            _iam.Setup(i => i.GetGrantScopeAsync(It.IsAny<CancellationToken>())).ReturnsAsync((IamGrantScope?)null);

            await AssertRefusedAsync(
                new SaveNotificationConfigurationRequest { Name = "mine", NotifyMethod = "mine", IsUpdateRequest = true, Audience = Roles("editor") },
                Constants.NotificationGrantScopeUnavailable);
        }

        [Fact]
        public async Task The_root_tenant_is_not_limited_to_its_own_roles()
        {
            using var _ = new BlocksTestContext(tenantId: RootTenant);
            Stored(new NotificationConfiguration { ItemId = "c-1", Name = "mine", NotifyMethod = "mine" });

            var response = await Service().SaveNotificationConfigurationAsync(
                new SaveNotificationConfigurationRequest { Name = "mine", NotifyMethod = "mine", IsUpdateRequest = true, Audience = Roles("any-role") });

            response.IsSuccess.Should().BeTrue();
            _iam.Verify(i => i.GetGrantScopeAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        // ---------------- channels and push message across the stored row ----------------

        [Fact]
        public async Task Push_on_needs_both_keys_even_when_the_request_leaves_the_message_out()
        {
            using var _ = new BlocksTestContext(tenantId: OtherTenant);
            Stored(new NotificationConfiguration { ItemId = "c-1", Name = "mine", NotifyMethod = "mine" });
            var request = new SaveNotificationConfigurationRequest { Name = "mine", NotifyMethod = "mine", IsUpdateRequest = true, PushEnabled = true };

            await AssertRefusedAsync(request, Constants.NotificationPushKeysRequired);
        }

        [Fact]
        public async Task Push_on_is_accepted_when_the_stored_row_already_has_both_keys()
        {
            using var _ = new BlocksTestContext(tenantId: OtherTenant);
            var stored = new NotificationConfiguration
            {
                ItemId = "c-1", Name = "mine", NotifyMethod = "mine", PushTemplate = new NotificationPushTemplate { TitleKey = "T", BodyKey = "B" }
            };
            Stored(stored);

            var response = await Service().SaveNotificationConfigurationAsync(
                new SaveNotificationConfigurationRequest { Name = "mine", NotifyMethod = "mine", IsUpdateRequest = true, PushEnabled = true });

            response.IsSuccess.Should().BeTrue();
            _saved!.PushEnabled.Should().BeTrue();
        }

        [Fact]
        public async Task Turning_off_in_app_while_push_is_off_is_refused_because_nothing_would_be_sent()
        {
            using var _ = new BlocksTestContext(tenantId: OtherTenant);
            Stored(new NotificationConfiguration { ItemId = "c-1", Name = "mine", NotifyMethod = "mine" });
            var request = new SaveNotificationConfigurationRequest { Name = "mine", NotifyMethod = "mine", IsUpdateRequest = true, LiveEnabled = false };

            await AssertRefusedAsync(request, Constants.NotificationChannelRequired);
        }

        [Fact]
        public async Task A_row_saved_with_the_old_Firebase_channel_follows_the_new_channel_fields_from_then_on()
        {
            using var _ = new BlocksTestContext(tenantId: OtherTenant);
            var stored = new NotificationConfiguration { ItemId = "c-1", Name = "mine", NotifyMethod = "mine", ChannelToNotify = NotifierTypes.Firebase };
            Stored(stored);
            var request = new SaveNotificationConfigurationRequest
            {
                Name = "mine", NotifyMethod = "mine", IsUpdateRequest = true, ChannelToNotify = NotifierTypes.Firebase, LiveEnabled = true, PushEnabled = false
            };

            var response = await Service().SaveNotificationConfigurationAsync(request);

            response.IsSuccess.Should().BeTrue();
            var channels = _saved!.EffectiveChannels();
            channels.Live.Should().BeTrue();
            channels.Push.Should().BeFalse("the old Firebase value must not keep pushing after the user turned push off");
        }

        [Fact]
        public async Task Two_broken_rules_on_one_field_come_back_as_one_error_not_a_crash()
        {
            using var _ = new BlocksTestContext(tenantId: OtherTenant);
            var request = new SaveNotificationConfigurationRequest
            {
                Name = "mine", NotifyMethod = "mine", IsUpdateRequest = true,
                Audience = new NotificationAudience { Roles = Enumerable.Range(0, 60).Select(_ => new string('r', 300)).ToList() }
            };

            var response = await Service().SaveNotificationConfigurationAsync(request);

            response.IsSuccess.Should().BeFalse();
            response.Errors!.Keys.Should().ContainSingle(k => k.StartsWith("Audience"));
        }
    }
}
