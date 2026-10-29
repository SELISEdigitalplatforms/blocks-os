using DomainService.Entities;

namespace DomainService.Dtos
{
    public class GroupedProjectsDto
    {
        public string TenantGroupId { get; set; } = string.Empty;
        public List<Project> Projects { get; set; } = [];
        public bool IsShared { get; set; }

        /// <summary>
        /// The caller's grants in this group, unioned across their rows. Empty for a group they
        /// own — an owner holds everything implicitly.
        /// </summary>
        /// <remarks>
        /// Carried on the list so the console can tell whether a shared project is worth opening
        /// without asking per card. Without it the console either hides the way in from every
        /// contributor, which is what it did, or offers one that bounces straight back.
        /// </remarks>
        public List<string> AccessPolicies { get; set; } = [];
        public List<Project> NonSharedProject { get; set; } = [];
    }
}
