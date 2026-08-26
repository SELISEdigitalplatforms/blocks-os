namespace Cloud.LmtService.Models.ArchiveAndDelete
{
    /// <summary>
    /// DTO for parquet file serialization. Excludes TenantId as it is in the file path.
    /// </summary>
    public class StoredTraceForParquet: StoredTrace
    {
        /// <summary>
        /// Maps StoredTrace to StoredTraceForParquet, excluding TenantId only.
        /// </summary>
        public static StoredTraceForParquet FromStoredTrace(StoredTrace trace)
        {
            return new StoredTraceForParquet
            {
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
