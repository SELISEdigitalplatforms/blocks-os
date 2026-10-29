namespace Cloud.LmtService.Models.ArchiveAndDelete
{
    public class BackupTracesBatchMessage
    {
        public List<string> TenantIds { get; set; } = new();
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
    }
}
