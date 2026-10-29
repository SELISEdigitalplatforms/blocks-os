namespace Blocks.Secrets;

public sealed class SecretAuditLogResult
{
    public string AuditId { get; set; } = string.Empty;

    public string? SecretId { get; set; }

    public string? SecretName { get; set; }

    public string Action { get; set; } = string.Empty;

    public string Outcome { get; set; } = string.Empty;

    public string? Reason { get; set; }

    public string ActorUserId { get; set; } = string.Empty;

    public IReadOnlyList<string> ActorRoles { get; set; } = Array.Empty<string>();

    public bool IsRootOverride { get; set; }

    public bool Impersonated { get; set; }

    public string? RequestUri { get; set; }

    public string? TraceId { get; set; }

    public int? AffectedCount { get; set; }

    public DateTime CreatedDate { get; set; }
}
