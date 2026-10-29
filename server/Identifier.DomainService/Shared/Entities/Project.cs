using Blocks.Genesis;
using MongoDB.Bson.Serialization.Attributes;

namespace DomainService.Entities
{
    [BsonIgnoreExtraElements]
    public class Project : BaseEntity
    {
        public string Name { get; set; }

        /// <summary>
        /// The project's registered applications. Responses carrying this go through
        /// ProjectManagementService.VisibleApplications first, which drops the platform's own
        /// shared hosts — they are in every project's list and belong to none of them.
        /// </summary>
        public List<ApplicationDto> Applications { get; set; }
        public string TenantId { get; set; }
        public string TenantGroupId { get; set; }
        public bool IsDomainVerified { get; set; }
        public string CookieDomain { get; set; }
        public bool IsCookieEnable { get; set; }
        public string Environment { get; set; }
        public bool IsDisabled { get; set; }
        public string CustomDomain { get; set; }
    }
}
