using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Configuration.DomainService.Mail.RequestModel;
using Configuration.DomainService.Mail.Validators;
using Configuration.DomainService.Notification.RequestModel;
using Configuration.DomainService.Notification.Validators;
using Configuration.DomainService.Shared.Services;
using Configuration.DomainService.Shared.Utilities;
using Configuration.DomainService.Storage.Entities;
using Configuration.DomainService.Storage.RequestModel;
using Configuration.DomainService.Storage.Repositories;
using Configuration.DomainService.Storage.Validators;
using StorageSettings = DomainService.Configuration.StorageSettings;
using FluentAssertions;
using Moq;
using Blocks.Genesis.Entities.Data;
using Blocks.Genesis.Entities.Os;

namespace XUnitTest.Validators
{
    public class StorageConfigurationValidatorTests
    {
        private readonly Mock<IStorageConfigurationRepository> _repo = new();

        private StorageConfigurationValidator Validator() => new(_repo.Object);

        [Fact]
        public async Task Validate_Create_NameAlreadyTaken_FailsOnName()
        {
            // Uniqueness was once bound to ConnectionString, so a taken name passed.
            _repo.Setup(r => r.GetByNameAsync("az"))
                 .ReturnsAsync(new StoredStorageConfiguration(new StorageSettings { Name = "az" }, null));

            var request = new SaveStorageConfigurationRequest
            {
                Name = "az",
                StorageStrategy = "Azure",
                ConnectionString = "DefaultEndpointsProtocol=https;AccountName=acct;AccountKey=abc123==;EndpointSuffix=core.windows.net"
            };

            var result = await Validator().ValidateAsync(request);

            result.Errors.Should().ContainSingle(e => e.PropertyName == nameof(SaveStorageConfigurationRequest.Name));
        }

        [Fact]
        public async Task Validate_Azure_ValidConnectionString_IsValid()
        {
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
            var request = new SaveStorageConfigurationRequest { Name = "x", StorageStrategy = "GoogleCloud" };

            var result = await Validator().ValidateAsync(request);

            result.IsValid.Should().BeFalse();
        }

        [Fact]
        public async Task Validate_Sftp_Valid_IsValid()
        {
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
            var request = new SaveStorageConfigurationRequest { Name = "aws", StorageStrategy = "AWS" };

            var result = await Validator().ValidateAsync(request);

            result.IsValid.Should().BeFalse();
        }

        [Fact]
        public async Task Validate_UpdateRequest_WithoutItemId_Fails()
        {
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

        [Fact]
        public async Task Validate_UpdateRequest_CarryingOnlyMutableSettings_IsValid()
        {
            // The client sends nothing but the settings an update may change plus the target's id.
            // Requiring a name, a provider or credentials here would reject a perfectly good update,
            // since StorageConfigurationService ignores all of them on an update anyway.
            var request = new SaveStorageConfigurationRequest
            {
                UpdateRequest = true,
                ItemId = "cfg-1",
                UploadUrlExpirySeconds = 900,
                DownloadUrlExpirySeconds = 120,
                MaxFileSizeInBytes = 10_485_760,
                UploadCompletionRequiredFor = new List<string> { "Private" }
            };

            var result = await Validator().ValidateAsync(request);

            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public async Task Validate_UpdateRequest_WithMaskedAzureConnectionString_IsValid()
        {
            // A client can only ever echo back the masked connection string the read endpoint gave
            // it ("D****...t"), which can never match the real Azure format rule. Enforcing that rule
            // on an update made every Azure configuration permanently unsaveable.
            var masked = Helper.GetMaskedCloudStorageRegionEndPoint(
                "DefaultEndpointsProtocol=https;AccountName=acct;AccountKey=abc123==;EndpointSuffix=core.windows.net");

            var request = new SaveStorageConfigurationRequest
            {
                Name = "Default",
                StorageStrategy = "Azure",
                ConnectionString = masked,
                UpdateRequest = true,
                ItemId = "cfg-1",
                UploadUrlExpirySeconds = 600,
                DownloadUrlExpirySeconds = 300,
                MaxFileSizeInBytes = 5_242_880
            };

            var result = await Validator().ValidateAsync(request);

            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public async Task Validate_UpdateRequest_StillValidatesTheMutableSettings()
        {
            var request = new SaveStorageConfigurationRequest
            {
                UpdateRequest = true,
                ItemId = "cfg-1",
                UploadUrlExpirySeconds = 604_801,
                MaxFileSizeInBytes = 0,
                UploadCompletionRequiredFor = new List<string> { "Secure" }
            };

            var result = await Validator().ValidateAsync(request);

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.PropertyName == nameof(SaveStorageConfigurationRequest.UploadUrlExpirySeconds));
            result.Errors.Should().Contain(e => e.PropertyName == nameof(SaveStorageConfigurationRequest.MaxFileSizeInBytes));
            result.Errors.Should().Contain(e => e.PropertyName == nameof(SaveStorageConfigurationRequest.UploadCompletionRequiredFor));
        }

        [Fact]
        public async Task Validate_CreateRequest_StillRequiresNameAndProviderCredentials()
        {
            // The relaxation above must apply to updates only - creating a configuration is still the
            // one request that has to supply a name, a provider and that provider's credentials.
            var request = new SaveStorageConfigurationRequest
            {
                UpdateRequest = false,
                UploadUrlExpirySeconds = 600
            };

            var result = await Validator().ValidateAsync(request);

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.PropertyName == nameof(SaveStorageConfigurationRequest.Name));
            result.Errors.Should().Contain(e => e.PropertyName == nameof(SaveStorageConfigurationRequest.StorageStrategy));
        }

        private static SaveStorageConfigurationRequest ValidAzureRequest() => new()
        {
            Name = "az",
            StorageStrategy = "Azure",
            ConnectionString = "DefaultEndpointsProtocol=https;AccountName=acct;AccountKey=abc123==;EndpointSuffix=core.windows.net"
        };

        [Theory]
        [InlineData(0)]
        [InlineData(-1)]
        [InlineData(604_801)]
        public async Task Validate_UploadUrlExpirySeconds_OutOfRange_Fails(int value)
        {
            var request = ValidAzureRequest();
            request.UploadUrlExpirySeconds = value;

            var result = await Validator().ValidateAsync(request);

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.PropertyName == nameof(SaveStorageConfigurationRequest.UploadUrlExpirySeconds));
        }

        [Theory]
        [InlineData(1)]
        [InlineData(600)]
        [InlineData(604_800)]
        public async Task Validate_UploadUrlExpirySeconds_InRange_IsValid(int value)
        {
            var request = ValidAzureRequest();
            request.UploadUrlExpirySeconds = value;

            var result = await Validator().ValidateAsync(request);

            result.Errors.Should().NotContain(e => e.PropertyName == nameof(SaveStorageConfigurationRequest.UploadUrlExpirySeconds));
        }

        [Theory]
        [InlineData(0)]
        [InlineData(-1)]
        [InlineData(604_801)]
        public async Task Validate_DownloadUrlExpirySeconds_OutOfRange_Fails(int value)
        {
            var request = ValidAzureRequest();
            request.DownloadUrlExpirySeconds = value;

            var result = await Validator().ValidateAsync(request);

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.PropertyName == nameof(SaveStorageConfigurationRequest.DownloadUrlExpirySeconds));
        }

        [Theory]
        [InlineData(0)]
        [InlineData(-1)]
        public async Task Validate_MaxFileSizeInBytes_NotPositive_Fails(long value)
        {
            var request = ValidAzureRequest();
            request.MaxFileSizeInBytes = value;

            var result = await Validator().ValidateAsync(request);

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.PropertyName == nameof(SaveStorageConfigurationRequest.MaxFileSizeInBytes));
        }

        [Fact]
        public async Task Validate_MaxFileSizeInBytes_Positive_IsValid()
        {
            var request = ValidAzureRequest();
            request.MaxFileSizeInBytes = 5_242_880;

            var result = await Validator().ValidateAsync(request);

            result.Errors.Should().NotContain(e => e.PropertyName == nameof(SaveStorageConfigurationRequest.MaxFileSizeInBytes));
        }

        [Fact]
        public async Task Validate_MaxFileSizeInBytes_ExceedsFiftyMb_Fails()
        {
            var request = ValidAzureRequest();
            request.MaxFileSizeInBytes = 50 * 1024 * 1024 + 1;

            var result = await Validator().ValidateAsync(request);

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.PropertyName == nameof(SaveStorageConfigurationRequest.MaxFileSizeInBytes));
        }

        [Fact]
        public async Task Validate_MaxFileSizeInBytes_ExactlyFiftyMb_IsValid()
        {
            var request = ValidAzureRequest();
            request.MaxFileSizeInBytes = 50 * 1024 * 1024;

            var result = await Validator().ValidateAsync(request);

            result.Errors.Should().NotContain(e => e.PropertyName == nameof(SaveStorageConfigurationRequest.MaxFileSizeInBytes));
        }

        [Theory]
        [MemberData(nameof(AllowedUploadCompletionCombinations))]
        public async Task Validate_UploadCompletionRequiredFor_AllowedCombinations_IsValid(List<string> accessModifiers)
        {
            var request = ValidAzureRequest();
            request.UploadCompletionRequiredFor = accessModifiers;

            var result = await Validator().ValidateAsync(request);

            result.Errors.Should().NotContain(e => e.PropertyName == nameof(SaveStorageConfigurationRequest.UploadCompletionRequiredFor));
        }

        public static TheoryData<List<string>> AllowedUploadCompletionCombinations => new()
        {
            new List<string> { "Public" },
            new List<string> { "Private" },
            new List<string> { "Public", "Private" },
        };

        [Fact]
        public async Task Validate_UploadCompletionRequiredFor_DisallowedValue_Fails()
        {
            var request = ValidAzureRequest();
            request.UploadCompletionRequiredFor = new List<string> { "Secure" };

            var result = await Validator().ValidateAsync(request);

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.PropertyName == nameof(SaveStorageConfigurationRequest.UploadCompletionRequiredFor));
        }

        [Fact]
        public async Task Validate_UploadCompletionRequiredFor_DuplicateValue_Fails()
        {
            var request = ValidAzureRequest();
            request.UploadCompletionRequiredFor = new List<string> { "Public", "Public" };

            var result = await Validator().ValidateAsync(request);

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.PropertyName == nameof(SaveStorageConfigurationRequest.UploadCompletionRequiredFor));
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
                 .ReturnsAsync((MailServerConfiguration?)null);

            var result = await Validator().ValidateAsync(ValidOutbound());

            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public async Task Validate_DuplicateName_Fails()
        {
            // A different record holds the name, so the edit collides.
            _repo.Setup(r => r.GetMailConfigurationByNameAsync(It.IsAny<string>()))
                 .ReturnsAsync(new MailServerConfiguration { ItemId = "someone-else", Name = "Primary" });

            var result = await Validator().ValidateAsync(ValidOutbound());

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.ErrorMessage.Contains("unique"));
        }

        [Fact]
        public async Task Validate_InvalidHost_Fails()
        {
            _repo.Setup(r => r.GetMailConfigurationByNameAsync(It.IsAny<string>()))
                 .ReturnsAsync((MailServerConfiguration?)null);

            var request = ValidOutbound();
            request.Host = "not a host";

            var result = await Validator().ValidateAsync(request);

            result.IsValid.Should().BeFalse();
        }

        [Fact]
        public async Task Validate_OutboundMissingSenderAddress_Fails()
        {
            _repo.Setup(r => r.GetMailConfigurationByNameAsync(It.IsAny<string>()))
                 .ReturnsAsync((MailServerConfiguration?)null);

            var request = ValidOutbound();
            request.SenderAddress = "";

            var result = await Validator().ValidateAsync(request);

            result.IsValid.Should().BeFalse();
        }

        [Fact]
        public async Task Validate_InboundDoesNotRequireSender_IsValid()
        {
            _repo.Setup(r => r.GetMailConfigurationByNameAsync(It.IsAny<string>()))
                 .ReturnsAsync((MailServerConfiguration?)null);

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
                 .ReturnsAsync((MailServerConfiguration?)null);

            var request = ValidOutbound();
            request.AccountPassword = "123";

            var result = await Validator().ValidateAsync(request);

            result.IsValid.Should().BeFalse();
        }

        [Fact]
        public async Task Validate_NameHeldByTheRecordBeingEdited_IsValid()
        {
            // Without excluding the current record, every edit that leaves the name alone would
            // collide with itself and nothing could be saved twice.
            _repo.Setup(r => r.GetMailConfigurationByNameAsync(It.IsAny<string>()))
                 .ReturnsAsync(new MailServerConfiguration { ItemId = "cfg-1", Name = "Primary" });

            var result = await Validator().ValidateAsync(ValidOutbound());

            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public async Task Validate_CreateWithoutConfigurationId_IsValid()
        {
            // An empty id is how a caller asks for a create; requiring one here rejected every
            // create once the controller stopped minting them.
            _repo.Setup(r => r.GetMailConfigurationByNameAsync(It.IsAny<string>()))
                 .ReturnsAsync((MailServerConfiguration?)null);

            var request = ValidOutbound();
            request.ConfigurationId = "";

            var result = await Validator().ValidateAsync(request);

            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public async Task Validate_OAuthConfiguration_DoesNotRequireUsernameOrPassword()
        {
            _repo.Setup(r => r.GetMailConfigurationByNameAsync(It.IsAny<string>()))
                 .ReturnsAsync((MailServerConfiguration?)null);

            var request = ValidOutbound();
            request.AuthenticationType = MailAuthenticationType.OAuthClientCredentials;
            request.SenderUserName = "";
            request.AccountPassword = "";

            var result = await Validator().ValidateAsync(request);

            result.IsValid.Should().BeTrue();
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
                 .ReturnsAsync((NotificationConfiguration?)null);

            var result = await Validator().ValidateAsync(Valid());

            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public async Task Validate_BuiltInFieldsInRange_IsValid()
        {
            _repo.Setup(r => r.GetNotificationConfigurationByNameAsync(It.IsAny<string>()))
                 .ReturnsAsync((NotificationConfiguration?)null);
            var request = Valid();
            request.IsBuiltIn = true;
            request.IsDisabled = false;
            request.Importance = NotificationImportance.High;
            request.Kind = NotificationKind.Security;
            request.Description = new string('d', 1000);
            request.SourceService = "blocks-iam";

            var result = await Validator().ValidateAsync(request);

            result.IsValid.Should().BeTrue();
        }

        [Theory]
        [InlineData("Importance")]
        [InlineData("Kind")]
        [InlineData("Description")]
        [InlineData("SourceService")]
        [InlineData("ConsumerAppRecommendation")]
        [InlineData("ConsumerAppNote")]
        public async Task Validate_BuiltInFieldOutOfRange_Fails(string field)
        {
            _repo.Setup(r => r.GetNotificationConfigurationByNameAsync(It.IsAny<string>()))
                 .ReturnsAsync((NotificationConfiguration?)null);
            var request = Valid();
            switch (field)
            {
                case "Importance": request.Importance = (NotificationImportance)99; break;
                case "Kind": request.Kind = (NotificationKind)99; break;
                case "Description": request.Description = new string('d', 1001); break;
                case "SourceService": request.SourceService = new string('s', 101); break;
                case "ConsumerAppRecommendation": request.ConsumerAppRecommendation = new string('r', 2001); break;
                case "ConsumerAppNote": request.ConsumerAppNote = new string('n', 2001); break;
            }

            var result = await Validator().ValidateAsync(request);

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.PropertyName == field);
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
                 .ReturnsAsync(new NotificationConfiguration());

            var result = await Validator().ValidateAsync(Valid());

            result.IsValid.Should().BeFalse();
            result.Errors.Should().Contain(e => e.ErrorMessage.Contains("unique"));
        }

        [Fact]
        public async Task Validate_UpdateRequest_SkipsUniquenessCheck()
        {
            _repo.Setup(r => r.GetNotificationConfigurationByNameAsync(It.IsAny<string>()))
                 .ReturnsAsync(new NotificationConfiguration());

            var request = Valid();
            request.IsUpdateRequest = true;

            var result = await Validator().ValidateAsync(request);

            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public async Task Validate_EmptyNotifyMethod_Fails()
        {
            _repo.Setup(r => r.GetNotificationConfigurationByNameAsync(It.IsAny<string>()))
                 .ReturnsAsync((NotificationConfiguration?)null);

            var request = Valid();
            request.NotifyMethod = "";

            var result = await Validator().ValidateAsync(request);

            result.IsValid.Should().BeFalse();
        }

        private static SaveNotificationConfigurationRequest WithAudience(NotificationAudience audience)
        {
            var request = Valid();
            request.Audience = audience;
            return request;
        }

        private async Task<FluentValidation.Results.ValidationResult> ValidateAsync(SaveNotificationConfigurationRequest request)
        {
            _repo.Setup(r => r.GetNotificationConfigurationByNameAsync(It.IsAny<string>()))
                 .ReturnsAsync((NotificationConfiguration?)null);
            return await Validator().ValidateAsync(request);
        }

        [Fact]
        public async Task Audience_WithinLimits_IsValid()
        {
            var audience = new NotificationAudience
            {
                Match = NotificationAudienceMatch.All,
                UserIds = Enumerable.Range(0, 500).Select(i => "u" + i).ToList(),
                OrganizationIds = Enumerable.Range(0, 50).Select(i => "o" + i).ToList(),
                Roles = new List<string> { new string('r', 200) },
                Permissions = new List<string> { "blocks-iam::iam::users" },
                Filters = Enumerable.Range(0, 20).Select(i => new Blocks.Genesis.Entities.Logic.SubscriptionFilter { Context = "c" + i }).ToList()
            };

            (await ValidateAsync(WithAudience(audience))).IsValid.Should().BeTrue();
        }

        [Theory]
        [InlineData("UserIds", 501)]
        [InlineData("OrganizationIds", 51)]
        [InlineData("Roles", 51)]
        [InlineData("Permissions", 51)]
        [InlineData("Filters", 21)]
        public async Task Audience_OverTheListLimit_Fails(string list, int count)
        {
            var audience = new NotificationAudience();
            var items = Enumerable.Range(0, count).Select(i => "x" + i).ToList();
            switch (list)
            {
                case "UserIds": audience.UserIds = items; break;
                case "OrganizationIds": audience.OrganizationIds = items; break;
                case "Roles": audience.Roles = items; break;
                case "Permissions": audience.Permissions = items; break;
                default: audience.Filters = items.Select(c => new Blocks.Genesis.Entities.Logic.SubscriptionFilter { Context = c }).ToList(); break;
            }

            var result = await ValidateAsync(WithAudience(audience));

            result.Errors.Should().Contain(e => e.PropertyName.StartsWith("Audience." + list));
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public async Task Audience_EmptyItem_Fails(string? item)
        {
            var result = await ValidateAsync(WithAudience(new NotificationAudience { Roles = new List<string> { item! } }));

            result.IsValid.Should().BeFalse();
        }

        [Fact]
        public async Task Audience_TooLongItem_Fails()
        {
            var result = await ValidateAsync(WithAudience(new NotificationAudience { Permissions = new List<string> { new string('p', 201) } }));

            result.IsValid.Should().BeFalse();
        }

        [Fact]
        public async Task Audience_FilterWithoutContext_Fails()
        {
            var audience = new NotificationAudience
            {
                Filters = new List<Blocks.Genesis.Entities.Logic.SubscriptionFilter> { new() { Context = " ", Value = "v" } }
            };

            (await ValidateAsync(WithAudience(audience))).IsValid.Should().BeFalse();
        }

        [Fact]
        public async Task Audience_FilterFieldTooLong_Fails()
        {
            var audience = new NotificationAudience
            {
                Filters = new List<Blocks.Genesis.Entities.Logic.SubscriptionFilter> { new() { Context = "c", Value = new string('v', 201) } }
            };

            (await ValidateAsync(WithAudience(audience))).IsValid.Should().BeFalse();
        }

        [Fact]
        public async Task Audience_EveryoneWithRules_Fails()
        {
            var result = await ValidateAsync(WithAudience(new NotificationAudience { EveryoneInTenant = true, Roles = new List<string> { "admin" } }));

            result.Errors.Should().Contain(e => e.ErrorMessage.Contains("EveryoneInTenant"));
        }

        [Fact]
        public async Task Audience_EveryoneAlone_AndEmptyClear_AreValid()
        {
            (await ValidateAsync(WithAudience(new NotificationAudience { EveryoneInTenant = true }))).IsValid.Should().BeTrue();
            (await ValidateAsync(WithAudience(new NotificationAudience()))).IsValid.Should().BeTrue();
        }

        [Fact]
        public async Task Audience_NullLists_FailWithoutThrowing()
        {
            var result = await ValidateAsync(WithAudience(new NotificationAudience { UserIds = null!, Filters = null! }));

            result.IsValid.Should().BeFalse();
        }

        [Fact]
        public async Task Audience_InvalidMatchOrScope_Fails()
        {
            (await ValidateAsync(WithAudience(new NotificationAudience { Match = (NotificationAudienceMatch)9 }))).IsValid.Should().BeFalse();

            var request = Valid();
            request.Scope = (NotificationScope)7;
            (await ValidateAsync(request)).Errors.Should().Contain(e => e.PropertyName == "Scope");
        }
    }
}
