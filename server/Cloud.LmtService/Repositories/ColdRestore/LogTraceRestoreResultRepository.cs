using Blocks.Genesis;
using Cloud.LmtService.Models.ColdRestore;
using Cloud.LmtService.Models.Logs;
using Cloud.LmtService.Models.Trace;
using Cloud.LmtService.Repositories.Shared;
using Cloud.LmtService.Utilities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Text;
using System.Threading.Tasks;

namespace Cloud.LmtService.Repositories.ColdRestore
{
    public class LogTraceRestoreResultRepository : ILogTraceRestoreResultRepository
    {
        private readonly IMongoDatabase _database;
        private readonly ILogger<LogTraceRestoreResultRepository> _logger;
        private readonly ILmtArchiveRestoreConfigurationRepository _lmtConfigRepository;
        private const string DefaultDatabaseName = "LogTraceRestore";
        public LogTraceRestoreResultRepository(
            IBlocksSecret blocksSecret,
            IDbContextProvider dbContextProvider,
            ILogger<LogTraceRestoreResultRepository> logger,
            ILmtArchiveRestoreConfigurationRepository lmtConfigRepository,
            IConfiguration? configuration = null)
        {

            _database = dbContextProvider.GetDatabase(blocksSecret.TraceConnectionString, DefaultDatabaseName);
            _lmtConfigRepository = lmtConfigRepository ?? throw new ArgumentNullException(nameof(lmtConfigRepository));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        private async Task<int> GetRetentionDaysAsync(CancellationToken ct = default)
        {
            var config = await _lmtConfigRepository.GetLmtArchiveRestoreConfigurationsAsync(ct);
            return config.RetentionDay;
        }

        private IMongoCollection<RestoreTraceResultRecord> GetTraceResultsCollection(string requestId)
            => _database.GetCollection<RestoreTraceResultRecord>($"Trace_{requestId}");

        private IMongoCollection<RestoreLogResultRecord> GetLogResultsCollection(string requestId)
            => _database.GetCollection<RestoreLogResultRecord>($"Logs_{requestId}");

        /// <summary>
        /// Rows to skip for a 0-based page. A page below zero can only come from a hand-edited
        /// request, and reads the first page rather than handing Mongo a negative skip.
        /// </summary>
        private static int PageSkip(int page, int pageSize) => page <= 0 ? 0 : page * PageLimit(pageSize);

        /// <summary>
        /// Rows in a page. Mongo reads Limit(0) as "no limit", so a request that omits its page
        /// size would otherwise stream a whole restore -- a week of logs -- in one response.
        /// </summary>
        private const int DefaultPageSize = 50;
        private static int PageLimit(int pageSize) => pageSize <= 0 ? DefaultPageSize : pageSize;

        // Result collections are named per request, so their indexes can only be created once the
        // request exists. Built on first insert and remembered, so a batched restore pays for this
        // once per collection rather than once per batch. Without them the UI's list query is a
        // full scan plus an in-memory sort, which trips Mongo's 32MB sort limit on a large day.
        private readonly HashSet<string> _indexedCollections = [];
        private readonly SemaphoreSlim _indexLock = new(1, 1);

        private async Task EnsureTraceIndexesAsync(IMongoCollection<RestoreTraceResultRecord> collection, CancellationToken ct)
        {
            if (!await ClaimIndexCreationAsync(collection.CollectionNamespace.FullName, ct))
                return;

            var keys = Builders<RestoreTraceResultRecord>.IndexKeys;

            await collection.Indexes.CreateManyAsync(
            [
                // GetRestoredTracesAsync: root spans for the tenant, newest first.
                new CreateIndexModel<RestoreTraceResultRecord>(
                    keys.Ascending(x => x.TenantId).Ascending(x => x.ParentId).Descending(x => x.Timestamp),
                    new CreateIndexOptions { Name = "tenant_parentId_timestamp" }),

                // GetRestoredTraceAsync: every span of one trace.
                new CreateIndexModel<RestoreTraceResultRecord>(
                    keys.Ascending(x => x.TenantId).Ascending(x => x.TraceId),
                    new CreateIndexOptions { Name = "tenant_traceId" }),

                // DeleteTraceResultsByRequestAndDateAsync, run before every file is re-streamed.
                new CreateIndexModel<RestoreTraceResultRecord>(
                    keys.Ascending(x => x.SourceDate),
                    new CreateIndexOptions { Name = "sourceDate" }),

                new CreateIndexModel<RestoreTraceResultRecord>(
                    keys.Ascending(x => x.ExpireAt),
                    new CreateIndexOptions { Name = "expireAt" })
            ], ct);
        }

        private async Task EnsureLogIndexesAsync(IMongoCollection<RestoreLogResultRecord> collection, CancellationToken ct)
        {
            if (!await ClaimIndexCreationAsync(collection.CollectionNamespace.FullName, ct))
                return;

            var keys = Builders<RestoreLogResultRecord>.IndexKeys;

            await collection.Indexes.CreateManyAsync(
            [
                new CreateIndexModel<RestoreLogResultRecord>(
                    keys.Ascending(x => x.TenantId).Descending(x => x.Timestamp),
                    new CreateIndexOptions { Name = "tenant_timestamp" }),

                // GetRestoredLogsByTraceAsync, used by the trace detail view.
                new CreateIndexModel<RestoreLogResultRecord>(
                    keys.Ascending(x => x.TenantId).Ascending(x => x.TraceId),
                    new CreateIndexOptions { Name = "tenant_traceId" }),

                new CreateIndexModel<RestoreLogResultRecord>(
                    keys.Ascending(x => x.SourceDate),
                    new CreateIndexOptions { Name = "sourceDate" }),

                new CreateIndexModel<RestoreLogResultRecord>(
                    keys.Ascending(x => x.ExpireAt),
                    new CreateIndexOptions { Name = "expireAt" })
            ], ct);
        }

        /// <summary>Returns true for the first caller to reach a given collection, false afterwards.</summary>
        private async Task<bool> ClaimIndexCreationAsync(string collectionName, CancellationToken ct)
        {
            if (_indexedCollections.Contains(collectionName))
                return false;

            await _indexLock.WaitAsync(ct);
            try
            {
                return _indexedCollections.Add(collectionName);
            }
            finally
            {
                _indexLock.Release();
            }
        }

        public async Task InsertTraceResultsAsync(
            List<RestoreTraceResultRecord> rows,
            CancellationToken ct = default)
        {
            if (rows == null || rows.Count == 0)
                return;

            try
            {
                var collection = GetTraceResultsCollection(rows[0].RequestId);
                await EnsureTraceIndexesAsync(collection, ct);
                await collection.InsertManyAsync(rows, cancellationToken: ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Failed to insert cold restore trace results for RequestId {RequestId}",
                    rows.FirstOrDefault()?.RequestId);

                throw new InvalidOperationException(
                    $"Failed to insert cold restore trace results for RequestId {rows.FirstOrDefault()?.RequestId}",
                    ex);
            }
        }

        public async Task InsertLogResultsAsync(
            List<RestoreLogResultRecord> rows,
            CancellationToken ct = default)
        {
            if (rows == null || rows.Count == 0)
                return;

            try
            {
                var collection = GetLogResultsCollection(rows[0].RequestId);
                await EnsureLogIndexesAsync(collection, ct);
                await collection.InsertManyAsync(rows, cancellationToken: ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Failed to insert cold restore log results for RequestId {RequestId}",
                    rows.FirstOrDefault()?.RequestId);

                throw new InvalidOperationException(
                    $"Failed to insert cold restore log results for RequestId {rows.FirstOrDefault()?.RequestId}",
                    ex);
            }
        }

        public async Task<(IQueryable<SingleTraceProjection>, long)> GetRestoredTracesAsync(GetRestoredTracesRequest request, CancellationToken ct = default)
        {
            var collection = GetTraceResultsCollection(request.RequestId);
            var tenantId = BlocksContext.GetContext()?.TenantId;

            var filter = Builders<RestoreTraceResultRecord>.Filter.Eq(x => x.TenantId, tenantId) &
                         Builders<RestoreTraceResultRecord>.Filter.Eq(x => x.ParentId, string.Empty);

            if (!string.IsNullOrWhiteSpace(request.Search))
            {
                var regex = new BsonRegularExpression(request.Search, "i");
                filter &= Builders<RestoreTraceResultRecord>.Filter.Or(
                    Builders<RestoreTraceResultRecord>.Filter.Regex(
                       "OperationName",
                        regex),
                    Builders<RestoreTraceResultRecord>.Filter.Eq(x => x.TraceId, request.Search)
                    );
            }

            if (request.Filter?.Services != null && request.Filter.Services.Count > 0)
            {
                filter &= Builders<RestoreTraceResultRecord>.Filter.In(x => x.ServiceName, request.Filter.Services);
            }

            if (request.Filter?.Excepts != null && request.Filter.Excepts.Count > 0)
            {
                filter &= Builders<RestoreTraceResultRecord>.Filter.Nin(x => x.ServiceName, request.Filter.Excepts);
            }

            if (request.Filter?.StartDate != null)
            {
                filter &= Builders<RestoreTraceResultRecord>.Filter.Gt(x => x.Timestamp, request.Filter.StartDate.Value);
            }

            if (request.Filter?.EndDate != null)
            {
                filter &= Builders<RestoreTraceResultRecord>.Filter.Lte(x => x.Timestamp, request.Filter.EndDate.Value);
            }

            var sort = Builders<RestoreTraceResultRecord>.Sort.Descending(x => x.Timestamp);
            // Pages are 0-based, matching the hot repositories and the client's pager. Counting
            // from 1 here made page 0 and page 1 the same page and hid the last one.
            var skip = PageSkip(request.Page, request.PageSize);
            var countTask = collection.CountDocumentsAsync(filter, cancellationToken: ct);
            var rowsTask = collection
                .Find(filter)
                .Sort(sort)
                .Skip(skip)
                .Limit(PageLimit(request.PageSize))
                .ToListAsync(ct);

            await Task.WhenAll(countTask, rowsTask);

            var mapped = rowsTask.Result
                .Select(x => new SingleTraceProjection
                {
                    Timestamp = x.Timestamp,
                    TraceId = x.TraceId,
                    OperationName = x.OperationName,
                    StartTime = x.StartTime,
                    EndTime = x.EndTime,
                    Duration = x.Duration,
                    Attributes = ParseAttributes(x.AttributesJson),
                    ServiceName = x.ServiceName,
                    SpanId = x.SpanId,
                    ParentId = x.ParentId,
                    ParentSpanId = x.ParentSpanId,
                    Kind = x.Kind,
                    ActivitySourceName = x.ActivitySourceName,
                    Status = x.Status,
                    StatusDescription = x.StatusDescription,
                    Baggage = ParseBaggage(x.Baggage)
                })
                .AsQueryable();

            return (mapped, countTask.Result);
        }

        private static Dictionary<string, object?> ParseAttributes(string rawJson)
        {
            if (string.IsNullOrWhiteSpace(rawJson))
                return new Dictionary<string, object?>();

            try
            {
                return System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object?>>(rawJson)
                       ?? new Dictionary<string, object?>();
            }
            catch
            {
                return new Dictionary<string, object?>();
            }
        }

        private static Dictionary<string, string> ParseBaggage(string rawJson)
        {
            if (string.IsNullOrWhiteSpace(rawJson))
                return new Dictionary<string, string>();

            try
            {
                return System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, string>>(rawJson)
                       ?? new Dictionary<string, string>();
            }
            catch
            {
                return new Dictionary<string, string>();
            }
        }

        public async Task<(IQueryable<LogProjection>, long)> GetRestoredLogsAsync(
            GetRestoredLogsRequest request,
            CancellationToken ct = default)
        {
            var collection = GetLogResultsCollection(request.RequestId);
            var tenantId = BlocksContext.GetContext()?.TenantId;

            var filter = Builders<RestoreLogResultRecord>.Filter.Eq(x => x.TenantId, tenantId);

            if (!string.IsNullOrWhiteSpace(request.Search))
            {
                filter &= Builders<RestoreLogResultRecord>.Filter.Regex(
                    x => x.Message,
                    new BsonRegularExpression(request.Search, "i"));
            }

            // A body that spells the list out as null overwrites the property initialiser, so the
            // list is re-checked here rather than trusted to exist. Blank entries are dropped:
            // one would otherwise match only the rows whose service name was never written.
            var serviceNames = request.ServiceNames?
                .Where(name => !string.IsNullOrWhiteSpace(name))
                .ToList() ?? [];

            if (serviceNames.Count > 0)
            {
                filter &= Builders<RestoreLogResultRecord>.Filter.In(x => x.ServiceName, serviceNames);
            }
            else if (!string.IsNullOrWhiteSpace(request.ServiceName))
            {
                filter &= Builders<RestoreLogResultRecord>.Filter.Eq(x => x.ServiceName, request.ServiceName);
            }

            if (!string.IsNullOrWhiteSpace(request.Filter?.TraceId))
            {
                filter &= Builders<RestoreLogResultRecord>.Filter.Eq(x => x.TraceId, request.Filter.TraceId);
            }

            if (!string.IsNullOrWhiteSpace(request.Filter?.SpanId))
            {
                filter &= Builders<RestoreLogResultRecord>.Filter.Eq(x => x.SpanId, request.Filter.SpanId);
            }

            if (!string.IsNullOrWhiteSpace(request.Filter?.Level))
            {
                filter &= Builders<RestoreLogResultRecord>.Filter.Eq(x => x.Level, request.Filter.Level);
            }

            if (request.Filter?.StartDate != null)
            {
                filter &= Builders<RestoreLogResultRecord>.Filter.Gt(x => x.Timestamp, request.Filter.StartDate.Value);
            }

            if (request.Filter?.EndDate != null)
            {
                filter &= Builders<RestoreLogResultRecord>.Filter.Lte(x => x.Timestamp, request.Filter.EndDate.Value);
            }

            var sort = Builders<RestoreLogResultRecord>.Sort.Descending(x => x.Timestamp);

            var countTask = collection.CountDocumentsAsync(filter, cancellationToken: ct);
            var skip = PageSkip(request.Page, request.PageSize);
            var rowsTask = collection
                .Find(filter)
                .Sort(sort)
                .Skip(skip)
                .Limit(PageLimit(request.PageSize))
                .ToListAsync(ct);

            await Task.WhenAll(countTask, rowsTask);

            var mapped = rowsTask.Result
                .Select(x => new LogProjection
                {
                    Timestamp = x.Timestamp,
                    Level = x.Level,
                    Message = x.Message,
                    TraceId = x.TraceId,
                    SpanId = x.SpanId,
                    // The list renders a service badge per row, so the field the rows were
                    // filtered on has to survive the projection.
                    ServiceName = x.ServiceName,
                    ActionName = x.ActionName,
                    Exception = x.Exception
                })
                .AsQueryable();

            return (mapped, countTask.Result);
        }

        public async Task DeleteTraceResultsByRequestAndDateAsync(string requestId, DateTime sourceDate, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(requestId))
                return;

            try
            {
                var collection = GetTraceResultsCollection(requestId);
                var filter = Builders<RestoreTraceResultRecord>.Filter.Eq(x => x.SourceDate, sourceDate.Date);
                await collection.DeleteManyAsync(filter, ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Failed to delete cold restore trace results for RequestId {RequestId}, SourceDate {SourceDate}",
                    requestId,
                    sourceDate);

                throw new InvalidOperationException(
                    $"Failed to delete cold restore trace results for RequestId {requestId}, SourceDate {sourceDate:O}",
                    ex);
            }
        }

        public async Task DeleteLogResultsByRequestAndDateAsync(string requestId, DateTime sourceDate, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(requestId))
                return;

            try
            {
                var collection = GetLogResultsCollection(requestId);
                var filter = Builders<RestoreLogResultRecord>.Filter.Eq(x => x.SourceDate, sourceDate.Date);
                await collection.DeleteManyAsync(filter, ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Failed to delete cold restore log results for RequestId {RequestId}, SourceDate {SourceDate}",
                    requestId,
                    sourceDate);

                throw new InvalidOperationException(
                    $"Failed to delete cold restore log results for RequestId {requestId}, SourceDate {sourceDate:O}",
                    ex);
            }
        }

        public async Task DropResultCollectionsAsync(string requestId, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(requestId))
                return;

            // Dropping a collection that does not exist is a no-op, which keeps this idempotent —
            // both the cancel endpoint and the worker call it for the same request.
            await _database.DropCollectionAsync($"Trace_{requestId}", ct);
            await _database.DropCollectionAsync($"Logs_{requestId}", ct);
        }

        public async Task<long> DeleteExpiredTraceResultsAsync(CancellationToken ct = default) =>
            await DropFullyExpiredCollectionsAsync<RestoreTraceResultRecord>("Trace_", x => x.ExpireAt, ct);

        public async Task<long> DeleteExpiredLogResultsAsync(CancellationToken ct = default) =>
            await DropFullyExpiredCollectionsAsync<RestoreLogResultRecord>("Logs_", x => x.ExpireAt, ct);

        /// <summary>
        /// Drops each per-request result collection whose rows have <em>all</em> expired.
        /// </summary>
        /// <remarks>
        /// The live-row check is the point. This used to drop a collection as soon as any single row
        /// was expired, which destroyed still-valid rows alongside it — a real hazard for archive
        /// restores, where rows land hours apart as each blob finishes rehydrating.
        /// </remarks>
        private async Task<long> DropFullyExpiredCollectionsAsync<TRecord>(
            string namePrefix,
            Expression<Func<TRecord, DateTime>> expireAtField,
            CancellationToken ct)
        {
            using var cursor = await _database.ListCollectionNamesAsync(null, ct);
            var names = await cursor.ToListAsync(ct);
            var now = DateTime.UtcNow;
            long totalDropped = 0;

            foreach (var name in names.Where(n => n.StartsWith(namePrefix, StringComparison.Ordinal)))
            {
                var collection = _database.GetCollection<TRecord>(name);

                var hasLiveRows = await collection
                    .Find(Builders<TRecord>.Filter.Gte(expireAtField, now))
                    .AnyAsync(ct);

                if (hasLiveRows)
                    continue;

                var rowCount = await collection.CountDocumentsAsync(
                    Builders<TRecord>.Filter.Empty, cancellationToken: ct);

                if (rowCount == 0)
                {
                    // An empty collection is left over from a purge; drop it without counting rows.
                    await _database.DropCollectionAsync(name, ct);
                    continue;
                }

                await _database.DropCollectionAsync(name, ct);
                totalDropped += rowCount;
            }

            return totalDropped;
        }

        public async Task<IQueryable<SingleTraceProjection>> GetRestoredTraceAsync(GetRestoredTraceRequest request, CancellationToken ct = default)
        {
            var collection = GetTraceResultsCollection(request.RequestId);
            var tenantId = BlocksContext.GetContext()?.TenantId;

            var filter = Builders<RestoreTraceResultRecord>.Filter.Eq(x => x.TenantId, tenantId) &
                         Builders<RestoreTraceResultRecord>.Filter.Eq(x => x.TraceId, request.TraceId);

            var sort = Builders<RestoreTraceResultRecord>.Sort.Ascending(x => x.Timestamp);

            var rows = await collection
                .Find(filter)
                .Sort(sort)
                .ToListAsync(ct);

            var mapped = rows.Select(x => new SingleTraceProjection
            {
                Timestamp = x.Timestamp,
                TraceId = x.TraceId,
                SpanId = x.SpanId,
                ParentSpanId = x.ParentSpanId,
                ParentId = x.ParentId,
                Kind = x.Kind,
                ActivitySourceName = x.ActivitySourceName,
                OperationName = x.OperationName,
                StartTime = x.StartTime,
                EndTime = x.EndTime,
                Duration = x.Duration,
                Attributes = ParseAttributes(x.AttributesJson),
                Status = x.Status,
                StatusDescription = x.StatusDescription,
                Baggage = ParseBaggage(x.Baggage),
                ServiceName = x.ServiceName
            }).AsQueryable();

            return mapped;
        }

        public async Task<(IQueryable<LogProjection>, long)> GetRestoredLogsByTraceAsync(GetRestoredLogsByTraceRequest request, CancellationToken ct = default)
        {
            var collection = GetLogResultsCollection(request.RequestId);
            var tenantId = BlocksContext.GetContext()?.TenantId;

            var pageSize = PageLimit(request.PageSize);
            var skip = PageSkip(request.Page, pageSize);

            var filter = Builders<RestoreLogResultRecord>.Filter.Eq(x => x.TenantId, tenantId) &
                         Builders<RestoreLogResultRecord>.Filter.Eq(x => x.TraceId, request.TraceId);

            if (!string.IsNullOrWhiteSpace(request.SpanId))
            {
                filter &= Builders<RestoreLogResultRecord>.Filter.Eq(x => x.SpanId, request.SpanId);
            }

            if (!string.IsNullOrWhiteSpace(request.Level))
            {
                filter &= Builders<RestoreLogResultRecord>.Filter.Eq(x => x.Level, request.Level);
            }

            var sort = Builders<RestoreLogResultRecord>.Sort.Descending(x => x.Timestamp);

            var countTask = collection.CountDocumentsAsync(filter, cancellationToken: ct);
            var rowsTask = collection
                .Find(filter)
                .Sort(sort)
                .Skip(skip)
                .Limit(pageSize)
                .ToListAsync(ct);

            await Task.WhenAll(countTask, rowsTask);

            var mapped = rowsTask.Result
                .Select(x => new LogProjection
                {
                    Timestamp = x.Timestamp,
                    Level = x.Level,
                    Message = x.Message,
                    TraceId = x.TraceId,
                    SpanId = x.SpanId,
                    ServiceName = x.ServiceName,
                    ActionName = x.ActionName,
                    Exception = x.Exception
                })
                .AsQueryable();

            return (mapped, countTask.Result);
        }

        public async Task<List<RestoreTraceResultRecord>> GetTraceResultsForDownloadAsync(string requestId, string tenantId, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(requestId) || string.IsNullOrWhiteSpace(tenantId))
                return [];

            var collection = GetTraceResultsCollection(requestId);

            return await collection
                .Find(x => x.TenantId == tenantId)
                .SortByDescending(x => x.Timestamp)
                .ToListAsync(ct);
        }

        public async Task<List<RestoreLogResultRecord>> GetLogResultsForDownloadAsync(string requestId, string tenantId, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(requestId) || string.IsNullOrWhiteSpace(tenantId))
                return [];

            var collection = GetLogResultsCollection(requestId);

            return await collection
                .Find(x => x.TenantId == tenantId)
                .SortByDescending(x => x.Timestamp)
                .ToListAsync(ct);
        }
    }
}
