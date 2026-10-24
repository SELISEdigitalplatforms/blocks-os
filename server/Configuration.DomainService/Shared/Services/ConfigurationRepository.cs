using Blocks.Genesis;
using MongoDB.Bson;
using MongoDB.Driver;
using System.Linq.Expressions;
using Configuration.DomainService.Notification.ResponseModel;
using Configuration.DomainService.Notification.RequestModel;
using Configuration.DomainService.Storage.Entities;
using Configuration.DomainService.Mail.RequestModel;
using Blocks.Genesis.Entities.Data;
using Blocks.Genesis.Entities.Os;
using Os.DataAccess;

namespace Configuration.DomainService.Shared.Services
{
    public class ConfigurationRepository : IConfigurationRepository
    {
        private readonly IDbContextProvider _dbContextProvider;
        private readonly IKeyValueStore _keyValueStore;
        private readonly IOsDataAccess _dataAccess;

        private const string NotificationKeyPrefix = "notification-config:";
        private const string _notificatonConfigurationCollectionName = "NotificationConfigurations";
        private const string _mailConfigurationCollectionName = "MailServerConfigurations";

        public ConfigurationRepository(
            IDbContextProvider dbContextProvider,
            IKeyValueStore keyValueStore,
            IOsDataAccess dataAccess)
        {
            _dbContextProvider = dbContextProvider;
            _keyValueStore = keyValueStore;
            _dataAccess = dataAccess;
        }

        #region Notification

        // Notification configs now live in Genesis KeyValueStores (same tenant DB, impersonated: true).
        // While the old collection still exists (before the migration `cleanup`), blocks-logic still reads and
        // writes it, so reads run today's code unchanged and writes go to the old collection first, then to KV.
        // After `cleanup` the old collection is gone and KV is the only store.
        private static string NotificationKey(string name) => NotificationKeyPrefix + (name ?? string.Empty).Trim();

        private bool LegacyExists()
        {
            var database = _dbContextProvider.GetDatabase();
            if (database == null)
            {
                return false;
            }

            return database
                .ListCollectionNames(new ListCollectionNamesOptions
                {
                    Filter = new BsonDocument("name", _notificatonConfigurationCollectionName)
                })
                .Any();
        }

        private async Task<List<NotificationConfiguration>> GetAllNotificationsFromKvAsync()
        {
            var all = await _keyValueStore.GetByPrefixAsync<NotificationConfiguration>(NotificationKeyPrefix);
            return all?.Where(c => c != null).ToList() ?? new List<NotificationConfiguration>();
        }

        public async Task SaveNotificationConfigurationAsync(NotificationConfiguration configuration)
        {
            if (LegacyExists())
            {
                var collection = _dbContextProvider.GetCollection<NotificationConfiguration>(_notificatonConfigurationCollectionName);

                var filter = Builders<NotificationConfiguration>.Filter.Eq(mc => mc.ItemId, configuration.ItemId);

                await collection.ReplaceOneAsync(
                    filter,
                    configuration,
                    new ReplaceOptions { IsUpsert = true }
                );
            }

            await _keyValueStore.SetAsync(NotificationKey(configuration.Name), configuration);
        }

        public async Task<NotificationConfiguration> GetNotificationConfigurationByIdAsync(string id)
        {
            if (!LegacyExists())
            {
                return (await GetAllNotificationsFromKvAsync()).FirstOrDefault(c => c.ItemId == id)!;
            }

            var collection = _dbContextProvider.GetCollection<NotificationConfiguration>(_notificatonConfigurationCollectionName);

            var filter = Builders<NotificationConfiguration>.Filter.Eq(mc => mc.ItemId, id);
            return await(await collection.FindAsync(filter)).FirstOrDefaultAsync();
        }

        public async Task<GetNotificationConfigurationsResponse> GetNotificationConfigurationsAsync(GetNotificationConfigurationsRequest request)
        {
            if (!LegacyExists())
            {
                var all = await GetAllNotificationsFromKvAsync();
                var sorted = all
                    .OrderByDescending(n => n.CreatedDate)
                    .Skip(request.PageSize * request.Page);
                // Mongo Limit = 0 means "no limit" today; keep that answer for PageSize <= 0.
                var page = (request.PageSize > 0 ? sorted.Take(request.PageSize) : sorted).ToList();

                return new GetNotificationConfigurationsResponse
                {
                    Configurations = page,
                    TotalCount = all.Count,
                    IsSuccess = true
                };
            }

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
            if (!LegacyExists())
            {
                return (await _keyValueStore.GetAsync<NotificationConfiguration>(NotificationKey(name)))!;
            }

            var collection = _dbContextProvider.GetCollection<NotificationConfiguration>(_notificatonConfigurationCollectionName);

            var filter = Builders<NotificationConfiguration>.Filter.Eq(mc => mc.Name, name);
            return await (await collection.FindAsync(filter)).FirstOrDefaultAsync();
        }

        public async Task<BaseResponse> DeleteNotificationConfigurationAsync(DeleteNotificationConfigurationRequest request)
        {
            if (LegacyExists())
            {
                var collection = _dbContextProvider.GetCollection<NotificationConfiguration>(_notificatonConfigurationCollectionName);
                var filter = Builders<NotificationConfiguration>.Filter.Eq(mc => mc.ItemId, request.ItemId);
                await collection.DeleteOneAsync(filter);
            }

            var existing = (await GetAllNotificationsFromKvAsync()).FirstOrDefault(c => c.ItemId == request.ItemId);
            if (existing != null)
            {
                await _keyValueStore.DeleteAsync(NotificationKey(existing.Name));
            }

            return new BaseResponse { IsSuccess = true };
        }

        #endregion

        #region Mail

        public async Task SaveMailConfigurationAsync(MailServerConfiguration configuration)
        {
            var collection = _dbContextProvider.GetCollection<MailServerConfiguration>(_mailConfigurationCollectionName);

            var filter = Builders<MailServerConfiguration>.Filter.Eq(mc => mc.ItemId, configuration.ItemId);

            // Upsert = update or insert: both gates apply. Denied is an error, not a silent no-op.
            var editFilter = await _dataAccess.EditFilterAsync(OsSchemas.MailServerConfiguration, filter, "ConfigurationRepository.SaveMailConfigurationAsync");
            if (editFilter is null || !await _dataAccess.InsertAllowedAsync(OsSchemas.MailServerConfiguration, "ConfigurationRepository.SaveMailConfigurationAsync"))
                throw new UnauthorizedAccessException("Access to the mail configuration was denied by the data access policy.");

            configuration = await _dataAccess.PrepareUpsertAsync(OsSchemas.MailServerConfiguration, configuration, collection, editFilter, "ConfigurationRepository.SaveMailConfigurationAsync");
            await collection.ReplaceOneAsync(editFilter, configuration, new ReplaceOptions { IsUpsert = true });
        }

        public async Task UpdateMailSenderNameAsync(string configurationId, string senderName, DateTime lastUpdatedDate, string lastUpdatedBy)
        {
            var collection = _dbContextProvider.GetCollection<MailServerConfiguration>(_mailConfigurationCollectionName);

            var filter = Builders<MailServerConfiguration>.Filter.Eq(mc => mc.ItemId, configurationId);
            var update = Builders<MailServerConfiguration>.Update
                .Set(mc => mc.SenderName, senderName)
                .Set(mc => mc.LastUpdatedDate, lastUpdatedDate)
                .Set(mc => mc.LastUpdatedBy, lastUpdatedBy);

            var editFilter = await _dataAccess.EditFilterAsync(OsSchemas.MailServerConfiguration, filter, "ConfigurationRepository.UpdateMailSenderNameAsync");
            if (editFilter is null)
            {
                return;
            }

            await _dataAccess.CheckUpdateAsync(OsSchemas.MailServerConfiguration, update, "ConfigurationRepository.UpdateMailSenderNameAsync");
            await collection.UpdateOneAsync(editFilter, update);
        }

        public async Task<MailServerConfiguration> GetMailConfigurationByIdAsync(string configurationId)
        {
            var collection = _dbContextProvider.GetCollection<MailServerConfiguration>(_mailConfigurationCollectionName);
            var filter = Builders<MailServerConfiguration>.Filter.Eq(mc => mc.ItemId, configurationId);

            // No projection: the result can be saved back as a whole document.
            var scope = await _dataAccess.ReadAsync(OsSchemas.MailServerConfiguration, filter, "ConfigurationRepository.GetMailConfigurationByIdAsync", useProjection: false);
            return scope.Granted ? await scope.Apply(collection).FirstOrDefaultAsync() : default!;
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

            var scope = await _dataAccess.ReadAsync(OsSchemas.MailServerConfiguration, filter, "ConfigurationRepository.GetMailConfigurationByNameAsync", useProjection: false);
            return scope.Granted ? await scope.Apply(collection).FirstOrDefaultAsync() : default!;
        }

        public async Task<MailServerConfiguration> GetMailConfigurationByNameForViewAsync(string configurationName)
        {
            var collection = _dbContextProvider.GetCollection<MailServerConfiguration>(_mailConfigurationCollectionName);
            var filter = Builders<MailServerConfiguration>.Filter.Eq(mc => mc.Name, configurationName);

            // Masked: View column (property) rules clear what the caller may not see.
            var scope = await _dataAccess.ReadAsync(OsSchemas.MailServerConfiguration, filter, "ConfigurationRepository.GetMailConfigurationByNameForViewAsync");
            return scope.Granted ? scope.ForView(await scope.Apply(collection).FirstOrDefaultAsync()) : default!;
        }

        public async Task<List<MailServerConfiguration>> GetAllMailConfigurationsAsync()
        {
            var collection = _dbContextProvider.GetCollection<MailServerConfiguration>(_mailConfigurationCollectionName);
            var scope = await _dataAccess.ReadAsync(OsSchemas.MailServerConfiguration, FilterDefinition<MailServerConfiguration>.Empty, "ConfigurationRepository.GetAllMailConfigurationsAsync");
            if (!scope.Granted)
            {
                return new List<MailServerConfiguration>();
            }

            // Only the API lists these: View column (property) rules clear what the caller may not see.
            return scope.ForView(await scope.Apply(collection).SortByDescending(doc => doc.IsDefault).ToListAsync());
        }

        public async Task<List<MailServerConfiguration>> GetMailConfigurationsByClientSecretReferenceAsync(string clientSecretReference)
        {
            if (string.IsNullOrWhiteSpace(clientSecretReference))
            {
                // An empty reference is what every configuration without a secret carries, so
                // matching on it would report unrelated configurations as dependents.
                return new List<MailServerConfiguration>();
            }

            var collection = _dbContextProvider.GetCollection<MailServerConfiguration>(_mailConfigurationCollectionName);
            var filter = Builders<MailServerConfiguration>.Filter.Eq(mc => mc.ClientSecretReference, clientSecretReference);

            var scope = await _dataAccess.ReadAsync(OsSchemas.MailServerConfiguration, filter, "ConfigurationRepository.GetMailConfigurationsByClientSecretReferenceAsync");
            return scope.Granted ? await scope.Apply(collection).ToListAsync() : new List<MailServerConfiguration>();
        }

        public async Task DeleteMailConfigurationAsync(string configurationId)
        {
            var collection = _dbContextProvider.GetCollection<MailServerConfiguration>(_mailConfigurationCollectionName);
            var filter = Builders<MailServerConfiguration>.Filter.Eq(mc => mc.ItemId, configurationId);

            var deleteFilter = await _dataAccess.DeleteFilterAsync(OsSchemas.MailServerConfiguration, filter, "ConfigurationRepository.DeleteMailConfigurationAsync");
            if (deleteFilter is null)
            {
                return;
            }

            await collection.DeleteOneAsync(deleteFilter);
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

