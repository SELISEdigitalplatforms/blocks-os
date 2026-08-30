using MongoDB.Bson.Serialization.Attributes;

namespace Cloud.LmtService.Models.ArchiveAndDelete
{
    [BsonIgnoreExtraElements]
    public class StoredLog:StoredLogForParquet
    {
        public string TenantId { get; set; }

    }
}
