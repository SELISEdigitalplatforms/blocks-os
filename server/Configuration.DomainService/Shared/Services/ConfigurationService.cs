using Blocks.Genesis;
using FluentValidation;
using Configuration.DomainService.Shared.Utilities;
using Configuration.DomainService.Notification.RequestModel;
using Configuration.DomainService.Notification.ResponseModel;
using Configuration.DomainService.Notification.Entities;
using Configuration.DomainService.Storage.RequestModel;
using Configuration.DomainService.Storage.Entities;
using Configuration.DomainService.Storage.Enums;
using Configuration.DomainService.DataGateway.RequestModel;
using Configuration.DomainService.DataGateway.Entities;
using System.Collections.Immutable;
using Microsoft.Extensions.Logging;

namespace Configuration.DomainService.Shared.Services
{
    public class ConfigurationService : IConfigurationService
    {
        private const string MaskedSecretValue = "********";

        private readonly IConfigurationRepository _configurationRepository;
        private readonly IValidator<SaveNotificationConfigurationRequest> _notificatonConfigurationValidator;
        private readonly IValidator<SaveStorageConfigurationRequest> _storageConfigurationValidator;
        private readonly IValidator<SaveDataGatewayConfigurationRequest> _dataGatewayConfigurationValidator;
        private readonly IMessageClient _messageClient;
        private readonly ILogger<ConfigurationService> _logger;


        public ConfigurationService(IConfigurationRepository configurationRepository,
                                    IValidator<SaveNotificationConfigurationRequest> notificatonConfigurationValidator,
                                    IValidator<SaveStorageConfigurationRequest> storageConfigurationValidator,
                                    IValidator<SaveDataGatewayConfigurationRequest> dataGatewayConfigurationValidator,
                                    IMessageClient messageClient,
                                    ILogger<ConfigurationService> logger)
        {
            _configurationRepository = configurationRepository;
            _notificatonConfigurationValidator = notificatonConfigurationValidator;
            _storageConfigurationValidator = storageConfigurationValidator;
            _dataGatewayConfigurationValidator = dataGatewayConfigurationValidator;
            _messageClient = messageClient;
            _logger = logger;
        }

        #region Notification

        public async Task<BaseResponse> SaveNotificationConfigurationAsync(SaveNotificationConfigurationRequest configuration)
        {
            var validationResult = await _notificatonConfigurationValidator.ValidateAsync(configuration);

            if (!validationResult.IsValid)
            {
                return new BaseResponse
                {
                    IsSuccess = false,
                    Errors = validationResult.Errors.ToDictionary(e => e.PropertyName, e => e.ErrorMessage)
                };
            }

            var repoConfig = await MapAsync(configuration);
            await _configurationRepository.SaveNotificationConfigurationAsync(repoConfig);
            return new BaseResponse { IsSuccess = true };
        }

        public async Task<GetNotificationConfigurationsResponse> GetNotificationConfigurationsAsync(GetNotificationConfigurationsRequest request)
        {
            return await _configurationRepository.GetNotificationConfigurationsAsync(request);
        }

        public async Task<NotificationConfiguration> GetNotificationConfigurationAsync(GetNotificationConfigurationRequest request)
        {
            return await _configurationRepository.GetNotificationConfigurationByIdAsync(request.ItemId);
        }

        public async Task<BaseResponse> DeleteNotificationConfigurationAsync(DeleteNotificationConfigurationRequest request)
        {
            return await _configurationRepository.DeleteNotificationConfigurationAsync(request);
        }

        private async Task<NotificationConfiguration> MapAsync(SaveNotificationConfigurationRequest configuration)
        {
            var repoConfig = await _configurationRepository.GetNotificationConfigurationByNameAsync(configuration.Name);

            repoConfig = repoConfig ?? new NotificationConfiguration { ItemId = Guid.NewGuid().ToString(), CreatedDate = DateTime.UtcNow, CreatedBy = BlocksContext.GetContext()?.UserId };

            repoConfig.LastUpdatedDate = DateTime.UtcNow;
            repoConfig.LastUpdatedBy = BlocksContext.GetContext()?.UserId;
            repoConfig.Name = configuration.Name;
            repoConfig.ChannelToNotify = configuration.ChannelToNotify;
            repoConfig.NotificationType = configuration.NotificationType;
            repoConfig.EnablePersistence = configuration.EnablePersistence;
            repoConfig.NotifyMethod = configuration.NotifyMethod;

            return repoConfig;
        }

        #endregion

        #region Storage

        public async Task<BaseMutationResponse> SaveStorageConfigurationAsync(SaveStorageConfigurationRequest request)
        {
            var validationResult = await _storageConfigurationValidator.ValidateAsync(request);

            if (!validationResult.IsValid)
                return new BaseMutationResponse { IsSuccess = false, Errors = validationResult.Errors.ToDictionary(e => e.PropertyName, e => e.ErrorMessage) };

            var repoConfiguration = await MappedIntoRepoConfigurationAsync(request);

            await _configurationRepository.SaveStorageConfigurationAsync(repoConfiguration);

            await _messageClient.SendToConsumerAsync(new ConsumerMessage<CreateDefaultFolderEvent>
            {
                Payload = new CreateDefaultFolderEvent
                {
                    ItemId = repoConfiguration.ItemId,
                    ConfigurationName = repoConfiguration.Name,
                    StorageStrategy = repoConfiguration.StorageStrategy
                },
                ConsumerName = Constants.StorageQueue,
            });

            return new BaseMutationResponse { IsSuccess = true, ItemId = repoConfiguration.ItemId };
        }

        private async Task<StorageConfiguration> MappedIntoRepoConfigurationAsync(SaveStorageConfigurationRequest request)
        {
            var repoConfiguration = request.UpdateRequest ?
                                    await _configurationRepository.GetStorageConfigurationByIdAsync(request.ItemId ?? "") :
                                    await _configurationRepository.GetStorageConfigurationByNameAsync(request.Name ?? "");

            var isNewConfiguration = repoConfiguration == null;

            if (repoConfiguration == null)
            {
                repoConfiguration = new StorageConfiguration { ItemId = Guid.NewGuid().ToString(), CreatedDate = DateTime.UtcNow };
                // Only a brand new configuration records its author; an update must not rewrite the
                // original creator to whoever happened to change an expiry setting.
                repoConfiguration.CreatedBy = BlocksContext.GetContext()?.UserId;
            }

            repoConfiguration.LastUpdatedBy = BlocksContext.GetContext()?.UserId;
            repoConfiguration.LastUpdatedDate = DateTime.UtcNow;

            #region Phase1UploadSecurity

            repoConfiguration.UploadUrlExpirySeconds = request.UploadUrlExpirySeconds;
            repoConfiguration.DownloadUrlExpirySeconds = request.DownloadUrlExpirySeconds;
            repoConfiguration.MaxFileSizeInBytes = request.MaxFileSizeInBytes;
            repoConfiguration.UploadCompletionRequiredFor = request.UploadCompletionRequiredFor;

            #endregion

            // The provider identity and its credentials are fixed once a configuration exists - the client UI
            // disables these fields in edit mode, but that alone doesn't stop a direct API call from sending
            // different values, so an update request is not trusted to change them here either. Only a brand
            // new configuration takes these from the request.
            if (!isNewConfiguration)
            {
                return repoConfiguration;
            }

            // request.Name/StorageStrategy are only null here if validation somehow let a create
            // request through without them - FluentValidation already requires both when
            // !UpdateRequest, so this only guards against that invariant, not a real empty write.
            repoConfiguration.Name = request.Name ?? "";
            repoConfiguration.ConnectionString = request.ConnectionString;
            repoConfiguration.SecretKey = request.SecretKey;
            repoConfiguration.StorageStrategy = request.StorageStrategy ?? "";
            repoConfiguration.AccessKey = request.AccessKey;
            repoConfiguration.CloudStorageRegionEndPoint = request.CloudStorageRegionEndPoint;

            #region LocalStorage

            _ = StorageTypes.TryGetCategory(request.StorageStrategy ?? "", out var category);

            repoConfiguration.Host = request.Host ?? "";
            repoConfiguration.Port = request.Port ?? "";
            repoConfiguration.UserName = request.UserName ?? "";
            repoConfiguration.Password = request.Password ?? "";
            repoConfiguration.RemoteBasePath = request.RemoteBasePath ?? "";
            repoConfiguration.StorageStrategy = request.StorageStrategy ?? "";
            repoConfiguration.SftpSecretKey = category == StorageStrategyCategory.Local ? Helper.GenerateAesKey() : "";

            #endregion

            return repoConfiguration;
        }

        public static class StorageTypes
        {
            private static readonly ImmutableDictionary<string, StorageStrategyCategory> TypeToCategory =
                ImmutableDictionary.CreateRange(StringComparer.OrdinalIgnoreCase, new[]
                {
                   new KeyValuePair<string, StorageStrategyCategory>("azure", StorageStrategyCategory.Cloud),
                   new KeyValuePair<string, StorageStrategyCategory>("aws", StorageStrategyCategory.Cloud),
                   new KeyValuePair<string, StorageStrategyCategory>("sftpstorage", StorageStrategyCategory.Local)
                });

            public static bool TryGetCategory(string type, out StorageStrategyCategory category)
            {
                return TypeToCategory.TryGetValue(type.ToLower(), out category);
            }
        }

        public async Task<List<StorageConfiguration>> GetStorageConfigurationsAsync()
        {
            var configurations = await _configurationRepository.GetAllStorageConfigurationsByDateAsync();

            foreach (var configuration in configurations)
            {
                //To do masking if required
                if (configuration.StorageStrategy == "SftpStorage")
                {
                    configuration.Password = MaskedSecretValue;
                    configuration.SftpSecretKey = MaskedSecretValue;
                }
                else
                {
                    configuration.ConnectionString = Helper.GetMaskedCloudStorageRegionEndPoint(configuration.ConnectionString);
                }
            }

            return configurations;
        }

        public async Task<StorageConfiguration> GetStorageConfigurationAsync(string configurationName)
        {
            var configuration = await _configurationRepository.GetStorageConfigurationByNameAsync(configurationName);

            //To do masking if required
            if (configuration.StorageStrategy == "SftpStorage")
            {
                configuration.Password = MaskedSecretValue;
                configuration.SftpSecretKey = MaskedSecretValue;
            }
            else
            {
                configuration.ConnectionString = Helper.GetMaskedCloudStorageRegionEndPoint(configuration.ConnectionString);
            }

            return configuration;
        }

        public async Task<BaseResponse> DeleteStorageConfigurationAsync(string configurationName)
        {
            await _configurationRepository.DeleteStorageConfigurationByNameAsync(configurationName);

            return new BaseResponse { IsSuccess = true };
        }

        #endregion

        #region DataGateway

        public async Task<BaseMutationResponse> SaveDataGatewayConfigurationAsync(SaveDataGatewayConfigurationRequest request)
        {
            var validationResult = await _dataGatewayConfigurationValidator.ValidateAsync(request);

            if (!validationResult.IsValid)
                return new BaseMutationResponse { IsSuccess = false, Errors = validationResult.Errors.ToDictionary(e => e.PropertyName, e => e.ErrorMessage) };

            var repoConfiguration = await MappedIntoRepoConfigurationAsync(request);

            await _configurationRepository.SaveDataGatewayConfigurationAsync(repoConfiguration);

            return new BaseMutationResponse { IsSuccess = true, ItemId = repoConfiguration.ItemId };
        }

        private async Task<DataGatewayConfiguration> MappedIntoRepoConfigurationAsync(SaveDataGatewayConfigurationRequest request)
        {
            var repoConfiguration = request.UpdateRequest ?
                                    await _configurationRepository.GetDataGatewayConfigurationByIdAsync(request.ItemId ?? "") :
                                    null;

            var isNewConfiguration = repoConfiguration == null;

            if (repoConfiguration == null)
            {
                repoConfiguration = new DataGatewayConfiguration { ItemId = Guid.NewGuid().ToString(), CreatedDate = DateTime.UtcNow };
                repoConfiguration.CreatedBy = BlocksContext.GetContext()?.UserId;
                repoConfiguration.ProjectKey = request.ProjectKey ?? "";
            }

            repoConfiguration.LastUpdatedBy = BlocksContext.GetContext()?.UserId;
            repoConfiguration.LastUpdatedDate = DateTime.UtcNow;

            repoConfiguration.ConnectionString = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(request.ConnectionString ?? ""));
            repoConfiguration.DatabaseName = request.DatabaseName ?? "";
            repoConfiguration.IsCollectionNameEditable = request.IsCollectionNameEditable;
            repoConfiguration.CollectionNamePattern = request.CollectionNamePattern ?? repoConfiguration.CollectionNamePattern;

            if (request.EnableAnalytics.HasValue)
            {
                repoConfiguration.AnalyticsConfiguration ??= new AnalyticsConfiguration();
                if (request.EnableAnalytics.Value
                    && !repoConfiguration.AnalyticsConfiguration.EnableDate.HasValue
                    && !repoConfiguration.AnalyticsConfiguration.ValidTill.HasValue)
                {
                    var enableDate = DateTime.UtcNow;
                    repoConfiguration.AnalyticsConfiguration.EnableDate = enableDate;
                    repoConfiguration.AnalyticsConfiguration.ValidTill = enableDate.AddDays(14);
                }

                repoConfiguration.AnalyticsConfiguration.EnableAnalytics = request.EnableAnalytics.Value;
            }
            else if (isNewConfiguration)
            {
                var enableDate = DateTime.UtcNow;
                repoConfiguration.AnalyticsConfiguration = new AnalyticsConfiguration
                {
                    EnableAnalytics = true,
                    EnableDate = enableDate,
                    ValidTill = enableDate.AddDays(14)
                };
            }

            return repoConfiguration;
        }

        public async Task<List<DataGatewayConfiguration>> GetDataGatewayConfigurationsAsync()
        {
            var configurations = await _configurationRepository.GetAllDataGatewayConfigurationsByDateAsync();

            foreach (var configuration in configurations)
            {
                configuration.ConnectionString = MaskedSecretValue;
            }

            return configurations;
        }

        public async Task<DataGatewayConfiguration> GetDataGatewayConfigurationAsync(string projectKey)
        {
            var configuration = await _configurationRepository.GetDataGatewayConfigurationByProjectKeyAsync(projectKey);

            if (configuration != null)
            {
                configuration.ConnectionString = MaskedSecretValue;
            }

            return configuration;
        }

        #endregion
    }
}

