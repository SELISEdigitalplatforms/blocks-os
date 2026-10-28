using MongoDB.Bson.Serialization.Attributes;

namespace Configuration.DomainService.Notification.Push
{
    /// <summary>
    /// Per-notification push options (shared contract §2). The same shape is the request/response field
    /// <c>pushOptions</c> and part of the KV record <see cref="NotificationPushOptionsRecord"/>.
    /// </summary>
    [BsonIgnoreExtraElements]
    public sealed class NotificationPushOptions
    {
        /// <summary>Link a web notification opens. https only.</summary>
        public string? WebLink { get; set; }

        public AndroidPushOptions? Android { get; set; }

        public IosPushOptions? Ios { get; set; }

        public WebPushOptions? Web { get; set; }
    }

    [BsonIgnoreExtraElements]
    public sealed class AndroidPushOptions
    {
        /// <summary>"high" or "normal".</summary>
        public string? Priority { get; set; }

        public string? ChannelId { get; set; }

        public string? Sound { get; set; }

        public int? TtlSeconds { get; set; }

        public string? CollapseKey { get; set; }

        /// <summary>"#RRGGBB".</summary>
        public string? Color { get; set; }
    }

    [BsonIgnoreExtraElements]
    public sealed class IosPushOptions
    {
        public string? Sound { get; set; }

        /// <summary>0 to 9999.</summary>
        public int? Badge { get; set; }

        /// <summary>"high" or "normal".</summary>
        public string? Priority { get; set; }

        /// <summary>"active", "time-sensitive" or "passive".</summary>
        public string? InterruptionLevel { get; set; }

        public string? ThreadId { get; set; }

        public int? TtlSeconds { get; set; }
    }

    [BsonIgnoreExtraElements]
    public sealed class WebPushOptions
    {
        /// <summary>https URL of the notification icon.</summary>
        public string? Icon { get; set; }

        public bool? RequireInteraction { get; set; }

        /// <summary>"very-low", "low", "normal" or "high".</summary>
        public string? Urgency { get; set; }

        public int? TtlSeconds { get; set; }
    }

    /// <summary>
    /// KV <c>notification-push-options:{ConfigName}</c> (tenant DB). blocks-os writes it, blocks-logic reads it when sending.
    /// Kept out of the genesis NotificationConfiguration on purpose: changing genesis needs a package release.
    /// </summary>
    [BsonIgnoreExtraElements]
    public sealed class NotificationPushOptionsRecord
    {
        public const string KeyPrefix = "notification-push-options:";

        public string ConfigName { get; set; } = string.Empty;

        /// <summary>"android", "ios", "web". Empty = all three.</summary>
        public List<string> Platforms { get; set; } = [];

        public string? WebLink { get; set; }

        public AndroidPushOptions? Android { get; set; }

        public IosPushOptions? Ios { get; set; }

        public WebPushOptions? Web { get; set; }

        public static string KeyOf(string configName) => KeyPrefix + (configName ?? string.Empty).Trim();
    }
}
