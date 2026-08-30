using Blocks.Genesis;
using Cloud.LmtService.Models.ColdRestore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Text;
using System.Threading.Tasks;

namespace Cloud.LmtService.Repositories.ColdRestore
{
    public class LogTraceRestoreRepository : ILogTraceRestoreRepository
    {
        private readonly IMongoDatabase _database;
        private readonly ILogger<LogTraceRestoreRepository> _logger;
        private const string LogTraceRestoreFileProgressCollection = "LogTraceRestoreFileProgress";
        private const string LogTraceRestoreRequestsCollection = "LogTraceRestoreRequests";
        private const string LogTraceRestoreDatabaseName = "LogTraceRestore";
        public LogTraceRestoreRepository(
            IBlocksSecret blocksSecret,
            IDbContextProvider dbContextProvider,
            ILogger<LogTraceRestoreRepository> logger,
            IConfiguration configuration)
        {
            _database = dbContextProvider.GetDatabase(blocksSecret.TraceConnectionString, LogTraceRestoreDatabaseName);

            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task CreateRequestAsync(RestoreRequestRecord request, CancellationToken ct = default)
        {
            try
            {
                var collection = GetRequestCollection();
                await collection.InsertOneAsync(request, cancellationToken: ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create cold restore request for RequestId {RequestId}", request.RequestId);
                throw new InvalidOperationException($"Failed to create cold restore request for RequestId {request.RequestId}", ex);
            }
        }

        public async Task<RestoreRequestRecord?> GetRequestByIdAsync(string requestId, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(requestId))
                return null;

            try
            {
                var collection = GetRequestCollection();

                return await collection
                    .Find(x => x.RequestId == requestId)
                    .FirstOrDefaultAsync(ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get cold restore request for RequestId {RequestId}", requestId);
                throw new InvalidOperationException($"Failed to get cold restore request for RequestId {requestId}", ex);
            }
        }
        public async Task<RestoreRequestRecord?> GetRequestStatusAsync(string requestId,string sourceType, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(requestId))
                return null;

            try
            {
                var collection = GetRequestCollection();

                return await collection
                    .Find(x => x.RequestId == requestId && x.SourceType.ToString()==sourceType)
                    .FirstOrDefaultAsync(ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get cold restore request for RequestId {RequestId}", requestId);
                throw new InvalidOperationException($"Failed to get cold restore request status for RequestId {requestId}", ex);
            }
        }

        public async Task UpdateRequestStatusAsync(
            string requestId,
            RestoreRequestStatus status,
            DateTime? startedAt = null,
            DateTime? completedAt = null,
            CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(requestId))
                return;

            try
            {
                var collection = GetRequestCollection();

                var update = Builders<RestoreRequestRecord>.Update
                    .Set(x => x.Status, status);

                if (startedAt.HasValue)
                {
                    update = update.Set(x => x.StartedAt, startedAt.Value);
                }

                if (completedAt.HasValue)
                {
                    update = update.Set(x => x.CompletedAt, completedAt.Value);
                }

                await collection.UpdateOneAsync(
                    x => x.RequestId == requestId,
                    update,
                    cancellationToken: ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to update cold restore request status for RequestId {RequestId}", requestId);
                throw new InvalidOperationException($"Failed to update cold restore request status for RequestId {requestId}", ex);
            }
        }

        public async Task ResetStuckProcessingFilesAsync(string requestId, CancellationToken ct = default)
        {
            var collection = GetFileProgressCollection();
            var filter = Builders<LogTraceRestoreFileProgressRecord>.Filter
                .Eq(x => x.RequestId, requestId) &
                Builders<LogTraceRestoreFileProgressRecord>.Filter
                .Eq(x => x.Status, RestoreFileProgressStatus.Processing);

            var update = Builders<LogTraceRestoreFileProgressRecord>.Update
                .Set(x => x.Status, RestoreFileProgressStatus.Pending)
                .Unset(x => x.StartedAt);

            await collection.UpdateManyAsync(filter, update, cancellationToken: ct);
        }
        private IMongoCollection<RestoreRequestRecord> GetRequestCollection()
        {
            return _database.GetCollection<RestoreRequestRecord>(LogTraceRestoreRequestsCollection);
        }

        public async Task CreateFileProgressAsync(LogTraceRestoreFileProgressRecord record, CancellationToken ct = default)
        {
            try
            {
                var collection = GetFileProgressCollection();
                await collection.InsertOneAsync(record, cancellationToken: ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Failed to create file progress for RequestId {RequestId}, DataType {DataType}, FileDate {FileDate}",
                    record.RequestId,
                    record.DataType,
                    record.FileDate);

                throw new InvalidOperationException($"Failed to create file progress for RequestId {record.RequestId}, DataType {record.DataType}, FileDate {record.FileDate:O}", ex);
            }
        }

        public async Task UpdateFileProgressAsync(
            string requestId,
            RestoreDataType dataType,
            DateTime fileDate,
            RestoreFileProgressStatus status,
            int rowsRestored = 0,
            string? errorMessage = null,
            DateTime? startedAt = null,
            DateTime? completedAt = null,
            CancellationToken ct = default)
        {
            try
            {
                var collection = GetFileProgressCollection();

                var update = Builders<LogTraceRestoreFileProgressRecord>.Update
                    .Set(x => x.Status, status)
                    .Set(x => x.RowsRestored, rowsRestored);

                if (!string.IsNullOrWhiteSpace(errorMessage))
                {
                    update = update.Set(x => x.ErrorMessage, errorMessage);
                }

                if (startedAt.HasValue)
                {
                    update = update.Set(x => x.StartedAt, startedAt.Value);
                }

                if (completedAt.HasValue)
                {
                    update = update.Set(x => x.CompletedAt, completedAt.Value);
                }

                await collection.UpdateOneAsync(
                    x => x.RequestId == requestId &&
                         x.DataType == dataType &&
                         x.FileDate == fileDate.Date,
                    update,
                    cancellationToken: ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Failed to update file progress for RequestId {RequestId}, DataType {DataType}, FileDate {FileDate}",
                    requestId,
                    dataType,
                    fileDate);

                throw new InvalidOperationException($"Failed to update file progress for RequestId {requestId}, DataType {dataType}, FileDate {fileDate:O}", ex);
            }
        }

        public async Task<List<LogTraceRestoreFileProgressRecord>> GetFileProgressByRequestIdAsync(
            string requestId,
            CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(requestId))
                return [];

            try
            {
                var collection = GetFileProgressCollection();

                return await collection
                    .Find(x => x.RequestId == requestId)
                    .ToListAsync(ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Failed to get file progress for RequestId {RequestId}",
                    requestId);

                throw new InvalidOperationException($"Failed to get file progress for RequestId {requestId}", ex);
            }
        }
        private IMongoCollection<LogTraceRestoreFileProgressRecord> GetFileProgressCollection()
        {
            return _database.GetCollection<LogTraceRestoreFileProgressRecord>(LogTraceRestoreFileProgressCollection);
        }
        public async Task UpdateTotalFilesAsync(string requestId, int totalFiles, CancellationToken ct = default)
        {
            var collection = GetRequestCollection();

            var update = Builders<RestoreRequestRecord>.Update
                .Set(x => x.TotalFiles, totalFiles);

            await collection.UpdateOneAsync(
                x => x.RequestId == requestId,
                update,
                cancellationToken: ct);
        }
        public async Task IncrementRequestProgressAsync(string requestId, int processedFilesIncrement, int failedFilesIncrement, int traceRowsIncrement, int logRowsIncrement, CancellationToken ct = default)
        {
            var collection = GetRequestCollection();

            var update = Builders<RestoreRequestRecord>.Update
                .Inc(x => x.ProcessedFiles, processedFilesIncrement)
                .Inc(x => x.FailedFiles, failedFilesIncrement)
                .Inc(x => x.TraceRowsRestored, traceRowsIncrement)
                .Inc(x => x.LogRowsRestored, logRowsIncrement);

            await collection.UpdateOneAsync(
                x => x.RequestId == requestId,
                update,
                cancellationToken: ct);
        }
        public async Task<bool> FileProgressExistsAsync(string requestId, RestoreDataType dataType, DateTime fileDate, CancellationToken ct = default)
        {
            var collection = GetFileProgressCollection();

            return await collection.Find(x =>
                    x.RequestId == requestId &&
                    x.DataType == dataType &&
                    x.FileDate == fileDate.Date)
                .AnyAsync(ct);
        }
        public async Task<List<LogTraceRestoreFileProgressRecord>> GetPendingFileProgressByRequestIdAsync(string requestId, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(requestId))
                return [];

            var collection = GetFileProgressCollection();

            return await collection.Find(x =>
                    x.RequestId == requestId &&
                    x.Status == RestoreFileProgressStatus.Pending)
                .ToListAsync(ct);
        }
        public async Task<List<LogTraceRestoreFileProgressRecord>> GetReadablePendingFileProgressByRequestIdAsync(string requestId, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(requestId))
                return [];

            var collection = GetFileProgressCollection();

            return await collection.Find(x =>
                    x.RequestId == requestId &&
                    x.Status == RestoreFileProgressStatus.Pending &&
                    x.NeedsHydration == false)
                .ToListAsync(ct);
        }
        public async Task UpdateRequestCountersAsync(string requestId, int processedFiles, int failedFiles, int traceRowsRestored, int logRowsRestored, CancellationToken ct = default)
        {
            var collection = GetRequestCollection();

            var update = Builders<RestoreRequestRecord>.Update
                .Set(x => x.ProcessedFiles, processedFiles)
                .Set(x => x.FailedFiles, failedFiles)
                .Set(x => x.TraceRowsRestored, traceRowsRestored)
                .Set(x => x.LogRowsRestored, logRowsRestored);

            await collection.UpdateOneAsync(
                x => x.RequestId == requestId,
                update,
                cancellationToken: ct);
        }
        public async Task<long> DeleteExpiredRequestsAsync(CancellationToken ct = default)
        {
            var collection = GetRequestCollection();

            var filter = Builders<RestoreRequestRecord>.Filter
                .Lt(x => x.ExpireAt, DateTime.UtcNow);

            var result = await collection.DeleteManyAsync(filter, ct);

            return result.DeletedCount;
        }
        public async Task<long> DeleteExpiredFileProgressAsync(CancellationToken ct = default)
        {
            var collection = GetFileProgressCollection();

            var filter = Builders<LogTraceRestoreFileProgressRecord>.Filter
                .Lt(x => x.ExpireAt, DateTime.UtcNow);

            var result = await collection.DeleteManyAsync(filter, ct);

            return result.DeletedCount;
        }
        public async Task<string?> GetLatestRequestIdByProjectKeyAsync(string projectKey,string sourceType, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(projectKey))
                return null;

            var collection = GetRequestCollection();

            var latestRequest = await collection.Find(x => x.TenantId == projectKey && x.SourceType.ToString()==sourceType).Sort(Builders<RestoreRequestRecord>
                                .Sort.Descending(x => x.Timestamp)
                                .Descending(x => x.RequestId))
                                .Project(x => x.RequestId)
                                .FirstOrDefaultAsync(ct);

            return latestRequest;
        }
        public async Task<List<LogTraceRestoreFileProgressRecord>> GetFileProgressByBlobPathAsync(string requestId, string blobPath, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(blobPath))
                return [];

            var collection = GetFileProgressCollection();

            return await collection
                .Find(x => x.BlobPath == blobPath && x.RequestId == requestId)
                .ToListAsync(ct);
        }

        public async Task UpdateFileProgressStatusByIdAsync(
        string requestId, string blobPath, RestoreFileProgressStatus status,
        bool? needsHydration = null, ArchiveHydrationStatus? hydrationStatus = null,
        DateTime? startedAt = null, DateTime? completedAt = null,
        string? errorMessage = null, CancellationToken ct = default)
        {
            await UpdateFileProgressStatusInternalAsync(
                x => x.RequestId == requestId && x.BlobPath == blobPath,
                status, needsHydration, hydrationStatus, startedAt, completedAt, errorMessage, ct: ct);
        }

        public async Task UpdateFileProgressStatusByObjectIdAsync(
            ObjectId id, RestoreFileProgressStatus status,
            bool? needsHydration = null, int rowsRestored = 0,
            ArchiveHydrationStatus? hydrationStatus = null,
            DateTime? startedAt = null, DateTime? completedAt = null,
            string? errorMessage = null, CancellationToken ct = default)
        {
            await UpdateFileProgressStatusInternalAsync(
                x => x.Id == id,
                status, needsHydration, hydrationStatus, startedAt, completedAt, errorMessage,
                rowsRestored: rowsRestored, ct: ct);
        }

        private async Task UpdateFileProgressStatusInternalAsync(
            Expression<Func<LogTraceRestoreFileProgressRecord, bool>> filter,
            RestoreFileProgressStatus status,
            bool? needsHydration = null,
            ArchiveHydrationStatus? hydrationStatus = null,
            DateTime? startedAt = null,
            DateTime? completedAt = null,
            string? errorMessage = null,
            int? rowsRestored = null,
            CancellationToken ct = default)
        {
            var update = Builders<LogTraceRestoreFileProgressRecord>.Update
                .Set(x => x.Status, status);

            if (rowsRestored.HasValue)
                update = update.Set(x => x.RowsRestored, rowsRestored.Value);

            if (needsHydration.HasValue)
                update = update.Set(x => x.NeedsHydration, needsHydration.Value);

            if (hydrationStatus.HasValue)
                update = update.Set(x => x.HydrationStatus, hydrationStatus.Value);

            if (startedAt.HasValue)
                update = update.Set(x => x.StartedAt, startedAt.Value);

            if (completedAt.HasValue)
                update = update.Set(x => x.CompletedAt, completedAt.Value);

            if (!string.IsNullOrWhiteSpace(errorMessage))
                update = update.Set(x => x.ErrorMessage, errorMessage);

            await GetFileProgressCollection().UpdateOneAsync(filter, update, cancellationToken: ct);
        }
    }
}
