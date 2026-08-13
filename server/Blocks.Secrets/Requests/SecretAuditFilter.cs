namespace Blocks.Secrets;

public sealed class SecretAuditFilter
{
    public string? SecretId { get; set; }

    public string? Action { get; set; }

    public string? ActorUserId { get; set; }

    public DateTime? FromDate { get; set; }

    public DateTime? ToDate { get; set; }

    /// <summary>1-based.</summary>
    public int PageNumber { get; set; } = 1;

    /// <summary>Clamped to [1, 100] by the service.</summary>
    public int PageSize { get; set; } = 20;
}
