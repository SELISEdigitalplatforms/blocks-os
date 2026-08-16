namespace Blocks.Secrets;

public sealed class SecretFilter
{
    /// <summary>Case-insensitive match against name and description.</summary>
    public string? Search { get; set; }

    public string? Type { get; set; }

    public string? Status { get; set; }

    /// <summary>Deleted secrets are excluded unless this is set.</summary>
    public bool IncludeDeleted { get; set; }

    public string? OrganizationId { get; set; }

    /// <summary>1-based.</summary>
    public int PageNumber { get; set; } = 1;

    /// <summary>Clamped to [1, 100] by the service.</summary>
    public int PageSize { get; set; } = 20;
}
