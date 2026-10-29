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
    public class ArchiveRestoreRepository : IArchiveRestoreRepository
    {
        private readonly IMongoDatabase _database;
        private const string HydrationJobs = "ArchiveHydrationJobs";
        private const string LogTraceRestoreDatabaseName = "LogTraceRestore";
        public ArchiveRestoreRepository(IBlocksSecret blocksSecret, IDbContextProvider dbContextProvider, IConfiguration configuration, ILogger<ArchiveRestoreRepository> logger)
        {
            _database = dbContextProvider.GetDatabase(blocksSecret.TraceConnectionString, LogTraceRestoreDatabaseName);

            _ = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        private IMongoCollection<ArchiveHydrationJobRecord> GetCollection()
        {
            return _database.GetCollection<ArchiveHydrationJobRecord>(HydrationJobs);
        }

        public async Task CreateHydrationJobAsync(
            ArchiveHydrationJobRecord record,
            CancellationToken ct = default)
        {
            var collection = GetCollection();
            await collection.InsertOneAsync(record, cancellationToken: ct);
        }

        public async Task<List<ArchiveHydrationJobRecord>> GetPendingHydrationJobsAsync(CancellationToken ct = default)
        {
            var collection = GetCollection();

            var filter = Builders<ArchiveHydrationJobRecord>.Filter.Eq(
                x => x.Status,
                ArchiveHydrationStatus.RehydrationRequested);

            return await collection.Find(filter).ToListAsync(ct);
        }

        public async Task UpdateHydrationStatusAsync(string requestId, ArchiveHydrationStatus status, DateTime? lastCheckedAt = null, DateTime? completedAt = null, string? errorMessage = null, CancellationToken ct = default)
        {
            await UpdateHydrationStatusInternalAsync(
                x => x.RequestId == requestId, status, lastCheckedAt, completedAt, errorMessage, ct);
        }

        public async Task UpdateHydrationStatusByIdAsync(ObjectId id, ArchiveHydrationStatus status, DateTime? lastCheckedAt = null, DateTime? completedAt = null, string? errorMessage = null, CancellationToken ct = default)
        {
            await UpdateHydrationStatusInternalAsync(
                x => x.Id == id, status, lastCheckedAt, completedAt, errorMessage, ct);
        }

        private async Task UpdateHydrationStatusInternalAsync(Expression<Func<ArchiveHydrationJobRecord, bool>> filter, ArchiveHydrationStatus status, DateTime? lastCheckedAt, DateTime? completedAt, string? errorMessage, CancellationToken ct)
        {
            var update = Builders<ArchiveHydrationJobRecord>.Update
                .Set(x => x.Status, status);

            if (lastCheckedAt != null)
                update = update.Set(x => x.LastCheckedAt, lastCheckedAt);

            if (completedAt != null)
                update = update.Set(x => x.CompletedAt, completedAt);

            if (!string.IsNullOrWhiteSpace(errorMessage))
                update = update.Set(x => x.ErrorMessage, errorMessage);

            await GetCollection().UpdateOneAsync(filter, update, cancellationToken: ct);
        }

        public async Task<long> DeleteExpiredHydrationJobsAsync(CancellationToken ct = default)
        {
            var filter = Builders<ArchiveHydrationJobRecord>.Filter
                .Lt(x => x.ExpireAt, DateTime.UtcNow);

            var result = await GetCollection().DeleteManyAsync(filter, ct);

            return result.DeletedCount;
        }

        public async Task<long> CancelHydrationJobsForRequestAsync(string requestId, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(requestId))
                return 0;

            var builder = Builders<ArchiveHydrationJobRecord>.Filter;
            var filter = builder.Eq(x => x.RequestId, requestId) &
                         builder.Nin(x => x.Status,
                         [
                             ArchiveHydrationStatus.Ready,
                             ArchiveHydrationStatus.Failed,
                             ArchiveHydrationStatus.Cancelled
                         ]);

            var update = Builders<ArchiveHydrationJobRecord>.Update
                .Set(x => x.Status, ArchiveHydrationStatus.Cancelled)
                .Set(x => x.CompletedAt, DateTime.UtcNow)
                .Set(x => x.ErrorMessage, "Restore request was cancelled.");

            var result = await GetCollection().UpdateManyAsync(filter, update, cancellationToken: ct);

            return result.ModifiedCount;
        }

        public async Task<bool> HydrationJobExistsAsync(string requestId,string blobPath, CancellationToken ct = default)
        {
            var collection = GetCollection();

            var filter = Builders<ArchiveHydrationJobRecord>.Filter.Eq(x => x.RequestId, requestId) & Builders<ArchiveHydrationJobRecord>.Filter.Eq(x => x.BlobPath, blobPath);

            var count = await collection.CountDocumentsAsync(filter, cancellationToken: ct);

            return count > 0;
        }
    }
}
