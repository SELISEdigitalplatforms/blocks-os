namespace Blocks.Secrets;

/// <summary>
/// One tag in the tenant's tag catalogue: the stored key plus the text a person reads.
/// </summary>
/// <remarks>
/// A secret carries only the <see cref="Key"/>. The label exists so a catalogue entry can read
/// as "Blocks Iam" while the value stored on every secret, indexed and filtered on, stays the
/// short, canonical <c>iam</c>.
/// </remarks>
public sealed class SecretTagEntry
{
    /// <summary>Canonical form, as produced by <see cref="SecretTag.Normalize"/>.</summary>
    public string Key { get; set; } = string.Empty;

    /// <summary>Display text. Falls back to the key when nothing better is known.</summary>
    public string Label { get; set; } = string.Empty;
}
