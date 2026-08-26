namespace Cloud.LmtService.Models.ArchiveAndDelete
{
    /// <summary>
    /// Message to backup logs for a batch of tenants for a specific blocks service.
    /// Queries logs for multiple tenants, then groups by TenantId.
    /// </summary>
    public class BlocksServiceLogBatchBackupMessage
    {
        public string ServiceName { get; set; } = string.Empty;
        public List<string> TenantIds { get; set; } = new();
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
    }
}
