using Blocks.Genesis;
using Cloud.LmtService.Models.ArchiveAndDelete;
using Cloud.LmtService.Models.Trace;
using Cloud.LmtService.Utilities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;
using System;
using System.Collections.Generic;
using System.Text;

namespace Cloud.LmtService.Repositories.Trace
{
    public class TraceRepository:ITraceRepository
    {
        private readonly IMongoDatabase _database;
        private readonly IMongoDatabase _archiveDatabase;
        private readonly ILogger<TraceRepository> _logger;
        private const string FailedArchiveTracesCollection = "FailedArchiveTraces";
        private const string TracesArchiveDatabaseName = "TracesArchive";
        private const string TraceIdField = "TraceId";
        private const string ParentIdField = "ParentId";
        private const string OperationNameField = "OperationName";
        private const string ServiceNameField = "ServiceName";
        private const string TimestampField = "Timestamp";

        public TraceRepository(
            IBlocksSecret blocksSecret,
            IDbContextProvider dbContextProvider,
            ILogger<TraceRepository> logger,
            IConfiguration configuration)
        {
            _database = dbContextProvider.GetDatabase(blocksSecret.TraceConnectionString, blocksSecret.TraceDatabaseName);
            _archiveDatabase = dbContextProvider.GetDatabase(blocksSecret.TraceConnectionString, TracesArchiveDatabaseName);
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }
        public async Task<IQueryable<SingleTraceProjection>> GetTraces(GetTraceRequest query)
        {
            var bc = BlocksContext.GetContext();
            var collection = _database.GetCollection<BsonDocument>(bc?.TenantId);

            var filter = Builders<BsonDocument>.Filter.Eq("TraceId", query.TraceId);
            var projection = Builders<BsonDocument>.Projection.As<SingleTraceProjection>();

            var logs = await collection
                .Find(filter)
                .Project(projection)
                .ToListAsync();

            return logs.AsQueryable();
        }

        public async Task<(IQueryable<TraceProjection>, long)> GetTraces(GetTracesRequest query)
        {
            var bc = BlocksContext.GetContext();
            var collection = _database.GetCollection<BsonDocument>(bc.TenantId);

            var filter = Builders<BsonDocument>.Filter.Or(
                Builders<BsonDocument>.Filter.Eq("ParentId", string.Empty),
                Builders<BsonDocument>.Filter.Eq("ParentId", BsonNull.Value)
            );

            if (!string.IsNullOrWhiteSpace(query.Search))
            {
                var regex = new BsonRegularExpression(query.Search, "i");

                filter &= Builders<BsonDocument>.Filter.Or(
                          Builders<BsonDocument>.Filter.Regex("OperationName", regex),
                          Builders<BsonDocument>.Filter.Eq("TraceId", query.Search));
            }

            if (query.Filter?.Services != null && query.Filter.Services.Count > 0)
                filter &= Builders<BsonDocument>.Filter.In("ServiceName", query.Filter.Services);

            if (query.Filter?.Excepts != null && query.Filter.Excepts.Count > 0)
                filter &= Builders<BsonDocument>.Filter.Nin("ServiceName", query.Filter.Excepts);

            // See the note on LogTimeRange: unmarked (Kind.Unspecified) dates must be read as
            // UTC, otherwise Mongo's serializer shifts them by the server's offset.
            if (query.Filter?.StartDate != null)
                filter &= Builders<BsonDocument>.Filter.Gt("Timestamp", LogTimeRange.AsUtc(query.Filter.StartDate));

            if (query.Filter?.EndDate != null)
                filter &= Builders<BsonDocument>.Filter.Lte("Timestamp", LogTimeRange.AsUtc(query.Filter.EndDate));

            if (query.Filter?.StatusCodes != null && query.Filter.StatusCodes.Count > 0)
            {
                var statusCodeField = new BsonDocument("$getField", new BsonDocument
                {
                    { "field", "response.status.code" },
                    { "input", "$Attributes" }
                });

                var inArray = new BsonArray(query.Filter.StatusCodes);
                var exprFilter = new BsonDocument("$expr", new BsonDocument("$in", new BsonArray { statusCodeField, inArray }));

                filter &= new BsonDocumentFilterDefinition<BsonDocument>(exprFilter);
            }

            if (query.Filter?.StatusCodeClasses != null && query.Filter.StatusCodeClasses.Count > 0)
            {
                // $getField because the attribute key itself contains dots.
                var statusCodeField = new BsonDocument("$getField", new BsonDocument
                {
                    { "field", "response.status.code" },
                    { "input", "$Attributes" }
                });

                // Guarded by $isNumber: roots with no HTTP code at all (message-worker consumers)
                // and any code stored as a string would otherwise make $divide throw and fail the
                // whole query. Those spans resolve to null, which matches no class -- correct for
                // a filter that asks about HTTP status.
                var codeClass = new BsonDocument("$cond", new BsonArray
                {
                    new BsonDocument("$isNumber", statusCodeField),
                    new BsonDocument("$floor", new BsonDocument("$divide", new BsonArray { statusCodeField, 100 })),
                    BsonNull.Value
                });

                var classArray = new BsonArray(query.Filter.StatusCodeClasses);
                var exprFilter = new BsonDocument("$expr", new BsonDocument("$in", new BsonArray { codeClass, classArray }));

                filter &= new BsonDocumentFilterDefinition<BsonDocument>(exprFilter);
            }

            var sort = query.Sort != null
                ? (query.Sort.IsDescending
                    ? Builders<BsonDocument>.Sort.Descending(query.Sort.Property)
                    : Builders<BsonDocument>.Sort.Ascending(query.Sort.Property))
                : Builders<BsonDocument>.Sort.Descending("Timestamp");

            var projection = Builders<BsonDocument>.Projection.As<TraceProjection>();

            // Optimize: Run count and data fetch in parallel
            var tracesTask = collection.Find(filter)
                                       .Sort(sort)
                                       .Project(projection)
                                       .Limit(query.PageSize)
                                       .Skip(query.PageSize * query.Page)
                                       .ToListAsync();

            var countTask = collection.CountDocumentsAsync(filter);

            await Task.WhenAll(tracesTask, countTask);

            return (tracesTask.Result.AsQueryable(), countTask.Result);
        }

        public async Task<object> GetOperationalAnalytics(
            DateTime startTime,
            DateTime endTime,
            string serviceName,
            string? operationSearch = null)
        {
            var filter = Builders<BsonDocument>.Filter.Gte("Timestamp", startTime) &
                         Builders<BsonDocument>.Filter.Lte("Timestamp", endTime) &
                         Builders<BsonDocument>.Filter.Eq("ServiceName", serviceName);

            if (!string.IsNullOrWhiteSpace(operationSearch))
            {
                var regex = new BsonRegularExpression(operationSearch, "i");
                filter &= Builders<BsonDocument>.Filter.Regex("OperationName", regex);
            }

            return await RunAnalyticsQuery(filter, "OperationName");
        }

        public async Task<object> GetServiceAnalytics(
            DateTime startTime,
            DateTime endTime,
            string? serviceName = null)
        {
            var filter = Builders<BsonDocument>.Filter.Gte("Timestamp", startTime) &
                         Builders<BsonDocument>.Filter.Lte("Timestamp", endTime) &
                         Builders<BsonDocument>.Filter.Eq("Attributes.usage", true);

            if (!string.IsNullOrWhiteSpace(serviceName))
            {
                filter &= Builders<BsonDocument>.Filter.Eq("ServiceName", serviceName);
            }

            return await RunAnalyticsQuery(filter, "ServiceName");
        }
        private async Task<List<Dictionary<string, object>>> RunAnalyticsQuery(FilterDefinition<BsonDocument> filter, string groupBy)
        {
            var collection = GetTenantCollection();

            var statusCodeField = new BsonDocument("$toInt",
                new BsonDocument("$getField", new BsonDocument
                {
                    { "field", "response.status.code" },
                    { "input", "$Attributes" }
                })
            );

            var throughputField = new BsonDocument("$toInt", new BsonDocument("$getField", new BsonDocument
                {
                    { "field", "throughput.total.bytes" },
                    { "input", "$Attributes" }
                })
            );

            var groupStage = new BsonDocument
            {
                { "_id", $"${groupBy}" },
                { "TotalRequests", new BsonDocument("$sum", 1) },
                { "Status1xx", CreateStatusRangeSum(statusCodeField, 100, 200) },
                { "Status2xx", CreateStatusRangeSum(statusCodeField, 200, 300) },
                { "Status3xx", CreateStatusRangeSum(statusCodeField, 300, 400) },
                { "Status4xx", CreateStatusRangeSum(statusCodeField, 400, 500) },
                { "Status5xx", CreateStatusRangeSum(statusCodeField, 500, null) },

                { "TotalDuration", new BsonDocument("$sum", "$Duration") },
                { "AverageDuration", new BsonDocument("$avg", "$Duration") },
                { "PeakDuration", new BsonDocument("$max", "$Duration") },
                { "TotalThroughput", new BsonDocument("$sum", throughputField) },
                { "AverageThroughput", new BsonDocument("$avg", throughputField) }
            };

            var rawResult = await collection.Aggregate()
                .Match(filter)
                .Group(groupStage)
                .ToListAsync();

            return [.. rawResult.Select(doc => doc.ToDictionary())];
        }

        private static BsonDocument CreateStatusRangeSum(BsonDocument statusCodeField, int min, int? maxExclusive)
        {
            BsonValue condition;
            if (maxExclusive.HasValue)
            {
                condition = new BsonDocument("$and", new BsonArray
                {
                    new BsonDocument("$gte", new BsonArray { statusCodeField, min }),
                    new BsonDocument("$lt", new BsonArray { statusCodeField, maxExclusive.Value })
                });
            }
            else
            {
                condition = new BsonDocument("$gte", new BsonArray { statusCodeField, min });
            }

            return new BsonDocument("$sum", new BsonDocument("$cond", new BsonArray
            {
                condition,
                1,
                0
            }));
        }


        private IMongoCollection<BsonDocument> GetTenantCollection()
        {
            var bc = BlocksContext.GetContext();
            return _database.GetCollection<BsonDocument>(bc.TenantId);
        }

        // ── Archive/backup methods ───────────────────────────────────────────────

        public async Task<List<string>> GetDistinctTracesCollectionNamesAsync(DateTime startDate, DateTime endDate)
        {
            try
            {
                // Optimization: Filter system collections and archive failure collection at the DB level
                var collectionFilter = new BsonDocument("name", new BsonDocument
                {
                    { "$nin", new BsonArray { FailedArchiveTracesCollection } },
                    { "$not", new BsonRegularExpression("^system\\.", "i") }
                });

                var names = await _database.GetCollectionNamesWithDataAsync(collectionFilter, startDate, endDate);

                return names
                    .Where(n => !Constants.IgnoredTenants.Contains(n, StringComparer.OrdinalIgnoreCase))
                    .ToList();


            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get distinct traces collection names");
                return [];
            }
        }

        public async Task<List<StoredTrace>> GetTracesByCollectionAsync(
            string collectionName,
            TenantLogsRequest query,
            int pageNumber,
            int pageSize)
        {
            if (string.IsNullOrWhiteSpace(collectionName))
                return [];

            try
            {
                var collection = _database.GetCollection<BsonDocument>(collectionName);

                var filter = BuildDateFilter(query);
                var sort = Builders<BsonDocument>.Sort.Descending(Constants.Timestamp);
                var projection = BuildStoredTraceProjection();

                var aggregateOptions = new AggregateOptions { AllowDiskUse = true };

                var docs = await collection.Aggregate(aggregateOptions)
                    .Match(filter)
                    .Sort(sort)
                    .Skip(pageNumber * pageSize)
                    .Limit(pageSize)
                    .Project(projection)
                    .ToListAsync();

                return [.. docs.Select(doc => MapStoredTrace(doc))];
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get traces for collection {CollectionName}", collectionName);
                return [];
            }
        }
        public async Task DeleteMiscellaneousTracesCollectionAsync(string collectionName)
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

        public async Task<long> DeleteTracesByCollectionAsync(TenantLogsRequest query, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(query.ProjectKey))
                return 0;

            try
            {
                var collection = _database.GetCollection<BsonDocument>(query.ProjectKey);
                var filter = BuildDateFilter(query);

                var deleteResult = await collection.DeleteManyAsync(filter, ct);
                return deleteResult.DeletedCount;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to delete traces for collection {CollectionName}", query.ProjectKey);
                return 0;
            }
        }

        public async Task ArchiveTracesAsync(List<StoredTrace> traces, TenantLogsRequest query)
        {
            if (traces == null || traces.Count == 0 || string.IsNullOrWhiteSpace(query.ProjectKey)) return;

            var startDate = query.Filter?.StartDate ?? DateTime.MinValue;
            var endDate = query.Filter?.EndDate ?? DateTime.MinValue;
            var collectionName = $"{query.ProjectKey}_{startDate:yyyyMMdd}_{endDate:yyyyMMdd}";

            try
            {
                var collection = _archiveDatabase.GetCollection<StoredTrace>(collectionName);
                await collection.InsertManyAsync(traces);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to archive traces for tenant {TenantId} to collection {CollectionName}", query.ProjectKey, collectionName);
                throw new InvalidOperationException(
                    $"Failed to archive traces for tenant {query.ProjectKey} to collection {collectionName}",
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
                _logger.LogError(ex, "Failed to list collections from TracesArchive database");
                return [];
            }
        }

        public async Task<List<StoredTrace>> GetTracesFromArchiveCollectionAsync(string collectionName)
        {
            try
            {
                var collection = _archiveDatabase.GetCollection<StoredTrace>(collectionName);
                return await collection
                    .Find(FilterDefinition<StoredTrace>.Empty)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get traces from archive collection {CollectionName}", collectionName);
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

        private static FilterDefinition<BsonDocument> BuildDateFilter(TenantLogsRequest query)
        {
            var filter = Builders<BsonDocument>.Filter.Empty;

            if (query.Filter?.StartDate != null)
                filter &= Builders<BsonDocument>.Filter.Gt(Constants.Timestamp, query.Filter.StartDate);

            if (query.Filter?.EndDate != null)
                filter &= Builders<BsonDocument>.Filter.Lte(Constants.Timestamp, query.Filter.EndDate);

            return filter;
        }

        private static ProjectionDefinition<BsonDocument> BuildStoredTraceProjection()
        {
            return Builders<BsonDocument>.Projection
                .Include(TimestampField)
                .Include(TraceIdField)
                .Include("SpanId")
                .Include("ParentSpanId")
                .Include(ParentIdField)
                .Include(OperationNameField)
                .Include("Kind")
                .Include("StartTime")
                .Include("EndTime")
                .Include("Duration")
                .Include("Attributes")
                .Include("Baggage")
                .Include("Status")
                .Include("StatusDescription")
                .Include("TenantId")
                .Include(ServiceNameField);
        }

        private static StoredTrace MapStoredTrace(BsonDocument doc)
        {
            return new StoredTrace
            {
                Timestamp = GetBsonValueAsString(doc, TimestampField),
                StartTime = GetBsonValueAsString(doc, "StartTime"),
                EndTime = GetBsonValueAsString(doc, "EndTime"),
                TraceId = doc.GetValue(TraceIdField, BsonNull.Value).IsBsonNull ? string.Empty : doc[TraceIdField].AsString,
                SpanId = doc.GetValue("SpanId", BsonNull.Value).IsBsonNull ? string.Empty : doc["SpanId"].AsString,
                ParentSpanId = doc.GetValue("ParentSpanId", BsonNull.Value).IsBsonNull ? string.Empty : doc["ParentSpanId"].AsString,
                ParentId = doc.GetValue(ParentIdField, BsonNull.Value).IsBsonNull ? string.Empty : doc[ParentIdField].AsString,
                OperationName = doc.GetValue(OperationNameField, BsonNull.Value).IsBsonNull ? string.Empty : doc[OperationNameField].AsString,
                Kind = doc.GetValue("Kind", BsonNull.Value).IsBsonNull ? string.Empty : doc["Kind"].AsString,
                Duration = doc.GetValue("Duration", BsonNull.Value).IsBsonNull ? 0.0 : doc["Duration"].ToDouble(),
                Attributes = doc.GetValue("Attributes", BsonNull.Value).IsBsonNull ? string.Empty : doc["Attributes"].ToJson(),
                Baggage = doc.GetValue("Baggage", BsonNull.Value).IsBsonNull ? string.Empty : doc["Baggage"].ToJson(),
                Status = doc.GetValue("Status", BsonNull.Value).IsBsonNull ? string.Empty : doc["Status"].AsString,
                StatusDescription = doc.GetValue("StatusDescription", BsonNull.Value).IsBsonNull ? string.Empty : doc["StatusDescription"].AsString,
                TenantId = doc.GetValue("TenantId", BsonNull.Value).IsBsonNull ? string.Empty : doc["TenantId"].AsString,
                ServiceName = doc.GetValue(ServiceNameField, BsonNull.Value).IsBsonNull ? string.Empty : doc[ServiceNameField].AsString,
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
