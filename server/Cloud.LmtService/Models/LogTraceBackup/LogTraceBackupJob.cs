using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Cloud.LmtService.Models.LogTraceBackup
{
    /// <summary>
    /// One document per backed-up day (DataDateFrom/DataDateTo are that day's UTC midnight bounds);
    /// a run that catches up several days writes one per day. Stored in collection
    /// "LogTraceBackupJobs" (Root DB).
    /// Counters are updated atomically throughout the run — query at any point for live status.
    /// </summary>
    public class LogTraceBackupJob
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        /// <summary>Unique identifier for this run (Guid string). Used as a foreign key in all tracker collections.</summary>
        public string RunId { get; set; } = string.Empty;

        /// <summary>Running | Completed | CompletedWithErrors | Failed | Abandoned | Skipped</summary>
        public string Status { get; set; } = LogTraceBackupJobStatus.Running;

        /// <summary>Archiving | BlobUploading | Finalizing</summary>
        public string CurrentPhase { get; set; } = BackupPhase.Archiving;

        public DateTime StartTime { get; set; }
        public DateTime? EndTime { get; set; }

        /// <summary>Updated periodically during the run. Used to detect abandoned (crashed) jobs on startup.</summary>
        public DateTime LastHeartbeatAt { get; set; }

        /// <summary>The day of hot data this job archives, as [DataDateFrom, DataDateTo).</summary>
        public DateTime DataDateFrom { get; set; }
        public DateTime DataDateTo { get; set; }

        // Per-type phase counters
        public BackupPhaseStats LogArchivingStats { get; set; } = new();
        public BackupPhaseStats ServiceLogArchivingStats { get; set; } = new();
        public BackupPhaseStats LogBlobUploadStats { get; set; } = new();
        public BackupPhaseStats TraceStats { get; set; } = new();

        /// <summary>Grand total successful uploads across all types and phases.</summary>
        public int TotalSuccessful { get; set; }

        /// <summary>Grand total failures across all types and phases.</summary>
        public int TotalFailed { get; set; }

        /// <summary>
        /// Populated when Status = Failed (unhandled orchestrator-level crash) or Skipped (the day
        /// reached the failed-attempt limit).
        /// </summary>
        public string? ErrorReason { get; set; }
    }
}
