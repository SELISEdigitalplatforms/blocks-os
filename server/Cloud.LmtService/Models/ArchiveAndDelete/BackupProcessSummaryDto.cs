namespace Cloud.LmtService.Models.ArchiveAndDelete
{
    public class BackupProcessSummaryDto
    {
        public DateTime BackupStartTime { get; set; }
        public DateTime BackupEndTime { get; set; }
        public DateTime ProcessStartDate { get; set; }
        public DateTime ProcessEndDate { get; set; }
        public int SuccessfulLogsUploads { get; set; }
        public int SuccessfulTraceUploads { get; set; }
        public Dictionary<string, string> FailedTracesByTenantId { get; set; } = new();
        public int FailedTraceUploads { get; set; }
        public Dictionary<string, string> FailedBlocksServiceLogsByTenantId { get; set; } = new();
        public int FailedBlocksServiceLogUploads { get; set; }
        public Dictionary<string, string> FailedManagedServiceLogsByTenantId { get; set; } = new();
        public int FailedManagedServiceLogUploads { get; set; }
    }
}
