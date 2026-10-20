using Blocks.Genesis;
using DomainService.People;
using DomainService.Shared;
using MongoDB.Bson;
using MongoDB.Driver;
using Blocks.Genesis.Entities.Iam;
using Blocks.Genesis.Entities.Os;
using Os.DataAccess;

namespace DomainService.Migration.Services
{
    public class MigrationRepository : IMigrationRepository
    {
        // Process documents in batches to optimize memory usage
        private const int MigrationBatchSize = 1000;

        // Resolve for the current operation, not the singleton's first request/message.
        private IMongoCollection<MigrationTracker> Collection =>
            _dbContextProvider.GetCollection<MigrationTracker>(IdentifierConstants.MigrationTrackerCollectionName);
        private IMongoCollection<User> UserCollection => _dbContextProvider.GetCollection<User>("Users");
        private readonly IDbContextProvider _dbContextProvider;
        private readonly IBlocksSecret _blocksSecret;
        private readonly IOsDataAccess _dataAccess;

        public MigrationRepository(IDbContextProvider dbContextProvider, IBlocksSecret blocksSecret, IOsDataAccess dataAccess)
        {
            _dbContextProvider = dbContextProvider;
            _blocksSecret = blocksSecret;
            _dataAccess = dataAccess;
        }

        public async Task<string> CreateMigrationTrackerAsync(MigrationTracker migrationTracker)
        {
            if (!await _dataAccess.InsertAllowedAsync(OsSchemas.MigrationTracker, "MigrationRepository.CreateMigrationTrackerAsync"))
                throw new UnauthorizedAccessException("Access to the migration tracker was denied by the data access policy.");

            await Collection.InsertOneAsync(migrationTracker);
            return migrationTracker.ItemId;
        }

        public async Task<MigrationTracker?> GetMigrationTrackerAsync(string trackerId)
        {
            var filter = Builders<MigrationTracker>.Filter.Eq(m => m.ItemId, trackerId);
            var scope = await _dataAccess.ReadAsync(OsSchemas.MigrationTracker, filter, "MigrationRepository.GetMigrationTrackerAsync");
            return scope.Granted ? await scope.Apply(Collection).FirstOrDefaultAsync() : null;
        }

        public async Task<bool> UpdateServiceStatusAsync(string trackerId, MigrationServiceNames serviceName, bool isCompleted, string? errorMessage = null)
        {
            var filter = Builders<MigrationTracker>.Filter.Eq(m => m.ItemId, trackerId);
            
            var propertyName = GetServicePropertyName(serviceName);
            var update = Builders<MigrationTracker>.Update
                .Set($"{propertyName}.IsCompleted", isCompleted)
                .Set($"{propertyName}.CompletedAt", isCompleted ? DateTime.UtcNow : (DateTime?)null)
                .Set($"{propertyName}.ErrorMessage", errorMessage)
                .Set(m => m.LastUpdatedDate, DateTime.UtcNow);

            var editFilter = await _dataAccess.EditFilterAsync(OsSchemas.MigrationTracker, filter, "MigrationRepository.UpdateServiceStatusAsync");
            if (editFilter is null)
            {
                return false;
            }

            var result = await Collection.UpdateOneAsync(editFilter, update);
            return result.ModifiedCount > 0;
        }

        public async Task<List<MigrationTracker>> GetMigrationsByProjectKeysAsync(List<string> projectKeys)
        {
            var filter = Builders<MigrationTracker>.Filter.Or(
                Builders<MigrationTracker>.Filter.In(m => m.ProjectKey, projectKeys),
                Builders<MigrationTracker>.Filter.In(m => m.TargetedProjectKey, projectKeys)
            );

            var trackers = await Collection.Find(filter)
                .SortByDescending(m => m.CreatedDate)
                .ToListAsync();

            // Filter to only include trackers with at least one incomplete service
            return trackers.Where(HasIncompleteServices).ToList();
        }

        public async Task<List<MigrationTracker>> GetMigrationsByTenantGroupIdAsync(string tenantGroupId)
        {
            var filter = Builders<MigrationTracker>.Filter.Eq(m => m.TenantGroupId, tenantGroupId);

            var scope = await _dataAccess.ReadAsync(OsSchemas.MigrationTracker, filter, "MigrationRepository.GetMigrationsByTenantGroupIdAsync");
            if (!scope.Granted)
            {
                return new List<MigrationTracker>();
            }

            var trackers = await scope.Apply(Collection)
                .SortByDescending(m => m.CreatedDate)
                .ToListAsync();

            // Filter to only include trackers with at least one incomplete service
            return trackers.Where(HasIncompleteServices).ToList();
        }

        private static string GetServicePropertyName(MigrationServiceNames serviceName)
        {
            return serviceName switch
            {
                MigrationServiceNames.Authentication => nameof(MigrationTracker.Authentication),
                MigrationServiceNames.IAM => nameof(MigrationTracker.IAM),
                MigrationServiceNames.MFA => nameof(MigrationTracker.MFA),
                MigrationServiceNames.CAPTCHA => nameof(MigrationTracker.CAPTCHA),
                MigrationServiceNames.Email => nameof(MigrationTracker.Email),
                MigrationServiceNames.DataGateway => nameof(MigrationTracker.DataGateway),
                MigrationServiceNames.Notifications => nameof(MigrationTracker.Notifications),
                MigrationServiceNames.Storage => nameof(MigrationTracker.Storage),
                MigrationServiceNames.Language => nameof(MigrationTracker.LanguageService),
                _ => throw new ArgumentException($"Unknown service name: {serviceName}")
            };
        }

        private static bool HasIncompleteServices(MigrationTracker tracker)
        {
            return (tracker.Authentication != null && !tracker.Authentication.IsCompleted) ||
                   (tracker.IAM != null && !tracker.IAM.IsCompleted) ||
                   (tracker.MFA != null && !tracker.MFA.IsCompleted) ||
                   (tracker.CAPTCHA != null && !tracker.CAPTCHA.IsCompleted) ||
                   (tracker.Email != null && !tracker.Email.IsCompleted) ||
                   (tracker.DataGateway != null && !tracker.DataGateway.IsCompleted) ||
                   (tracker.Notifications != null && !tracker.Notifications.IsCompleted) ||
                   (tracker.Storage != null && !tracker.Storage.IsCompleted) ||
                   (tracker.LanguageService != null && !tracker.LanguageService.IsCompleted);
        }

        public async Task<(int totalDocuments, int migratedDocuments)> MigrateCollectionAsync(string sourceProjectKey, string targetProjectKey,
            string collectionName, bool shouldOverwriteExistingData)
        {
            // Get source database and collection
            var sourceDatabase = _dbContextProvider.GetDatabase(sourceProjectKey);
            var sourceCollection = sourceDatabase.GetCollection<BsonDocument>(collectionName);

            // Get target database and collection
            var targetDatabase = _dbContextProvider.GetDatabase(targetProjectKey);
            var targetCollection = targetDatabase.GetCollection<BsonDocument>(collectionName);

            // Check if source collection has any documents
            var sourceCount = await sourceCollection.CountDocumentsAsync(new BsonDocument());
            if (sourceCount == 0)
            {
                return (0, 0); // No data to migrate
            }

            var totalDocuments = (int)sourceCount;

            var totalProcessed = shouldOverwriteExistingData
                ? await ReplaceAllDocumentsAsync(sourceCollection, targetCollection)
                : await InsertMissingDocumentsAsync(sourceCollection, targetCollection);

            return (totalDocuments, totalProcessed);
        }

        private static async Task<int> ReplaceAllDocumentsAsync(IMongoCollection<BsonDocument> sourceCollection,
            IMongoCollection<BsonDocument> targetCollection)
        {
            var totalProcessed = 0;

            // Process documents in batches for upsert operations
            using var cursor = await sourceCollection.FindAsync(new BsonDocument());

            while (await cursor.MoveNextAsync())
            {
                var batch = cursor.Current.Take(MigrationBatchSize).ToList();
                if (!batch.Any()) break;

                var bulkOps = batch.Select(document =>
                    new ReplaceOneModel<BsonDocument>(
                        Builders<BsonDocument>.Filter.Eq("_id", document["_id"]),
                        document)
                    {
                        IsUpsert = true
                    } as WriteModel<BsonDocument>).ToList();

                if (bulkOps.Any())
                {
                    await targetCollection.BulkWriteAsync(bulkOps, new BulkWriteOptions { IsOrdered = false });
                    totalProcessed += bulkOps.Count;
                }
            }

            return totalProcessed;
        }

        private static async Task<int> InsertMissingDocumentsAsync(IMongoCollection<BsonDocument> sourceCollection,
            IMongoCollection<BsonDocument> targetCollection)
        {
            var totalProcessed = 0;

            // Insert-only mode using UpdateOneModel with $setOnInsert
            // This approach is more explicit and avoids exceptions
            using var cursor = await sourceCollection.FindAsync(new BsonDocument());

            while (await cursor.MoveNextAsync())
            {
                var batch = cursor.Current.Take(MigrationBatchSize).ToList();
                if (!batch.Any()) break;

                var bulkOps = batch.Select(BuildSetOnInsertModel).ToList();

                if (bulkOps.Any())
                {
                    var bulkResult = await targetCollection.BulkWriteAsync(bulkOps, new BulkWriteOptions { IsOrdered = false });
                    totalProcessed += bulkResult.Upserts.Count; // Count actual upserts (inserts in this case)
                }
            }

            return totalProcessed;
        }

        private static UpdateOneModel<BsonDocument> BuildSetOnInsertModel(BsonDocument document)
        {
            var filter = Builders<BsonDocument>.Filter.Eq("_id", document["_id"]);

            // Build update with $setOnInsert for all fields
            var updateBuilder = Builders<BsonDocument>.Update;
            UpdateDefinition<BsonDocument>? update = null;

            foreach (var element in document.Elements)
            {
                if (update == null)
                    update = updateBuilder.SetOnInsert(element.Name, element.Value);
                else
                    update = update.SetOnInsert(element.Name, element.Value);
            }

            return new UpdateOneModel<BsonDocument>(filter, update!) { IsUpsert = true };
        }

        public async Task<bool> CleanupCollectionAsync(string projectKey, string collectionName)
        {
            try
            {
                var database = _dbContextProvider.GetDatabase(projectKey);
                var collection = database.GetCollection<BsonDocument>(collectionName);

                var deleteResult = await collection.DeleteManyAsync(new BsonDocument());
                return deleteResult.IsAcknowledged;
            }
            catch (Exception ex)
            {
                // Log the exception as needed
                Console.WriteLine($"Error during cleanup: {ex.Message}");
                return false;
            }
        }

        public async Task<bool>  MigrateDocumentsAsync(string targetProjectKey, string collectionName)
        {
            try
            {
                var sourceDatabase = _dbContextProvider.GetDatabase(_blocksSecret.DatabaseConnectionString, "BlocksConfiguration");
                var targetDatabase = _dbContextProvider.GetDatabase(targetProjectKey);

                await CopyDocumentAsync(sourceDatabase, targetDatabase, collectionName);
                return true;
            }
            catch (Exception ex)
            {
                // Log the exception as needed
                Console.WriteLine($"Error during document migration: {ex.Message}");
                return false;
            }
        }
        private async Task CopyDocumentAsync(IMongoDatabase sourceDb, IMongoDatabase targetDb, string collectionName)
        {
            var sourceCollection = sourceDb.GetCollection<BsonDocument>(collectionName);
            var targetCollection = targetDb.GetCollection<BsonDocument>(collectionName);

            var sourceCount = await sourceCollection.CountDocumentsAsync(new BsonDocument());
            if (sourceCount == 0)
            {
                return;
            }

            const int batchSize = 1000;
            using var cursor = await sourceCollection.FindAsync(new BsonDocument());

            while (await cursor.MoveNextAsync())
            {
                var batch = cursor.Current.Take(batchSize).ToList();
                if (!batch.Any()) break;

                await targetCollection.InsertManyAsync(batch, new InsertManyOptions { IsOrdered = false });
            }
        }
       public async Task<User> GetUserByIdAsync ( string itemId )
       {
          return await UserCollection.Find(x => x.ItemId == itemId).FirstOrDefaultAsync();
       }
  }
}
