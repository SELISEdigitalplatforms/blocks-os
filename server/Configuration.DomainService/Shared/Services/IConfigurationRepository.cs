using Blocks.Genesis;
using Configuration.DomainService.Mail.Entities;
using Configuration.DomainService.Mail.RequestModel;
using Configuration.DomainService.Notification.Entities;
using Configuration.DomainService.Notification.RequestModel;
using Configuration.DomainService.Notification.ResponseModel;
using Configuration.DomainService.Storage.Entities;
using Configuration.DomainService.DataGateway.Entities;
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

        /// <summary>
        /// Sets the sender name and audit fields of one configuration in place, leaving every other
        /// field of the stored document untouched — including any the entity does not map.
        /// </summary>
        Task UpdateMailSenderNameAsync(string configurationId, string senderName, DateTime lastUpdatedDate, string lastUpdatedBy);
        Task<MailServerConfiguration> GetMailConfigurationByIdAsync(string configurationId);
        Task<MailServerConfiguration> GetMailConfigurationByNameAsync(string configurationName);
        Task<List<MailServerConfiguration>> GetAllMailConfigurationsAsync();
        Task DeleteMailConfigurationAsync(string configurationId);

        #endregion

        #region DataGateway

        Task SaveDataGatewayConfigurationAsync(DataGatewayConfiguration configuration);
        Task<DataGatewayConfiguration> GetDataGatewayConfigurationAsync();
        Task<DataGatewayConfiguration> GetDataGatewayConfigurationByIdAsync(string itemId);

        #endregion

        Task UpsertAsync<T>(T data, Expression<Func<T, bool>> filterExpression, string collectionName = "");
    }
}

