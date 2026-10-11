using Blocks.Genesis;
using DomainService.Projects;
using MongoDB.Bson.Serialization.Attributes;

namespace DomainService.Shared.Entities
{
    /// <summary>
    /// The project group itself: one per <c>TenantGroupId</c>, holding what belongs to the project
    /// as a whole rather than to one environment.
    /// </summary>
    [BsonIgnoreExtraElements]
    public class TenantAsset : BaseEntity
    {
        public string TenantGroupId { get; set; }
        public List<Resource> Resources { get; set; }

        /// <summary>
        /// The project's name. Each environment's tenant carries it too; this copy is what a
        /// project created with no environment yet is called, and what its first one is named.
        /// </summary>
        public string? Name { get; set; }

        /// <summary>Free text the owner gave the project. At most 500 characters.</summary>
        public string? Description { get; set; }

        /// <summary>
        /// Which repository deploys to which environment — the create-project "Add repositories"
        /// grid. A plan, not wiring: per-branch deployment lives in blocks-release.
        /// </summary>
        public List<RepositoryDeployment> RepositoryDeployments { get; set; } = [];
    }

    public class RepositoryDeployment
    {
        /// <summary>A <see cref="Resource.ResourceId"/> in this group's <see cref="TenantAsset.Resources"/>.</summary>
        public string ResourceId { get; set; } = string.Empty;

        /// <summary>Catalogue environment keys: dev, test, stg, iat, uat, pre-prod, prod.</summary>
        public List<string> Environments { get; set; } = [];
    }
}
