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

        public async Task InsertTraceResultsAsync(
            List<RestoreTraceResultRecord> rows,
            CancellationToken ct = default)
        {
            if (rows == null || rows.Count == 0)
                return;

            try
            {
                var collection = GetTraceResultsCollection(rows[0].RequestId);
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
            var page = request.Page <= 0 ? 1 : request.Page;
            var skip = (page - 1) * request.PageSize;
            var countTask = collection.CountDocumentsAsync(filter, cancellationToken: ct);
            var rowsTask = collection
                .Find(filter)
                .Sort(sort)
                .Skip(skip)
                .Limit(request.PageSize)
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

            if (!string.IsNullOrWhiteSpace(request.ServiceName))
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
            var page = request.Page <= 0 ? 1 : request.Page;
            var skip = (page - 1) * request.PageSize;
            var rowsTask = collection
                .Find(filter)
                .Sort(sort)
                .Skip(skip)
                .Limit(request.PageSize)
                .ToListAsync(ct);

            await Task.WhenAll(countTask, rowsTask);

            var mapped = rowsTask.Result
                .Select(x => new LogProjection
                {
                    Timestamp = x.Timestamp,
                    Level = x.Level,
                    Message = x.Message,
                    TraceId = x.TraceId,
                    SpanId = x.SpanId
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

        public async Task<List<RestoreTraceResultRecord>> GetTraceResultsByBlobPathAsync(string requestId, string tenantId, string blobPath, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(requestId) || string.IsNullOrWhiteSpace(tenantId) || string.IsNullOrWhiteSpace(blobPath))
                return [];

            var collection = GetTraceResultsCollection(requestId);

            return await collection
                .Find(x => x.TenantId == tenantId && x.BlobPath == blobPath)
                .ToListAsync(ct);
        }

        public async Task CloneTraceResultsForRequestAsync(string newRequestId, string tenantId, DateTime sourceDate, string blobPath, List<RestoreTraceResultRecord> existingRows, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(newRequestId) || existingRows == null || existingRows.Count == 0)
                return;

            var collection = GetTraceResultsCollection(newRequestId);
            var retentionDays = await GetRetentionDaysAsync(ct);

            var clonedRows = existingRows.Select(x => new RestoreTraceResultRecord
            {
                RequestId = newRequestId,
                TenantId = tenantId,
                SourceDate = sourceDate.Date,
                BlobPath = blobPath,
                Timestamp = x.Timestamp,
                TraceId = x.TraceId,
                OperationName = x.OperationName,
                StartTime = x.StartTime,
                EndTime = x.EndTime,
                Duration = x.Duration,
                AttributesJson = x.AttributesJson,
                ServiceName = x.ServiceName,
                SpanId = x.SpanId,
                ParentSpanId = x.ParentSpanId,
                ParentId = x.ParentId,
                Status = x.Status,
                StatusDescription = x.StatusDescription,
                Baggage = x.Baggage,
                Kind = x.Kind,
                ActivitySourceName = x.ActivitySourceName,
                ExpireAt = DateTime.UtcNow.AddDays(retentionDays)
            }).ToList();

            foreach (var batch in clonedRows.Chunk(Constants.RestoreInsertBatchSize))
            {
                await collection.InsertManyAsync(batch, cancellationToken: ct);
            }
        }

        public async Task<List<RestoreLogResultRecord>> GetLogResultsByBlobPathAsync(string requestId, string tenantId, string blobPath, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(requestId) || string.IsNullOrWhiteSpace(tenantId) || string.IsNullOrWhiteSpace(blobPath))
                return [];

            var collection = GetLogResultsCollection(requestId);

            return await collection
                .Find(x => x.TenantId == tenantId && x.BlobPath == blobPath)
                .ToListAsync(ct);
        }

        public async Task CloneLogResultsForRequestAsync(string newRequestId, string tenantId, DateTime sourceDate, string blobPath, List<RestoreLogResultRecord> existingRows, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(newRequestId) || existingRows == null || existingRows.Count == 0)
                return;

            var collection = GetLogResultsCollection(newRequestId);
            var retentionDays = await GetRetentionDaysAsync(ct);

            var clonedRows = existingRows.Select(x => new RestoreLogResultRecord
            {
                RequestId = newRequestId,
                TenantId = tenantId,
                SourceDate = sourceDate.Date,
                BlobPath = blobPath,
                Timestamp = x.Timestamp,
                TraceId = x.TraceId,
                ServiceName = x.ServiceName,
                SpanId = x.SpanId,
                Level = x.Level,
                Message = x.Message,
                ActionName = x.ActionName,
                ExpireAt = DateTime.UtcNow.AddDays(retentionDays)
            }).ToList();

            foreach (var batch in clonedRows.Chunk(Constants.RestoreInsertBatchSize))
            {
                await collection.InsertManyAsync(batch, cancellationToken: ct);
            }
        }

        public async Task<long> DeleteExpiredTraceResultsAsync(CancellationToken ct = default)
        {
            using var cursor = await _database.ListCollectionNamesAsync(null, ct);
            var names = await cursor.ToListAsync(ct);
            long totalDropped = 0;

            foreach (var name in names.Where(n => n.StartsWith("Trace_")))
            {
                var col = _database.GetCollection<RestoreTraceResultRecord>(name);
                var expiredCount = await col.CountDocumentsAsync(
                    Builders<RestoreTraceResultRecord>.Filter.Lt(x => x.ExpireAt, DateTime.UtcNow),
                    cancellationToken: ct);

                if (expiredCount > 0)
                {
                    await _database.DropCollectionAsync(name, ct);
                    totalDropped += expiredCount;
                }
            }

            return totalDropped;
        }

        public async Task<long> DeleteExpiredLogResultsAsync(CancellationToken ct = default)
        {
            using var cursor = await _database.ListCollectionNamesAsync(null, ct);
            var names = await cursor.ToListAsync(ct);
            long totalDropped = 0;
            var date = DateTime.UtcNow;
            foreach (var name in names.Where(n => n.StartsWith("Logs_")))
            {
                var col = _database.GetCollection<RestoreLogResultRecord>(name);
                var expiredCount = await col.CountDocumentsAsync(
                    Builders<RestoreLogResultRecord>.Filter.Lt(x => x.ExpireAt, DateTime.UtcNow),
                    cancellationToken: ct);

                if (expiredCount > 0)
                {
                    await _database.DropCollectionAsync(name, ct);
                    totalDropped += expiredCount;
                }
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

            var page = request.Page <= 0 ? 1 : request.Page;
            var pageSize = request.PageSize <= 0 ? 50 : request.PageSize;
            var skip = (page - 1) * pageSize;

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
                    ActionName = x.ActionName
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
