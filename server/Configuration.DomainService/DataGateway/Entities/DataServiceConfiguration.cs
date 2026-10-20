using Blocks.Genesis;
using MongoDB.Bson.Serialization.Attributes;

namespace Configuration.DomainService.DataGateway.Entities
{
    /// <summary>
    /// Root data-source configuration of a tenant: one doc per tenant in <c>BlocksRootDb.DataServiceConfigurations</c>,
    /// <c>_id = TenantId</c>. Same collection and field names blocks-data reads at runtime. The connection string is never
    /// stored here: it lives in the Blocks <c>Service</c> secret <see cref="DbConnectionSecretId"/> points at.
    /// </summary>
    [BsonIgnoreExtraElements]
    public class DataServiceConfiguration : BaseEntity
    {
        /// <summary>Id of the secret that holds <c>default</c> (Blocks DB) or the plain connection string. Always set.</summary>
        public string DbConnectionSecretId { get; set; } = string.Empty;
        /// <summary>The owning tenant; equals <c>_id</c>.</summary>
        public string TenantId { get; set; } = string.Empty;
        public bool IsDeleted { get; set; }
        public string ProjectKey { get; set; } = string.Empty;
        public string ProjectShortKey { get; set; } = string.Empty;
        public string DatabaseName { get; set; } = string.Empty;
        public bool IsCollectionNameEditable { get; set; }
        public string CollectionNamePattern { get; set; } = "sb_{SchemaName}s";
        public AnalyticsConfiguration? AnalyticsConfiguration { get; set; }
    }

    public class AnalyticsConfiguration
    {
        public bool EnableAnalytics { get; set; }
        public DateTime? EnableDate { get; set; }
        public DateTime? ValidTill { get; set; }
    }
}
