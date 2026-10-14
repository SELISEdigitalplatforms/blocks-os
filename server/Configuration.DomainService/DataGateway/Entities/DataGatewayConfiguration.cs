using Blocks.Genesis;
using MongoDB.Bson.Serialization.Attributes;
using System.Text.Json.Serialization;

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
        // Root docs (BlocksRootDb, _id = TenantId) never carry this field (os SPEC2 §6.2), so it is
        // nullable and left out of the BSON when null. The GET answer always fills it.
        [BsonIgnoreIfNull]
        public string? DbConnectionString { get; set; } = string.Empty;

        // Root doc only: the Blocks Secrets id of the connection string, "default", or null (blank).
        // Never part of the GET JSON (today's keys only).
        [BsonIgnoreIfNull]
        [JsonIgnore]
        public string? DbConnectionSecretId { get; set; }

        // Root doc only: the old tenant-copy _id (the API's ItemId). A doc that has it is a root doc,
        // legacy tenant docs never have it (os SPEC2 §6.1a / §6.2).
        [BsonIgnoreIfNull]
        [JsonIgnore]
        public string? ConfigItemId { get; set; }

        // Root doc only: true once new code changed or chose the value (a flag, no value; never cleared).
        // Read so an update knows whether the flag still has to be written first (os SPEC2 §6.5 step 3).
        [BsonIgnoreIfNull]
        [JsonIgnore]
        public bool? ValueChangedAfterDeploy { get; set; }
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
