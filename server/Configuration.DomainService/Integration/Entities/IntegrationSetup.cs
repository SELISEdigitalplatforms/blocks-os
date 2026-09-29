using Blocks.Genesis;
using MongoDB.Bson.Serialization.Attributes;

namespace Configuration.DomainService.Integration.Entities
{
    /// <summary>
    /// The record that a project has completed Integration setup, and what that setup created.
    /// </summary>
    /// <remarks>
    /// Stored in the tenant's own database. A project has at most one, which is why every record
    /// carries the same <see cref="SingletonId"/>. Only references are kept: the client secret
    /// stays with IAM's credential and is read from there when shown.
    /// </remarks>
    [BsonIgnoreExtraElements]
    public class IntegrationSetup : BaseEntity
    {
        public const string SingletonId = "integration";

        public string TemplateKey { get; set; } = string.Empty;

        public string TemplateDisplayName { get; set; } = string.Empty;

        public string RoleId { get; set; } = string.Empty;

        public string RoleSlug { get; set; } = string.Empty;

        /// <summary>The IAM client credential id, which is also the client id.</summary>
        public string ClientCredentialId { get; set; } = string.Empty;
    }
}
