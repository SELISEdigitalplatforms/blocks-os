using System.Text.Json;
using Blocks.Genesis.Entities.Os;
using Configuration.DomainService.Notification.Push;

namespace Configuration.DomainService.Notification.ResponseModel
{
    /// <summary>
    /// Answer of <c>GET /Notification/Get</c>: every field of the stored configuration, flat as before, plus the push
    /// platforms and options kept in their own KV record. Both are null when none are stored.
    /// </summary>
    public sealed class NotificationConfigurationDetail : NotificationConfiguration
    {
        public List<string>? PushPlatforms { get; set; }

        public NotificationPushOptions? PushOptions { get; set; }

        public static NotificationConfigurationDetail From(NotificationConfiguration configuration, NotificationPushOptionsRecord? options)
        {
            ArgumentNullException.ThrowIfNull(configuration);

            // A JSON copy keeps every field of the genesis class, also ones a later genesis release adds.
            var detail = JsonSerializer.Deserialize<NotificationConfigurationDetail>(JsonSerializer.Serialize(configuration))!;
            if (options is not null)
            {
                detail.PushPlatforms = options.Platforms;
                detail.PushOptions = new NotificationPushOptions
                {
                    WebLink = options.WebLink,
                    Android = options.Android,
                    Ios = options.Ios,
                    Web = options.Web,
                };
            }

            return detail;
        }
    }
}
