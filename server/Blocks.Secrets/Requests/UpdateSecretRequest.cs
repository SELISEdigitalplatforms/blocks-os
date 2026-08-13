namespace Blocks.Secrets;

/// <summary>
/// Metadata-only update. The value is deliberately not updatable here — changing a value is
/// <c>RotateAsync</c>, which is separately permissioned and separately audited.
/// </summary>
public sealed class UpdateSecretRequest
{
    public string? Name { get; set; }

    public string? Description { get; set; }
}
