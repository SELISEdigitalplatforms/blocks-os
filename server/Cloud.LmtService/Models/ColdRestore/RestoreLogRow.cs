namespace Cloud.LmtService.Models.ColdRestore
{
    public class RestoreLogRow
    {
        public DateTime? Timestamp { get; set; }

        public string Level { get; set; } = string.Empty;

        public string Message { get; set; } = string.Empty;

        public string TraceId { get; set; } = string.Empty;

        public string SpanId { get; set; } = string.Empty;

        public string ServiceName { get; set; } = string.Empty;

        public string ActionName { get; set; } = string.Empty;

        public string Exception { get; set; } = string.Empty;
    }
}
