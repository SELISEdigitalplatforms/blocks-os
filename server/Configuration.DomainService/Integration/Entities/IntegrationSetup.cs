using Blocks.Genesis;
using MongoDB.Bson.Serialization.Attributes;

namespace Configuration.DomainService.Integration.Entities
{
    /// <summary>
    /// The record that a project has completed Integration setup, and what that setup created.
    /// </summary>
    /// <remarks>
    /// Stored in the tenant's own database, at most one per template (a unique index on
    /// <see cref="TemplateKey"/>). Only references are kept: the client secret stays with IAM's
    /// credential and is read from there when shown.
    /// </remarks>
    [BsonIgnoreExtraElements]
    public class IntegrationSetup : BaseEntity
    {
        public string TemplateKey { get; set; } = string.Empty;

        public string TemplateDisplayName { get; set; } = string.Empty;

        public string RoleId { get; set; } = string.Empty;

        public string RoleSlug { get; set; } = string.Empty;

        /// <summary>The IAM client credential id, which is also the client id.</summary>
        public string ClientCredentialId { get; set; } = string.Empty;

        public string ConnectionName { get; set; } = string.Empty;
        public string Source { get; set; } = "manual";
        public string Status { get; set; } = "active";
        public string? SiteUrl { get; set; }
        public bool NeverDelivered { get; set; }
        public string? RevokedBy { get; set; }
        public DateTime? RevokedDate { get; set; }
        public string TemplateAccessLevel { get; set; } = string.Empty;
    }
}
