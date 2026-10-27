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
    /// <summary>Who may change Scope and Audience of a notification config, and how Audience is stored.</summary>
    public class NotificationAudienceRulesTests
    {
        private const string RootTenant = "root-tenant";
        private const string OtherTenant = "other-tenant";

        private readonly Mock<IConfigurationRepository> _repo = new();
        private readonly Mock<IValidator<SaveNotificationConfigurationRequest>> _validator = new();
        private readonly Mock<IMessageClient> _messageClient = new();
        private readonly Mock<ITenants> _tenants = new();
        private NotificationConfiguration? _saved;

        public NotificationAudienceRulesTests()
        {
            _validator.Setup(v => v.ValidateAsync(It.IsAny<SaveNotificationConfigurationRequest>(), It.IsAny<CancellationToken>()))
                      .ReturnsAsync(new ValidationResult());
            _repo.Setup(r => r.SaveNotificationConfigurationAsync(It.IsAny<NotificationConfiguration>()))
                 .Callback<NotificationConfiguration>(c => _saved = c)
                 .Returns(Task.CompletedTask);
            _messageClient.Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<BuiltInNotificationConfigurationChangedEvent>>()))
                          .Returns(Task.CompletedTask);
            _tenants.Setup(t => t.GetTenantByID(RootTenant)).Returns(NewTenant(true));
            _tenants.Setup(t => t.GetTenantByID(OtherTenant)).Returns(NewTenant(false));
        }

        private ConfigurationService Service() => new(
            _repo.Object, _validator.Object, _messageClient.Object, _tenants.Object, NullLogger<ConfigurationService>.Instance);

        private static Tenant NewTenant(bool isRoot) => new()
        {
            IsRootTenant = isRoot,
            DbConnectionString = "mongodb://localhost/test",
            JwtTokenParameters = new JwtTokenParameters { IssueDate = DateTime.UtcNow, PrivateCertificatePassword = string.Empty }
        };

        private static NotificationConfiguration Stored(bool builtIn) => new()
        {
            ItemId = "b-1",
            Name = "DataImportFailed",
            ChannelToNotify = NotifierTypes.SignalR,
            NotificationType = NotificationReceiverTypes.UserSpecificReceiverType,
            NotifyMethod = "DataImportFailed",
            EnablePersistence = true,
            IsBuiltIn = builtIn,
            Kind = NotificationKind.Alert,
            Importance = NotificationImportance.High,
            Description = "An import failed."
        };

        private SaveNotificationConfigurationRequest SameAs(NotificationConfiguration c) => new()
        {
            Name = c.Name,
            ChannelToNotify = c.ChannelToNotify,
            NotificationType = c.NotificationType,
            EnablePersistence = c.EnablePersistence,
            NotifyMethod = c.NotifyMethod,
            IsUpdateRequest = true
        };

        private NotificationConfiguration Setup(NotificationConfiguration config)
        {
            _repo.Setup(r => r.GetNotificationConfigurationByNameAsync(config.Name)).ReturnsAsync(config);
            return config;
        }

        [Fact]
        public async Task NonRoot_OnBuiltIn_CanChangeAudienceAndIsDisabled()
        {
            var config = Setup(Stored(builtIn: true));
            var request = SameAs(config);
            request.IsDisabled = true;
            request.Audience = new NotificationAudience { Roles = new List<string> { "admin" } };
            using var _ = new BlocksTestContext(tenantId: OtherTenant);

            var response = await Service().SaveNotificationConfigurationAsync(request);

            response.IsSuccess.Should().BeTrue();
            _saved!.IsDisabled.Should().BeTrue();
            _saved.Audience!.Roles.Should().Equal("admin");
        }

        [Fact]
        public async Task NonRoot_OnBuiltIn_CannotChangeAnythingElseWithAudience()
        {
            var config = Setup(Stored(builtIn: true));
            var request = SameAs(config);
            request.Description = "changed";
            request.Audience = new NotificationAudience { EveryoneInTenant = true };
            using var _ = new BlocksTestContext(tenantId: OtherTenant);

            var response = await Service().SaveNotificationConfigurationAsync(request);

            response.IsSuccess.Should().BeFalse();
            _repo.Verify(r => r.SaveNotificationConfigurationAsync(It.IsAny<NotificationConfiguration>()), Times.Never);
        }

        [Theory]
        [InlineData(true)]
        [InlineData(false)]
        public async Task NonRoot_CannotChangeScope_OnBuiltInOrCustom(bool builtIn)
        {
            var config = Setup(Stored(builtIn));
            var request = SameAs(config);
            request.Scope = NotificationScope.Console;
            using var _ = new BlocksTestContext(tenantId: OtherTenant);

            var response = await Service().SaveNotificationConfigurationAsync(request);

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey(nameof(SaveNotificationConfigurationRequest.Scope));
            _repo.Verify(r => r.SaveNotificationConfigurationAsync(It.IsAny<NotificationConfiguration>()), Times.Never);
        }

        [Fact]
        public async Task NonRoot_ResendingTheStoredScope_IsNotAChange()
        {
            var stored = Stored(builtIn: true);
            stored.Scope = NotificationScope.Console;
            var request = SameAs(Setup(stored));
            request.Scope = NotificationScope.Console;
            using var _ = new BlocksTestContext(tenantId: OtherTenant);

            (await Service().SaveNotificationConfigurationAsync(request)).IsSuccess.Should().BeTrue();
        }

        [Fact]
        public async Task Root_CanSetScope_AndItIsStored()
        {
            var request = SameAs(Setup(Stored(builtIn: true)));
            request.Scope = NotificationScope.Console;
            using var _ = new BlocksTestContext(tenantId: RootTenant);

            var response = await Service().SaveNotificationConfigurationAsync(request);

            response.IsSuccess.Should().BeTrue();
            _saved!.Scope.Should().Be(NotificationScope.Console);
        }

        [Fact]
        public async Task EmptyAudience_ClearsTheStoredAudience_AndNullKeepsIt()
        {
            var stored = Stored(builtIn: false);
            stored.Audience = new NotificationAudience { EveryoneInTenant = true };
            var config = Setup(stored);
            using var _ = new BlocksTestContext(tenantId: OtherTenant);

            var keep = SameAs(config);
            await Service().SaveNotificationConfigurationAsync(keep);
            _saved!.Audience.Should().NotBeNull();

            var clear = SameAs(config);
            clear.Audience = new NotificationAudience();
            await Service().SaveNotificationConfigurationAsync(clear);
            _saved!.Audience.Should().BeNull();
        }
    }
}
