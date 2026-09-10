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

        /// <summary>
        /// Atomically claims the request for processing, moving it to InProgress only if it is not
        /// already running or finished. Returns false when another delivery of the same message got
        /// there first. Must be a single conditional update: a read-then-write lets two concurrent
        /// deliveries both believe they won.
        /// </summary>
        Task<bool> TryBeginProcessingAsync(string requestId, DateTime startedAt, CancellationToken ct = default);

        /// <summary>
        /// Atomically moves the request to a terminal status, returning true only for the caller
        /// that actually performed the transition. Completion notifications hang off that return
        /// value, so concurrent finishers cannot each send their own email.
        /// </summary>
        Task<bool> TryCompleteRequestAsync(string requestId, RestoreRequestStatus status, DateTime completedAt, CancellationToken ct = default);

        /// <summary>
        /// Pushes the request's expiry out, so retention is measured from when the restore finished
        /// rather than from when it was asked for.
        /// </summary>
        /// <summary>
        /// Pushes the expiry of the request <em>and</em> its file-progress rows out. Covers both so
        /// a restore that is still working — an archive rehydration can take most of a day — cannot
        /// have its own bookkeeping swept out from under it by the cleanup job.
        /// </summary>
        Task ExtendRequestExpiryAsync(string requestId, DateTime expireAt, CancellationToken ct = default);

        /// <summary>
        /// Atomically moves a Pending or InProgress request to Cancelled, returning false if it had
        /// already reached a terminal status.
        /// </summary>
        Task<bool> TryCancelRequestAsync(string requestId, DateTime cancelledAt, CancellationToken ct = default);

        /// <summary>
        /// Marks every not-yet-finished file of the request as Cancelled, so nothing further is
        /// picked up by the executor or the hydration poll.
        /// </summary>
        Task<long> CancelOutstandingFileProgressAsync(string requestId, CancellationToken ct = default);

        /// <summary>
        /// Cheap check the file loop makes between files, so a cancellation lands within one file
        /// rather than after the whole range has been restored.
        /// </summary>
        Task<bool> IsRequestCancelledAsync(string requestId, CancellationToken ct = default);
    }
}
