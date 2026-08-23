using System.Diagnostics.CodeAnalysis;

namespace Blocks.Secrets;

/// <summary>
/// Canonical lowercase form of a secret name, persisted as <see cref="Secret.NameLower"/>.
/// </summary>
public static class SecretName
{
    /// <summary>
    /// Produces the lookup form of a secret name.
    /// </summary>
    /// <remarks>
    /// Lowercase rather than uppercase because the normalized form is persisted as
    /// <see cref="Secret.NameLower"/> and appears in queries; uppercasing would read as
    /// shouting in every log line and diff for no behavioural gain. Invariant culture, so a
    /// Turkish-locale host cannot map 'I' to a different letter and produce a different
    /// canonical form for the same name.
    /// </remarks>
    [SuppressMessage("Globalization", "CA1308:Normalize strings to uppercase",
        Justification = "The normalized form is a stored, human-visible lookup key; invariant lowercase is the intended canonical form.")]
    public static string Normalize(string? name) =>
        string.IsNullOrWhiteSpace(name) ? string.Empty : name.ToLowerInvariant();
}
