namespace Cloud.LmtService.Models.ArchiveAndDelete
{
    public class TracesStoredByTenantId
    {
        public string TenantId { get; set; } = string.Empty;
        public List<StoredTrace> Traces { get; set; } = new List<StoredTrace>();
    }
}
