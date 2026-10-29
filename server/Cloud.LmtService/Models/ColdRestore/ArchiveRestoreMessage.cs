namespace Cloud.LmtService.Models.ColdRestore
{
    public class ArchiveRestoreMessage
    {
        public string RequestId { get; set; } = string.Empty;

        public string TenantId { get; set; } = string.Empty;

        public DateTime StartDate { get; set; }

        public DateTime EndDate { get; set; }

        public string? ServiceName { get; set; }
    }
}
