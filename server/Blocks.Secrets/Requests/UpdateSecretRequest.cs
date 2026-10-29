namespace Blocks.Secrets;

/// <summary>
/// Metadata-only update. The value is deliberately not updatable here — changing a value is
/// <c>RotateAsync</c>, which is separately permissioned and separately audited.
/// </summary>
public sealed class UpdateSecretRequest
{
    public string? Name { get; set; }

    public string? Description { get; set; }

    /// <summary>
    /// Replaces the whole tag set. Null leaves the existing tags alone; an empty collection
    /// clears them.
    /// </summary>
    /// <remarks>
    /// Replace rather than merge: with a merge there is no way to express "remove this one"
    /// without a second verb, and a UI editing a tag chip list already holds the full set.
    /// </remarks>
    public IReadOnlyCollection<string>? Tags { get; set; }
}
