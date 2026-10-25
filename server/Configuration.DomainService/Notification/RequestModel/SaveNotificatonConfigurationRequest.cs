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
    }
}
