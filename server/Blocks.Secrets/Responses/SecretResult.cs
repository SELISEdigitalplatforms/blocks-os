namespace Blocks.Secrets;

/// <summary>
/// Metadata view of a secret.
/// </summary>
/// <remarks>
/// Has no value and no vault-derived field, by design. A contract test asserts this so a
/// future edit cannot quietly reintroduce one.
/// </remarks>
public sealed class SecretResult
{
    public string SecretId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public IReadOnlyList<string> Tags { get; set; } = [];

    public string Type { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string OrganizationId { get; set; } = string.Empty;

    public SecretAccess? Access { get; set; }

    public DateTime CreatedDate { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime LastUpdatedDate { get; set; }

    public string? LastUpdatedBy { get; set; }

    public DateTime? LastRotatedDate { get; set; }

    public string? LastRotatedBy { get; set; }

    public int RotationCount { get; set; }

    public DateTime? DeletedDate { get; set; }

    public string? DeletedBy { get; set; }

    /// <summary>
    /// Whether the calling context would be allowed to read this secret's value. Lets a UI
    /// enable or disable reveal without a speculative round trip.
    /// </summary>
    public bool CanReadValue { get; set; }
}
