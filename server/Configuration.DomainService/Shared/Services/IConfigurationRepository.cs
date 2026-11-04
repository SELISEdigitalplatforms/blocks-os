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
        /// field of the stored document untouched — including any the entity does not map. Also writes
        /// the Default organization, which the project default record belongs to, so a record stored
        /// before organizations gets the element on its first save.
        /// </summary>
        Task UpdateMailSenderNameAsync(string configurationId, string senderName, DateTime lastUpdatedDate, string lastUpdatedBy);
        Task<MailServerConfiguration> GetMailConfigurationByIdAsync(string configurationId);
        Task<MailServerConfiguration> GetMailConfigurationByNameAsync(string configurationName);
        /// <summary>The configuration as the caller may see it: properties a column rule hides are left out. Never save it back.</summary>
        Task<MailServerConfiguration> GetMailConfigurationByNameForViewAsync(string configurationName);
        /// <summary>
        /// The configurations the API lists, in one query: all of them for a null
        /// <paramref name="organizationId"/>, the Default organization's for <c>"default"</c>, and
        /// that organization's plus the Default organization's for any other id. A document without
        /// an organization counts as the Default organization's.
        /// </summary>
        Task<List<MailServerConfiguration>> GetAllMailConfigurationsAsync(string? organizationId);

        /// <summary>
        /// Clears <see cref="MailServerConfiguration.IsOrganizationDefault"/> on the organization's
        /// other configurations in one update, sparing <paramref name="keepConfigurationId"/> and any
        /// configuration saved after <paramref name="savedAt"/>.
        /// </summary>
        Task ClearOtherOrganizationDefaultsAsync(string organizationId, string keepConfigurationId, DateTime savedAt);

        /// <summary>
        /// The configurations whose <see cref="MailServerConfiguration.ClientSecretReference"/> or
        /// <see cref="MailServerConfiguration.AccountPasswordReference"/> equals
        /// <paramref name="secretReference"/>, in the caller's tenant. Used to warn before a secret
        /// is archived or purged; never returns anything for a blank reference.
        /// </summary>
        Task<List<MailServerConfiguration>> GetMailConfigurationsBySecretReferenceAsync(string secretReference);
        Task DeleteMailConfigurationAsync(string configurationId);

        #endregion

        Task UpsertAsync<T>(T data, Expression<Func<T, bool>> filterExpression, string collectionName = "");
    }
}

