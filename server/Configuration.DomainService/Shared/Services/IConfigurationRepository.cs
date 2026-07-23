using Blocks.Genesis;
using Configuration.DomainService.Mail.Entities;
using Configuration.DomainService.Mail.RequestModel;
using Configuration.DomainService.Notification.Entities;
using Configuration.DomainService.Notification.RequestModel;
using Configuration.DomainService.Notification.ResponseModel;
using Configuration.DomainService.Storage.Entities;
using System.Linq.Expressions;

namespace Configuration.DomainService.Shared.Services
{
    public interface IConfigurationRepository
    {
        #region Notification

        Task SaveNotificationConfigurationAsync(NotificationConfiguration configuration);
        Task<NotificationConfiguration> GetNotificationConfigurationByIdAsync(string id);
        Task<GetNotificationConfigurationsResponse> GetNotificationConfigurationsAsync(GetNotificationConfigurationsRequest request);
        Task<BaseResponse> DeleteNotificationConfigurationAsync(DeleteNotificationConfigurationRequest request);
        Task<NotificationConfiguration> GetNotificationConfigurationByNameAsync(string name);

        #endregion

        #region Storage

        public Task SaveStorageConfigurationAsync(StorageConfiguration configuration);
        Task<StorageConfiguration> GetStorageConfigurationByNameAsync(string configurationName);
        Task<List<StorageConfiguration>> GetAllStorageConfigurationsByDateAsync();
        Task DeleteStorageConfigurationByNameAsync(string configurationName);
        Task<StorageConfiguration> GetStorageConfigurationByIdAsync(string itemId);
        Task<StorageConfiguration?> GetStorageConfigurationStrategyAsync(string storageStrategy);

        #endregion

        #region Mail

        Task SaveMailConfigurationAsync(MailServerConfiguration configuration);
        Task<MailServerConfiguration> GetMailConfigurationByIdAsync(string configurationId);
        Task<MailConfiguration> GetMailConfigurationByNameAsync(string configurationName);
        Task<List<MailServerConfiguration>> GetAllMailConfigurationsAsync();
        Task DeleteMailConfigurationAsync(string configurationId);

        #endregion

        Task UpsertAsync<T>(T data, Expression<Func<T, bool>> filterExpression, string collectionName = "");
    }
}

