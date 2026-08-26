namespace Cloud.LmtService.Models.ArchiveAndDelete
{
    /// <summary>
    /// Summary of the entire backup process including traces and logs.
    /// </summary>
    public class BackupProcessSummary
    {
        public DateTime BackupStartTime { get; set; }
        public DateTime? BackupEndTime { get; set; }
        public DateTime ProcessStartDate { get; set; }
        public DateTime ProcessEndDate { get; set; }

        public TraceBackupSummary TraceBackupSummary { get; set; } = new();
        public BlocksServiceLogBackupSummary BlocksServiceLogBackupSummary { get; set; } = new();
        public ManagedServiceLogBackupSummary ManagedServiceLogBackupSummary { get; set; } = new();
        public LogsArchiveToBlobSummary LogsArchiveToBlobSummary { get; set; } = new();
        public TracesArchiveToBlobSummary TracesArchiveToBlobSummary { get; set; } = new();

        public bool LogsArchiveToBlobStarted { get; set; }
        public bool TracesArchiveToBlobStarted { get; set; }

        public override string ToString()
        {
            var duration = BackupEndTime.HasValue
                ? (BackupEndTime.Value - BackupStartTime).TotalMinutes
                : 0;

            return $@"
=== BACKUP PROCESS SUMMARY ===
Start Time: {BackupStartTime:yyyy-MM-dd HH:mm:ss}
End Time: {(BackupEndTime?.ToString("yyyy-MM-dd HH:mm:ss") ?? "In Progress")}
Duration: {duration:F2} minutes
Process Date Range: {ProcessStartDate:yyyy-MM-dd} to {ProcessEndDate:yyyy-MM-dd}

--- Traces Backup ---
{TraceBackupSummary}

--- Blocks Service Logs Backup ---
{BlocksServiceLogBackupSummary}

--- Managed Service Logs Backup ---
{ManagedServiceLogBackupSummary}

--- Logs Archive to Blob ---
{LogsArchiveToBlobSummary}

--- Traces Archive to Blob ---
{TracesArchiveToBlobSummary}
=============================";
        }
    }

    /// <summary>
    /// Summary of traces backup process.
    /// </summary>
    public class TraceBackupSummary
    {
        public int SuccessfulUploads { get; set; }
        public int FailedUploads { get; set; }
        public List<string> ProcessedTenantIds { get; set; } = new();
        public Dictionary<string, string> FailedTracesByTenantId { get; set; } = new();

        public override string ToString()
        {
            return $@"
  Successful Archives: {SuccessfulUploads}
  Failed Archives: {FailedUploads}
  Processed Tenants: {ProcessedTenantIds.Count}
  {(FailedTracesByTenantId.Count > 0 ? $"Failed Tenants: {string.Join(", ", FailedTracesByTenantId.Keys)}" : "")}";
        }
    }

    /// <summary>
    /// Summary of traces archive to blob process.
    /// </summary>
    public class TracesArchiveToBlobSummary: ArchiveSummaryModel
    {
        public override string ToString()
        {
            return $@"
  Successful Uploads: {SuccessfulUploads}
  Failed Uploads: {FailedUploads}
  Processed Collections: {ProcessedCollections.Count}
  {(FailedCollections.Count > 0 ? $"Failed Collections: {string.Join(", ", FailedCollections.Keys)}" : "")}";
        }
    }

    /// <summary>
    /// Summary of blocks service logs backup process.
    /// </summary>
    public class BlocksServiceLogBackupSummary
    {
        public int SuccessfulUploads { get; set; }
        public int FailedUploads { get; set; }
        public List<string> ProcessedServices { get; set; } = new();
        public Dictionary<string, List<string>> ProcessedTenantsByService { get; set; } = new();
        public Dictionary<string, string> FailedLogsByTenantId { get; set; } = new();

        public override string ToString()
        {
            return $@"
  Successful Archives: {SuccessfulUploads}
  Failed Archives: {FailedUploads}
  Processed Services: {ProcessedServices.Count}
  {(FailedLogsByTenantId.Count > 0 ? $"Failed Tenants: {string.Join(", ", FailedLogsByTenantId.Keys)}" : "")}";
        }
    }

    /// <summary>
    /// Summary of managed service logs backup process.
    /// </summary>
    public class ManagedServiceLogBackupSummary
    {
        public int SuccessfulUploads { get; set; }
        public int FailedUploads { get; set; }
        public List<string> ProcessedServices { get; set; } = new();
        public Dictionary<string, string> ProcessedTenantsByService { get; set; } = new();
        public Dictionary<string, string> FailedLogsByTenantId { get; set; } = new();

        public override string ToString()
        {
            return $@"
  Successful Archives: {SuccessfulUploads}
  Failed Archives: {FailedUploads}
  Processed Services: {ProcessedServices.Count}
  {(FailedLogsByTenantId.Count > 0 ? $"Failed Tenants: {string.Join(", ", FailedLogsByTenantId.Keys)}" : "")}";
        }
    }

    public class LogsArchiveToBlobSummary: ArchiveSummaryModel
    {
        public override string ToString()
        {
            return $@"
  Successful Uploads: {SuccessfulUploads}
  Failed Uploads: {FailedUploads}
  Processed Collections: {ProcessedCollections.Count}
  {(FailedCollections.Count > 0 ? $"Failed Collections: {string.Join(", ", FailedCollections.Keys)}" : "")}";
        }
    }
    public class ArchiveSummaryModel
    {
        public int SuccessfulUploads { get; set; }
        public int FailedUploads { get; set; }
        public List<string> ProcessedCollections { get; set; } = new();
        public Dictionary<string, string> FailedCollections { get; set; } = new();
    }
}
