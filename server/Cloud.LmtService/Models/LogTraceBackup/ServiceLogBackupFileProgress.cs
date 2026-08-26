using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Cloud.LmtService.Models.LogTraceBackup
{
    /// <summary>
    /// Tracks Phase 1 archiving progress for a single managed service.
    /// Stored in collection "ServiceLogBackupFileProgressTracker" (Root DB).
    /// TenantId starts null and is resolved mid-processing (managed services are single-tenant
    /// but TenantId is only discovered by reading the first document in the collection).
    /// </summary>
    public class ServiceLogBackupFileProgress
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        public string RunId { get; set; } = string.Empty;

        /// <summary>e.g. "SB-payment-service"</summary>
        public string ServiceName { get; set; } = string.Empty;

        /// <summary>Resolved during processing. Null until the first document in the collection is read.</summary>
        public string? TenantId { get; set; }

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
