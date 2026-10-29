namespace Cloud.LmtService.Models.ArchiveAndDelete
{
    /// <summary>
    /// Message to backup logs for a specific service and tenant combination.
    /// This is the final granular message that triggers actual parquet file creation.
    /// </summary>
    public class BackupLogMessage
    {
        public string ServiceName { get; set; } = string.Empty;
        public string TenantId { get; set; } = string.Empty;
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
    }
}
