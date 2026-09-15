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
            await GetServiceNamesWithPrefixAsync(Constants.BlocksServiceNamePrefix, startDate, endDate,
                "Failed to get distinct blocks service names");

        public async Task<List<string>> GetDistinctManagedServiceNamesAsync(DateTime startDate, DateTime endDate) =>
            await GetServiceNamesWithPrefixAsync(Constants.ManagedServiceNamePrefix, startDate, endDate,
                "Failed to get distinct managed service names");

        private async Task<List<string>> GetServiceNamesWithPrefixAsync(string prefix, DateTime startDate, DateTime endDate, string errorMessage)
        {
            try
            {
                var filter = new BsonDocument("name", new BsonRegularExpression($"^{prefix}", "i"));
                return await _database.GetCollectionNamesWithDataAsync(filter, startDate, endDate);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, errorMessage);
                return [];
            }
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

        public async Task<Dictionary<string, List<StoredLog>>> GetLogsByServiceGroupedByTenantAsync(
            string serviceName,
            TenantLogsRequest query,
            int pageNumber,
            int pageSize)
        {
            if (string.IsNullOrWhiteSpace(serviceName))
                return [];

            var collection = _database.GetCollection<BsonDocument>(serviceName);
            var filter = BuildDateFilter(query);
            filter &= Builders<BsonDocument>.Filter.Nin(TenantIdField, Constants.IgnoredTenants);
            filter &= Builders<BsonDocument>.Filter.Nin(ServiceNameField, Constants.IgnoredServices);

            var sort = Builders<BsonDocument>.Sort.Descending(Constants.Timestamp);
            var projection = BuildStoredLogProjection();

            try
            {
                var aggregateOptions = new AggregateOptions { AllowDiskUse = true };

                var groupedDocs = await collection.Aggregate(aggregateOptions)
                    .Match(filter)
                    .Sort(sort)
                    .Project(projection)
                    .Skip(pageNumber * pageSize)
                    .Limit(pageSize)
                    .Group(new BsonDocument
                    {
                                { "_id", "$TenantId" },
                                { "Logs", new BsonDocument("$push", "$$ROOT") }
                    })
                    .ToListAsync();

                return groupedDocs
                    .Select(doc =>
                    {
                        var id = doc.GetValue("_id", BsonNull.Value);
                        string tenantId;

                        if (id.IsString)
                        {
                            tenantId = id.AsString;
                        }
                        else if (id.IsBsonNull)
                        {
                            tenantId = string.Empty;
                        }
                        else
                        {
                            tenantId = id.ToString();
                        }

                        return new
                        {
                            TenantId = tenantId,
                            Logs = doc.GetValue("Logs", new BsonArray()).AsBsonArray
                        };
                    })
                    .Where(x => !string.IsNullOrWhiteSpace(x.TenantId) && x.Logs.Count > 0)
                    .ToDictionary(
                        x => x.TenantId!,
                        x => x.Logs
                            .Select(l => MapStoredLog(l.AsBsonDocument))
                            .ToList(),
                        StringComparer.OrdinalIgnoreCase);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get logs for service {ServiceName}", serviceName);
                return [];
            }
        }

        public async Task<(List<StoredLog> Logs, string? TenantId)> GetLogsByServiceAsync(
            string serviceName,
            TenantLogsRequest query)
        {
            if (string.IsNullOrWhiteSpace(serviceName))
                return ([], null);

            var collection = _database.GetCollection<BsonDocument>(serviceName);
            var filter = BuildDateFilter(query);
            var sort = Builders<BsonDocument>.Sort.Descending(Constants.Timestamp);
            var projection = BuildStoredLogWithTenantProjection();

            try
            {
                var docs = await collection.Find(filter)
                    .Sort(sort)
                    .Project(projection)
                    .ToListAsync();

                if (docs.Count == 0)
                    return ([], null);

                var firstDoc = docs[0];
                var tenantId = firstDoc.GetValue(TenantIdField, BsonNull.Value).IsBsonNull
                    ? null
                    : firstDoc[TenantIdField].AsString;

                var logs = docs
                    .Select(doc => MapStoredLog(doc))
                    .ToList();

                return (logs, tenantId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get logs for managed service {ServiceName}", serviceName);
                return ([], null);
            }
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
            var collectionName = $"{query.ProjectKey}_{startDate:yyyyMMdd}_{endDate:yyyyMMdd}";

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

        public async Task<List<string>> GetArchiveCollectionsAsync()
        {
            try
            {
                return await _archiveDatabase.GetArchiveCollectionsAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to list collections from LogsArchive database");
                return [];
            }
        }

        public async Task<List<StoredLog>> GetLogsFromArchiveCollectionAsync(string collectionName)
        {
            try
            {
                var collection = _archiveDatabase.GetCollection<StoredLog>(collectionName);
                return await collection
                    .Find(FilterDefinition<StoredLog>.Empty)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get logs from archive collection {CollectionName}", collectionName);
                return [];
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
