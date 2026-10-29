using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Configuration.DomainService.Storage.Entities;
using Configuration.DomainService.Storage.Repositories;
using Configuration.DomainService.Storage.RequestModel;
using Configuration.DomainService.Storage.Services;
using DomainService.Configuration;
using FluentAssertions;
using FluentValidation;
using FluentValidation.Results;
using Moq;

namespace XUnitTest.Services
{
    public class StorageConfigurationServiceTests
    {
        private const string ExistingId = "existing-id";

        private readonly Mock<IStorageConfigurationRepository> _repo = new();
        private readonly Mock<IValidator<SaveStorageConfigurationRequest>> _validator = new();
        private readonly Mock<IMessageClient> _messageClient = new();

        public StorageConfigurationServiceTests()
        {
            _validator.Setup(v => v.ValidateAsync(It.IsAny<SaveStorageConfigurationRequest>(), It.IsAny<CancellationToken>()))
                      .ReturnsAsync(new ValidationResult());
        }

        private StorageConfigurationService Service() => new(_repo.Object, _validator.Object, _messageClient.Object);

        private List<(StorageSettings Settings, StorageSecretValues? Secrets)> CaptureSaves()
        {
            var saves = new List<(StorageSettings, StorageSecretValues?)>();
            _repo.Setup(r => r.SaveAsync(It.IsAny<StorageSettings>(), It.IsAny<StorageSecretValues?>()))
                 .Callback<StorageSettings, StorageSecretValues?>((s, v) => saves.Add((s, v)))
                 .ReturnsAsync((StorageSettings s, StorageSecretValues? _) => s);
            return saves;
        }

        [Fact]
        public async Task Save_Invalid_ReturnsErrorsAndWritesNothing()
        {
            _validator.Setup(v => v.ValidateAsync(It.IsAny<SaveStorageConfigurationRequest>(), It.IsAny<CancellationToken>()))
                      .ReturnsAsync(new ValidationResult(new[] { new ValidationFailure("Name", "bad") }));

            var response = await Service().SaveAsync(new SaveStorageConfigurationRequest());

            response.IsSuccess.Should().BeFalse();
            _repo.Verify(r => r.CreateAsync(It.IsAny<StorageSettings>(), It.IsAny<StorageSecretValues>()), Times.Never);
            _messageClient.Verify(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<CreateDefaultFolderEvent>>()), Times.Never);
        }

        [Fact]
        public async Task Create_SendsSecretsToTheStoreNotTheSettings_AndPublishesTheFolderEvent()
        {
            StorageSettings? settings = null;
            StorageSecretValues? secrets = null;
            _repo.Setup(r => r.CreateAsync(It.IsAny<StorageSettings>(), It.IsAny<StorageSecretValues>()))
                 .Callback<StorageSettings, StorageSecretValues>((s, v) => (settings, secrets) = (s, v))
                 .ReturnsAsync((StorageSettings s, StorageSecretValues _) => { s.ItemId = "new-id"; return s; });

            var response = await Service().SaveAsync(new SaveStorageConfigurationRequest
            {
                Name = " az ",
                StorageStrategy = "Azure",
                ConnectionString = "conn",
                UploadUrlExpirySeconds = 900,
                UploadCompletionRequiredFor = new List<string> { "Public" },
            });

            response.IsSuccess.Should().BeTrue();
            response.ItemId.Should().Be("new-id");
            settings!.Name.Should().Be("az");
            settings.UploadUrlExpirySeconds.Should().Be(900);
            settings.UploadCompletionRequiredFor.Should().Equal("Public");
            secrets!.ConnectionString.Should().Be("conn");
            secrets.SftpSecretKey.Should().BeNull();
            _messageClient.Verify(m => m.SendToConsumerAsync(It.Is<ConsumerMessage<CreateDefaultFolderEvent>>(
                e => e.Payload.ConfigurationName == "az" && e.Payload.ItemId == "new-id")), Times.Once);
        }

        [Fact]
        public async Task Create_Sftp_GeneratesAnSftpSecretKey()
        {
            StorageSecretValues? secrets = null;
            _repo.Setup(r => r.CreateAsync(It.IsAny<StorageSettings>(), It.IsAny<StorageSecretValues>()))
                 .Callback<StorageSettings, StorageSecretValues>((_, v) => secrets = v)
                 .ReturnsAsync((StorageSettings s, StorageSecretValues _) => s);

            await Service().SaveAsync(new SaveStorageConfigurationRequest
            {
                Name = "sftp",
                StorageStrategy = "SftpStorage",
                Host = "h",
                UserName = "user",
                Password = "p",
                RemoteBasePath = "/b"
            });

            secrets!.SftpSecretKey.Should().NotBeNullOrEmpty();
            secrets.Password.Should().Be("p");
        }

        [Fact]
        public async Task Create_NameTakenMeanwhile_IsRefusedWithoutAnEvent()
        {
            // Two creates with the same name: the store keeps the first row, the second is refused, never overwritten.
            _repo.Setup(r => r.CreateAsync(It.IsAny<StorageSettings>(), It.IsAny<StorageSecretValues>()))
                 .ReturnsAsync((StorageSettings?)null);

            var response = await Service().SaveAsync(new SaveStorageConfigurationRequest { Name = "az", StorageStrategy = "Azure", ConnectionString = "c" });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey(nameof(SaveStorageConfigurationRequest.Name));
            _messageClient.Verify(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<CreateDefaultFolderEvent>>()), Times.Never);
        }

        [Fact]
        public async Task Update_ChangesOnlyTheMutableSettings_AndNeverTheSecrets()
        {
            var existing = new StorageSettings
            {
                ItemId = ExistingId,
                Name = "original-name",
                StorageStrategy = "Azure",
                Host = "original-host",
                ConnectionStringSecretId = "secret-1",
                UploadUrlExpirySeconds = 900,
                DownloadUrlExpirySeconds = 120,
            };
            _repo.Setup(r => r.GetByItemIdAsync(ExistingId)).ReturnsAsync(new StoredStorageConfiguration(existing, null));
            var saves = CaptureSaves();

            // Bypasses the client and tries to rename, switch provider and replace a credential.
            var response = await Service().SaveAsync(new SaveStorageConfigurationRequest
            {
                UpdateRequest = true,
                ItemId = ExistingId,
                Name = "renamed",
                StorageStrategy = "SftpStorage",
                Host = "attacker-host",
                ConnectionString = "attacker-conn",
                UploadUrlExpirySeconds = 300,
            });

            response.IsSuccess.Should().BeTrue();
            var (saved, secrets) = saves.Should().ContainSingle().Subject;
            secrets.Should().BeNull();
            saved.Name.Should().Be("original-name");
            saved.StorageStrategy.Should().Be("Azure");
            saved.Host.Should().Be("original-host");
            saved.UploadUrlExpirySeconds.Should().Be(300);
            // Omitted settings are cleared (blocks-data then uses its defaults), not kept.
            saved.DownloadUrlExpirySeconds.Should().BeNull();
        }

        [Fact]
        public async Task Update_OldDocumentNotMigrated_IsWrittenWithItsOwnSecrets()
        {
            // Else the new row would hide the old document and its credentials would be lost.
            var legacySecrets = new StorageSecretValues { ConnectionString = "old-conn" };
            _repo.Setup(r => r.GetByItemIdAsync(ExistingId))
                 .ReturnsAsync(new StoredStorageConfiguration(new StorageSettings { ItemId = ExistingId, Name = "az" }, legacySecrets));
            var saves = CaptureSaves();

            await Service().SaveAsync(new SaveStorageConfigurationRequest { UpdateRequest = true, ItemId = ExistingId, MaxFileSizeInBytes = 1024 });

            saves.Should().ContainSingle().Which.Secrets.Should().BeSameAs(legacySecrets);
        }

        [Fact]
        public async Task Update_UnknownItemId_IsRefusedAndCreatesNothing()
        {
            var response = await Service().SaveAsync(new SaveStorageConfigurationRequest { UpdateRequest = true, ItemId = "missing" });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey(nameof(SaveStorageConfigurationRequest.ItemId));
            _repo.Verify(r => r.SaveAsync(It.IsAny<StorageSettings>(), It.IsAny<StorageSecretValues?>()), Times.Never);
            _repo.Verify(r => r.CreateAsync(It.IsAny<StorageSettings>(), It.IsAny<StorageSecretValues>()), Times.Never);
        }

        [Fact]
        public async Task GetAll_ReturnsEachSecretStatusFromTheRepository()
        {
            var stored = new StoredStorageConfiguration(new StorageSettings { Name = "az", ConnectionStringSecretId = "s-1" }, null);
            _repo.Setup(r => r.GetAllAsync()).ReturnsAsync(new[] { stored });
            _repo.Setup(r => r.GetSecretStatusAsync(stored))
                 .ReturnsAsync(new Dictionary<string, string> { { "ConnectionString", "archived" } });

            var configurations = await Service().GetAllAsync();

            configurations.Should().ContainSingle().Which.ConnectionStringStatus.Should().Be("archived");
        }

        [Fact]
        public async Task Get_UnknownName_ReturnsNull()
        {
            (await Service().GetAsync("missing")).Should().BeNull();
        }
    }
}
