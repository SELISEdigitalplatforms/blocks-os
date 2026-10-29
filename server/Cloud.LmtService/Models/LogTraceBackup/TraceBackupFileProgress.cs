using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Cloud.LmtService.Models.LogTraceBackup
{
    /// <summary>
    /// Tracks Phase 1 (archiving) AND Phase 2 (blob upload) for a single tenant's traces.
    /// Stored in collection "TraceBackupFileProgressTracker" (Root DB).
    /// Phase 1 and Phase 2 share the same key (RunId + TenantId) so one document covers the full lifecycle.
    /// </summary>
    public class TraceBackupFileProgress
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        public string RunId { get; set; } = string.Empty;
        public string TenantId { get; set; } = string.Empty;

        /// <summary>The MongoDB archive collection name, e.g. "tenantA_20250116_20250117". Set when Phase 2 begins.</summary>
        public string? ArchiveCollectionName { get; set; }

        /// <summary>Total records archived/uploaded. Set after Phase 1 completes.</summary>
        public int RecordCount { get; set; }

        /// <summary>
        /// The full blob path targeted for this upload.
        /// Set when upload begins — present even on failure so you know the intended path.
        /// </summary>
        public string? BlobPath { get; set; }

        /// <summary>Archiving | Archived | ArchiveFailed | Uploading | Completed | UploadFailed</summary>
        public string Status { get; set; } = BackupFileStatus.Archiving;

        /// <summary>True when this archive collection was left from a previous failed run (self-healing).</summary>
        public bool IsCarryover { get; set; }

        public DateTime ArchivingStartedAt { get; set; }
        public DateTime? ArchivingEndedAt { get; set; }
        public DateTime? UploadingStartedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        public DateTime? FailedAt { get; set; }

        /// <summary>Populated when Status is ArchiveFailed or UploadFailed.</summary>
        public LogTraceBackupFailedItem? FailureDetail { get; set; }
    }
}
