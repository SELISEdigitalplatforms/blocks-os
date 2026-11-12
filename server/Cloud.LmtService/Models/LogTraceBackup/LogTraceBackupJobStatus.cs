namespace Cloud.LmtService.Models.LogTraceBackup
{
    public static class LogTraceBackupJobStatus
    {
        public const string Running = "Running";
        public const string Completed = "Completed";
        public const string CompletedWithErrors = "CompletedWithErrors";
        public const string Failed = "Failed";
        public const string Abandoned = "Abandoned";

        /// <summary>The day failed too often (Constants.BackupMaxFailedAttemptsPerDay) and is no longer retried.</summary>
        public const string Skipped = "Skipped";
    }

    public static class BackupPhase
    {
        public const string Archiving = "Archiving";
        public const string BlobUploading = "BlobUploading";
        public const string Finalizing = "Finalizing";
    }

    public static class BackupFileStatus
    {
        public const string Archiving = "Archiving";
        public const string Archived = "Archived";
        public const string ArchiveFailed = "ArchiveFailed";
        public const string Uploading = "Uploading";
        public const string Completed = "Completed";
        public const string UploadFailed = "UploadFailed";
    }
}
