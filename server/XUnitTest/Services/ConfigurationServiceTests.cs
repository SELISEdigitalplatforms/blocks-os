using Configuration.DomainService.Notification.Services;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Configuration.DomainService.Notification.RequestModel;
using Configuration.DomainService.Notification.ResponseModel;
using Configuration.DomainService.Shared.Services;
using FluentAssertions;
using FluentValidation;
using FluentValidation.Results;
using Moq;
using XUnitTest.TestSupport;
using Blocks.Genesis.Entities.Data;
using Blocks.Genesis.Entities.Os;

namespace XUnitTest.Services
{
    public class ConfigurationServiceTests
    {
        private readonly Mock<IConfigurationRepository> _repo = new();
        private readonly Mock<IValidator<SaveNotificationConfigurationRequest>> _notifValidator = new();
        private readonly Mock<IMessageClient> _messageClient = new();
        private readonly Mock<INotificationAudienceGrantGuard> _grantGuard = new();

        private readonly XUnitTest.TestHelpers.InMemoryKeyValueStore _pushKv = new();

        private ConfigurationService Service() => new(
            _repo.Object,
            _notifValidator.Object,
            _messageClient.Object,
            new Mock<ITenants>().Object,
            _grantGuard.Object,
            new Configuration.DomainService.Notification.Push.NotificationPushOptionsService(
                new Configuration.DomainService.Notification.Push.NotificationPushOptionsRepository(_pushKv),
                Microsoft.Extensions.Logging.Abstractions.NullLogger<Configuration.DomainService.Notification.Push.NotificationPushOptionsService>.Instance),
            Microsoft.Extensions.Logging.Abstractions.NullLogger<ConfigurationService>.Instance);

        private static ValidationResult Valid() => new();
        private static ValidationResult Invalid() => new(new[] { new ValidationFailure("Name", "bad") });

        // ---------- Notification ----------

        [Fact]
        public async Task SaveNotificationConfiguration_Invalid_ReturnsErrors()
        {
            _notifValidator.Setup(v => v.ValidateAsync(It.IsAny<SaveNotificationConfigurationRequest>(), It.IsAny<CancellationToken>()))
                           .ReturnsAsync(Invalid());

            var response = await Service().SaveNotificationConfigurationAsync(new SaveNotificationConfigurationRequest());

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("Name");
            _repo.Verify(r => r.SaveNotificationConfigurationAsync(It.IsAny<NotificationConfiguration>()), Times.Never);
        }

        [Fact]
        public async Task SaveNotificationConfiguration_Valid_NewConfig_Saves()
        {
            using var _ = new BlocksTestContext(userId: "u1");
            _notifValidator.Setup(v => v.ValidateAsync(It.IsAny<SaveNotificationConfigurationRequest>(), It.IsAny<CancellationToken>()))
                           .ReturnsAsync(Valid());
            _repo.Setup(r => r.GetNotificationConfigurationByNameAsync(It.IsAny<string>()))
                 .ReturnsAsync((NotificationConfiguration?)null);
            NotificationConfiguration? saved = null;
            _repo.Setup(r => r.SaveNotificationConfigurationAsync(It.IsAny<NotificationConfiguration>()))
                 .Callback<NotificationConfiguration>(c => saved = c)
                 .Returns(Task.CompletedTask);

            var response = await Service().SaveNotificationConfigurationAsync(new SaveNotificationConfigurationRequest
            {
                Name = "notif",
                NotifyMethod = "push"
            });

            response.IsSuccess.Should().BeTrue();
            saved.Should().NotBeNull();
            saved.Name.Should().Be("notif");
            saved.CreatedBy.Should().Be("u1");
        }

        [Fact]
        public async Task GetNotificationConfigurations_DelegatesToRepository()
        {
            var expected = new GetNotificationConfigurationsResponse { TotalCount = 4 };
            _repo.Setup(r => r.GetNotificationConfigurationsAsync(It.IsAny<GetNotificationConfigurationsRequest>()))
                 .ReturnsAsync(expected);

            var response = await Service().GetNotificationConfigurationsAsync(new GetNotificationConfigurationsRequest());

            response.Should().BeSameAs(expected);
        }

        [Fact]
        public async Task GetNotificationConfiguration_KeepsEveryStoredField_AndHasNoPushOptionsWhenNoneAreStored()
        {
            var expected = new NotificationConfiguration { ItemId = "n-1", Name = "n", NotifyMethod = "m", RateLimitPerMinute = 5 };
            _repo.Setup(r => r.GetNotificationConfigurationByIdAsync("n-1")).ReturnsAsync(expected);

            var result = await Service().GetNotificationConfigurationAsync(new GetNotificationConfigurationRequest { ItemId = "n-1" });

            result.Should().BeEquivalentTo(expected);
            result.PushPlatforms.Should().BeNull();
            result.PushOptions.Should().BeNull();
        }

        [Fact]
        public async Task DeleteNotificationConfiguration_DelegatesToRepository()
        {
            var expected = new BaseResponse { IsSuccess = true };
            _repo.Setup(r => r.DeleteNotificationConfigurationAsync(It.IsAny<DeleteNotificationConfigurationRequest>()))
                 .ReturnsAsync(expected);

            var response = await Service().DeleteNotificationConfigurationAsync(new DeleteNotificationConfigurationRequest());

            response.Should().BeSameAs(expected);
        }

    }
}
