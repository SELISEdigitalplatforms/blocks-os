using Blocks.Genesis;
using MongoDB.Bson;
using MongoDB.Driver;
using System.Linq.Expressions;
using Configuration.DomainService.Notification.ResponseModel;
using Configuration.DomainService.Notification.RequestModel;
using Configuration.DomainService.Storage.Entities;
using Configuration.DomainService.Mail.RequestModel;
using Configuration.DomainService.DataGateway;
using Configuration.DomainService.DataGateway.Entities;
using Blocks.Genesis.Entities.Data;
using Blocks.Genesis.Entities.Os;

namespace Configuration.DomainService.Shared.Services
{
    public class ConfigurationRepository : IConfigurationRepository
    {
        private readonly IDbContextProvider _dbContextProvider;
        private readonly IKeyValueStore _keyValueStore;
        private readonly IBlocksSecret _blocksSecret;
        private readonly DataGatewayRootMode _dataGatewayRootMode;

        private const string NotificationKeyPrefix = "notification-config:";
        private const string _notificatonConfigurationCollectionName = "NotificationConfigurations";
        private const string _storageCollectionName = "StorageConfigurations";
        private const string _mailConfigurationCollectionName = "MailServerConfigurations";
        // Matches blocks-data's own DataServiceConfiguration collection name exactly (its DbRepository
        // derives it as $"{typeof(T).Name}s") - both sides read/write the same document per tenant.
        private const string _dataGatewayCollectionName = "DataServiceConfigurations";

        public ConfigurationRepository(
            IDbContextProvider dbContextProvider,
            IKeyValueStore keyValueStore,
            IBlocksSecret blocksSecret,
            DataGatewayRootMode dataGatewayRootMode)
        {
            _dbContextProvider = dbContextProvider;
            _keyValueStore = keyValueStore;
            _blocksSecret = blocksSecret;
            _dataGatewayRootMode = dataGatewayRootMode;
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

        public async Task UpdateMailSenderNameAsync(string configurationId, string senderName, DateTime lastUpdatedDate, string lastUpdatedBy)
        {
            var collection = _dbContextProvider.GetCollection<MailServerConfiguration>(_mailConfigurationCollectionName);

            var filter = Builders<MailServerConfiguration>.Filter.Eq(mc => mc.ItemId, configurationId);
            var update = Builders<MailServerConfiguration>.Update
                .Set(mc => mc.SenderName, senderName)
                .Set(mc => mc.LastUpdatedDate, lastUpdatedDate)
                .Set(mc => mc.LastUpdatedBy, lastUpdatedBy);

            await collection.UpdateOneAsync(filter, update);
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

            return await collection.Find(filter).ToListAsync();
        }

        public async Task DeleteMailConfigurationAsync(string configurationId)
        {
            var collection = _dbContextProvider.GetCollection<MailServerConfiguration>(_mailConfigurationCollectionName);
            var filter = Builders<MailServerConfiguration>.Filter.Eq(mc => mc.ItemId, configurationId);

            await collection.DeleteOneAsync(filter);
        }

        #endregion

        #region DataGateway

        // Switch OFF path (today's code) with the two root-DB guards of os SPEC2 §6.1a: a doc with a
        // ConfigItemId is a root doc (BlocksRootDb, _id = TenantId) and is never replaced from here. For a
        // normal tenant DB (no such docs) the filter changes nothing; the root tenant (whose tenant DB is
        // the root DB) gets DuplicateKey instead of overwriting another tenant's root doc.
        public async Task SaveDataGatewayConfigurationAsync(DataGatewayConfiguration configuration)
        {
            var collection = _dbContextProvider.GetCollection<DataGatewayConfiguration>(_dataGatewayCollectionName);

            var builder = Builders<DataGatewayConfiguration>.Filter;
            var filter = builder.Eq(mc => mc.ItemId, configuration.ItemId)
                         & builder.Exists(mc => mc.ConfigItemId, false);

            await collection.ReplaceOneAsync(
                filter,
                configuration,
                new ReplaceOptions { IsUpsert = true }
            );
        }

        // There is at most one DataGateway configuration - mirrors blocks-data's own
        // DataGatewayConfigurationService.GetConfiguration, which likewise takes no key and just
        // filters on IsDeleted. Switch on: the caller's root doc, else the tenant copy (used by the
        // validator's "exists" check). Never "the first live doc" of the root DB (os SPEC2 C9/C18).
        public async Task<DataGatewayConfiguration> GetDataGatewayConfigurationAsync()
        {
            if (_dataGatewayRootMode.IsOn)
            {
                var root = await GetDataGatewayRootAsync(BlocksContext.GetContext()?.TenantId ?? string.Empty);
                if (root != null)
                {
                    return root;
                }
            }

            return (await GetDataGatewayTenantCopyAsync())!;
        }

        // No ConfigItemId filter on purpose (os SPEC2 §6.3): the off-path save must SEE a root doc so it can
        // refuse; otherwise a crafted update would fall into "unknown ItemId -> new doc".
        public async Task<DataGatewayConfiguration> GetDataGatewayConfigurationByIdAsync(string itemId)
        {
            var collection = _dbContextProvider.GetCollection<DataGatewayConfiguration>(_dataGatewayCollectionName);

            var filter = Builders<DataGatewayConfiguration>.Filter.Eq(mc => mc.ItemId, itemId);
            return await collection.Find(filter).FirstOrDefaultAsync();
        }

        private IMongoCollection<DataGatewayConfiguration> RootDataGatewayCollection() =>
            _dbContextProvider
                .GetDatabase(_blocksSecret.DatabaseConnectionString, _blocksSecret.RootDatabaseName)
                .GetCollection<DataGatewayConfiguration>(_dataGatewayCollectionName);

        private static FilterDefinition<DataGatewayConfiguration> RootFilter(string tenantId)
        {
            var builder = Builders<DataGatewayConfiguration>.Filter;
            return builder.Eq(mc => mc.ItemId, tenantId) & builder.Exists(mc => mc.ConfigItemId);
        }

        public async Task<DataGatewayConfiguration?> GetDataGatewayRootAsync(string tenantId)
        {
            if (string.IsNullOrWhiteSpace(tenantId))
            {
                return null;
            }

            var filter = RootFilter(tenantId) & Builders<DataGatewayConfiguration>.Filter.Eq(mc => mc.IsDeleted, false);
            return await RootDataGatewayCollection().Find(filter).FirstOrDefaultAsync();
        }

        public async Task<DataGatewayConfiguration?> GetDataGatewayTenantCopyAsync()
        {
            var collection = _dbContextProvider.GetCollection<DataGatewayConfiguration>(_dataGatewayCollectionName);

            var builder = Builders<DataGatewayConfiguration>.Filter;
            var filter = builder.Eq(mc => mc.IsDeleted, false) & builder.Exists(mc => mc.ConfigItemId, false);
            return await collection.Find(filter).FirstOrDefaultAsync();
        }

        public async Task<bool> InsertDataGatewayRootAsync(DataGatewayConfiguration root)
        {
            try
            {
                await RootDataGatewayCollection().InsertOneAsync(root);
                return true;
            }
            catch (MongoWriteException ex) when (ex.WriteError?.Category == ServerErrorCategory.DuplicateKey)
            {
                return false;
            }
        }

        public async Task<long> SetDataGatewayRootFieldsAsync(string tenantId, BsonDocument set, IEnumerable<string>? unset = null)
        {
            var update = new BsonDocument("$set", set);
            var unsetFields = unset?.ToList() ?? new List<string>();
            if (unsetFields.Count > 0)
            {
                update.Add("$unset", new BsonDocument(unsetFields.Select(f => new BsonElement(f, ""))));
            }

            var result = await RootDataGatewayCollection().UpdateOneAsync(
                RootFilter(tenantId),
                new BsonDocumentUpdateDefinition<DataGatewayConfiguration>(update),
                new UpdateOptions { IsUpsert = false });

            return result.MatchedCount;
        }

        // The only fields new code may write into a tenant copy (owner "Stop writing": never the value).
        internal static readonly IReadOnlySet<string> TenantCopyWritableFields = new HashSet<string>(StringComparer.Ordinal)
        {
            nameof(DataGatewayConfiguration.DatabaseName),
            nameof(DataGatewayConfiguration.IsCollectionNameEditable),
            nameof(DataGatewayConfiguration.CollectionNamePattern),
            nameof(DataGatewayConfiguration.AnalyticsConfiguration),
            nameof(DataGatewayConfiguration.LastUpdatedDate),
            nameof(DataGatewayConfiguration.LastUpdatedBy),
        };

        public async Task<long> SetDataGatewayTenantCopyNonSecretAsync(string configItemId, BsonDocument set)
        {
            var notAllowed = set.Names.FirstOrDefault(n => !TenantCopyWritableFields.Contains(n));
            if (notAllowed != null)
            {
                throw new ArgumentException($"Field '{notAllowed}' must not be written into the tenant copy.", nameof(set));
            }

            var collection = _dbContextProvider.GetCollection<DataGatewayConfiguration>(_dataGatewayCollectionName);

            var builder = Builders<DataGatewayConfiguration>.Filter;
            var filter = builder.Eq(mc => mc.ItemId, configItemId) & builder.Exists(mc => mc.ConfigItemId, false);

            var result = await collection.UpdateOneAsync(
                filter,
                new BsonDocumentUpdateDefinition<DataGatewayConfiguration>(new BsonDocument("$set", set)),
                new UpdateOptions { IsUpsert = false });

            return result.MatchedCount;
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

