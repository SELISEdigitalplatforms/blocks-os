namespace Cloud.LmtService.Models.LogTraceBackup
{
    /// <summary>
    /// Embedded failure detail stored inside a tracker document when Status is ArchiveFailed or UploadFailed.
    /// </summary>
    public class LogTraceBackupFailedItem
    {
        /// <summary>The tenant the failure belongs to. Null for managed-service items before TenantId is resolved.</summary>
        public string? TenantId { get; set; }

        /// <summary>Service name — populated for log/service-log items, null for trace items.</summary>
        public string? ServiceName { get; set; }

        /// <summary>"Log" | "ServiceLog" | "Trace"</summary>
        public string Type { get; set; } = string.Empty;

        /// <summary>"Archiving" | "BlobUpload"</summary>
        public string Phase { get; set; } = string.Empty;

        /// <summary>
        /// The blob path that was being targeted.
        /// Null when the failure occurred during the Archiving phase (before a path was computed).
        /// </summary>
        public string? BlobPath { get; set; }

        /// <summary>Full exception detail captured via ex.ToString().</summary>
        public string Error { get; set; } = string.Empty;
    }
}
