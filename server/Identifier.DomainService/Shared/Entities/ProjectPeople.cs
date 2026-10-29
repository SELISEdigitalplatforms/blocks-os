using Blocks.Genesis;
using MongoDB.Bson.Serialization.Attributes;

namespace DomainService.Entities
{
    [BsonIgnoreExtraElements]
    public class ProjectPeople : BaseEntity
    {
        public string UserId { get; set; }
        public string Email { get; set; }
        public string TenantId { get; set; }
        public bool IsInvitationSent { get; set; }
        public bool IsInvitationConfirmed { get; set; }
        public bool IsCreator { get; set; }

        public List<string> Roles { get; set; } = [];

        /// <summary>
        /// What the owner granted this contributor in the project pages, as flat
        /// <c>menu::action</c> strings. Empty for owners, who hold everything implicitly.
        /// </summary>
        /// <remarks>
        /// Grants are group-wide while these rows are per-environment, so every row a member has
        /// in a group carries the same list. Two rules keep them that way:
        /// <c>SaveAccessPolicy</c> is the only writer and always writes all of the member's rows
        /// at once, and a new row added by an invitation is seeded from an existing one. Reads
        /// take the union across the rows regardless, so a drifted row degrades rather than
        /// silently removing access.
        ///
        /// Absent on existing documents, which deserialises to an empty list — no backfill.
        /// </remarks>
        public List<string> AccessPolicies { get; set; } = [];

    }

}
