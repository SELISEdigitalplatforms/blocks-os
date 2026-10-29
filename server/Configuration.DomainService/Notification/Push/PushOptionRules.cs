namespace Configuration.DomainService.Notification.Push
{
    /// <summary>Allowed values and limits of push platforms and options (shared contract §2). Null or empty always passes: not set.</summary>
    public static class PushOptionRules
    {
        public const int TtlMaxSeconds = 2_419_200; // 28 days, the FCM limit.
        public const int BadgeMax = 9999;
        public const int TextMax = 100;
        public const int LinkMax = 500;
        private const string HttpsScheme = "https://";

        public static readonly IReadOnlyList<string> Platforms = ["android", "ios", "web"];
        public static readonly IReadOnlyList<string> Priorities = ["high", "normal"];
        public static readonly IReadOnlyList<string> InterruptionLevels = ["active", "time-sensitive", "passive"];
        public static readonly IReadOnlyList<string> Urgencies = ["very-low", "low", "normal", "high"];

        public static bool IsOneOf(string? value, IReadOnlyList<string> allowed) =>
            string.IsNullOrEmpty(value) || allowed.Contains(value, StringComparer.Ordinal);

        /// <summary>Channel id, sound, thread id, collapse key: ≤ 100 of <c>[A-Za-z0-9._{}-]</c> ({field} placeholders allowed).</summary>
        public static bool IsToken(string? value) =>
            string.IsNullOrEmpty(value) || (value.Length <= TextMax && value.All(c => char.IsAsciiLetterOrDigit(c) || c is '.' or '_' or '-' or '{' or '}'));

        public static bool IsTtl(int? seconds) => seconds is null || (seconds >= 0 && seconds <= TtlMaxSeconds);

        /// <summary><c>#RRGGBB</c>.</summary>
        public static bool IsColor(string? value) =>
            string.IsNullOrEmpty(value) || (value.Length == 7 && value[0] == '#' && value.Skip(1).All(char.IsAsciiHexDigit));

        /// <summary>An absolute https link of at most 500 characters. Placeholders like {field} may sit in the path or query.</summary>
        public static bool IsHttpsLink(string? value) =>
            string.IsNullOrEmpty(value)
            || (value.Length <= LinkMax
                && value.StartsWith(HttpsScheme, StringComparison.OrdinalIgnoreCase)
                && value.Length > HttpsScheme.Length
                && !value.Any(char.IsWhiteSpace));
    }
}
