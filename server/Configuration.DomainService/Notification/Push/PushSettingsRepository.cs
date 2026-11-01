using Blocks.Genesis;
using Blocks.Genesis.Entities.Logic;

namespace Configuration.DomainService.Notification.Push
{
    /// <summary>The <c>firebase-config</c> KV record of the context tenant. Data access only.</summary>
    public interface IPushSettingsRepository
    {
        Task<PushSettingsRecord?> GetAsync(CancellationToken cancellationToken);

        Task SaveAsync(PushSettingsRecord record, CancellationToken cancellationToken);
    }

    /// <inheritdoc cref="IPushSettingsRepository"/>
    public sealed class PushSettingsRepository : IPushSettingsRepository
    {
        private readonly IKeyValueStore _keyValueStore;

        public PushSettingsRepository(IKeyValueStore keyValueStore)
        {
            _keyValueStore = keyValueStore;
        }

        // impersonated: true = the context tenant's DB (the project), also for an impersonated root user.
        public Task<PushSettingsRecord?> GetAsync(CancellationToken cancellationToken) =>
            _keyValueStore.GetAsync<PushSettingsRecord>(FirebasePushConfiguration.KeyValueKey, impersonated: true, cancellationToken);

        public Task SaveAsync(PushSettingsRecord record, CancellationToken cancellationToken) =>
            _keyValueStore.SetAsync(FirebasePushConfiguration.KeyValueKey, record, impersonated: true, cancellationToken);
    }
}
