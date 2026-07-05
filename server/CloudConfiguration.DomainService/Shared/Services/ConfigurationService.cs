using Blocks.Genesis;
using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using CloudConfiguration.DomainService.Shared.Utilities;
using CloudConfiguration.DomainService.Notification.RequestModel;
using CloudConfiguration.DomainService.Notification.ResponseModel;
using CloudConfiguration.DomainService.Notification.Entities;
using CloudConfiguration.DomainService.Storage.RequestModel;
using CloudConfiguration.DomainService.Storage.Entities;
using CloudConfiguration.DomainService.Storage.Enums;
using System.Collections.Immutable;

namespace CloudConfiguration.DomainService.Shared.Services
{
    public class ConfigurationService : IConfigurationService
    {
        private const string MaskedSecretValue = "********";

        private readonly IConfigurationRepository _configurationRepository;
        private readonly IValidator<SaveNotificatonConfigurationRequest> _notificatonConfigurationValidator;
        private readonly IValidator<SaveStorageConfigurationRequest> _storageConfigurationValidator;
        private readonly IMessageClient _messageClient;


        public ConfigurationService(IConfigurationRepository configurationRepository,
                                    IValidator<SaveNotificatonConfigurationRequest> notificatonConfigurationValidator,
                                    IValidator<SaveStorageConfigurationRequest> storageConfigurationValidator,
                                    IMessageClient messageClient)
        {
            _configurationRepository = configurationRepository;
            _notificatonConfigurationValidator = notificatonConfigurationValidator;
            _storageConfigurationValidator = storageConfigurationValidator;
            _messageClient = messageClient;
        }

        #region Notification

        public async Task<BaseResponse> SaveNotificationConfigurationAsync(SaveNotificatonConfigurationRequest configuration)
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

        public async Task<NotificationConfiguration> GetNotificatoinConfigurationAsync(GetNotificationConfigurationRequest request)
        {
            return await _configurationRepository.GetNotificationConfigurationByIdAsync(request.ItemId);
        }

        public async Task<BaseResponse> DeleteNotificationConfigurationAsync(DeleteNotificatoinConfigurationRequest request)
        {
            return await _configurationRepository.DeleteNotificationConfigurationAsync(request);
        }

        private async Task<NotificationConfiguration> MapAsync(SaveNotificatonConfigurationRequest configuration)
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
                                    await _configurationRepository.GetStorageConfigurationByNameAsync(request.Name);

            if (repoConfiguration == null)
            {
                repoConfiguration = new StorageConfiguration { ItemId = Guid.NewGuid().ToString(), CreatedDate = DateTime.UtcNow };
            }

            repoConfiguration.CreatedBy = BlocksContext.GetContext()?.UserId;
            repoConfiguration.LastUpdatedBy = BlocksContext.GetContext()?.UserId;
            repoConfiguration.LastUpdatedDate = DateTime.UtcNow;
            repoConfiguration.Name = request.Name;
            repoConfiguration.ConnectionString = request.ConnectionString;
            repoConfiguration.SecretKey = request.SecretKey;
            repoConfiguration.StorageStrategy = request.StorageStrategy;
            repoConfiguration.AccessKey = request.AccessKey;
            repoConfiguration.CloudStorageRegionEndPoint = request.CloudStorageRegionEndPoint;


            #region LocalStorage

            _ = StorageTypes.TryGetCategory(request.StorageStrategy, out var category);

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
    }
}
