using Blocks.Genesis;
using Configuration.DomainService.Notification.RequestModel;
using Configuration.DomainService.Notification.ResponseModel;
using Configuration.DomainService.Notification.Entities;
using Configuration.DomainService.Storage.RequestModel;
using Configuration.DomainService.Storage.Entities;
using Configuration.DomainService.Mail.RequestModel;
using Configuration.DomainService.Mail.Entities;

namespace Configuration.DomainService.Shared.Services
{
    public interface IConfigurationService
    {
        #region Notification

        Task<BaseResponse> SaveNotificationConfigurationAsync(SaveNotificationConfigurationRequest configuration);
        Task<GetNotificationConfigurationsResponse> GetNotificationConfigurationsAsync(GetNotificationConfigurationsRequest request);
        Task<NotificationConfiguration> GetNotificationConfigurationAsync(GetNotificationConfigurationRequest request);
        Task<BaseResponse> DeleteNotificationConfigurationAsync(DeleteNotificationConfigurationRequest request);

        #endregion

        #region Storage

        Task<BaseMutationResponse> SaveStorageConfigurationAsync(SaveStorageConfigurationRequest request);
        Task<List<StorageConfiguration>> GetStorageConfigurationsAsync();
        Task<StorageConfiguration> GetStorageConfigurationAsync(string configurationName);
        Task<BaseResponse> DeleteStorageConfigurationAsync(string configurationName);

        #endregion

        #region Mail

        Task<BaseMutationResponse> SaveMailConfigurationAsync(MailConfiguration configuration);
        Task<MailConfiguration> GetMailConfigurationAsync(GetMailConfigurationRequest request);
        Task<List<MailServerConfiguration>> GetAllMailConfigurationsAsync();
        Task<BaseMutationResponse> DeleteMailConfigurationAsync(DeleteMailConfigurationRequest request);
        Task<BaseMutationResponse> DuplicateMailConfigurationAsync(DuplicateMailConfigurationRequest request);

        #endregion
    }
}

