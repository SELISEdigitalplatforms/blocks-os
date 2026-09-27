using Blocks.Genesis;
using MongoDB.Bson.Serialization.Attributes;

namespace Configuration.DomainService.DataGateway.Entities
{
    // This maps onto the same "DataServiceConfigurations" collection/document blocks-data's own
    // DataServiceConfiguration entity reads and writes - field names must match its shape exactly
    // (in particular DbConnectionString, not ConnectionString) or the two sides silently diverge.
    [BsonIgnoreExtraElements]
    public class DataGatewayConfiguration : BaseEntity
    {
        public string ProjectKey { get; set; } = string.Empty;
        public string ProjectShortKey { get; set; } = string.Empty;
        public string DbConnectionString { get; set; } = string.Empty;
        public string DatabaseName { get; set; } = string.Empty;
        public bool IsCollectionNameEditable { get; set; }
        public string CollectionNamePattern { get; set; } = "sb_{SchemaName}s";
        public DateTime? DeletedDate { get; set; }
        public bool IsDeleted { get; set; }
        public AnalyticsConfiguration? AnalyticsConfiguration { get; set; }
    }

    public class AnalyticsConfiguration
    {
        public bool EnableAnalytics { get; set; }
        public DateTime? EnableDate { get; set; }
        public DateTime? ValidTill { get; set; }
    }
}
