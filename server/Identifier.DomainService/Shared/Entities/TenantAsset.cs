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

        /// <summary>
        /// <see cref="ProjectTypes.Regular"/> or <see cref="ProjectTypes.Template"/>. Groups created
        /// before project types existed have no value and are regular.
        /// </summary>
        public string? ProjectType { get; set; }
    }
}
