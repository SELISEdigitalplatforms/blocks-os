using Blocks.Genesis;

namespace DomainService.Preference
{
    /// <summary>
    /// The settings a user may keep through <c>UserPreference</c>. A fixed list, so the
    /// key-value store only ever holds what a console screen actually reads back.
    /// </summary>
    public static class UserPreferenceKeys
    {
        /// <summary>The console sidebar: favourites and the order of the apps' blocks.</summary>
        public const string SidebarLayout = "sidebar-layout";

        public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.Ordinal)
        {
            SidebarLayout,
        };

        /// <summary>Largest value accepted, in characters. A layout is a few hundred.</summary>
        public const int MaxValueLength = 16 * 1024;
    }

    public class GetUserPreferenceRequest
    {
        public string Key { get; set; } = string.Empty;
    }

    /// <summary>The caller's value for one key.</summary>
    public class GetUserPreferenceResponse : BaseResponse
    {
        public string Key { get; set; } = string.Empty;

        /// <summary>The JSON as saved; null when the caller has never saved this key.</summary>
        public string? Value { get; set; }
    }

    public class SaveUserPreferenceRequest
    {
        public string Key { get; set; } = string.Empty;

        /// <summary>A JSON document; the client owns its shape.</summary>
        public string Value { get; set; } = string.Empty;
    }
}
