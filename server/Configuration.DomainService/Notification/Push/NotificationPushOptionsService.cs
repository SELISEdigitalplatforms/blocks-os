using System.Text.Json;
using Configuration.DomainService.Notification.RequestModel;
using Microsoft.Extensions.Logging;

namespace Configuration.DomainService.Notification.Push
{
    /// <summary>The push platforms and options of one notification configuration (KV <c>notification-push-options:{Name}</c>).</summary>
    public interface INotificationPushOptionsService
    {
        /// <summary>True when the request would change the stored platforms or options (used for locked personal notices).</summary>
        Task<bool> ChangesStoredAsync(SaveNotificationConfigurationRequest request);

        /// <summary>
        /// Stores the sent platforms and options merged onto the stored ones (null = keep). Nothing to do when neither
        /// was sent. False when the store failed; the failure is logged by type only.
        /// </summary>
        Task<bool> SaveAsync(SaveNotificationConfigurationRequest request);

        Task<NotificationPushOptionsRecord?> GetAsync(string configName);

        /// <summary>Removes the options of a deleted configuration. Best effort: a failure is logged, never thrown.</summary>
        Task DeleteAsync(string configName);
    }

    /// <inheritdoc cref="INotificationPushOptionsService"/>
    public sealed class NotificationPushOptionsService : INotificationPushOptionsService
    {
        private readonly INotificationPushOptionsRepository _repository;
        private readonly ILogger<NotificationPushOptionsService> _logger;

        public NotificationPushOptionsService(INotificationPushOptionsRepository repository, ILogger<NotificationPushOptionsService> logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<bool> ChangesStoredAsync(SaveNotificationConfigurationRequest request)
        {
            if (!Sends(request))
            {
                return false;
            }

            var stored = await _repository.GetAsync(request.Name) ?? new NotificationPushOptionsRecord { ConfigName = request.Name };
            var merged = Merge(stored, request);
            return JsonSerializer.Serialize(Normalize(stored)) != JsonSerializer.Serialize(merged);
        }

        public async Task<bool> SaveAsync(SaveNotificationConfigurationRequest request)
        {
            if (!Sends(request))
            {
                return true;
            }

            try
            {
                var stored = await _repository.GetAsync(request.Name);
                await _repository.SaveAsync(Merge(stored ?? new NotificationPushOptionsRecord(), request));
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Push options of a notification config were not stored ({ErrorType}).", ex.GetType().Name);
                return false;
            }
        }

        public Task<NotificationPushOptionsRecord?> GetAsync(string configName) => _repository.GetAsync(configName);

        public async Task DeleteAsync(string configName)
        {
            try
            {
                await _repository.DeleteAsync(configName);
            }
            catch (Exception ex)
            {
                // The config is already deleted; left-over options are harmless until a config of the same name is saved with new ones.
                _logger.LogWarning(ex, "Push options of a deleted notification config were not removed ({ErrorType}).", ex.GetType().Name);
            }
        }

        private static bool Sends(SaveNotificationConfigurationRequest request) =>
            request.PushPlatforms is not null || request.PushOptions is not null;

        private static NotificationPushOptionsRecord Merge(NotificationPushOptionsRecord stored, SaveNotificationConfigurationRequest request)
        {
            var options = request.PushOptions;
            return Normalize(new NotificationPushOptionsRecord
            {
                ConfigName = request.Name.Trim(),
                Platforms = request.PushPlatforms ?? stored.Platforms,
                WebLink = options is null ? stored.WebLink : options.WebLink,
                Android = options is null ? stored.Android : options.Android,
                Ios = options is null ? stored.Ios : options.Ios,
                Web = options is null ? stored.Web : options.Web,
            });
        }

        /// <summary>Empty text = not set (null); platforms trimmed, de-duplicated and in a fixed order.</summary>
        private static NotificationPushOptionsRecord Normalize(NotificationPushOptionsRecord record) => new()
        {
            ConfigName = record.ConfigName,
            Platforms = PushOptionRules.Platforms.Where(p => (record.Platforms ?? []).Contains(p, StringComparer.Ordinal)).ToList(),
            WebLink = NullIfEmpty(record.WebLink),
            Android = record.Android is null ? null : new AndroidPushOptions
            {
                Priority = NullIfEmpty(record.Android.Priority),
                ChannelId = NullIfEmpty(record.Android.ChannelId),
                Sound = NullIfEmpty(record.Android.Sound),
                TtlSeconds = record.Android.TtlSeconds,
                CollapseKey = NullIfEmpty(record.Android.CollapseKey),
                Color = NullIfEmpty(record.Android.Color),
            },
            Ios = record.Ios is null ? null : new IosPushOptions
            {
                Sound = NullIfEmpty(record.Ios.Sound),
                Badge = record.Ios.Badge,
                Priority = NullIfEmpty(record.Ios.Priority),
                InterruptionLevel = NullIfEmpty(record.Ios.InterruptionLevel),
                ThreadId = NullIfEmpty(record.Ios.ThreadId),
                TtlSeconds = record.Ios.TtlSeconds,
            },
            Web = record.Web is null ? null : new WebPushOptions
            {
                Icon = NullIfEmpty(record.Web.Icon),
                RequireInteraction = record.Web.RequireInteraction,
                Urgency = NullIfEmpty(record.Web.Urgency),
                TtlSeconds = record.Web.TtlSeconds,
            },
        };

        private static string? NullIfEmpty(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }
}
