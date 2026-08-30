using MongoDB.Bson.Serialization.Attributes;

namespace Cloud.LmtService.Models.ArchiveAndDelete
{
    public class TracesBackupMessage
    {
        public List<string> TenantIds { get; set; } = new List<string>();
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
    }

    public class ManagedServiceLogBackupMessage
    {
        public List<string> ServiceNames { get; set; } = new List<string>();
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
    }

    public class ArchiveLogsToBlobMessage
    {
        public DateTime RequestTime { get; set; } = DateTime.UtcNow;
    }

    public class ArchiveTracesToBlobMessage
    {
    }

    /// <summary>
    /// Lightweight class for document existence checks via projection.
    /// Using this reduces the data transferred from MongoDB.
    /// </summary>
    [BsonIgnoreExtraElements]
    public class ItemId
    {
        [BsonId]
        public required object Id { get; set; }
    }
}
