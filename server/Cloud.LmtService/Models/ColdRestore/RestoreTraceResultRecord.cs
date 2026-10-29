using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Cloud.LmtService.Models.ColdRestore
{
    [BsonIgnoreExtraElements]
    public class RestoreTraceResultRecord
    {
        [BsonId]
        public ObjectId Id { get; set; }

        public string RequestId { get; set; } = string.Empty;

        public string TenantId { get; set; } = string.Empty;

        public DateTime SourceDate { get; set; }

        public DateTime? Timestamp { get; set; }

        public string TraceId { get; set; } = string.Empty;

        public string OperationName { get; set; } = string.Empty;

        public DateTime? StartTime { get; set; }

        public DateTime? EndTime { get; set; }

        public double Duration { get; set; }

        public string AttributesJson { get; set; } = string.Empty;

        public string ServiceName { get; set; } = string.Empty;
        public string SpanId { get; set; } = string.Empty;
        public string ParentSpanId { get; set; } = string.Empty;
        public string ParentId { get; set; } = string.Empty;
        public string Kind { get; set; } = string.Empty;
        public string ActivitySourceName { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string StatusDescription { get; set; } = string.Empty;
        public string Baggage { get; set; } = string.Empty;
        public string BlobPath { get; set; } = string.Empty;
        public DateTime ExpireAt { get; set; }
    }
}
