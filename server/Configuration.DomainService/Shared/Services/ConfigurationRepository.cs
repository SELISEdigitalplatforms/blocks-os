using Blocks.Genesis;
using MongoDB.Driver;
using System.Linq.Expressions;
using Configuration.DomainService.Notification.Entities;
using Configuration.DomainService.Notification.ResponseModel;
using Configuration.DomainService.Notification.RequestModel;
using Configuration.DomainService.Storage.Entities;
using Configuration.DomainService.Mail.Entities;
using Configuration.DomainService.Mail.RequestModel;
using Configuration.DomainService.DataGateway.Entities;

namespace Configuration.DomainService.Shared.Services
{
    public class ConfigurationRepository : IConfigurationRepository
    {
        private readonly IDbContextProvider _dbContextProvider;

        private const string _notificatonConfigurationCollectionName = "NotificationConfigurations";
        private const string _storageCollectionName = "StorageConfigurations";
        private const string _mailConfigurationCollectionName = "MailServerConfigurations";
        private const string _dataGatewayCollectionName = "DataGatewayConfigurations";

        public ConfigurationRepository(IDbContextProvider dbContextProvider)
        {
            _dbContextProvider = dbContextProvider;
        }

        #region Notification

        public async Task SaveNotificationConfigurationAsync(NotificationConfiguration configuration)
        {
            var collection = _dbContextProvider.GetCollection<NotificationConfiguration>(_notificatonConfigurationCollectionName);

            var filter = Builders<NotificationConfiguration>.Filter.Eq(mc => mc.ItemId, configuration.ItemId);

            await collection.ReplaceOneAsync(
                filter,
                configuration,
                new ReplaceOptions { IsUpsert = true }
            );
        }

        public async Task<NotificationConfiguration> GetNotificationConfigurationByIdAsync(string id)
        {
            var collection = _dbContextProvider.GetCollection<NotificationConfiguration>(_notificatonConfigurationCollectionName);

            var filter = Builders<NotificationConfiguration>.Filter.Eq(mc => mc.ItemId, id);
            return await(await collection.FindAsync(filter)).FirstOrDefaultAsync();
        }

        public async Task<GetNotificationConfigurationsResponse> GetNotificationConfigurationsAsync(GetNotificationConfigurationsRequest request)
        {
            var collection = _dbContextProvider.GetCollection<NotificationConfiguration>(_notificatonConfigurationCollectionName);
            var filter = FilterDefinition<NotificationConfiguration>.Empty;

            var options = new FindOptions<NotificationConfiguration>
            {
                Skip = request.PageSize * request.Page,
                Limit = request.PageSize,
                Sort = Builders<NotificationConfiguration>.Sort.Descending(n => n.CreatedDate)
            };

            var configurations = await(await collection.FindAsync(filter, options)).ToListAsync();
            var totalCount = await collection.CountDocumentsAsync(_ => true);

            return new GetNotificationConfigurationsResponse
            {
                Configurations = configurations,
                TotalCount = totalCount,
                IsSuccess = true
            };
        }

        public async Task<NotificationConfiguration> GetNotificationConfigurationByNameAsync(string name)
        {
            var collection = _dbContextProvider.GetCollection<NotificationConfiguration>(_notificatonConfigurationCollectionName);

            var filter = Builders<NotificationConfiguration>.Filter.Eq(mc => mc.Name, name);
            return await (await collection.FindAsync(filter)).FirstOrDefaultAsync();
        }

        public async Task<BaseResponse> DeleteNotificationConfigurationAsync(DeleteNotificationConfigurationRequest request)
        {
            var collection = _dbContextProvider.GetCollection<NotificationConfiguration>(_notificatonConfigurationCollectionName);
            var filter = Builders<NotificationConfiguration>.Filter.Eq(mc => mc.ItemId, request.ItemId);
            await collection.DeleteOneAsync(filter);

            return new BaseResponse { IsSuccess = true };
        }

        #endregion

        #region Storage

        public async Task SaveStorageConfigurationAsync(StorageConfiguration configuration)
        {
            var collection = _dbContextProvider.GetCollection<StorageConfiguration>(_storageCollectionName);

            var filter = Builders<StorageConfiguration>.Filter.Eq(mc => mc.ItemId, configuration.ItemId);

            await collection.ReplaceOneAsync(
                filter,
                configuration,
                new ReplaceOptions { IsUpsert = true }
            );
        }

        public async Task<StorageConfiguration> GetStorageConfigurationByNameAsync(string configurationName)
        {
            var collection = _dbContextProvider.GetCollection<StorageConfiguration>(_storageCollectionName);

            var filter = Builders<StorageConfiguration>.Filter.Eq(mc => mc.Name, configurationName);
            return await collection.Find(filter).FirstOrDefaultAsync();
        }

        public async Task<List<StorageConfiguration>> GetAllStorageConfigurationsByDateAsync()
        {
            var collection = _dbContextProvider.GetCollection<StorageConfiguration>(_storageCollectionName);
            var filter = Builders<StorageConfiguration>.Filter.Where(_ => true);

            using var cursor = await collection.FindAsync(filter, new FindOptions<StorageConfiguration>
            {
                Sort = Builders<StorageConfiguration>.Sort.Ascending(doc => doc.LastUpdatedDate)
            });

            return await cursor.ToListAsync();
        }

        public async Task DeleteStorageConfigurationByNameAsync(string configurationName)
        {
            var collection = _dbContextProvider.GetCollection<StorageConfiguration>(_storageCollectionName);
            var filter = Builders<StorageConfiguration>.Filter.Eq(mc => mc.Name, configurationName);

            await collection.DeleteOneAsync(filter);
        }

        public async Task<StorageConfiguration> GetStorageConfigurationByIdAsync(string itemId)
        {
            var collection = _dbContextProvider.GetCollection<StorageConfiguration>(_storageCollectionName);

            var filter = Builders<StorageConfiguration>.Filter.Eq(mc => mc.ItemId, itemId);
            return await collection.Find(filter).FirstOrDefaultAsync();
        }

        public async Task<StorageConfiguration?> GetStorageConfigurationStrategyAsync(string storageStrategy)
        {
            var collection = _dbContextProvider.GetCollection<StorageConfiguration>(_storageCollectionName);

            var filter = Builders<StorageConfiguration>.Filter.Eq(mc => mc.StorageStrategy, storageStrategy);
            return await collection.Find(filter).FirstOrDefaultAsync();
        }

        #endregion

        #region Mail

        public async Task SaveMailConfigurationAsync(MailServerConfiguration configuration)
        {
            var collection = _dbContextProvider.GetCollection<MailServerConfiguration>(_mailConfigurationCollectionName);

            var filter = Builders<MailServerConfiguration>.Filter.Eq(mc => mc.ItemId, configuration.ItemId);

            await collection.ReplaceOneAsync(filter, configuration, new ReplaceOptions { IsUpsert = true });
        }

        public async Task<MailServerConfiguration> GetMailConfigurationByIdAsync(string configurationId)
        {
            var collection = _dbContextProvider.GetCollection<MailServerConfiguration>(_mailConfigurationCollectionName);
            var filter = Builders<MailServerConfiguration>.Filter.Eq(mc => mc.ItemId, configurationId);

            return await collection.Find(filter).FirstOrDefaultAsync();
        }

        /// <summary>
        /// Looks a configuration up by the name it is stored under.
        /// </summary>
        /// <remarks>
        /// Typed to the entity and filtered on <c>Name</c>. It previously typed the collection as
        /// the request model and filtered on <c>ConfigurationName</c> — a field no document in
        /// this collection has — so it matched nothing: name uniqueness silently passed for every
        /// name, and a lookup by name never found anything.
        /// </remarks>
        public async Task<MailServerConfiguration> GetMailConfigurationByNameAsync(string configurationName)
        {
            var collection = _dbContextProvider.GetCollection<MailServerConfiguration>(_mailConfigurationCollectionName);
            var filter = Builders<MailServerConfiguration>.Filter.Eq(mc => mc.Name, configurationName);

            return await collection.Find(filter).FirstOrDefaultAsync();
        }

        public async Task<List<MailServerConfiguration>> GetAllMailConfigurationsAsync()
        {
            var collection = _dbContextProvider.GetCollection<MailServerConfiguration>(_mailConfigurationCollectionName);
            var document = collection.Find(_ => true).SortByDescending(doc => doc.IsDefault);

            return await document.ToListAsync();
        }

        public async Task DeleteMailConfigurationAsync(string configurationId)
        {
            var collection = _dbContextProvider.GetCollection<MailServerConfiguration>(_mailConfigurationCollectionName);
            var filter = Builders<MailServerConfiguration>.Filter.Eq(mc => mc.ItemId, configurationId);

            await collection.DeleteOneAsync(filter);
        }

        #endregion

        #region DataGateway

        public async Task SaveDataGatewayConfigurationAsync(DataGatewayConfiguration configuration)
        {
            var collection = _dbContextProvider.GetCollection<DataGatewayConfiguration>(_dataGatewayCollectionName);

            var filter = Builders<DataGatewayConfiguration>.Filter.Eq(mc => mc.ItemId, configuration.ItemId);

            await collection.ReplaceOneAsync(
                filter,
                configuration,
                new ReplaceOptions { IsUpsert = true }
            );
        }

        public async Task<DataGatewayConfiguration> GetDataGatewayConfigurationByProjectKeyAsync(string projectKey)
        {
            var collection = _dbContextProvider.GetCollection<DataGatewayConfiguration>(_dataGatewayCollectionName);

            var filter = Builders<DataGatewayConfiguration>.Filter.Eq(mc => mc.ProjectKey, projectKey);
            return await collection.Find(filter).FirstOrDefaultAsync();
        }

        public async Task<DataGatewayConfiguration> GetDataGatewayConfigurationByIdAsync(string itemId)
        {
            var collection = _dbContextProvider.GetCollection<DataGatewayConfiguration>(_dataGatewayCollectionName);

            var filter = Builders<DataGatewayConfiguration>.Filter.Eq(mc => mc.ItemId, itemId);
            return await collection.Find(filter).FirstOrDefaultAsync();
        }

        public async Task<List<DataGatewayConfiguration>> GetAllDataGatewayConfigurationsByDateAsync()
        {
            var collection = _dbContextProvider.GetCollection<DataGatewayConfiguration>(_dataGatewayCollectionName);
            var filter = Builders<DataGatewayConfiguration>.Filter.Where(_ => true);

            using var cursor = await collection.FindAsync(filter, new FindOptions<DataGatewayConfiguration>
            {
                Sort = Builders<DataGatewayConfiguration>.Sort.Ascending(doc => doc.LastUpdatedDate)
            });

            return await cursor.ToListAsync();
        }

        #endregion

        public async Task UpsertAsync<T>(T data, Expression<Func<T, bool>> filterExpression, string collectionName = "")
        {
            IMongoCollection<T> collection = _dbContextProvider.GetCollection<T>(string.IsNullOrWhiteSpace(collectionName) ? (typeof(T).Name + "s") : collectionName);

            var options = new ReplaceOptions { IsUpsert = true };
            await collection.ReplaceOneAsync(filterExpression, data, options);
        }
    }
}

