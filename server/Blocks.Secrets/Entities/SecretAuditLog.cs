using Blocks.Genesis;
using MongoDB.Bson.Serialization.Attributes;

namespace Blocks.Secrets;

/// <summary>
/// One audited secret operation.
/// </summary>
/// <remarks>
/// Must never carry a plaintext value, nor any hash, prefix or length of one — those all leak
/// information about the secret and defeat the point of keeping values out of Mongo.
/// </remarks>
[BsonIgnoreExtraElements]
public class SecretAuditLog : BaseEntity
{
    public string TenantId { get; set; } = string.Empty;

    public string? SecretId { get; set; }

    public string? SecretName { get; set; }

    public string Action { get; set; } = string.Empty;

    public string Outcome { get; set; } = SecretAuditOutcomes.Success;

    /// <summary>Machine-readable code from <see cref="SecretAuditReasons"/>.</summary>
    public string? Reason { get; set; }

    public string ActorUserId { get; set; } = string.Empty;

    public List<string> ActorRoles { get; set; } = new();

    public bool IsRootOverride { get; set; }

    public bool Impersonated { get; set; }

    public string? ImpersonationSessionId { get; set; }

    public string? OriginalTenantId { get; set; }

    public string? RequestUri { get; set; }

    public string? TraceId { get; set; }

    /// <summary>Number of secrets touched by a batch operation.</summary>
    public int? AffectedCount { get; set; }
}
