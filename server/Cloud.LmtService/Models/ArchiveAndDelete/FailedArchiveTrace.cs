namespace Cloud.LmtService.Models.ArchiveAndDelete
{
    public class FailedArchiveTrace
    {
        public DateTime FailedAt { get; set; } = DateTime.UtcNow;
        public string TenantId { get; set; } = string.Empty;
        public DateTime ProcessStartDate { get; set; }
        public DateTime ProcessEndDate { get; set; }
        public string FailureReason { get; set; } = string.Empty;
        public string Timestamp { get; set; } = string.Empty;
        public string TraceId { get; set; } = string.Empty;
        public string SpanId { get; set; } = string.Empty;
        public string ParentSpanId { get; set; } = string.Empty;
        public string ParentId { get; set; } = string.Empty;
        public string OperationName { get; set; } = string.Empty;
        public string Kind { get; set; } = string.Empty;
        public string StartTime { get; set; } = string.Empty;
        public string EndTime { get; set; } = string.Empty;
        public double Duration { get; set; }
        public string Attributes { get; set; } = string.Empty;
        public string Baggage { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string StatusDescription { get; set; } = string.Empty;
        public string ServiceName { get; set; } = string.Empty;

        public static FailedArchiveTrace FromStoredTrace(StoredTrace trace, string tenantId, string failureReason, DateTime processStartDate, DateTime processEndDate)
        {
            return new FailedArchiveTrace
            {
                FailedAt = DateTime.UtcNow,
                TenantId = tenantId,
                ProcessStartDate = processStartDate,
                ProcessEndDate = processEndDate,
                FailureReason = failureReason,
                Timestamp = trace.Timestamp,
                TraceId = trace.TraceId,
                SpanId = trace.SpanId,
                ParentSpanId = trace.ParentSpanId,
                ParentId = trace.ParentId,
                OperationName = trace.OperationName,
                Kind = trace.Kind,
                StartTime = trace.StartTime,
                EndTime = trace.EndTime,
                Duration = trace.Duration,
                Attributes = trace.Attributes,
                Baggage = trace.Baggage,
                Status = trace.Status,
                StatusDescription = trace.StatusDescription,
                ServiceName = trace.ServiceName
            };
        }
    }
}
