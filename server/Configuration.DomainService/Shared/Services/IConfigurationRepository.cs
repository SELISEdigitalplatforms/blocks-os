using Blocks.Genesis;
using Configuration.DomainService.Mail.RequestModel;
using Configuration.DomainService.Notification.RequestModel;
using Configuration.DomainService.Notification.ResponseModel;
using Configuration.DomainService.Storage.Entities;
using Configuration.DomainService.DataGateway.Entities;
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

        /// <summary>
        /// The configurations whose <see cref="MailServerConfiguration.ClientSecretReference"/>
        /// equals <paramref name="clientSecretReference"/>, in the caller's tenant. Used to warn
        /// before a secret is archived or purged; never returns anything for a blank reference.
        /// </summary>
        Task<List<MailServerConfiguration>> GetMailConfigurationsByClientSecretReferenceAsync(string clientSecretReference);
        Task DeleteMailConfigurationAsync(string configurationId);

        #endregion

        #region DataGateway

        Task SaveDataGatewayConfigurationAsync(DataGatewayConfiguration configuration);
        Task<DataGatewayConfiguration> GetDataGatewayConfigurationAsync();
        Task<DataGatewayConfiguration> GetDataGatewayConfigurationByIdAsync(string itemId);

        // Switch on (os SPEC2 §6.3). Root doc = BlocksRootDb.DataServiceConfigurations, _id = TenantId.

        /// <summary>The caller's root doc: <c>{_id: tenantId, ConfigItemId exists, IsDeleted: false}</c>.</summary>
        Task<DataGatewayConfiguration?> GetDataGatewayRootAsync(string tenantId);

        /// <summary>Live tenant copy in the context tenant DB; a doc with <c>ConfigItemId</c> is never one.</summary>
        Task<DataGatewayConfiguration?> GetDataGatewayTenantCopyAsync();

        /// <summary><c>InsertOne</c> into the root DB; <c>false</c> on DuplicateKey (the doc exists).</summary>
        Task<bool> InsertDataGatewayRootAsync(DataGatewayConfiguration root);

        /// <summary>Field <c>$set</c>/<c>$unset</c> on the caller's root doc, no upsert. Returns the matched count.</summary>
        Task<long> SetDataGatewayRootFieldsAsync(string tenantId, BsonDocument set, IEnumerable<string>? unset = null);

        /// <summary>
        /// Field <c>$set</c> of non-secret fields on the tenant copy <c>_id = configItemId</c>, no upsert; never
        /// <c>DbConnectionString</c>. Returns the matched count.
        /// </summary>
        Task<long> SetDataGatewayTenantCopyNonSecretAsync(string configItemId, BsonDocument set);

        #endregion

        Task UpsertAsync<T>(T data, Expression<Func<T, bool>> filterExpression, string collectionName = "");
    }
}

