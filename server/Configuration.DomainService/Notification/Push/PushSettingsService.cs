using Blocks.Genesis;
using Microsoft.Extensions.Logging;

namespace Configuration.DomainService.Notification.Push
{
    /// <summary>The project's mobile push (Firebase) settings: KV <c>firebase-config</c> + Blocks Secrets.</summary>
    public interface IPushSettingsService
    {
        Task<PushSettingsView> GetAsync(CancellationToken cancellationToken);

        /// <summary>
        /// Checks and stores the settings. Secrets first, KV last: when a step fails, this save's secret changes are
        /// undone and the KV record stays as it was.
        /// </summary>
        Task<BaseResponse> SaveAsync(SavePushSettingsRequest request, CancellationToken cancellationToken);
    }

    /// <inheritdoc cref="IPushSettingsService"/>
    public sealed class PushSettingsService : IPushSettingsService
    {
        public const string SettingsField = "settings";
        public const string KeyNotStored = "The key could not be stored. Try again.";
        public const string WebConfigNotStored = "The web config could not be stored. Try again.";
        public const string SettingsNotStored = "The settings could not be stored. Try again.";

        private readonly IPushSettingsRepository _repository;
        private readonly IPushSecretWriter _secrets;
        private readonly TimeProvider _timeProvider;
        private readonly ILogger<PushSettingsService> _logger;

        public PushSettingsService(IPushSettingsRepository repository, IPushSecretWriter secrets, TimeProvider timeProvider, ILogger<PushSettingsService> logger)
        {
            _repository = repository;
            _secrets = secrets;
            _timeProvider = timeProvider;
            _logger = logger;
        }

        public async Task<PushSettingsView> GetAsync(CancellationToken cancellationToken) =>
            PushSettingsView.From(await _repository.GetAsync(cancellationToken));

        public Task<BaseResponse> SaveAsync(SavePushSettingsRequest request, CancellationToken cancellationToken)
        {
            ArgumentNullException.ThrowIfNull(request);
            return SaveCoreAsync(request, cancellationToken);
        }

        private async Task<BaseResponse> SaveCoreAsync(SavePushSettingsRequest request, CancellationToken cancellationToken)
        {
            var stored = await _repository.GetAsync(cancellationToken);
            var plan = PushSettingsSavePlan.Build(stored, request, _timeProvider.GetUtcNow().UtcDateTime, CurrentUploader());
            if (plan.Errors.Count > 0)
            {
                return Failed(plan.Errors);
            }

            var record = plan.Record;
            var changes = new PushSecretChanges();

            if (plan.KeyJson is not null
                && !await TryStepAsync(async () => record.SecretId = await WriteKeyAsync(stored, record, plan.KeyJson, changes, cancellationToken), changes, "key"))
            {
                return Failed(PushSettingsSavePlan.KeyField, KeyNotStored);
            }

            if (plan.WebSecretJson is not null
                && !await TryStepAsync(async () => record.WebSecretId = await _secrets.WriteAsync(record.WebSecretId, record.WebSecretName, plan.WebSecretJson, changes, cancellationToken), changes, "web config"))
            {
                return Failed(PushSettingsSavePlan.WebConfigField, WebConfigNotStored);
            }

            if (!await TryStepAsync(() => _repository.SaveAsync(record, cancellationToken), changes, "settings"))
            {
                return Failed(SettingsField, SettingsNotStored);
            }

            await RetireUnusedAsync(changes, plan.DroppedWebSecretId, cancellationToken);
            _logger.LogInformation(
                "Push settings saved. NewKey={NewKey} NewWebConfig={NewWebConfig} WebConfigDropped={WebConfigDropped}",
                plan.KeyJson is not null, plan.WebSecretJson is not null, plan.DroppedWebSecretId is not null);
            return new BaseResponse { IsSuccess = true };
        }

        /// <summary>A record saved by blocks-logic before secret ids existed points at its key by name only: rotate that one.</summary>
        private async Task<string> WriteKeyAsync(PushSettingsRecord? stored, PushSettingsRecord record, string keyJson, PushSecretChanges changes, CancellationToken cancellationToken)
        {
            var currentId = record.SecretId;
            if (string.IsNullOrEmpty(currentId) && stored?.HasKey == true)
            {
                currentId = await _secrets.FindIdByNameAsync(record.SecretName, cancellationToken);
            }

            return await _secrets.WriteAsync(currentId, record.SecretName, keyJson, changes, cancellationToken);
        }

        /// <summary>Runs one save step; on any failure undoes this save's secret changes. Logs the type only, never a value.</summary>
        private async Task<bool> TryStepAsync(Func<Task> step, PushSecretChanges changes, string stepName)
        {
            try
            {
                await step();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError("Push settings: the {Step} step failed, the save is undone ({ErrorType}).", stepName, ex.GetType().Name); // NOSONAR S6667 — type only: a message can hold request data
                await _secrets.UndoAsync(changes);
                return false;
            }
        }

        /// <summary>
        /// After the KV write: a secret this save created that KV does not point at (a concurrent save won, last write
        /// wins) is retired, and so is a web config dropped because the key moved to another project.
        /// </summary>
        private async Task RetireUnusedAsync(PushSecretChanges changes, string? droppedWebSecretId, CancellationToken cancellationToken)
        {
            if (changes.Created.Count == 0 && droppedWebSecretId is null)
            {
                return;
            }

            PushSettingsRecord? current;
            try
            {
                current = await _repository.GetAsync(cancellationToken);
            }
            catch (Exception ex)
            {
                // The save stands. Without a fresh read a secret could be retired that KV points at, so none is.
                _logger.LogWarning("Push settings: the record could not be read again after the save ({ErrorType}).", ex.GetType().Name); // NOSONAR S6667 — type only
                return;
            }

            var unused = changes.Created.Append(droppedWebSecretId)
                .OfType<string>()
                .Where(id => !string.Equals(id, current?.SecretId, StringComparison.Ordinal)
                             && !string.Equals(id, current?.WebSecretId, StringComparison.Ordinal))
                .ToList();

            foreach (var secretId in unused)
            {
                await _secrets.RetireQuietlyAsync(secretId);
            }

            if (unused.Count > 0)
            {
                _logger.LogInformation("Push settings: retired {Count} unused secret(s) after the save.", unused.Count);
            }
        }

        /// <summary>Who uploaded: display name, else user name, email or user id.</summary>
        private static string CurrentUploader()
        {
            var context = BlocksContext.GetContext();
            return new[] { context?.DisplayName, context?.UserName, context?.Email, context?.UserId }
                .FirstOrDefault(v => !string.IsNullOrWhiteSpace(v)) ?? string.Empty;
        }

        private static BaseResponse Failed(string field, string message) =>
            Failed(new Dictionary<string, string> { [field] = message });

        private static BaseResponse Failed(Dictionary<string, string> errors) => new() { IsSuccess = false, Errors = errors };
    }
}
