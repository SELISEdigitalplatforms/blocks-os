using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Configuration.DomainService.Notification.Entities;
using Configuration.DomainService.Notification.RequestModel;
using Configuration.DomainService.Notification.ResponseModel;
using Configuration.DomainService.Shared.Services;
using Configuration.DomainService.Storage.Entities;
using Configuration.DomainService.Storage.RequestModel;
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
        private readonly Mock<IValidator<SaveNotificationConfigurationRequest>> _notifValidator = new();
        private readonly Mock<IValidator<SaveStorageConfigurationRequest>> _storageValidator = new();
        private readonly Mock<IMessageClient> _messageClient = new();
        private readonly Mock<ILogger<ConfigurationService>> _logger = new();

        private ConfigurationService Service() => new(
            _repo.Object,
            _notifValidator.Object,
            _storageValidator.Object,
            _messageClient.Object,
            _logger.Object);

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
        public async Task GetNotificationConfiguration_DelegatesToRepository()
        {
            var expected = new NotificationConfiguration { ItemId = "n-1" };
            _repo.Setup(r => r.GetNotificationConfigurationByIdAsync("n-1")).ReturnsAsync(expected);

            var result = await Service().GetNotificationConfigurationAsync(new GetNotificationConfigurationRequest { ItemId = "n-1" });

            result.Should().BeSameAs(expected);
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
        public async Task SaveStorageConfiguration_NewConfiguration_PersistsThePhase1UploadSecurityFields()
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
                Name = "az",
                StorageStrategy = "Azure",
                ConnectionString = "conn",
                UploadUrlExpirySeconds = 900,
                DownloadUrlExpirySeconds = 120,
                MaxFileSizeInBytes = 10_485_760,
                UploadCompletionRequiredFor = new List<string> { "Public", "Private" },
            });

            saved!.UploadUrlExpirySeconds.Should().Be(900);
            saved.DownloadUrlExpirySeconds.Should().Be(120);
            saved.MaxFileSizeInBytes.Should().Be(10_485_760);
            saved.UploadCompletionRequiredFor.Should().BeEquivalentTo(new List<string> { "Public", "Private" });
        }

        [Fact]
        public async Task SaveStorageConfiguration_UpdateOmittingTheFields_ClearsThemRatherThanKeepingTheStoredValues()
        {
            using var _ = new BlocksTestContext();
            _storageValidator.Setup(v => v.ValidateAsync(It.IsAny<SaveStorageConfigurationRequest>(), It.IsAny<CancellationToken>()))
                             .ReturnsAsync(Valid());
            var existing = new StorageConfiguration
            {
                ItemId = "existing-id",
                Name = "az",
                UploadUrlExpirySeconds = 900,
                DownloadUrlExpirySeconds = 120,
                MaxFileSizeInBytes = 10_485_760,
                UploadCompletionRequiredFor = new List<string> { "Public" },
            };
            _repo.Setup(r => r.GetStorageConfigurationByIdAsync("existing-id")).ReturnsAsync(existing);
            _repo.Setup(r => r.GetStorageConfigurationByNameAsync(It.IsAny<string>()))
                 .ReturnsAsync((StorageConfiguration?)null);
            StorageConfiguration? saved = null;
            _repo.Setup(r => r.SaveStorageConfigurationAsync(It.IsAny<StorageConfiguration>()))
                 .Callback<StorageConfiguration>(c => saved = c)
                 .Returns(Task.CompletedTask);

            await Service().SaveStorageConfigurationAsync(new SaveStorageConfigurationRequest
            {
                Name = "az",
                StorageStrategy = "Azure",
                ConnectionString = "conn",
                UpdateRequest = true,
                ItemId = "existing-id",
            });

            saved!.UploadUrlExpirySeconds.Should().BeNull();
            saved.DownloadUrlExpirySeconds.Should().BeNull();
            saved.MaxFileSizeInBytes.Should().BeNull();
            saved.UploadCompletionRequiredFor.Should().BeNull();
        }

        [Fact]
        public async Task SaveStorageConfiguration_Update_IgnoresRequestedChangesToProviderIdentityAndCredentials()
        {
            using var _ = new BlocksTestContext();
            _storageValidator.Setup(v => v.ValidateAsync(It.IsAny<SaveStorageConfigurationRequest>(), It.IsAny<CancellationToken>()))
                             .ReturnsAsync(Valid());
            var existing = new StorageConfiguration
            {
                ItemId = "existing-id",
                Name = "original-name",
                StorageStrategy = "Azure",
                ConnectionString = "original-conn",
                AccessKey = "original-access",
                SecretKey = "original-secret",
                CloudStorageRegionEndPoint = "original-region",
                Host = "original-host",
                Port = "original-port",
                UserName = "original-user",
                Password = "original-password",
                RemoteBasePath = "/original",
                SftpSecretKey = "original-sftp-key",
                CreatedBy = "original-author",
            };
            _repo.Setup(r => r.GetStorageConfigurationByIdAsync("existing-id")).ReturnsAsync(existing);
            StorageConfiguration? saved = null;
            _repo.Setup(r => r.SaveStorageConfigurationAsync(It.IsAny<StorageConfiguration>()))
                 .Callback<StorageConfiguration>(c => saved = c)
                 .Returns(Task.CompletedTask);

            // Simulates a request that bypasses the (client-only) disabled fields and tries to rename the
            // configuration, switch providers, and replace every credential.
            await Service().SaveStorageConfigurationAsync(new SaveStorageConfigurationRequest
            {
                Name = "renamed",
                StorageStrategy = "SftpStorage",
                ConnectionString = "attacker-conn",
                AccessKey = "attacker-access",
                SecretKey = "attacker-secret",
                CloudStorageRegionEndPoint = "attacker-region",
                Host = "attacker-host",
                Port = "attacker-port",
                UserName = "attacker-user",
                Password = "attacker-password",
                RemoteBasePath = "/attacker",
                UpdateRequest = true,
                ItemId = "existing-id",
                UploadUrlExpirySeconds = 900,
            });

            saved!.Name.Should().Be("original-name");
            saved.StorageStrategy.Should().Be("Azure");
            saved.ConnectionString.Should().Be("original-conn");
            saved.AccessKey.Should().Be("original-access");
            saved.SecretKey.Should().Be("original-secret");
            saved.CloudStorageRegionEndPoint.Should().Be("original-region");
            saved.Host.Should().Be("original-host");
            saved.Port.Should().Be("original-port");
            saved.UserName.Should().Be("original-user");
            saved.Password.Should().Be("original-password");
            saved.RemoteBasePath.Should().Be("/original");
            saved.SftpSecretKey.Should().Be("original-sftp-key");
            // Changing an expiry setting doesn't make the editor the configuration's author.
            saved.CreatedBy.Should().Be("original-author");
            // The one thing an update is actually allowed to change still goes through.
            saved.UploadUrlExpirySeconds.Should().Be(900);
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

    }
}
