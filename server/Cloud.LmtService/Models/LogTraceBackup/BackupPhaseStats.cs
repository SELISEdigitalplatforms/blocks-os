namespace Cloud.LmtService.Models.LogTraceBackup
{
    /// <summary>
    /// Counters for one phase of the backup pipeline, embedded in LogTraceBackupJob.
    /// All fields are updated atomically via MongoDB $inc — never read-modify-write.
    /// </summary>
    public class BackupPhaseStats
    {
        /// <summary>Incremented each time a new file/item progress document is created.</summary>
        public int TotalDiscovered { get; set; }

        /// <summary>Items currently in the Archiving (Phase 1) state.</summary>
        public int ArchivingCount { get; set; }

        /// <summary>Items that completed Phase 1 successfully.</summary>
        public int ArchiveSuccessCount { get; set; }

        /// <summary>Items that failed Phase 1.</summary>
        public int ArchiveFailedCount { get; set; }

        /// <summary>Items currently uploading to blob (Phase 2).</summary>
        public int UploadingCount { get; set; }

        /// <summary>Items that completed Phase 2 (blob upload) successfully.</summary>
        public int UploadSuccessCount { get; set; }

        /// <summary>Items that failed Phase 2 (blob upload).</summary>
        public int UploadFailedCount { get; set; }
    }
}
