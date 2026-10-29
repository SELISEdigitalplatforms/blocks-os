using System.Text.Json;
using Blocks.Genesis;
using Blocks.Genesis.Entities.Os;
using Configuration.DomainService.Notification.RequestModel;
using Configuration.DomainService.Shared.Utilities;

namespace Configuration.DomainService.Notification.Services
{
    /// <summary>A refused save: the request field and the error key the client shows.</summary>
    public readonly record struct SaveRefusal(string Field, string Key);

    /// <summary>
    /// The rules of saving a notification configuration that need the stored row: who may change what, what stays
    /// locked, and how a request is merged onto the stored configuration. Pure functions, no I/O.
    /// </summary>
    public static class NotificationSaveRules
    {
        /// <summary>The tenant lookup runs only when a built-in, a root-only field or a role/permission pick is involved, so plain custom saves cost what they did.</summary>
        public static bool NeedsRootCheck(NotificationConfiguration? stored, SaveNotificationConfigurationRequest request) =>
            stored?.IsBuiltIn == true || request.IsBuiltIn == true || request.DefaultAudience is not null || request.AudienceLocked is not null
            || PicksRolesOrPermissions(request.Audience);

        /// <summary>True when the audience names a role or a permission (those need the grant-scope check for a non-root editor).</summary>
        public static bool PicksRolesOrPermissions(NotificationAudience? audience) =>
            audience is not null && ((audience.Roles?.Count ?? 0) > 0 || (audience.Permissions?.Count ?? 0) > 0);

        /// <summary>True when the audience and push message of the stored row must stay as they are.</summary>
        public static bool IsLocked(NotificationConfiguration? stored, SaveNotificationConfigurationRequest request, bool isRoot) =>
            stored?.AudienceLocked == true && !(isRoot && request.AudienceLocked == false);

        /// <summary>The first rule the request breaks against the stored row, or null.</summary>
        public static SaveRefusal? FindRefusal(NotificationConfiguration? stored, SaveNotificationConfigurationRequest request, bool isRoot)
        {
            var storedIsBuiltIn = stored?.IsBuiltIn == true;

            if (!storedIsBuiltIn && request.IsBuiltIn == true && !isRoot)
            {
                return new(nameof(request.IsBuiltIn), Constants.OnlyRootTenantCanManageBuiltInNotificationConfiguration);
            }

            if (!isRoot && (request.DefaultAudience is not null || request.AudienceLocked is not null))
            {
                return new(request.DefaultAudience is not null ? nameof(request.DefaultAudience) : nameof(request.AudienceLocked),
                    Constants.OnlyRootTenantCanSetDefaultAudience);
            }

            if (storedIsBuiltIn && !isRoot && ChangesReadOnlyField(stored!, request))
            {
                return new(nameof(request.IsBuiltIn), Constants.BuiltInNotificationConfigurationIsReadOnly);
            }

            if (IsLocked(stored, request, isRoot) && ChangesLockedField(stored!, request))
            {
                return new(request.Audience is not null ? nameof(request.Audience) : nameof(request.PushTemplate), Constants.NotificationAudienceIsLocked);
            }

            return null;
        }

        /// <summary>The first rule the merged configuration breaks (it needs the stored values the request left out), or null.</summary>
        public static SaveRefusal? FindMergedRefusal(NotificationConfiguration merged, SaveNotificationConfigurationRequest request)
        {
            if (request.LiveEnabled is null && request.PushEnabled is null && request.PushTemplate is null)
            {
                return null;
            }

            var channels = merged.EffectiveChannels();
            if (!channels.Live && !channels.Push)
            {
                return new(nameof(request.LiveEnabled), Constants.NotificationChannelRequired);
            }

            if (channels.Push && !HasKeys(merged.PushTemplate))
            {
                return new(nameof(request.PushTemplate), Constants.NotificationPushKeysRequired);
            }

            return null;
        }

        /// <summary>
        /// A built-in config is read-only for a non-root tenant except for what a tenant may tune: <c>IsDisabled</c>,
        /// scope, audience, channels, push message and rate limit. The portal re-sends every field, so a field sent
        /// with the stored value is not a change. Fields left out (null) are not a change.
        /// </summary>
        private static bool ChangesReadOnlyField(NotificationConfiguration stored, SaveNotificationConfigurationRequest request)
        {
            static bool SameText(string? a, string? b) => string.Equals(a ?? string.Empty, b ?? string.Empty, StringComparison.Ordinal);

            return stored.ChannelToNotify != request.ChannelToNotify
                || stored.NotificationType != request.NotificationType
                || !SameText(stored.NotifyMethod, request.NotifyMethod)
                || (request.IsBuiltIn.HasValue && request.IsBuiltIn.Value != stored.IsBuiltIn)
                || (request.Description is not null && !SameText(stored.Description, request.Description))
                || (request.Importance.HasValue && request.Importance.Value != stored.Importance)
                || (request.Kind.HasValue && request.Kind.Value != stored.Kind)
                || (request.SourceService is not null && !SameText(stored.SourceService, request.SourceService))
                || (request.ConsumerAppRecommendation is not null && !SameText(stored.ConsumerAppRecommendation, request.ConsumerAppRecommendation))
                || (request.ConsumerAppNote is not null && !SameText(stored.ConsumerAppNote, request.ConsumerAppNote));
        }

        private static bool ChangesLockedField(NotificationConfiguration stored, SaveNotificationConfigurationRequest request) =>
            (request.Audience is not null && !SameJson(Normalize(request.Audience), Normalize(stored.Audience ?? new NotificationAudience())))
            || (request.PushTemplate is not null && !SameJson(Normalize(request.PushTemplate), Normalize(stored.PushTemplate ?? new NotificationPushTemplate())));

        /// <summary>Merges the request onto the stored row (or a new one). Null request fields keep the stored value.</summary>
        public static NotificationConfiguration Apply(NotificationConfiguration? stored, SaveNotificationConfigurationRequest request, bool isRoot)
        {
            var config = stored ?? new NotificationConfiguration { ItemId = Guid.NewGuid().ToString(), CreatedDate = DateTime.UtcNow, CreatedBy = BlocksContext.GetContext()?.UserId };
            var locked = IsLocked(stored, request, isRoot);

            config.LastUpdatedDate = DateTime.UtcNow;
            config.LastUpdatedBy = BlocksContext.GetContext()?.UserId;
            config.Name = request.Name;
            config.ChannelToNotify = request.ChannelToNotify;
            config.NotificationType = request.NotificationType;
            config.EnablePersistence = request.EnablePersistence;
            config.NotifyMethod = request.NotifyMethod;

            ApplyMetadata(config, request, isRoot);
            ApplyDelivery(config, request, isRoot, locked);
            return config;
        }

        private static void ApplyMetadata(NotificationConfiguration config, SaveNotificationConfigurationRequest request, bool isRoot)
        {
            // Null = not sent = keep the stored value. Only the root tenant ever sets IsBuiltIn; FindRefusal has
            // already refused any other field change a non-root caller sent for a built-in config.
            if (isRoot && request.IsBuiltIn.HasValue) config.IsBuiltIn = request.IsBuiltIn.Value;
            if (request.IsDisabled.HasValue) config.IsDisabled = request.IsDisabled.Value;
            if (request.Description is not null) config.Description = NullIfEmpty(request.Description);
            if (request.Importance.HasValue) config.Importance = request.Importance.Value;
            if (request.Kind.HasValue) config.Kind = request.Kind.Value;
            if (request.SourceService is not null) config.SourceService = NullIfEmpty(request.SourceService);
            if (request.ConsumerAppRecommendation is not null) config.ConsumerAppRecommendation = NullIfEmpty(request.ConsumerAppRecommendation);
            if (request.ConsumerAppNote is not null) config.ConsumerAppNote = NullIfEmpty(request.ConsumerAppNote);
        }

        private static void ApplyDelivery(NotificationConfiguration config, SaveNotificationConfigurationRequest request, bool isRoot, bool locked)
        {
            if (request.Scope.HasValue) config.Scope = request.Scope.Value;
            if (request.RateLimitPerMinute.HasValue) config.RateLimitPerMinute = request.RateLimitPerMinute.Value;
            if (isRoot && request.DefaultAudience is not null) config.DefaultAudience = Normalize(request.DefaultAudience);
            if (isRoot && request.AudienceLocked.HasValue) config.AudienceLocked = request.AudienceLocked.Value;

            if (!locked)
            {
                if (request.Audience is not null) config.Audience = Normalize(request.Audience);
                if (request.PushTemplate is not null) config.PushTemplate = Normalize(request.PushTemplate);
            }

            if (request.LiveEnabled.HasValue || request.PushEnabled.HasValue)
            {
                // A row saved before the channel fields reads its channels from the old Firebase/SignalR value:
                // keep what it sends today, then retire the old value so the new fields decide from now on.
                var current = config.EffectiveChannels();
                config.LiveEnabled = request.LiveEnabled ?? current.Live;
                config.PushEnabled = request.PushEnabled ?? current.Push;
                if (config.ChannelToNotify == NotifierTypes.Firebase) config.ChannelToNotify = NotifierTypes.SignalR;
            }
        }

        /// <summary>Trimmed, de-duplicated lists without blanks; a null list from the request becomes empty.</summary>
        public static NotificationAudience Normalize(NotificationAudience audience) => new()
        {
            Level = audience.Level,
            Match = audience.Match,
            UserIds = Clean(audience.UserIds),
            Roles = Clean(audience.Roles),
            Permissions = Clean(audience.Permissions),
            Filters = (audience.Filters ?? []).Where(f => f is not null).Select(f => new Blocks.Genesis.Entities.Logic.SubscriptionFilter
            {
                Context = f.Context?.Trim() ?? string.Empty,
                ActionName = f.ActionName?.Trim() ?? string.Empty,
                Value = f.Value?.Trim() ?? string.Empty
            }).ToList(),
            AlsoNamedUsers = audience.AlsoNamedUsers,
            AlsoDoneBy = audience.AlsoDoneBy
        };

        public static NotificationPushTemplate Normalize(NotificationPushTemplate template) => new()
        {
            TitleKey = template.TitleKey?.Trim() ?? string.Empty,
            BodyKey = template.BodyKey?.Trim() ?? string.Empty,
            Link = NullIfEmpty(template.Link?.Trim() ?? string.Empty)
        };

        private static bool HasKeys(NotificationPushTemplate? template) =>
            template is not null && !string.IsNullOrWhiteSpace(template.TitleKey) && !string.IsNullOrWhiteSpace(template.BodyKey);

        private static List<string> Clean(List<string>? items) =>
            (items ?? []).Select(i => i?.Trim() ?? string.Empty).Where(i => i.Length > 0).Distinct(StringComparer.Ordinal).ToList();

        private static bool SameJson<T>(T a, T b) => JsonSerializer.Serialize(a) == JsonSerializer.Serialize(b);

        // An empty string is stored as "not set", so it stays out of the stored document like any other default.
        private static string? NullIfEmpty(string value) => string.IsNullOrEmpty(value) ? null : value;
    }
}
