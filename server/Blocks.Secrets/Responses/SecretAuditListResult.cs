namespace Blocks.Secrets;

public sealed class SecretAuditListResult
{
    public IReadOnlyList<SecretAuditLogResult> Data { get; set; } = Array.Empty<SecretAuditLogResult>();

    public long TotalCount { get; set; }
}
