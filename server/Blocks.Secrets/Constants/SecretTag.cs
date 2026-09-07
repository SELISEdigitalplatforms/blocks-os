using System.Diagnostics.CodeAnalysis;

namespace Blocks.Secrets;

/// <summary>
/// Canonical form and limits for the free-form labels on <see cref="Secret.Tags"/>.
/// </summary>
/// <remarks>
/// Tags are normalized on write rather than matched case-insensitively on read. A stored
/// lowercase form keeps a tag filter an indexed equality; a case-insensitive read would need a
/// regex per tag and would scan.
/// </remarks>
public static class SecretTag
{
    /// <summary>Upper bound on tags carried by one secret.</summary>
    public const int MaxPerSecret = 20;

    public const int MaxLength = 50;

    /// <summary>Upper bound on tags in a single filter, so one query cannot fan out unbounded.</summary>
    public const int MaxPerFilter = 10;

    /// <summary>
    /// Produces the stored form of a tag: trimmed and invariant-lowercased.
    /// </summary>
    /// <remarks>
    /// Invariant culture for the same reason as <see cref="SecretName.Normalize"/>: a
    /// Turkish-locale host must not map 'I' to a different letter and split one tag into two.
    /// </remarks>
    [SuppressMessage("Globalization", "CA1308:Normalize strings to uppercase",
        Justification = "The normalized form is a stored, human-visible lookup key; invariant lowercase is the intended canonical form.")]
    public static string Normalize(string? tag) =>
        string.IsNullOrWhiteSpace(tag) ? string.Empty : tag.Trim().ToLowerInvariant();

    /// <summary>
    /// Normalizes a set of tags, dropping blanks and duplicates and ordering the result.
    /// </summary>
    /// <remarks>
    /// Ordered so two writes of the same set produce the same document, which keeps diffs and
    /// audit comparisons meaningful. Does not validate — see <c>SecretService.ValidateTags</c>.
    /// </remarks>
    public static List<string> NormalizeAll(IEnumerable<string>? tags) =>
        tags is null
            ? []
            : tags.Select(Normalize)
                  .Where(tag => tag.Length > 0)
                  .Distinct(StringComparer.Ordinal)
                  .Order(StringComparer.Ordinal)
                  .ToList();

    /// <summary>
    /// Whether a normalized tag is well formed: starts alphanumeric, then alphanumeric plus
    /// dot, underscore, hyphen or colon. Colon is allowed so a caller can namespace a tag as
    /// <c>env:prod</c> without needing a second field.
    /// </summary>
    public static bool IsWellFormed(string? tag)
    {
        if (string.IsNullOrEmpty(tag) || tag.Length > MaxLength)
        {
            return false;
        }

        if (!char.IsAsciiLetterOrDigit(tag[0]))
        {
            return false;
        }

        foreach (var character in tag)
        {
            if (!char.IsAsciiLetterOrDigit(character) && character is not ('.' or '_' or '-' or ':'))
            {
                return false;
            }
        }

        return true;
    }
}
