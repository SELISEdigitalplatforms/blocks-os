using Blocks.Genesis;
using Cloud.LmtService.Models.ColdRestore;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace Cloud.LmtService.Repositories.ColdRestore
{
    /// <summary>
    /// Creates the indexes the restore collections are queried by. Nothing created them before, so
    /// every status poll, plan check and hydration sweep was a full collection scan.
    /// </summary>
    /// <remarks>
    /// The per-request result collections (<c>Trace_{requestId}</c> / <c>Logs_{requestId}</c>) are
    /// indexed on creation instead — see <see cref="LogTraceRestoreResultRepository"/> — because
    /// their names are only known once a request exists.
    /// </remarks>
    public sealed class RestoreIndexInitializer : IRestoreIndexInitializer
    {
        private const string DatabaseName = "LogTraceRestore";

        private readonly IMongoDatabase _database;
        private readonly ILogger<RestoreIndexInitializer> _logger;

        public RestoreIndexInitializer(
            IBlocksSecret blocksSecret,
            IDbContextProvider dbContextProvider,
            ILogger<RestoreIndexInitializer> logger)
        {
            _database = dbContextProvider.GetDatabase(blocksSecret.TraceConnectionString, DatabaseName);
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task EnsureIndexesAsync(CancellationToken ct = default)
        {
            try
            {
                await EnsureRequestIndexesAsync(ct);
                await EnsureFileProgressIndexesAsync(ct);
                await EnsureHydrationJobIndexesAsync(ct);

                _logger.LogInformation("Restore collection indexes ensured");
            }
            catch (Exception ex)
            {
                // Never block worker startup on this: missing indexes make queries slow, not wrong.
                _logger.LogError(ex, "Could not ensure restore collection indexes");
            }
        }

        private async Task EnsureRequestIndexesAsync(CancellationToken ct)
        {
            var collection = _database.GetCollection<RestoreRequestRecord>("LogTraceRestoreRequests");
            var keys = Builders<RestoreRequestRecord>.IndexKeys;

            await collection.Indexes.CreateManyAsync(
            [
                // GetLatestRequestIdByProjectKeyAsync: filter by tenant + tier, newest first.
                new CreateIndexModel<RestoreRequestRecord>(
                    keys.Ascending(x => x.TenantId)
                        .Ascending(x => x.SourceType)
                        .Descending(x => x.Timestamp),
                    new CreateIndexOptions { Name = "tenant_sourceType_timestamp" }),

                new CreateIndexModel<RestoreRequestRecord>(
                    keys.Ascending(x => x.ExpireAt),
                    new CreateIndexOptions { Name = "expireAt" })
            ], ct);
        }

        private async Task EnsureFileProgressIndexesAsync(CancellationToken ct)
        {
            var collection = _database.GetCollection<LogTraceRestoreFileProgressRecord>("LogTraceRestoreFileProgress");
            var keys = Builders<LogTraceRestoreFileProgressRecord>.IndexKeys;

            await collection.Indexes.CreateManyAsync(
            [
                // FileProgressExistsAsync and UpdateFileProgressAsync address a row by this triple.
                new CreateIndexModel<LogTraceRestoreFileProgressRecord>(
                    keys.Ascending(x => x.RequestId)
                        .Ascending(x => x.DataType)
                        .Ascending(x => x.FileDate),
                    new CreateIndexOptions { Name = "request_dataType_fileDate", Unique = true }),

                // The executor's pending scan, and the archive variant's NeedsHydration filter.
                new CreateIndexModel<LogTraceRestoreFileProgressRecord>(
                    keys.Ascending(x => x.RequestId)
                        .Ascending(x => x.Status)
                        .Ascending(x => x.NeedsHydration),
                    new CreateIndexOptions { Name = "request_status_needsHydration" }),

                new CreateIndexModel<LogTraceRestoreFileProgressRecord>(
                    keys.Ascending(x => x.RequestId).Ascending(x => x.BlobPath),
                    new CreateIndexOptions { Name = "request_blobPath" }),

                new CreateIndexModel<LogTraceRestoreFileProgressRecord>(
                    keys.Ascending(x => x.ExpireAt),
                    new CreateIndexOptions { Name = "expireAt" })
            ], ct);
        }

        private async Task EnsureHydrationJobIndexesAsync(CancellationToken ct)
        {
            var collection = _database.GetCollection<ArchiveHydrationJobRecord>("ArchiveHydrationJobs");
            var keys = Builders<ArchiveHydrationJobRecord>.IndexKeys;

            await collection.Indexes.CreateManyAsync(
            [
                // GetPendingHydrationJobsAsync polls by status on every hydration check.
                new CreateIndexModel<ArchiveHydrationJobRecord>(
                    keys.Ascending(x => x.Status),
                    new CreateIndexOptions { Name = "status" }),

                new CreateIndexModel<ArchiveHydrationJobRecord>(
                    keys.Ascending(x => x.RequestId).Ascending(x => x.BlobPath),
                    new CreateIndexOptions { Name = "request_blobPath", Unique = true }),

                new CreateIndexModel<ArchiveHydrationJobRecord>(
                    keys.Ascending(x => x.ExpireAt),
                    new CreateIndexOptions { Name = "expireAt" })
            ], ct);
        }
    }
}
