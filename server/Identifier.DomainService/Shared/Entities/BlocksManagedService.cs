using Blocks.Genesis;
using MongoDB.Bson.Serialization.Attributes;

namespace DomainService.Shared.Entities
{
    [BsonIgnoreExtraElements]
    public class BlocksManagedService : BaseEntity
    {
        public string Name { get; set; }
        public string TenantId { get; set; }
        public string Description { get; set; }
        public string ServiceId { get; set; }
        public Dictionary<string, object> Metadata { get; set; } = new();
        public string ServiceBusConnectionString { get; set; }
        public string ServiceType { get; set; }
    }

    /// <summary>
    /// Runtime topology of a managed service registered with the platform.
    /// </summary>
    public enum BlocksManagedServiceType
    {
        /// <summary>Unspecified or legacy value.</summary>
        None = 0,

        /// <summary>HTTP API service that handles request/response traffic.</summary>
        Api = 1,

        /// <summary>Background worker that consumes queued jobs.</summary>
        Worker = 2,
    }
}
