using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Cloud.LmtService.Models.LogTraceBackup
{
    /// <summary>
    /// Tracks Phase 1 archiving progress for a single blocks-service × tenant combination.
    /// Stored in collection "LogBackupFileProgressTracker" (Root DB).
    /// One document = one (RunId, ServiceName, TenantId) triple.
    /// </summary>
    public class LogBackupFileProgress
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        public string RunId { get; set; } = string.Empty;

        /// <summary>e.g. "blocks-api"</summary>
        public string ServiceName { get; set; } = string.Empty;

        public string TenantId { get; set; } = string.Empty;

        /// <summary>TraceId from the first archived log record, if available.</summary>
        public string? TraceId { get; set; }

        /// <summary>Archiving | Archived | ArchiveFailed</summary>
        public string Status { get; set; } = BackupFileStatus.Archiving;

        /// <summary>Number of log records archived in Phase 1. Set on success.</summary>
        public int RecordCount { get; set; }

        public DateTime ArchivingStartedAt { get; set; }
        public DateTime? ArchivingEndedAt { get; set; }
        public DateTime? FailedAt { get; set; }

        /// <summary>Populated when Status = ArchiveFailed.</summary>
        public LogTraceBackupFailedItem? FailureDetail { get; set; }
    }
}
