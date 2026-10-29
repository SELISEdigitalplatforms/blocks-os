using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Cloud.LmtService.Models.ColdRestore
{
    [BsonIgnoreExtraElements]
    public class RestoreLogResultRecord
    {
        [BsonId]
        public ObjectId Id { get; set; }

        public string RequestId { get; set; } = string.Empty;

        public string TenantId { get; set; } = string.Empty;

        public DateTime SourceDate { get; set; }

        public DateTime? Timestamp { get; set; }

        public string Level { get; set; } = string.Empty;

        public string Message { get; set; } = string.Empty;

        public string TraceId { get; set; } = string.Empty;

        public string SpanId { get; set; } = string.Empty;

        public string ServiceName { get; set; } = string.Empty;

        public string ActionName { get; set; } = string.Empty;
        public string Exception { get; set; } = string.Empty;
        public string BlobPath { get; set; } = string.Empty;
        public DateTime ExpireAt { get; set; }
    }
}
