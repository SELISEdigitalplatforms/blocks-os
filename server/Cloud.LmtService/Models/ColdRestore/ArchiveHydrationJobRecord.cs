using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Cloud.LmtService.Models.ColdRestore
{
    [BsonIgnoreExtraElements]
    public class ArchiveHydrationJobRecord
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
        public ArchiveHydrationStatus Status { get; set; } = ArchiveHydrationStatus.Pending;

        public DateTime RequestedAt { get; set; }
        public DateTime? LastCheckedAt { get; set; }
        public DateTime? CompletedAt { get; set; }

        public string? ErrorMessage { get; set; }

        public DateTime ExpireAt { get; set; }
    }
}
