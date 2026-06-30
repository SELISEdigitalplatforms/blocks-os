using Blocks.Genesis;
using DomainService.Projects;
using MongoDB.Bson.Serialization.Attributes;

namespace DomainService.Shared.Entities
{
    [BsonIgnoreExtraElements]
    public class TenantAsset : BaseEntity
    {
        public string TenantGroupId { get; set; }
        public List<Resource> Resources { get; set; }
    }
}
