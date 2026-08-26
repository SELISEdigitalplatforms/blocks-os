using Cloud.LmtService.Models.ColdRestore;
using MongoDB.Bson;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Cloud.LmtService.Repositories.ColdRestore
{
    public interface ILogTraceRestoreRepository
    {
        Task CreateRequestAsync(RestoreRequestRecord request, CancellationToken ct = default);

        Task<RestoreRequestRecord?> GetRequestByIdAsync(string requestId, CancellationToken ct = default);
        Task<RestoreRequestRecord?> GetRequestStatusAsync(string requestId,string sourceType, CancellationToken ct = default);

        Task UpdateRequestStatusAsync(string requestId, RestoreRequestStatus status, DateTime? startedAt = null, DateTime? completedAt = null, CancellationToken ct = default);

        Task CreateFileProgressAsync(LogTraceRestoreFileProgressRecord record, CancellationToken ct = default);

        Task UpdateFileProgressAsync(string requestId, RestoreDataType dataType, DateTime fileDate, RestoreFileProgressStatus status, int rowsRestored = 0, string? errorMessage = null, DateTime? startedAt = null, DateTime? completedAt = null, CancellationToken ct = default);

        Task<List<LogTraceRestoreFileProgressRecord>> GetFileProgressByRequestIdAsync(string requestId, CancellationToken ct = default);
        Task UpdateTotalFilesAsync(string requestId, int totalFiles, CancellationToken ct = default);
        Task IncrementRequestProgressAsync(string requestId, int processedFilesIncrement, int failedFilesIncrement, int traceRowsIncrement, int logRowsIncrement, CancellationToken ct = default);
        Task<bool> FileProgressExistsAsync(string requestId, RestoreDataType dataType, DateTime fileDate, CancellationToken ct = default);
        Task<List<LogTraceRestoreFileProgressRecord>> GetPendingFileProgressByRequestIdAsync(string requestId, CancellationToken ct = default);
        /// <summary>
        /// Returns Pending file-progress rows for the request that are NOT waiting on archive hydration.
        /// Used by ArchiveRestoreService to drive inline restore of immediately-readable blobs.
        /// </summary>
        Task<List<LogTraceRestoreFileProgressRecord>> GetReadablePendingFileProgressByRequestIdAsync(string requestId, CancellationToken ct = default);
        /// <summary>
        /// Definitively recomputes ProcessedFiles / FailedFiles / TraceRowsRestored / LogRowsRestored
        /// on the request record. Use during finalize as a safety net against drift from per-file $inc
        /// under retry/crash scenarios.
        /// </summary>
        Task UpdateRequestCountersAsync(string requestId, int processedFiles, int failedFiles, int traceRowsRestored, int logRowsRestored, CancellationToken ct = default);
        Task<long> DeleteExpiredRequestsAsync(CancellationToken ct = default);
        Task<long> DeleteExpiredFileProgressAsync(CancellationToken ct = default);
        Task<string?> GetLatestRequestIdByProjectKeyAsync(string projectKey,string sourceType, CancellationToken ct = default);
        Task<List<LogTraceRestoreFileProgressRecord>> GetFileProgressByBlobPathAsync(string requestId, string blobPath, CancellationToken ct = default);
        Task UpdateFileProgressStatusByIdAsync(string requestId,string blobPath, RestoreFileProgressStatus status, bool? needsHydration = null, ArchiveHydrationStatus? hydrationStatus = null, DateTime? startedAt = null, DateTime? completedAt = null, string? errorMessage = null, CancellationToken ct = default);
        /// <summary>
        /// Updates a single FileProgress document by its MongoDB _id.
        /// Preferred over UpdateFileProgressStatusByIdAsync when the record's ObjectId
        /// is already known (e.g. inside ProcessArchiveRestoreFileAsync), because the
        /// _id filter is unambiguous and cannot silently miss the document.
        /// </summary>
        Task UpdateFileProgressStatusByObjectIdAsync(ObjectId id, RestoreFileProgressStatus status, bool? needsHydration = null, int rowsRestored = 0, ArchiveHydrationStatus? hydrationStatus = null, DateTime? startedAt = null, DateTime? completedAt = null, string? errorMessage = null, CancellationToken ct = default);
        Task ResetStuckProcessingFilesAsync(string requestId, CancellationToken ct = default);
    }
}
