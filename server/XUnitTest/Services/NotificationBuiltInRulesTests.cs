using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Blocks.Genesis.Entities.Os;
using Configuration.DomainService.Notification.Propagation;
using Configuration.DomainService.Notification.RequestModel;
using Configuration.DomainService.Shared.Services;
using Configuration.DomainService.Shared.Utilities;
using FluentAssertions;
using FluentValidation;
using FluentValidation.Results;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using XUnitTest.TestSupport;

namespace XUnitTest.Services
{
    /// <summary>Save and delete rules for built-in notification configs (root vs other tenants).</summary>
    public class NotificationBuiltInRulesTests
    {
        private const string RootTenant = "root-tenant";
        private const string OtherTenant = "other-tenant";

        private readonly Mock<IConfigurationRepository> _repo = new();
        private readonly Mock<IValidator<SaveNotificationConfigurationRequest>> _validator = new();
        private readonly Mock<IMessageClient> _messageClient = new();
        private readonly Mock<ITenants> _tenants = new();
        private readonly List<BuiltInNotificationConfigurationChangedEvent> _published = new();
        private NotificationConfiguration? _saved;

        public NotificationBuiltInRulesTests()
        {
            _validator.Setup(v => v.ValidateAsync(It.IsAny<SaveNotificationConfigurationRequest>(), It.IsAny<CancellationToken>()))
                      .ReturnsAsync(new ValidationResult());
            _repo.Setup(r => r.SaveNotificationConfigurationAsync(It.IsAny<NotificationConfiguration>()))
                 .Callback<NotificationConfiguration>(c => _saved = c)
                 .Returns(Task.CompletedTask);
            _repo.Setup(r => r.DeleteNotificationConfigurationAsync(It.IsAny<DeleteNotificationConfigurationRequest>()))
                 .ReturnsAsync(new BaseResponse { IsSuccess = true });
            _messageClient.Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<BuiltInNotificationConfigurationChangedEvent>>()))
                          .Callback<ConsumerMessage<BuiltInNotificationConfigurationChangedEvent>>(m =>
                          {
                              m.ConsumerName.Should().Be(Constants.NotificationConfigurationQueue);
                              _published.Add(m.Payload);
                          })
                          .Returns(Task.CompletedTask);
            _tenants.Setup(t => t.GetTenantByID(RootTenant)).Returns(NewTenant(RootTenant, true));
            _tenants.Setup(t => t.GetTenantByID(OtherTenant)).Returns(NewTenant(OtherTenant, false));
        }

        private ConfigurationService Service() => new(
            _repo.Object,
            _validator.Object,
            _messageClient.Object,
            _tenants.Object,
            Mock.Of<Configuration.DomainService.Notification.Services.INotificationAudienceGrantGuard>(),
            NullLogger<ConfigurationService>.Instance);

        private static Tenant NewTenant(string id, bool isRoot) => new()
        {
            TenantId = id,
            IsRootTenant = isRoot,
            DbConnectionString = "mongodb://localhost/test",
            JwtTokenParameters = new JwtTokenParameters { IssueDate = DateTime.UtcNow, PrivateCertificatePassword = string.Empty }
        };

        private void Stored(NotificationConfiguration config)
        {
            _repo.Setup(r => r.GetNotificationConfigurationByNameAsync(config.Name)).ReturnsAsync(config);
            _repo.Setup(r => r.GetNotificationConfigurationByIdAsync(config.ItemId)).ReturnsAsync(config);
        }

        private static NotificationConfiguration BuiltIn(NotificationKind kind = NotificationKind.Alert) => new()
        {
            ItemId = "b-1",
            Name = "DataImportFailed",
            ChannelToNotify = NotifierTypes.SignalR,
            NotificationType = NotificationReceiverTypes.UserSpecificReceiverType,
            NotifyMethod = "DataImportFailed",
            EnablePersistence = true,
            IsBuiltIn = true,
            Kind = kind,
            Importance = NotificationImportance.High,
            Description = "An import failed.",
            SourceService = "blocks-data",
            CreatedBy = "creator",
            CreatedDate = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
        };

        private static SaveNotificationConfigurationRequest SameAs(NotificationConfiguration c) => new()
        {
            Name = c.Name,
            ChannelToNotify = c.ChannelToNotify,
            NotificationType = c.NotificationType,
            EnablePersistence = c.EnablePersistence,
            NotifyMethod = c.NotifyMethod,
            IsUpdateRequest = true
        };

        // ---------------- create ----------------

        [Fact]
        public async Task Create_BuiltIn_ByRoot_SavesAndPublishesUpsert()
        {
            using var _ = new BlocksTestContext(tenantId: RootTenant);

            var response = await Service().SaveNotificationConfigurationAsync(new SaveNotificationConfigurationRequest
            {
                Name = "New", NotifyMethod = "New", IsBuiltIn = true, Kind = NotificationKind.Job, Importance = NotificationImportance.Low
            });

            response.IsSuccess.Should().BeTrue();
            _saved!.IsBuiltIn.Should().BeTrue();
            _saved.Kind.Should().Be(NotificationKind.Job);
            _published.Should().ContainSingle();
            _published[0].Action.Should().Be(NotificationConfigurationChangeAction.Upsert);
            _published[0].Name.Should().Be("New");
            _published[0].SourceTenantId.Should().Be(RootTenant);
        }

        [Fact]
        public async Task Create_BuiltIn_ByOtherTenant_IsRefused()
        {
            using var _ = new BlocksTestContext(tenantId: OtherTenant);

            var response = await Service().SaveNotificationConfigurationAsync(new SaveNotificationConfigurationRequest
            {
                Name = "New", NotifyMethod = "New", IsBuiltIn = true
            });

            response.IsSuccess.Should().BeFalse();
            response.Errors!.Values.Should().Contain(Constants.OnlyRootTenantCanManageBuiltInNotificationConfiguration);
            _repo.Verify(r => r.SaveNotificationConfigurationAsync(It.IsAny<NotificationConfiguration>()), Times.Never);
            _published.Should().BeEmpty();
        }

        [Fact]
        public async Task Create_BuiltIn_WhenTenantLookupThrows_IsRefused()
        {
            using var _ = new BlocksTestContext(tenantId: "cache-down");
            _tenants.Setup(t => t.GetTenantByID("cache-down")).Throws(new InvalidOperationException("cache"));

            var response = await Service().SaveNotificationConfigurationAsync(new SaveNotificationConfigurationRequest
            {
                Name = "New", NotifyMethod = "New", IsBuiltIn = true
            });

            response.IsSuccess.Should().BeFalse();
            response.Errors!.Values.Should().Contain(Constants.OnlyRootTenantCanManageBuiltInNotificationConfiguration);
        }

        [Fact]
        public async Task Create_Custom_OldClientWithoutNewFields_BehavesAsBefore()
        {
            using var _ = new BlocksTestContext(tenantId: OtherTenant, userId: "u1");
            _repo.Setup(r => r.GetNotificationConfigurationByNameAsync("Mine")).ReturnsAsync((NotificationConfiguration?)null);

            var response = await Service().SaveNotificationConfigurationAsync(new SaveNotificationConfigurationRequest
            {
                Name = "Mine", NotifyMethod = "Mine", EnablePersistence = true
            });

            response.IsSuccess.Should().BeTrue();
            response.Errors.Should().BeNull();
            _saved!.IsBuiltIn.Should().BeFalse();
            _saved.IsDisabled.Should().BeFalse();
            _saved.Description.Should().BeNull();
            _saved.Kind.Should().Be(NotificationKind.None);
            _saved.CreatedBy.Should().Be("u1");
            _published.Should().BeEmpty();
            // A custom save never looks the tenant up.
            _tenants.Verify(t => t.GetTenantByID(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task Create_Custom_ByRoot_IsNotPropagated()
        {
            using var _ = new BlocksTestContext(tenantId: RootTenant);

            var response = await Service().SaveNotificationConfigurationAsync(new SaveNotificationConfigurationRequest
            {
                Name = "RootCustom", NotifyMethod = "RootCustom", Description = "mine", Importance = NotificationImportance.Medium
            });

            response.IsSuccess.Should().BeTrue();
            _saved!.Description.Should().Be("mine");
            _saved.Importance.Should().Be(NotificationImportance.Medium);
            _published.Should().BeEmpty();
        }

        // ---------------- update built-in ----------------

        [Fact]
        public async Task Update_BuiltIn_ByRoot_ChangesAnyFieldAndKeepsIsBuiltInWhenOmitted()
        {
            using var _ = new BlocksTestContext(tenantId: RootTenant);
            var stored = BuiltIn();
            Stored(stored);
            var request = SameAs(stored);
            request.NotifyMethod = "Renamed";
            request.Description = "Changed";
            request.Importance = NotificationImportance.Low;

            var response = await Service().SaveNotificationConfigurationAsync(request);

            response.IsSuccess.Should().BeTrue();
            _saved!.NotifyMethod.Should().Be("Renamed");
            _saved.Description.Should().Be("Changed");
            _saved.Importance.Should().Be(NotificationImportance.Low);
            _saved.IsBuiltIn.Should().BeTrue();
            _saved.CreatedBy.Should().Be("creator");
            _published.Should().ContainSingle(e => e.Action == NotificationConfigurationChangeAction.Upsert);
        }

        [Fact]
        public async Task Update_BuiltIn_ByRoot_UnmarkingBuiltIn_IsSavedAndPublished()
        {
            using var _ = new BlocksTestContext(tenantId: RootTenant);
            var stored = BuiltIn();
            Stored(stored);
            var request = SameAs(stored);
            request.IsBuiltIn = false;

            var response = await Service().SaveNotificationConfigurationAsync(request);

            response.IsSuccess.Should().BeTrue();
            _saved!.IsBuiltIn.Should().BeFalse();
            _published.Should().ContainSingle();
        }

        [Fact]
        public async Task Update_BuiltIn_ByOtherTenant_ToggleIsDisabled_IsSavedAndNotPublished()
        {
            using var _ = new BlocksTestContext(tenantId: OtherTenant);
            var stored = BuiltIn(NotificationKind.Alert);
            Stored(stored);
            var request = SameAs(stored);
            request.IsDisabled = true;
            // The portal re-sends the read-only fields unchanged; equal values are not a change.
            request.Description = stored.Description;
            request.Kind = stored.Kind;
            request.IsBuiltIn = true;

            var response = await Service().SaveNotificationConfigurationAsync(request);

            response.IsSuccess.Should().BeTrue();
            _saved!.IsDisabled.Should().BeTrue();
            _saved.IsBuiltIn.Should().BeTrue();
            _published.Should().BeEmpty();
        }

        [Theory]
        [InlineData("NotifyMethod")]
        [InlineData("ChannelToNotify")]
        [InlineData("NotificationType")]
        [InlineData("Description")]
        [InlineData("Importance")]
        [InlineData("Kind")]
        [InlineData("SourceService")]
        [InlineData("ConsumerAppRecommendation")]
        [InlineData("ConsumerAppNote")]
        [InlineData("IsBuiltIn")]
        public async Task Update_BuiltIn_ByOtherTenant_ChangingReadOnlyField_IsRefused(string field)
        {
            using var _ = new BlocksTestContext(tenantId: OtherTenant);
            var stored = BuiltIn();
            Stored(stored);
            var request = SameAs(stored);
            switch (field)
            {
                case "NotifyMethod": request.NotifyMethod = "Other"; break;
                case "ChannelToNotify": request.ChannelToNotify = NotifierTypes.Firebase; break;
                case "NotificationType": request.NotificationType = NotificationReceiverTypes.BroadcastReceiverType; break;
                case "Description": request.Description = "Other"; break;
                case "Importance": request.Importance = NotificationImportance.Low; break;
                case "Kind": request.Kind = NotificationKind.Security; break;
                case "SourceService": request.SourceService = "blocks-iam"; break;
                case "ConsumerAppRecommendation": request.ConsumerAppRecommendation = "x"; break;
                case "ConsumerAppNote": request.ConsumerAppNote = "x"; break;
                case "IsBuiltIn": request.IsBuiltIn = false; break;
            }

            var response = await Service().SaveNotificationConfigurationAsync(request);

            response.IsSuccess.Should().BeFalse();
            response.Errors!.Values.Should().Contain(Constants.BuiltInNotificationConfigurationIsReadOnly);
            _repo.Verify(r => r.SaveNotificationConfigurationAsync(It.IsAny<NotificationConfiguration>()), Times.Never);
        }

        [Fact]
        public async Task Update_BuiltIn_ByOtherTenant_OldClientWithoutNewFields_IsAccepted()
        {
            using var _ = new BlocksTestContext(tenantId: OtherTenant);
            var stored = BuiltIn();
            stored.IsDisabled = true;
            Stored(stored);

            var response = await Service().SaveNotificationConfigurationAsync(SameAs(stored));

            response.IsSuccess.Should().BeTrue();
            _saved!.IsDisabled.Should().BeTrue("a field that was not sent keeps its stored value");
            _saved.Description.Should().Be(stored.Description);
        }

        [Fact]
        public async Task Update_BuiltIn_EmptyStringEqualsNull_IsNotAChange()
        {
            using var _ = new BlocksTestContext(tenantId: OtherTenant);
            var stored = BuiltIn();
            stored.ConsumerAppNote = null;
            Stored(stored);
            var request = SameAs(stored);
            request.ConsumerAppNote = string.Empty;

            var response = await Service().SaveNotificationConfigurationAsync(request);

            response.IsSuccess.Should().BeTrue();
            _saved!.ConsumerAppNote.Should().BeNull();
        }

        [Theory]
        [InlineData(NotificationKind.Job)]
        [InlineData(NotificationKind.Progress)]
        public async Task Disable_BuiltInJobOrProgress_IsAllowed_WhenTheProjectDoesNotNeedIt(NotificationKind kind)
        {
            // User, 2026-10-28: a project may turn off any event it does not need, a page waiting on it included.
            using var _ = new BlocksTestContext(tenantId: OtherTenant);
            var stored = BuiltIn(kind);
            Stored(stored);
            var request = SameAs(stored);
            request.IsDisabled = true;

            var response = await Service().SaveNotificationConfigurationAsync(request);

            response.IsSuccess.Should().BeTrue();
            _saved!.IsDisabled.Should().BeTrue();
        }

        [Fact]
        public async Task Disable_Custom_JobKind_IsAllowed()
        {
            using var _ = new BlocksTestContext(tenantId: OtherTenant);
            var stored = new NotificationConfiguration { ItemId = "c-1", Name = "Mine", NotifyMethod = "Mine", Kind = NotificationKind.Job };
            Stored(stored);
            var request = SameAs(stored);
            request.IsDisabled = true;

            var response = await Service().SaveNotificationConfigurationAsync(request);

            response.IsSuccess.Should().BeTrue();
            _saved!.IsDisabled.Should().BeTrue();
        }

        [Fact]
        public async Task Update_Custom_ByOtherTenant_RequestingBuiltIn_IsRefused()
        {
            using var _ = new BlocksTestContext(tenantId: OtherTenant);
            var stored = new NotificationConfiguration { ItemId = "c-1", Name = "Mine", NotifyMethod = "Mine" };
            Stored(stored);
            var request = SameAs(stored);
            request.IsBuiltIn = true;

            var response = await Service().SaveNotificationConfigurationAsync(request);

            response.IsSuccess.Should().BeFalse();
            response.Errors!.Values.Should().Contain(Constants.OnlyRootTenantCanManageBuiltInNotificationConfiguration);
        }

        [Fact]
        public async Task Update_Custom_ByOtherTenant_ChangesFieldsAsToday()
        {
            using var _ = new BlocksTestContext(tenantId: OtherTenant);
            var stored = new NotificationConfiguration { ItemId = "c-1", Name = "Mine", NotifyMethod = "Mine", Description = "keep" };
            Stored(stored);
            var request = SameAs(stored);
            request.NotifyMethod = "Changed";
            request.IsBuiltIn = false;

            var response = await Service().SaveNotificationConfigurationAsync(request);

            response.IsSuccess.Should().BeTrue();
            _saved!.NotifyMethod.Should().Be("Changed");
            _saved.Description.Should().Be("keep");
            _saved.IsBuiltIn.Should().BeFalse();
            _published.Should().BeEmpty();
        }

        [Fact]
        public async Task Save_BuiltIn_ByRoot_WhenQueueFails_SavesAndReportsPropagationNotQueued()
        {
            using var _ = new BlocksTestContext(tenantId: RootTenant);
            var stored = BuiltIn();
            Stored(stored);
            _messageClient.Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<BuiltInNotificationConfigurationChangedEvent>>()))
                          .ThrowsAsync(new InvalidOperationException("broker down"));

            var response = await Service().SaveNotificationConfigurationAsync(SameAs(stored));

            response.IsSuccess.Should().BeTrue();
            response.Errors!.Values.Should().Contain(Constants.NotificationConfigurationPropagationNotQueued);
            _repo.Verify(r => r.SaveNotificationConfigurationAsync(It.IsAny<NotificationConfiguration>()), Times.Once);
        }

        // ---------------- delete ----------------

        [Fact]
        public async Task Delete_BuiltIn_ByOtherTenant_IsRefused()
        {
            using var _ = new BlocksTestContext(tenantId: OtherTenant);
            Stored(BuiltIn());

            var response = await Service().DeleteNotificationConfigurationAsync(new DeleteNotificationConfigurationRequest { ItemId = "b-1" });

            response.IsSuccess.Should().BeFalse();
            response.Errors!.Values.Should().Contain(Constants.OnlyRootTenantCanManageBuiltInNotificationConfiguration);
            _repo.Verify(r => r.DeleteNotificationConfigurationAsync(It.IsAny<DeleteNotificationConfigurationRequest>()), Times.Never);
        }

        [Fact]
        public async Task Delete_BuiltIn_ByRoot_DeletesAndPublishesDelete()
        {
            using var _ = new BlocksTestContext(tenantId: RootTenant);
            Stored(BuiltIn());

            var response = await Service().DeleteNotificationConfigurationAsync(new DeleteNotificationConfigurationRequest { ItemId = "b-1" });

            response.IsSuccess.Should().BeTrue();
            _repo.Verify(r => r.DeleteNotificationConfigurationAsync(It.IsAny<DeleteNotificationConfigurationRequest>()), Times.Once);
            _published.Should().ContainSingle(e => e.Action == NotificationConfigurationChangeAction.Delete && e.Name == "DataImportFailed");
        }

        [Fact]
        public async Task Delete_Custom_ByOtherTenant_AsToday()
        {
            using var _ = new BlocksTestContext(tenantId: OtherTenant);
            Stored(new NotificationConfiguration { ItemId = "c-1", Name = "Mine" });

            var response = await Service().DeleteNotificationConfigurationAsync(new DeleteNotificationConfigurationRequest { ItemId = "c-1" });

            response.IsSuccess.Should().BeTrue();
            _repo.Verify(r => r.DeleteNotificationConfigurationAsync(It.IsAny<DeleteNotificationConfigurationRequest>()), Times.Once);
            _published.Should().BeEmpty();
            _tenants.Verify(t => t.GetTenantByID(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task Delete_UnknownItem_DelegatesAsToday()
        {
            using var _ = new BlocksTestContext(tenantId: OtherTenant);

            var response = await Service().DeleteNotificationConfigurationAsync(new DeleteNotificationConfigurationRequest { ItemId = "missing" });

            response.IsSuccess.Should().BeTrue();
            _published.Should().BeEmpty();
        }
    }
}
