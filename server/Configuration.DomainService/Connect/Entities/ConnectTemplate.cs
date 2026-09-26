using Blocks.Genesis;
using MongoDB.Bson.Serialization.Attributes;

namespace Configuration.DomainService.Connect.Entities
{
    /// <summary>
    /// What a Connect setup provisions: the role to create, the permissions to assign to it and
    /// the client credential to issue for it.
    /// </summary>
    /// <remarks>
    /// Lives in the shared <c>BlocksConfiguration</c> database, not in a tenant's own, so every
    /// project reads the same template and a change to it needs no per-tenant copy. Permissions
    /// are listed by resource name because permission ids differ from tenant to tenant; the
    /// caller resolves them against the tenant's own <c>Permissions</c> at setup time.
    /// </remarks>
    [BsonIgnoreExtraElements]
    public class ConnectTemplate : BaseEntity
    {
        /// <summary>Stable identifier of the template, e.g. <c>localization</c>.</summary>
        public string Key { get; set; } = string.Empty;

        public string DisplayName { get; set; } = string.Empty;

        public string? Description { get; set; }

        public string RoleName { get; set; } = string.Empty;

        /// <summary>
        /// The slug requested when the role is created. IAM derives the stored slug itself, so
        /// the one actually in effect is the one recorded on <see cref="ConnectSetup.RoleSlug"/>.
        /// </summary>
        public string RoleSlug { get; set; } = string.Empty;

        public string? RoleDescription { get; set; }

        /// <summary>Permission resource names, e.g. <c>blocks-localization::key::gets</c>.</summary>
        public List<string> Permissions { get; set; } = [];

        public string ClientCredentialName { get; set; } = string.Empty;

        public int AccessTokenValidForNumberMinutes { get; set; } = 60;

        public bool IsActive { get; set; } = true;
    }
}
