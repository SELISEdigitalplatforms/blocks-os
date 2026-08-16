using Blocks.Genesis;
using MongoDB.Bson.Serialization.Attributes;

namespace Blocks.Secrets;

/// <summary>
/// Secret metadata. The value itself lives in the vault and is never stored here.
/// </summary>
/// <remarks>
/// This type must never gain a member that holds or points at a secret value: no
/// <c>Value</c>, <c>KeyValuePairs</c>, <c>KeyPairs</c>, <c>VaultUri</c>,
/// <c>KeyVaultSecretName</c> or <c>KeyVaultVersion</c>. The vault key is derived from
/// <see cref="Blocks.Genesis.BaseEntity.ItemId"/> at call time, so there is nothing to store.
/// A contract test enforces this.
/// </remarks>
[BsonIgnoreExtraElements]
public class Secret : BaseEntity
{
    public string TenantId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Lowercase projection of <see cref="Name"/>, maintained by the repository.
    /// Backs the case-insensitive uniqueness index.
    /// </summary>
    public string NameLower { get; set; } = string.Empty;

    public string? Description { get; set; }

    public string Type { get; set; } = SecretTypes.Api;

    public string Status { get; set; } = SecretStatuses.Active;

    public SecretAccess? Access { get; set; }

    public DateTime? LastRotatedDate { get; set; }

    public string? LastRotatedBy { get; set; }

    public int RotationCount { get; set; }

    public string? DeletedBy { get; set; }

    public DateTime? DeletedDate { get; set; }

    // OrganizationId is inherited from BaseEntity. Redeclaring it here would shadow the base
    // property and give Mongo two members mapped to the same element.
}
