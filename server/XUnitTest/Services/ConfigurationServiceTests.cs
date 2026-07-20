using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using CloudConfiguration.DomainService.Mail.Entities;
using CloudConfiguration.DomainService.Mail.RequestModel;
using CloudConfiguration.DomainService.Notification.Entities;
using CloudConfiguration.DomainService.Notification.RequestModel;
using CloudConfiguration.DomainService.Notification.ResponseModel;
using CloudConfiguration.DomainService.Shared.Services;
using CloudConfiguration.DomainService.Storage.Entities;
using CloudConfiguration.DomainService.Storage.RequestModel;
using FluentAssertions;
using FluentValidation;
using FluentValidation.Results;
using Microsoft.Extensions.Logging;
using Moq;
using XUnitTest.TestSupport;

namespace XUnitTest.Services
{
    public class ConfigurationServiceTests
    {
        private readonly Mock<IConfigurationRepository> _repo = new();
        private readonly Mock<IValidator<SaveNotificatonConfigurationRequest>> _notifValidator = new();
        private readonly Mock<IValidator<SaveStorageConfigurationRequest>> _storageValidator = new();
        private readonly Mock<IValidator<MailConfiguration>> _mailValidator = new();
        private readonly Mock<IMessageClient> _messageClient = new();
        private readonly Mock<ILogger<ConfigurationService>> _logger = new();

        private ConfigurationService Service() => new(
            _repo.Object,
            _notifValidator.Object,
            _storageValidator.Object,
            _mailValidator.Object,
            _messageClient.Object,
            _logger.Object);

        private static ValidationResult Valid() => new();
        private static ValidationResult Invalid() => new(new[] { new ValidationFailure("Name", "bad") });

        // ---------- Notification ----------

        [Fact]
        public async Task SaveNotificationConfiguration_Invalid_ReturnsErrors()
        {
            _notifValidator.Setup(v => v.ValidateAsync(It.IsAny<SaveNotificatonConfigurationRequest>(), It.IsAny<CancellationToken>()))
                           .ReturnsAsync(Invalid());

            var response = await Service().SaveNotificationConfigurationAsync(new SaveNotificatonConfigurationRequest());

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("Name");
            _repo.Verify(r => r.SaveNotificationConfigurationAsync(It.IsAny<NotificationConfiguration>()), Times.Never);
        }

        [Fact]
        public async Task SaveNotificationConfiguration_Valid_NewConfig_Saves()
        {
            using var _ = new BlocksTestContext(userId: "u1");
            _notifValidator.Setup(v => v.ValidateAsync(It.IsAny<SaveNotificatonConfigurationRequest>(), It.IsAny<CancellationToken>()))
                           .ReturnsAsync(Valid());
            _repo.Setup(r => r.GetNotificationConfigurationByNameAsync(It.IsAny<string>()))
                 .ReturnsAsync((NotificationConfiguration?)null);
            NotificationConfiguration? saved = null;
            _repo.Setup(r => r.SaveNotificationConfigurationAsync(It.IsAny<NotificationConfiguration>()))
                 .Callback<NotificationConfiguration>(c => saved = c)
                 .Returns(Task.CompletedTask);

            var response = await Service().SaveNotificationConfigurationAsync(new SaveNotificatonConfigurationRequest
            {
                Name = "notif",
                NotifyMethod = "push"
            });

            response.IsSuccess.Should().BeTrue();
            saved.Should().NotBeNull();
            saved!.Name.Should().Be("notif");
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
        public async Task GetNotificatoinConfiguration_DelegatesToRepository()
        {
            var expected = new NotificationConfiguration { ItemId = "n-1" };
            _repo.Setup(r => r.GetNotificationConfigurationByIdAsync("n-1")).ReturnsAsync(expected);

            var result = await Service().GetNotificatoinConfigurationAsync(new GetNotificationConfigurationRequest { ItemId = "n-1" });

            result.Should().BeSameAs(expected);
        }

        [Fact]
        public async Task DeleteNotificationConfiguration_DelegatesToRepository()
        {
            var expected = new BaseResponse { IsSuccess = true };
            _repo.Setup(r => r.DeleteNotificationConfigurationAsync(It.IsAny<DeleteNotificatoinConfigurationRequest>()))
                 .ReturnsAsync(expected);

            var response = await Service().DeleteNotificationConfigurationAsync(new DeleteNotificatoinConfigurationRequest());

            response.Should().BeSameAs(expected);
        }

        // ---------- Storage ----------

        [Fact]
        public async Task SaveStorageConfiguration_Invalid_ReturnsErrors()
        {
            _storageValidator.Setup(v => v.ValidateAsync(It.IsAny<SaveStorageConfigurationRequest>(), It.IsAny<CancellationToken>()))
                             .ReturnsAsync(Invalid());

            var response = await Service().SaveStorageConfigurationAsync(new SaveStorageConfigurationRequest());

            response.IsSuccess.Should().BeFalse();
            _messageClient.Verify(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<CreateDefaultFolderEvent>>()), Times.Never);
        }

        [Fact]
        public async Task SaveStorageConfiguration_Valid_SavesAndPublishesEvent()
        {
            using var _ = new BlocksTestContext();
            _storageValidator.Setup(v => v.ValidateAsync(It.IsAny<SaveStorageConfigurationRequest>(), It.IsAny<CancellationToken>()))
                             .ReturnsAsync(Valid());
            _repo.Setup(r => r.GetStorageConfigurationByNameAsync(It.IsAny<string>()))
                 .ReturnsAsync((StorageConfiguration?)null);

            var response = await Service().SaveStorageConfigurationAsync(new SaveStorageConfigurationRequest
            {
                Name = "az",
                StorageStrategy = "Azure",
                ConnectionString = "conn"
            });

            response.IsSuccess.Should().BeTrue();
            response.ItemId.Should().NotBeNullOrEmpty();
            _messageClient.Verify(m => m.SendToConsumerAsync(It.Is<ConsumerMessage<CreateDefaultFolderEvent>>(
                e => e.Payload.ConfigurationName == "az")), Times.Once);
        }

        [Fact]
        public async Task SaveStorageConfiguration_Sftp_GeneratesSecretKey()
        {
            using var _ = new BlocksTestContext();
            _storageValidator.Setup(v => v.ValidateAsync(It.IsAny<SaveStorageConfigurationRequest>(), It.IsAny<CancellationToken>()))
                             .ReturnsAsync(Valid());
            _repo.Setup(r => r.GetStorageConfigurationByNameAsync(It.IsAny<string>()))
                 .ReturnsAsync((StorageConfiguration?)null);
            StorageConfiguration? saved = null;
            _repo.Setup(r => r.SaveStorageConfigurationAsync(It.IsAny<StorageConfiguration>()))
                 .Callback<StorageConfiguration>(c => saved = c)
                 .Returns(Task.CompletedTask);

            await Service().SaveStorageConfigurationAsync(new SaveStorageConfigurationRequest
            {
                Name = "sftp",
                StorageStrategy = "sftpstorage",
                Host = "h",
                UserName = "u",
                Password = "p",
                RemoteBasePath = "/b"
            });

            saved!.SftpSecretKey.Should().NotBeNullOrEmpty();
        }

        [Fact]
        public async Task GetStorageConfigurations_MasksSecrets()
        {
            _repo.Setup(r => r.GetAllStorageConfigurationsByDateAsync()).ReturnsAsync(new List<StorageConfiguration>
            {
                new() { StorageStrategy = "SftpStorage", Password = "secret", SftpSecretKey = "key" },
                new() { StorageStrategy = "Azure", ConnectionString = "endpoint-value" }
            });

            var configs = await Service().GetStorageConfigurationsAsync();

            configs[0].Password.Should().Be("********");
            configs[0].SftpSecretKey.Should().Be("********");
            configs[1].ConnectionString.Should().NotBe("endpoint-value"); // masked
        }

        [Fact]
        public async Task GetStorageConfiguration_Sftp_MasksSecrets()
        {
            _repo.Setup(r => r.GetStorageConfigurationByNameAsync("sftp"))
                 .ReturnsAsync(new StorageConfiguration { StorageStrategy = "SftpStorage", Password = "p", SftpSecretKey = "k" });

            var config = await Service().GetStorageConfigurationAsync("sftp");

            config.Password.Should().Be("********");
        }

        [Fact]
        public async Task DeleteStorageConfiguration_ReturnsSuccess()
        {
            _repo.Setup(r => r.DeleteStorageConfigurationByNameAsync("az")).Returns(Task.CompletedTask);

            var response = await Service().DeleteStorageConfigurationAsync("az");

            response.IsSuccess.Should().BeTrue();
            _repo.Verify(r => r.DeleteStorageConfigurationByNameAsync("az"), Times.Once);
        }

        // ---------- Mail ----------

        [Fact]
        public async Task SaveMailConfiguration_Invalid_ReturnsErrors()
        {
            _mailValidator.Setup(v => v.ValidateAsync(It.IsAny<MailConfiguration>(), It.IsAny<CancellationToken>()))
                          .ReturnsAsync(Invalid());

            var response = await Service().SaveMailConfigurationAsync(new MailConfiguration());

            response.IsSuccess.Should().BeFalse();
            _repo.Verify(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()), Times.Never);
        }

        [Fact]
        public async Task SaveMailConfiguration_Valid_NewConfig_Saves()
        {
            using var _ = new BlocksTestContext();
            _mailValidator.Setup(v => v.ValidateAsync(It.IsAny<MailConfiguration>(), It.IsAny<CancellationToken>()))
                          .ReturnsAsync(Valid());
            _repo.Setup(r => r.GetMailConfigurationByIdAsync(It.IsAny<string>()))
                 .ReturnsAsync((MailServerConfiguration?)null);

            var response = await Service().SaveMailConfigurationAsync(new MailConfiguration
            {
                ConfigurationId = "c-1",
                ConfigurationName = "Primary",
                Host = "smtp.example.com",
                Port = 587
            });

            response.IsSuccess.Should().BeTrue();
            _repo.Verify(r => r.SaveMailConfigurationAsync(It.Is<MailServerConfiguration>(m => m.Name == "Primary")), Times.Once);
        }

        [Fact]
        public async Task GetMailConfiguration_MasksPassword()
        {
            _repo.Setup(r => r.GetMailConfigurationByNameAsync("Primary"))
                 .ReturnsAsync(new MailConfiguration { AccountPassword = "actual" });

            var config = await Service().GetMailConfigurationAsync(new GetMailConfigurationRequest { ConfigurationName = "Primary" });

            config.AccountPassword.Should().Be("********");
        }

        [Fact]
        public async Task GetAllMailConfigurations_MasksAllPasswords()
        {
            _repo.Setup(r => r.GetAllMailConfigurationsAsync()).ReturnsAsync(new List<MailServerConfiguration>
            {
                new() { AccountPassword = "a" },
                new() { AccountPassword = "b" }
            });

            var configs = await Service().GetAllMailConfigurationsAsync();

            configs.Should().OnlyContain(c => c.AccountPassword == "********");
        }

        [Fact]
        public async Task DeleteMailConfiguration_NotFound_ReturnsError()
        {
            _repo.Setup(r => r.GetMailConfigurationByIdAsync("missing")).ReturnsAsync((MailServerConfiguration?)null);

            var response = await Service().DeleteMailConfigurationAsync(new DeleteMailConfigurationRequest { ConfigurationId = "missing" });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("ConfigurationId");
        }

        [Fact]
        public async Task DeleteMailConfiguration_Found_Deletes()
        {
            _repo.Setup(r => r.GetMailConfigurationByIdAsync("c-1")).ReturnsAsync(new MailServerConfiguration());
            _repo.Setup(r => r.DeleteMailConfigurationAsync("c-1")).Returns(Task.CompletedTask);

            var response = await Service().DeleteMailConfigurationAsync(new DeleteMailConfigurationRequest { ConfigurationId = "c-1" });

            response.IsSuccess.Should().BeTrue();
            _repo.Verify(r => r.DeleteMailConfigurationAsync("c-1"), Times.Once);
        }

        [Fact]
        public async Task DuplicateMailConfiguration_NotFound_ReturnsError()
        {
            _repo.Setup(r => r.GetMailConfigurationByIdAsync("missing")).ReturnsAsync((MailServerConfiguration?)null);

            var response = await Service().DuplicateMailConfigurationAsync(new DuplicateMailConfigurationRequest { ConfigurationId = "missing" });

            response.IsSuccess.Should().BeFalse();
        }

        [Fact]
        public async Task DuplicateMailConfiguration_Found_SavesCopy()
        {
            using var _ = new BlocksTestContext();
            _repo.Setup(r => r.GetMailConfigurationByIdAsync("c-1"))
                 .ReturnsAsync(new MailServerConfiguration { Name = "Primary", Host = "h" });
            MailServerConfiguration? saved = null;
            _repo.Setup(r => r.SaveMailConfigurationAsync(It.IsAny<MailServerConfiguration>()))
                 .Callback<MailServerConfiguration>(m => saved = m)
                 .Returns(Task.CompletedTask);

            var response = await Service().DuplicateMailConfigurationAsync(new DuplicateMailConfigurationRequest { ConfigurationId = "c-1" });

            response.IsSuccess.Should().BeTrue();
            saved!.Name.Should().Be("Primary - Copy");
        }
    }
}
