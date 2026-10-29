using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Cloud.LmtService.Models.LogTraceBackup
{
    /// <summary>
    /// Tracks Phase 2 blob upload progress for a single tenant's combined log archive parquet file.
    /// Stored in collection "LogBlobUploadProgressTracker" (Root DB).
    /// One document = one tenant = one parquet file covering both blocks-service and managed-service logs.
    /// NOTE: Phase 1 logs (blocks + managed) archive into the same MongoDB collection per tenant,
    ///       so Phase 2 is always per-tenant regardless of how many services contributed.
    /// </summary>
    public class LogBlobUploadProgress
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        public string RunId { get; set; } = string.Empty;
        public string TenantId { get; set; } = string.Empty;

        /// <summary>The MongoDB archive collection name, e.g. "tenantA_20250116_20250117".</summary>
        public string ArchiveCollectionName { get; set; } = string.Empty;

        /// <summary>Total records in the parquet file. Set on successful upload.</summary>
        public int RecordCount { get; set; }

        /// <summary>
        /// The full blob path targeted for this upload.
        /// Set when upload begins — present even on failure so you know the intended path.
        /// </summary>
        public string? BlobPath { get; set; }

        /// <summary>Uploading | Completed | UploadFailed</summary>
        public string Status { get; set; } = BackupFileStatus.Uploading;

        /// <summary>True when this archive collection was left from a previous failed run (self-healing).</summary>
        public bool IsCarryover { get; set; }

        public DateTime UploadingStartedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        public DateTime? FailedAt { get; set; }

        /// <summary>Populated when Status = UploadFailed.</summary>
        public LogTraceBackupFailedItem? FailureDetail { get; set; }
    }
}
