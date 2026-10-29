using MongoDB.Bson.Serialization.Attributes;

namespace Cloud.LmtService.Models.ArchiveAndDelete
{
    [BsonIgnoreExtraElements]
    public class StoredTrace
    {
       public string Timestamp { get; set; }
       public string TraceId { get; set; }
       public string SpanId { get; set; }
       public string ParentSpanId { get; set; }
       public string ParentId { get; set; }
       public string OperationName { get; set; }
       public string Kind { get; set; }
       public string StartTime { get; set; }
       public string EndTime { get; set; }
       public double Duration { get; set; }
       public string Attributes { get; set; }
       public string Baggage { get; set; }
       public string Status { get; set; }
       public string StatusDescription { get; set; }
       public string ServiceName { get; set; }
       public string TenantId { get; set; }
    }
}
