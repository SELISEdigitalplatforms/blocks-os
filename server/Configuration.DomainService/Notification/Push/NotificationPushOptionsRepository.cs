using Blocks.Genesis;

namespace Configuration.DomainService.Notification.Push
{
    /// <summary>KV <c>notification-push-options:{ConfigName}</c> of the context tenant. Data access only.</summary>
    public interface INotificationPushOptionsRepository
    {
        Task<NotificationPushOptionsRecord?> GetAsync(string configName);

        Task SaveAsync(NotificationPushOptionsRecord record);

        Task DeleteAsync(string configName);
    }

    /// <inheritdoc cref="INotificationPushOptionsRepository"/>
    public sealed class NotificationPushOptionsRepository : INotificationPushOptionsRepository
    {
        private readonly IKeyValueStore _keyValueStore;

        public NotificationPushOptionsRepository(IKeyValueStore keyValueStore)
        {
            _keyValueStore = keyValueStore;
        }

        public Task<NotificationPushOptionsRecord?> GetAsync(string configName) =>
            _keyValueStore.GetAsync<NotificationPushOptionsRecord>(NotificationPushOptionsRecord.KeyOf(configName), impersonated: true);

        public Task SaveAsync(NotificationPushOptionsRecord record) =>
            _keyValueStore.SetAsync(NotificationPushOptionsRecord.KeyOf(record.ConfigName), record, impersonated: true);

        public Task DeleteAsync(string configName) =>
            _keyValueStore.DeleteAsync(NotificationPushOptionsRecord.KeyOf(configName), impersonated: true);
    }
}
