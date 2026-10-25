using Blocks.Genesis;
using Configuration.DomainService.Mail.RequestModel;
using Configuration.DomainService.Notification.RequestModel;
using Configuration.DomainService.Notification.ResponseModel;
using Configuration.DomainService.Storage.Entities;
using MongoDB.Bson;
using System.Linq.Expressions;
using Blocks.Genesis.Entities.Data;
using Blocks.Genesis.Entities.Os;

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

        #region Mail

        Task SaveMailConfigurationAsync(MailServerConfiguration configuration);

        /// <summary>
        /// Sets the sender name and audit fields of one configuration in place, leaving every other
        /// field of the stored document untouched — including any the entity does not map.
        /// </summary>
        Task UpdateMailSenderNameAsync(string configurationId, string senderName, DateTime lastUpdatedDate, string lastUpdatedBy);
        Task<MailServerConfiguration> GetMailConfigurationByIdAsync(string configurationId);
        Task<MailServerConfiguration> GetMailConfigurationByNameAsync(string configurationName);
        /// <summary>The configuration as the caller may see it: properties a column rule hides are left out. Never save it back.</summary>
        Task<MailServerConfiguration> GetMailConfigurationByNameForViewAsync(string configurationName);
        Task<List<MailServerConfiguration>> GetAllMailConfigurationsAsync();

        /// <summary>
        /// The configurations whose <see cref="MailServerConfiguration.ClientSecretReference"/>
        /// equals <paramref name="clientSecretReference"/>, in the caller's tenant. Used to warn
        /// before a secret is archived or purged; never returns anything for a blank reference.
        /// </summary>
        Task<List<MailServerConfiguration>> GetMailConfigurationsByClientSecretReferenceAsync(string clientSecretReference);
        Task DeleteMailConfigurationAsync(string configurationId);

        #endregion

        Task UpsertAsync<T>(T data, Expression<Func<T, bool>> filterExpression, string collectionName = "");
    }
}

