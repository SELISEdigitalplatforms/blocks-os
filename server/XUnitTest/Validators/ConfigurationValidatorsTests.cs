using System.Threading;
using System.Threading.Tasks;
using Configuration.DomainService.Mail.Entities;
using Configuration.DomainService.Mail.RequestModel;
using Configuration.DomainService.Mail.Validators;
using Configuration.DomainService.Notification.Enums;
using Configuration.DomainService.Notification.RequestModel;
using Configuration.DomainService.Notification.Validators;
using Configuration.DomainService.Shared.Services;
using Configuration.DomainService.Storage.Entities;
using Configuration.DomainService.Storage.RequestModel;
using Configuration.DomainService.Storage.Validators;
using FluentAssertions;
using Moq;

namespace XUnitTest.Validators
{
    public class StorageConfigurationValidatorTests
    {
        private readonly Mock<IConfigurationRepository> _repo = new();

        private StorageConfigurationValidator Validator() => new(_repo.Object);

        [Fact]
        public async Task Validate_Azure_ValidConnectionString_IsValid()
        {
            _repo.Setup(r => r.GetStorageConfigurationByNameAsync(It.IsAny<string>()))
                 .ReturnsAsync((StorageConfiguration?)null);

            var request = new SaveStorageConfigurationRequest
            {
                Name = "az",
                StorageStrategy = "Azure",
                ConnectionString = "DefaultEndpointsProtocol=https;AccountName=acct;AccountKey=abc123==;EndpointSuffix=core.windows.net"
            };

            var result = await Validator().ValidateAsync(request);

            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public async Task Validate_Azure_InvalidConnectionString_Fails()
        {
            _repo.Setup(r => r.GetStorageConfigurationByNameAsync(It.IsAny<string>()))
                 .ReturnsAsync((StorageConfiguration?)null);

            var request = new SaveStorageConfigurationRequest
            {
                Name = "az",
                StorageStrategy = "Azure",
                ConnectionString = "totally-invalid"
            };

            var result = await Validator().ValidateAsync(request);

            result.IsValid.Should().BeFalse();
        }

        [Fact]
        public async Task Validate_EmptyName_Fails()
        {
            _repo.Setup(r => r.GetStorageConfigurationByNameAsync(It.IsAny<string>()))
                 .ReturnsAsync((StorageConfiguration?)null);

            // Provide a valid Azure connection string so only the Name rule fails.
            var request = new SaveStorageConfigurationRequest
            {
                Name = "",
                StorageStrategy = "Azure",
                ConnectionString = "DefaultEndpointsProtocol=https;AccountName=acct;AccountKey=abc123==;EndpointSuffix=core.windows.net"
            };

            var result = await Validator().ValidateAsync(request);

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.PropertyName == nameof(SaveStorageConfigurationRequest.Name));
        }

        [Fact]
        public async Task Validate_UnknownStorageStrategy_Fails()
        {
            _repo.Setup(r => r.GetStorageConfigurationByNameAsync(It.IsAny<string>()))
                 .ReturnsAsync((StorageConfiguration?)null);

            var request = new SaveStorageConfigurationRequest { Name = "x", StorageStrategy = "GoogleCloud" };

            var result = await Validator().ValidateAsync(request);

            result.IsValid.Should().BeFalse();
        }

        [Fact]
        public async Task Validate_Sftp_Valid_IsValid()
        {
            _repo.Setup(r => r.GetStorageConfigurationByNameAsync(It.IsAny<string>()))
                 .ReturnsAsync((StorageConfiguration?)null);

            var request = new SaveStorageConfigurationRequest
            {
                Name = "sftp",
                StorageStrategy = "SftpStorage",
                Host = "sftp.example.com",
                UserName = "user",
                Password = "pass",
                RemoteBasePath = "/data"
            };

            var result = await Validator().ValidateAsync(request);

            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public async Task Validate_Sftp_RelativeRemotePath_Fails()
        {
            _repo.Setup(r => r.GetStorageConfigurationByNameAsync(It.IsAny<string>()))
                 .ReturnsAsync((StorageConfiguration?)null);

            var request = new SaveStorageConfigurationRequest
            {
                Name = "sftp",
                StorageStrategy = "SftpStorage",
                Host = "sftp.example.com",
                UserName = "user",
                Password = "pass",
                RemoteBasePath = "/data/../etc"
            };

            var result = await Validator().ValidateAsync(request);

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.ErrorMessage.Contains("relative segments"));
        }

        [Fact]
        public async Task Validate_Aws_MissingKeys_Fails()
        {
            _repo.Setup(r => r.GetStorageConfigurationByNameAsync(It.IsAny<string>()))
                 .ReturnsAsync((StorageConfiguration?)null);

            var request = new SaveStorageConfigurationRequest { Name = "aws", StorageStrategy = "AWS" };

            var result = await Validator().ValidateAsync(request);

            result.IsValid.Should().BeFalse();
        }

        [Fact]
        public async Task Validate_UpdateRequest_WithoutItemId_Fails()
        {
            // IsNameUpdated reads the existing config by id, so it must resolve to a value.
            _repo.Setup(r => r.GetStorageConfigurationByIdAsync(It.IsAny<string>()))
                 .ReturnsAsync(new StorageConfiguration { Name = "existing-name" });
            _repo.Setup(r => r.GetStorageConfigurationByNameAsync(It.IsAny<string>()))
                 .ReturnsAsync((StorageConfiguration?)null);

            var request = new SaveStorageConfigurationRequest
            {
                Name = "x",
                StorageStrategy = "Azure",
                ConnectionString = "DefaultEndpointsProtocol=https;AccountName=acct;AccountKey=abc123==;EndpointSuffix=core.windows.net",
                UpdateRequest = true,
                ItemId = ""
            };

            var result = await Validator().ValidateAsync(request);

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.PropertyName == nameof(SaveStorageConfigurationRequest.ItemId));
        }
    }

    public class MailConfigurationValidatorTests
    {
        private readonly Mock<IConfigurationRepository> _repo = new();

        private MailConfigurationValidator Validator() => new(_repo.Object);

        private static MailConfiguration ValidOutbound() => new()
        {
            ConfigurationName = "Primary",
            ConfigurationId = "cfg-1",
            Host = "smtp.example.com",
            Port = 587,
            SenderName = "Blocks Team",
            SenderAddress = "noreply@example.com",
            SenderUserName = "smtpuser",
            AccountPassword = "password1",
            IsInbound = false
        };

        [Fact]
        public async Task Validate_HappyPathOutbound_IsValid()
        {
            _repo.Setup(r => r.GetMailConfigurationByNameAsync(It.IsAny<string>()))
                 .ReturnsAsync((MailConfiguration?)null);

            var result = await Validator().ValidateAsync(ValidOutbound());

            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public async Task Validate_DuplicateName_Fails()
        {
            _repo.Setup(r => r.GetMailConfigurationByNameAsync(It.IsAny<string>()))
                 .ReturnsAsync(ValidOutbound());

            var result = await Validator().ValidateAsync(ValidOutbound());

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.ErrorMessage.Contains("unique"));
        }

        [Fact]
        public async Task Validate_InvalidHost_Fails()
        {
            _repo.Setup(r => r.GetMailConfigurationByNameAsync(It.IsAny<string>()))
                 .ReturnsAsync((MailConfiguration?)null);

            var request = ValidOutbound();
            request.Host = "not a host";

            var result = await Validator().ValidateAsync(request);

            result.IsValid.Should().BeFalse();
        }

        [Fact]
        public async Task Validate_OutboundMissingSenderAddress_Fails()
        {
            _repo.Setup(r => r.GetMailConfigurationByNameAsync(It.IsAny<string>()))
                 .ReturnsAsync((MailConfiguration?)null);

            var request = ValidOutbound();
            request.SenderAddress = "";

            var result = await Validator().ValidateAsync(request);

            result.IsValid.Should().BeFalse();
        }

        [Fact]
        public async Task Validate_InboundDoesNotRequireSender_IsValid()
        {
            _repo.Setup(r => r.GetMailConfigurationByNameAsync(It.IsAny<string>()))
                 .ReturnsAsync((MailConfiguration?)null);

            var request = ValidOutbound();
            request.IsInbound = true;
            request.SenderName = null;
            request.SenderAddress = null;

            var result = await Validator().ValidateAsync(request);

            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public async Task Validate_ShortPassword_Fails()
        {
            _repo.Setup(r => r.GetMailConfigurationByNameAsync(It.IsAny<string>()))
                 .ReturnsAsync((MailConfiguration?)null);

            var request = ValidOutbound();
            request.AccountPassword = "123";

            var result = await Validator().ValidateAsync(request);

            result.IsValid.Should().BeFalse();
        }
    }

    public class NotificationConfigurationValidatorTests
    {
        private readonly Mock<IConfigurationRepository> _repo = new();

        private NotificationConfigurationValidator Validator() => new(_repo.Object);

        private static SaveNotificationConfigurationRequest Valid() => new()
        {
            Name = "notif",
            ChannelToNotify = NotifierTypes.SignalR,
            NotificationType = NotificationReceiverTypes.BroadcastReceiverType,
            EnablePersistence = true,
            NotifyMethod = "push",
            IsUpdateRequest = false
        };

        [Fact]
        public async Task Validate_HappyPath_IsValid()
        {
            _repo.Setup(r => r.GetNotificationConfigurationByNameAsync(It.IsAny<string>()))
                 .ReturnsAsync((Configuration.DomainService.Notification.Entities.NotificationConfiguration?)null);

            var result = await Validator().ValidateAsync(Valid());

            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public async Task Validate_EmptyName_Fails()
        {
            var request = Valid();
            request.Name = "";

            var result = await Validator().ValidateAsync(request);

            result.IsValid.Should().BeFalse();
        }

        [Fact]
        public async Task Validate_DuplicateName_OnCreate_Fails()
        {
            _repo.Setup(r => r.GetNotificationConfigurationByNameAsync(It.IsAny<string>()))
                 .ReturnsAsync(new Configuration.DomainService.Notification.Entities.NotificationConfiguration());

            var result = await Validator().ValidateAsync(Valid());

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.ErrorMessage.Contains("unique"));
        }

        [Fact]
        public async Task Validate_UpdateRequest_SkipsUniquenessCheck()
        {
            _repo.Setup(r => r.GetNotificationConfigurationByNameAsync(It.IsAny<string>()))
                 .ReturnsAsync(new Configuration.DomainService.Notification.Entities.NotificationConfiguration());

            var request = Valid();
            request.IsUpdateRequest = true;

            var result = await Validator().ValidateAsync(request);

            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public async Task Validate_EmptyNotifyMethod_Fails()
        {
            _repo.Setup(r => r.GetNotificationConfigurationByNameAsync(It.IsAny<string>()))
                 .ReturnsAsync((Configuration.DomainService.Notification.Entities.NotificationConfiguration?)null);

            var request = Valid();
            request.NotifyMethod = "";

            var result = await Validator().ValidateAsync(request);

            result.IsValid.Should().BeFalse();
        }
    }
}
