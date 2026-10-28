using System.Text.Json;

namespace Configuration.DomainService.Notification.Push
{
    /// <summary>
    /// A checked Firebase web config (the 4 values a browser needs to register for push). Stored only in Blocks
    /// Secrets as <see cref="ToSecretJson"/>. Errors never hold any part of a value.
    /// </summary>
    public sealed record PushWebConfig(string ApiKey, string AppId, string MessagingSenderId, string VapidKey)
    {
        public const string NotWebConfig = "This is not a Firebase web config.";
        public const string AppIdWrong = "App ID looks wrong (expected 1:<number>:web:<id>).";
        public const string SenderIdWrong = "Sender ID looks wrong.";
        public const string AppIdOtherSender = "App ID belongs to another sender.";
        public const string VapidMissing = "Add the VAPID public key.";
        public const string VapidWrong = "The VAPID public key looks wrong.";
        public const string OtherProject = "This config is for another Firebase project.";

        private const string AppIdWebPart = ":web:";

        /// <summary>
        /// Checks <paramref name="request"/> against the key's project <paramref name="keyProjectId"/>.
        /// Returns the config, or null with <paramref name="error"/> set.
        /// </summary>
        public static PushWebConfig? TryCreate(PushWebConfigRequest request, string keyProjectId, out string? error)
        {
            ArgumentNullException.ThrowIfNull(request);
            var apiKey = request.ApiKey?.Trim() ?? string.Empty;
            var appId = request.AppId?.Trim() ?? string.Empty;
            var senderId = request.MessagingSenderId?.Trim() ?? string.Empty;
            var vapidKey = request.VapidKey?.Trim() ?? string.Empty;
            var projectId = request.ProjectId?.Trim();

            error = FindError(apiKey, appId, senderId, vapidKey);
            if (error is null && !string.IsNullOrEmpty(projectId) && !string.Equals(projectId, keyProjectId, StringComparison.Ordinal))
            {
                error = OtherProject;
            }

            return error is null ? new PushWebConfig(apiKey, appId, senderId, vapidKey) : null;
        }

        /// <summary>The secret value: <c>{"apiKey","appId","messagingSenderId","vapidKey"}</c> (shared contract §1).</summary>
        public string ToSecretJson() => JsonSerializer.Serialize(new Dictionary<string, string>
        {
            ["apiKey"] = ApiKey,
            ["appId"] = AppId,
            ["messagingSenderId"] = MessagingSenderId,
            ["vapidKey"] = VapidKey,
        });

        private static string? FindError(string apiKey, string appId, string senderId, string vapidKey)
        {
            if (!IsBase64UrlText(apiKey, 30, 60))
                return NotWebConfig;
            if (!TryGetAppIdNumber(appId, out var appIdNumber))
                return AppIdWrong;
            if (senderId.Length is < 1 or > 20 || !senderId.All(char.IsAsciiDigit))
                return SenderIdWrong;
            if (!string.Equals(appIdNumber, senderId, StringComparison.Ordinal))
                return AppIdOtherSender;
            if (vapidKey.Length == 0)
                return VapidMissing;
            return IsBase64UrlText(vapidKey, 60, 120) ? null : VapidWrong;
        }

        /// <summary><c>1:&lt;digits&gt;:web:&lt;hex&gt;</c>; gives the digits (the sender number).</summary>
        private static bool TryGetAppIdNumber(string appId, out string number)
        {
            number = string.Empty;
            if (!appId.StartsWith("1:", StringComparison.Ordinal))
                return false;

            var webAt = appId.IndexOf(AppIdWebPart, StringComparison.Ordinal);
            if (webAt < 3)
                return false;

            var digits = appId[2..webAt];
            var hex = appId[(webAt + AppIdWebPart.Length)..];
            if (digits.Length > 20 || !digits.All(char.IsAsciiDigit) || hex.Length == 0 || !hex.All(char.IsAsciiHexDigit))
                return false;

            number = digits;
            return true;
        }

        private static bool IsBase64UrlText(string value, int minLength, int maxLength) =>
            value.Length >= minLength && value.Length <= maxLength && value.All(c => char.IsAsciiLetterOrDigit(c) || c == '-' || c == '_');
    }
}
