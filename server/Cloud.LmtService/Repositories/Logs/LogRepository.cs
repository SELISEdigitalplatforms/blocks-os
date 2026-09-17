using Blocks.Genesis;
using Cloud.LmtService.Models.ArchiveAndDelete;
using Cloud.LmtService.Models.Logs;
using Cloud.LmtService.Utilities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text;

namespace Cloud.LmtService.Repositories.Logs
{
    public class LogRepository : ILogRepository
    {
        private readonly IMongoDatabase _database;
        private readonly IMongoDatabase _archiveDatabase;
        private readonly ILogger<LogRepository> _logger;
        private const string FailedArchiveLogsCollection = "FailedArchiveLogs";
        private const string LogsArchiveDatabaseName = "LogsArchive";
        private const string TenantIdField = "TenantId";
        private const string MessageField = "Message";
        private const string TraceIdField = "TraceId";
        private const string SpanIdField = "SpanId";
        private const string LevelField = "Level";
        private const string ServiceNameField = "ServiceName";

        public LogRepository(IBlocksSecret blocksSecret, IDbContextProvider dbContextProvider, ILogger<LogRepository> logger, IConfiguration configuration)
        {
            _database = dbContextProvider.GetDatabase(blocksSecret.LogConnectionString, blocksSecret.LogDatabaseName);
            _archiveDatabase = dbContextProvider.GetDatabase(blocksSecret.LogConnectionString, LogsArchiveDatabaseName);
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        private static List<string> GetServiceNames(string? serviceName, IEnumerable<string>? serviceNames)
        {
            var names = serviceNames?
                .Where(name => !string.IsNullOrWhiteSpace(name))
                .Select(name => name.Trim())
                .ToList() ?? [];

            if (!names.Any() && !string.IsNullOrWhiteSpace(serviceName))
                names.Add(serviceName.Trim());

            return names.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        }

        private async Task<(List<LogProjection> Logs, long Count)> QueryCollectionAsync(
            string serviceName,
            FilterDefinition<BsonDocument> filter,
            int limit,
            int skip = 0)
        {
            var collection = _database.GetCollection<BsonDocument>(serviceName);
            var sort = Builders<BsonDocument>.Sort.Descending("Timestamp");
            var projection = Builders<BsonDocument>.Projection.As<LogProjection>();

            var countTask = collection.CountDocumentsAsync(filter);
            var logsTask = collection.Find(filter)
                .Sort(sort)
                .Project(projection)
                .Limit(limit)
                .Skip(skip)
                .ToListAsync();

            await Task.WhenAll(countTask, logsTask);

            return (logsTask.Result, countTask.Result);
        }

        public async Task<IQueryable<LogProjection>> GetLogs(LiveLogRequest query)
        {
            var bc = BlocksContext.GetContext();
            // Timestamps are stored in UTC. Mongo's DateTimeSerializer calls ToUniversalTime()
            // on serialize, so a Kind.Unspecified value (any caller that omits the trailing 'Z')
            // would be read as server-local and shift the window. LogTimeRange.AsUtc pins the
            // contract: unmarked input is UTC, not server-local.
            var filter = Builders<BsonDocument>.Filter.Eq("TenantId", bc?.TenantId)
                & Builders<BsonDocument>.Filter.Gt("Timestamp", LogTimeRange.AsUtc(query.LastDate));
            var serviceNames = GetServiceNames(query.Name, query.ServiceNames);
            var logTasks = serviceNames.Select(serviceName =>
                QueryCollectionAsync(serviceName, filter, int.MaxValue));

            var logs = await Task.WhenAll(logTasks);

            var liveLogs = logs
                .SelectMany(result => result.Logs)
                .OrderByDescending(log => log.Timestamp)
                .ToList();

            // Stack traces are withheld from the live tail on purpose. This query runs with no
            // result limit and the client polls it every few seconds, so carrying kilobyte-sized
            // traces here would dwarf every other response in the module. The paged endpoints
            // (GetLogs / GetLogsByDate) return the trace, and that is where the UI expands it.
            foreach (var log in liveLogs)
            {
                log.Exception = string.Empty;
            }

            return liveLogs.AsQueryable();
        }

        public async Task<(IQueryable<LogProjection>, long)> GetLogs(GetLogsRequest query)
        {
            var bc = BlocksContext.GetContext();
            var filter = Builders<BsonDocument>.Filter.Eq("TenantId", bc?.TenantId);

            if (!string.IsNullOrWhiteSpace(query.Search))
            {
                var regex = new BsonRegularExpression(query.Search, "i");
                filter &= Builders<BsonDocument>.Filter.Regex("Message", regex);
            }

            if (!string.IsNullOrWhiteSpace(query.Filter?.TraceId))
                filter &= Builders<BsonDocument>.Filter.Eq("TraceId", query.Filter.TraceId);

            if (!string.IsNullOrWhiteSpace(query.Filter?.SpanId))
                filter &= Builders<BsonDocument>.Filter.Eq("SpanId", query.Filter.SpanId);

            if (!string.IsNullOrWhiteSpace(query.Filter?.Level))
                filter &= Builders<BsonDocument>.Filter.Eq("Level", query.Filter.Level);

            // See the note in GetLogs(LiveLogRequest): unmarked (Kind.Unspecified) dates must be
            // read as UTC, otherwise Mongo's serializer shifts them by the server's offset.
            if (query.Filter?.StartDate != null)
                filter &= Builders<BsonDocument>.Filter.Gt("Timestamp", LogTimeRange.AsUtc(query.Filter.StartDate));

            if (query.Filter?.EndDate != null)
                filter &= Builders<BsonDocument>.Filter.Lte("Timestamp", LogTimeRange.AsUtc(query.Filter.EndDate));

            var serviceNames = GetServiceNames(query.ServiceName, query.ServiceNames);
            var page = Math.Max(query.Page, 0);
            var pageSize = Math.Max(query.PageSize, 1);
            var collectionLimit = pageSize * (page + 1);
            var logTasks = serviceNames.Select(serviceName =>
                QueryCollectionAsync(serviceName, filter, collectionLimit));

            var results = await Task.WhenAll(logTasks);
            var logs = results
                .SelectMany(result => result.Logs)
                .OrderByDescending(log => log.Timestamp)
                .Skip(pageSize * page)
                .Take(pageSize);

            return (logs.AsQueryable(), results.Sum(result => result.Count));
        }

        public async Task<(IQueryable<LogProjection>, long)> GetLogs(LogsByDateRequest request)
        {
            var bc = BlocksContext.GetContext();
            var filter = Builders<BsonDocument>.Filter.Eq("TenantId", bc?.TenantId);

            if (!string.IsNullOrWhiteSpace(request.Search))
            {
                var regex = new BsonRegularExpression(request.Search, "i");
                filter &= Builders<BsonDocument>.Filter.Regex("Message", regex);
            }

            if (!string.IsNullOrWhiteSpace(request.Filter?.TraceId))
                filter &= Builders<BsonDocument>.Filter.Eq("TraceId", request.Filter.TraceId);

            if (!string.IsNullOrWhiteSpace(request.Filter?.SpanId))
                filter &= Builders<BsonDocument>.Filter.Eq("SpanId", request.Filter.SpanId);

            if (!string.IsNullOrWhiteSpace(request.Filter?.Level))
                filter &= Builders<BsonDocument>.Filter.Eq("Level", request.Filter.Level);

            // See the note in GetLogs(LiveLogRequest): unmarked (Kind.Unspecified) dates must be
            // read as UTC, otherwise Mongo's serializer shifts them by the server's offset.
            if (request.Filter?.StartDate != null)
                filter &= Builders<BsonDocument>.Filter.Gte("Timestamp", LogTimeRange.AsUtc(request.Filter.StartDate));

            if (request.Filter?.EndDate != null)
                filter &= Builders<BsonDocument>.Filter.Lt("Timestamp", LogTimeRange.AsUtc(request.Filter.EndDate));

            var serviceNames = GetServiceNames(request.ServiceName, request.ServiceNames);
            var pageSize = Math.Max(request.PageSize, 1);
            var logTasks = serviceNames.Select(serviceName =>
                QueryCollectionAsync(serviceName, filter, pageSize));

            var results = await Task.WhenAll(logTasks);
            var logs = results
                .SelectMany(result => result.Logs)
                .OrderByDescending(log => log.Timestamp)
                .Take(pageSize);

            return (logs.AsQueryable(), results.Sum(result => result.Count));
        }

        // ── Archive/backup methods ───────────────────────────────────────────────

        public async Task<List<string>> GetDistinctBlocksServiceNamesAsync(DateTime startDate, DateTime endDate) =>
            await GetServiceNamesWithPrefixAsync(Constants.BlocksServiceNamePrefix, startDate, endDate);

        public async Task<List<string>> GetDistinctManagedServiceNamesAsync(DateTime startDate, DateTime endDate) =>
            await GetServiceNamesWithPrefixAsync(Constants.ManagedServiceNamePrefix, startDate, endDate);

        /// <summary>
        /// Lists the service collections holding logs in the window.
        /// <para>
        /// Failures are not swallowed: a single unreadable collection is already skipped inside
        /// <see cref="MongoDatabaseExtensions.GetCollectionNamesWithDataAsync"/>, so anything that
        /// reaches here means the enumeration itself failed. Reporting that as an empty list let the
        /// job complete "successfully" having backed up nothing.
        /// </para>
        /// </summary>
        private async Task<List<string>> GetServiceNamesWithPrefixAsync(string prefix, DateTime startDate, DateTime endDate)
        {
            var filter = new BsonDocument("name", new BsonRegularExpression($"^{prefix}", "i"));
            return await _database.GetCollectionNamesWithDataAsync(filter, startDate, endDate, _logger);
        }

        public async Task<Dictionary<string, List<StoredLog>>> GetLogsByServiceAndTenantBatchAsync(
            string serviceName,
            List<string> tenantIds,
            TenantLogsRequest query)
        {
            if (string.IsNullOrWhiteSpace(serviceName) || tenantIds == null || tenantIds.Count == 0)
                return [];

            var collection = _database.GetCollection<BsonDocument>(serviceName);
            var filter = Builders<BsonDocument>.Filter.In(TenantIdField, tenantIds);
            filter &= BuildDateFilter(query);

            var sort = Builders<BsonDocument>.Sort.Descending(Constants.Timestamp);
            var projection = BuildStoredLogProjection();

            try
            {
                var docs = await collection.Find(filter)
                    .Sort(sort)
                    .Project(projection)
                    .ToListAsync();

                return docs
                    .GroupBy(doc => doc.GetValue(TenantIdField, BsonNull.Value).IsBsonNull ? string.Empty : doc[TenantIdField].AsString)
                    .Where(g => !string.IsNullOrWhiteSpace(g.Key))
                    .ToDictionary(
                        g => g.Key,
                        g => g.Select(doc => MapStoredLog(doc)).ToList(),
                        StringComparer.OrdinalIgnoreCase);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get logs for service {ServiceName} with tenant batch", serviceName);
                return [];
            }
        }

        /// <summary>
        /// Streams a blocks service's logs for the window, excluding the tenants and services the
        /// backup has always ignored. Batched off one cursor rather than paged with Skip: the old
        /// paged read deleted between pages, so the moving offset silently skipped logs.
        /// </summary>
        public IAsyncEnumerable<List<StoredLog>> StreamBlocksServiceLogsAsync(
            string serviceName,
            TenantLogsRequest query,
            int batchSize,
            CancellationToken ct = default)
        {
            var filter = BuildDateFilter(query)
                & Builders<BsonDocument>.Filter.Nin(TenantIdField, Constants.IgnoredTenants)
                & Builders<BsonDocument>.Filter.Nin(ServiceNameField, Constants.IgnoredServices);

            return StreamServiceLogsAsync(serviceName, filter, batchSize, ct);
        }

        /// <summary>
        /// Streams a managed service's logs for the window. Managed services keep their own filter
        /// rules - they are not subject to the ignore lists the blocks services use - but they now
        /// read the same projection, so the six fields the narrower managed projection used to drop
        /// (ActionName, EnvironmentName, ParentId, RequestPath, Exception, ParentSpanId) reach the
        /// archive instead of being backed up blank.
        /// </summary>
        public IAsyncEnumerable<List<StoredLog>> StreamManagedServiceLogsAsync(
            string serviceName,
            TenantLogsRequest query,
            int batchSize,
            CancellationToken ct = default)
            => StreamServiceLogsAsync(serviceName, BuildDateFilter(query), batchSize, ct);

        private async IAsyncEnumerable<List<StoredLog>> StreamServiceLogsAsync(
            string serviceName,
            FilterDefinition<BsonDocument> filter,
            int batchSize,
            [EnumeratorCancellation] CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(serviceName) || batchSize <= 0)
                yield break;

            var collection = _database.GetCollection<BsonDocument>(serviceName);
            var options = new FindOptions<BsonDocument, BsonDocument>
            {
                Projection = BuildStoredLogProjection(),
                Sort = Builders<BsonDocument>.Sort.Descending(Constants.Timestamp),
                BatchSize = batchSize
            };

            using var cursor = await collection.FindAsync(filter, options, ct);

            var buffer = new List<StoredLog>(batchSize);

            while (await cursor.MoveNextAsync(ct))
            {
                foreach (var doc in cursor.Current)
                {
                    buffer.Add(MapStoredLog(doc));

                    if (buffer.Count < batchSize) continue;

                    yield return buffer;
                    buffer = new List<StoredLog>(batchSize);
                }
            }

            if (buffer.Count > 0)
                yield return buffer;
        }

        /// <summary>
        /// Streams an archive collection in batches. Read failures propagate so the caller can tell
        /// an empty collection from one it simply could not read.
        /// </summary>
        public async IAsyncEnumerable<List<StoredLog>> StreamLogsFromArchiveCollectionAsync(
            string collectionName,
            int batchSize,
            [EnumeratorCancellation] CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(collectionName) || batchSize <= 0)
                yield break;

            var collection = _archiveDatabase.GetCollection<StoredLog>(collectionName);
            var options = new FindOptions<StoredLog, StoredLog> { BatchSize = batchSize };

            using var cursor = await collection.FindAsync(FilterDefinition<StoredLog>.Empty, options, ct);

            var buffer = new List<StoredLog>(batchSize);

            while (await cursor.MoveNextAsync(ct))
            {
                foreach (var log in cursor.Current)
                {
                    buffer.Add(log);

                    if (buffer.Count < batchSize) continue;

                    yield return buffer;
                    buffer = new List<StoredLog>(batchSize);
                }
            }

            if (buffer.Count > 0)
                yield return buffer;
        }

        public async Task<long> DeleteLogsByServiceAndTenantAsync(string serviceName, TenantLogsRequest query, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(serviceName) || string.IsNullOrWhiteSpace(query.ProjectKey))
                return 0;

            var collection = _database.GetCollection<BsonDocument>(serviceName);
            var filter = Builders<BsonDocument>.Filter.Eq(TenantIdField, query.ProjectKey);
            filter &= BuildDateFilter(query);

            try
            {
                var deleteResult = await collection.DeleteManyAsync(filter, ct);
                return deleteResult.DeletedCount;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to delete logs for service {ServiceName}, tenant {TenantId}", serviceName, query.ProjectKey);
                return 0;
            }
        }

        public async Task ArchiveLogsAsync(List<StoredLog> logs, TenantLogsRequest query)
        {
            if (logs == null || logs.Count == 0 || string.IsNullOrWhiteSpace(query.ProjectKey)) return;

            var startDate = query.Filter?.StartDate ?? DateTime.MinValue;
            var endDate = query.Filter?.EndDate ?? DateTime.MinValue;
            var collectionName = ArchiveCollectionNaming.Build(query.ProjectKey, startDate, endDate);

            try
            {
                var collection = _archiveDatabase.GetCollection<StoredLog>(collectionName);
                await collection.InsertManyAsync(logs);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to archive logs for tenant {TenantId} to collection {CollectionName}", query.ProjectKey, collectionName);
                throw new InvalidOperationException(
                    $"Failed to archive logs for tenant {query.ProjectKey} to collection {collectionName}",
                    ex);
            }
        }

        /// <summary>
        /// Lists the archive collections awaiting upload.
        /// <para>
        /// Failures are not swallowed. This list drives the whole blob-upload phase, including the
        /// retry of collections carried over from earlier runs whose upload had not succeeded yet.
        /// Reporting a failure as an empty list skipped all of that silently and still let the job
        /// finish as Completed.
        /// </para>
        /// </summary>
        public async Task<List<string>> GetArchiveCollectionsAsync()
        {
            return await _archiveDatabase.GetArchiveCollectionsAsync();
        }

        /// <summary>
        /// Removes one service's rows from a tenant's archive collection.
        /// <para>
        /// Used to discard a partial archive when a service's write fails part-way. The collection
        /// cannot simply be dropped: every service archiving that tenant shares it, and the others
        /// may have written successfully.
        /// </para>
        /// </summary>
        public async Task DeleteArchivedLogsByServiceAsync(string collectionName, string serviceName)
        {
            if (string.IsNullOrWhiteSpace(collectionName) || string.IsNullOrWhiteSpace(serviceName))
                return;

            try
            {
                var collection = _archiveDatabase.GetCollection<StoredLog>(collectionName);
                var filter = Builders<StoredLog>.Filter.Eq(log => log.ServiceName, serviceName);

                var result = await collection.DeleteManyAsync(filter);

                _logger.LogWarning(
                    "Discarded {Count} partially archived log(s) for service {ServiceName} from {CollectionName}",
                    result.DeletedCount, serviceName, collectionName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to discard partial archive for service {ServiceName} in {CollectionName}",
                    serviceName, collectionName);
            }
        }

        public async Task DeleteArchiveCollectionAsync(string collectionName)
        {
            try
            {
                await _archiveDatabase.DropCollectionAsync(collectionName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to drop archive collection {CollectionName}", collectionName);
            }
        }

        public async Task DeleteMiscellaneousLogsCollectionAsync(string collectionName)
        {
            if (string.IsNullOrWhiteSpace(collectionName))
                return;

            try
            {
                var collections = await _database.ListCollectionNames().ToListAsync();
                if (!collections.Contains(collectionName))
                    return;

                await _database.DropCollectionAsync(collectionName);

                _logger.LogInformation(
                    "Successfully deleted collection {CollectionName}",
                    collectionName);
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Failed to delete traces for collection {CollectionName}",
                    collectionName);
            }
        }

        public async Task SaveFailedArchiveLogsAsync(string serviceName, List<StoredLog> logs, string failureReason, DateTime processStartDate, DateTime processEndDate)
        {
            if (logs == null || logs.Count == 0)
                return;

            try
            {
                await EnsureCollectionExistsAsync(FailedArchiveLogsCollection);
                var collection = _database.GetCollection<FailedArchiveLog>(FailedArchiveLogsCollection);

                var failedLogs = logs
                    .Select(log => FailedArchiveLog.FromStoredLog(log, serviceName, failureReason, processStartDate, processEndDate))
                    .ToList();

                await collection.InsertManyAsync(failedLogs);
                _logger.LogInformation("Saved {Count} failed archive logs for service {ServiceName}", logs.Count, serviceName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to save failed archive logs for service {ServiceName}", serviceName);
            }
        }

        private async Task EnsureCollectionExistsAsync(string collectionName)
        {
            var filter = new BsonDocument("name", collectionName);
            using var cursor = await _database.ListCollectionsAsync(new ListCollectionsOptions { Filter = filter });

            if (!await cursor.AnyAsync())
            {
                await _database.CreateCollectionAsync(collectionName);
                _logger.LogInformation("Created collection {CollectionName} in Logs database", collectionName);
            }
        }

        private static FilterDefinition<BsonDocument> BuildDateFilter(TenantLogsRequest query)
        {
            var filter = Builders<BsonDocument>.Filter.Empty;

            if (query.Filter?.StartDate != null)
                filter &= Builders<BsonDocument>.Filter.Gt(Constants.Timestamp, query.Filter.StartDate);

            if (query.Filter?.EndDate != null)
                filter &= Builders<BsonDocument>.Filter.Lte(Constants.Timestamp, query.Filter.EndDate);

            return filter;
        }

        private static ProjectionDefinition<BsonDocument> BuildStoredLogWithTenantProjection()
        {
            return Builders<BsonDocument>.Projection
                .Include(TenantIdField)
                .Include(Constants.Timestamp)
                .Include(LevelField)
                .Include(MessageField)
                .Include(TraceIdField)
                .Include(SpanIdField)
                .Include(ServiceNameField);
        }

        private static ProjectionDefinition<BsonDocument> BuildStoredLogProjection()
        {
            return Builders<BsonDocument>.Projection
                .Include(Constants.Timestamp)
                .Include("ActionName")
                    .Include(TraceIdField)
                .Include("EnvironmentName")
                .Include("ParentId")
                .Include("RequestPath")
                .Include("Exception")
                    .Include(MessageField)
                .Include("ParentSpanId")
                    .Include(SpanIdField)
                    .Include(LevelField)
                    .Include(ServiceNameField)
                    .Include(TenantIdField);
        }

        private static StoredLog MapStoredLog(BsonDocument doc)
        {
            return new StoredLog
            {
                Timestamp = GetBsonValueAsString(doc, "Timestamp"),
                ActionName = doc.GetValue("ActionName", BsonNull.Value).IsBsonNull ? string.Empty : doc["ActionName"].AsString,
                TraceId = doc.GetValue(TraceIdField, BsonNull.Value).IsBsonNull ? string.Empty : doc[TraceIdField].AsString,
                EnvironmentName = doc.GetValue("EnvironmentName", BsonNull.Value).IsBsonNull ? string.Empty : doc["EnvironmentName"].AsString,
                ParentId = doc.GetValue("ParentId", BsonNull.Value).IsBsonNull ? string.Empty : doc["ParentId"].AsString,
                RequestPath = doc.GetValue("RequestPath", BsonNull.Value).IsBsonNull ? string.Empty : doc["RequestPath"].AsString,
                Exception = doc.GetValue("Exception", BsonNull.Value).IsBsonNull ? string.Empty : doc["Exception"].AsString,
                Message = doc.GetValue(MessageField, BsonNull.Value).IsBsonNull ? string.Empty : doc[MessageField].AsString,
                ParentSpanId = doc.GetValue("ParentSpanId", BsonNull.Value).IsBsonNull ? string.Empty : doc["ParentSpanId"].AsString,
                SpanId = doc.GetValue(SpanIdField, BsonNull.Value).IsBsonNull ? string.Empty : doc[SpanIdField].AsString,
                Level = doc.GetValue(LevelField, BsonNull.Value).IsBsonNull ? string.Empty : doc[LevelField].AsString,
                TenantId = doc.GetValue(TenantIdField, BsonNull.Value).IsBsonNull ? string.Empty : doc[TenantIdField].AsString,
                ServiceName = doc.GetValue(ServiceNameField, BsonNull.Value).IsBsonNull ? string.Empty : doc[ServiceNameField].AsString
            };
        }

        private static string GetBsonValueAsString(BsonDocument doc, string fieldName)
        {
            var value = doc.GetValue(fieldName, BsonNull.Value);

            if (value.IsBsonNull)
                return string.Empty;

            if (value.IsBsonDateTime)
                return value.ToUniversalTime().ToString("O");

            return value.AsString;
        }
    }
}
