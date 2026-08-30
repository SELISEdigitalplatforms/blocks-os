namespace Cloud.LmtService.Models.ColdRestore
{
    public class RestoreTraceRow: RestoreTraceResultRecord
    {
        public string BaggageJson { get; set; } = string.Empty;
        public string TenantId { get; set; } = string.Empty;
    }
}
