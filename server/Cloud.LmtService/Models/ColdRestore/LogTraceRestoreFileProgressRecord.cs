using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Cloud.LmtService.Models.ColdRestore
{
    [BsonIgnoreExtraElements]
    public class LogTraceRestoreFileProgressRecord
    {
        [BsonId]
        public ObjectId Id { get; set; }

        public string RequestId { get; set; } = string.Empty;

        public string TenantId { get; set; } = string.Empty;

        [BsonRepresentation(MongoDB.Bson.BsonType.String)]
        public RestoreDataType DataType { get; set; }

        [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
        public DateTime FileDate { get; set; }

        public string BlobPath { get; set; } = string.Empty;

        [BsonRepresentation(MongoDB.Bson.BsonType.String)]
        public RestoreFileProgressStatus Status { get; set; } = RestoreFileProgressStatus.Pending;

        public int RowsRestored { get; set; }

        public DateTime Timestamp { get; set; }

        public DateTime? StartedAt { get; set; }

        public DateTime? CompletedAt { get; set; }

        public string? ErrorMessage { get; set; }
        public DateTime ExpireAt { get; set; }
        [BsonRepresentation(MongoDB.Bson.BsonType.String)]
        public RestoreSourceType SourceType { get; set; } = RestoreSourceType.Cold;

        public bool NeedsHydration { get; set; }

        [BsonRepresentation(MongoDB.Bson.BsonType.String)]
        public ArchiveHydrationStatus? HydrationStatus { get; set; }
    }
}
