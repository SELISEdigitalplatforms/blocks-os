namespace Blocks.Secrets;

public sealed class SecretFilter
{
    /// <summary>Case-insensitive match against name and description.</summary>
    public string? Search { get; set; }

    /// <summary>
    /// Restricts the result to secrets carrying <b>any</b> of these tags. Matching is on the
    /// normalized form, so the caller's casing does not matter.
    /// </summary>
    /// <remarks>
    /// Any-of rather than all-of because this backs a multi-select filter chip, where picking
    /// a second tag is read as widening the result, not narrowing it.
    /// </remarks>
    public IReadOnlyCollection<string>? Tags { get; set; }

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
