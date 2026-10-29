namespace Cloud.LmtService.Models.ArchiveAndDelete
{
    public class FailedArchiveLog
    {
        public DateTime FailedAt { get; set; } = DateTime.UtcNow;
        public string ServiceName { get; set; } = string.Empty;
        public string TenantId { get; set; } = string.Empty;
        public DateTime ProcessStartDate { get; set; }
        public DateTime ProcessEndDate { get; set; }
        public string FailureReason { get; set; } = string.Empty;
        public string Timestamp { get; set; } = string.Empty;
        public string ActionName { get; set; } = string.Empty;
        public string TraceId { get; set; } = string.Empty;
        public string EnvironmentName { get; set; } = string.Empty;
        public string ParentId { get; set; } = string.Empty;
        public string RequestPath { get; set; } = string.Empty;
        public string Exception { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string ParentSpanId { get; set; } = string.Empty;
        public string SpanId { get; set; } = string.Empty;
        public string Level { get; set; } = string.Empty;

        public static FailedArchiveLog FromStoredLog(StoredLog log, string serviceName, string failureReason, DateTime processStartDate, DateTime processEndDate)
        {
            return new FailedArchiveLog
            {
                FailedAt = DateTime.UtcNow,
                ServiceName = serviceName,
                TenantId = log.TenantId,
                ProcessStartDate = processStartDate,
                ProcessEndDate = processEndDate,
                FailureReason = failureReason,
                Timestamp = log.Timestamp,
                ActionName = log.ActionName,
                TraceId = log.TraceId,
                EnvironmentName = log.EnvironmentName,
                ParentId = log.ParentId,
                RequestPath = log.RequestPath,
                Exception = log.Exception,
                Message = log.Message,
                ParentSpanId = log.ParentSpanId,
                SpanId = log.SpanId,
                Level = log.Level
            };
        }
    }
}
