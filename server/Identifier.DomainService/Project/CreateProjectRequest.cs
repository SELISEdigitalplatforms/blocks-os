using Blocks.Genesis;

namespace DomainService.Projects
{
    public class CreateProjectRequest
    {
        public string Name { get; set; }
        public bool IsAcceptBlocksTerms { get; set; }
        public bool IsUseBlocksExclusively { get; set; }
        public bool IsProduction { get; set; }
        public string? TenantGroupId { get; set; }
        public List<Resource>? Resources { get; set; }
        public List<ApplicationContext> applicationContexts { get; set; }

        /// <summary>Optional, at most 500 characters. Stored on a new project group only.</summary>
        public string? Description { get; set; }

        /// <summary>
        /// Optional repository → environments plan for a new project group. Every ResourceId must
        /// be one of <see cref="Resources"/>; per environment the count is capped by the
        /// catalogue's <c>release.repos</c>.
        /// </summary>
        public List<DomainService.Shared.Entities.RepositoryDeployment>? RepositoryDeployments { get; set; }
    }

    public class ApplicationContext
    {
        public string Environment { get; set; } // e.g., DEV, STG, PROD
        public string Domain { get; set; } // e.g.,dev.example.com
        public string CookieDomain { get; set; }
    }

    public class CreateProjectResponse : BaseResponse
    {
        public string? TenantGroupId { get; set; }
    }

    public class Resource
    {
        public string ResourceId { get; set; }
        public string Name { get; set; }
        public string Link { get; set; }
        public DateTime CreatedDate { get; set; }
        public DateTime LastUpdatedDate { get; set; }
        /// <summary>Removing a repository archives it: the row is kept so re-adding the same
        /// repository restores it instead of creating a second entry. Reads filter these out.</summary>
        public bool IsArchived { get; set; }
    }
}
