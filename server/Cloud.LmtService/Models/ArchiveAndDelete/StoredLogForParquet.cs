namespace Cloud.LmtService.Models.ArchiveAndDelete
{
    /// <summary>
    /// DTO for parquet file serialization. Excludes TenantId and ServiceName as they are in the file path.
    /// </summary>
    public class StoredLogForParquet
    {
        public string Timestamp { get; set; }

        public string ActionName { get; set; }

        public string TraceId { get; set; }

        public string EnvironmentName { get; set; }

        public string ParentId { get; set; }

        public string RequestPath { get; set; }

        public string Exception { get; set; }

        public string Message { get; set; }

        public string ParentSpanId { get; set; }

        public string SpanId { get; set; }

        public string Level { get; set; }
        public string ServiceName { get; set; }

        /// <summary>
        /// Maps StoredLog to StoredLogForParquet, excluding TenantId.
        /// </summary>
        public static StoredLogForParquet FromStoredLog(StoredLog log)
        {
            return new StoredLogForParquet
            {
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
                Level = log.Level,
                ServiceName = log.ServiceName

            };
        }
    }
}
