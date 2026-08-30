namespace Cloud.LmtService.Models.ArchiveAndDelete
{
    /// <summary>
    /// Message to backup logs for a batch of tenants across managed services.
    /// One message per batch of tenants -> triggers events for each managed service per tenant.
    /// </summary>
    public class ManagedServiceLogBatchBackupMessage
    {
        public List<string> TenantIds { get; set; } = new();
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
    }
}
