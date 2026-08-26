using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Cloud.LmtService.Models.Shared
{
    public class LmtArchiveRestoreConfigurations
    {
        [BsonId]
        [BsonRepresentation(BsonType.String)]
        [BsonElement("_id")]
        public string Id { get; set; } = default!;

        [BsonElement("Container")]
        public string Container { get; set; } = default!;

        [BsonElement("HotDataRetentionPeriodInDays")]
        public int HotDataRetentionPeriodInDays { get; set; }

        [BsonElement("RetentionDay")]
        public int RetentionDay { get; set; }

        [BsonElement("ColdToArchiveLifeCycleInDays")]
        public int ColdToArchiveLifeCycleInDays { get; set; }

        [BsonElement("EmailTemplateConfig")]
        public LogTraceRestoreEmailTConfig? EmailTemplateConfig { get; set; }

        [BsonElement("NotificationConfig")]
        public NotificationConfig? NotificationConfig { get; set; }
    }
    public class LogTraceRestoreEmailTConfig
    {
        public string TemplateName { get; set; }
    }
    public class NotificationConfig
    {
        public string NotificationUrl { get; set; }
        public string NotificationConfigName { get; set; }
    }
}
