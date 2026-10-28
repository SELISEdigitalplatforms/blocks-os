using Blocks.Genesis.Entities.Os;

namespace Configuration.DomainService.Notification.RequestModel
{
    public class SaveNotificationConfigurationRequest
    {
        public string Name { get; set; }
        public NotifierTypes ChannelToNotify { get; set; }
        public NotificationReceiverTypes NotificationType { get; set; }
        public bool EnablePersistence { get; set; }
        public string NotifyMethod { get; set; }
        public bool IsUpdateRequest { get; set; }

        // Built-in fields. All optional: null means "not sent", and the stored value is kept.
        // A client that sends none of them gets exactly the behaviour it had before these fields existed.

        /// <summary>Marks a platform-defined config. Only the root tenant may set or change it.</summary>
        public bool? IsBuiltIn { get; set; }

        /// <summary>Stops this notification for the tenant. Refused for a built-in Job or Progress config.</summary>
        public bool? IsDisabled { get; set; }

        public string? Description { get; set; }
        public NotificationImportance? Importance { get; set; }
        public NotificationKind? Kind { get; set; }
        public string? SourceService { get; set; }
        public string? ConsumerAppRecommendation { get; set; }
        public string? ConsumerAppNote { get; set; }

        // Receivers, channels and push message. All optional: null means "not sent", and the stored value is kept.
        // A personal (audience-locked) notice never carries Audience, Scope or PushTemplate from the portal.

        /// <summary>Who receives it: project users, console users or both.</summary>
        public NotificationScope? Scope { get; set; }

        /// <summary>Who receives it in this tenant. Refused when the stored configuration is audience-locked.</summary>
        public NotificationAudience? Audience { get; set; }

        /// <summary>The audience a tenant starts with. Root tenant only.</summary>
        public NotificationAudience? DefaultAudience { get; set; }

        /// <summary>Personal notice: a tenant cannot change its audience or push message. Root tenant only.</summary>
        public bool? AudienceLocked { get; set; }

        public bool? LiveEnabled { get; set; }
        public bool? PushEnabled { get; set; }

        /// <summary>Localization keys of the push message. Not a change when null.</summary>
        public NotificationPushTemplate? PushTemplate { get; set; }

        /// <summary>Most sends per minute, 0 to 600. 0 means the notifier's default.</summary>
        public int? RateLimitPerMinute { get; set; }
    }
}
