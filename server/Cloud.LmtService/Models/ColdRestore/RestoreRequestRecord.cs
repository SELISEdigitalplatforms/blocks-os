using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Cloud.LmtService.Models.ColdRestore
{
    [BsonIgnoreExtraElements]
    public class RestoreRequestRecord
    {
        [BsonId]
        [BsonRepresentation(BsonType.String)]
        public string RequestId { get; set; } = string.Empty;

        public string TenantId { get; set; } = string.Empty;

        public string? ServiceName { get; set; }

        public DateTime StartDate { get; set; }

        public DateTime EndDate { get; set; }

        // When the request was created
        public DateTime Timestamp { get; set; }

        [BsonRepresentation(MongoDB.Bson.BsonType.String)]
        public RestoreRequestStatus Status { get; set; } = RestoreRequestStatus.Pending;

        public DateTime CreatedAt { get; set; }

        public DateTime? StartedAt { get; set; }

        public DateTime? CompletedAt { get; set; }

        public int TotalFiles { get; set; }

        public int ProcessedFiles { get; set; }

        public int FailedFiles { get; set; }

        public int TraceRowsRestored { get; set; }

        public int LogRowsRestored { get; set; }

        public List<string> Errors { get; set; } = new();
        public DateTime ExpireAt { get; set; }
        [BsonRepresentation(MongoDB.Bson.BsonType.String)]
        public RestoreSourceType SourceType { get; set; } = RestoreSourceType.Cold;
        public string? UserEmail { get; set; }
    }
}
