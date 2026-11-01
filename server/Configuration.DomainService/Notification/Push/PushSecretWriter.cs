using Blocks.Secrets;
using Configuration.DomainService.Shared.Secrets;
using Microsoft.Extensions.Logging;

namespace Configuration.DomainService.Notification.Push
{
    /// <summary>The secret changes one push settings save made, so they can be undone when a later step fails.</summary>
    public sealed class PushSecretChanges
    {
        private readonly List<string> _created = [];
        private readonly List<(string SecretId, string OldValue)> _rotated = [];

        public IReadOnlyList<string> Created => _created;

        public IReadOnlyList<(string SecretId, string OldValue)> Rotated => _rotated;

        public void AddCreated(string secretId) => _created.Add(secretId);

        public void AddRotated(string secretId, string oldValue) => _rotated.Add((secretId, oldValue));
    }

    /// <summary>Writes the Firebase key and web config to Blocks Secrets and undoes a save's writes. Never logs a value.</summary>
    public interface IPushSecretWriter
    {
        /// <summary>
        /// Rotates <paramref name="currentSecretId"/> to <paramref name="value"/> (its old value is kept in
        /// <paramref name="changes"/>), or creates a new secret when there is none or it was archived or purged.
        /// </summary>
        /// <returns>The id of the secret that now holds the value.</returns>
        Task<string> WriteAsync(string? currentSecretId, string name, string value, PushSecretChanges changes, CancellationToken cancellationToken);

        /// <summary>The id of the active secret named exactly <paramref name="name"/>, or null (records saved before ids existed).</summary>
        Task<string?> FindIdByNameAsync(string name, CancellationToken cancellationToken);

        /// <summary>Best effort: rotates back every rotated secret and retires every created one. Never throws.</summary>
        Task UndoAsync(PushSecretChanges changes);

        /// <summary>Best effort retire of a secret nothing points at any more. Never throws.</summary>
        Task RetireQuietlyAsync(string secretId);
    }

    /// <inheritdoc cref="IPushSecretWriter"/>
    public sealed class PushSecretWriter : IPushSecretWriter
    {
        private const string Tag = "notifications";
        private const int SearchPageSize = 50;

        private readonly ISecretService _secretService;
        private readonly ILogger<PushSecretWriter> _logger;

        public PushSecretWriter(ISecretService secretService, ILogger<PushSecretWriter> logger)
        {
            _secretService = secretService;
            _logger = logger;
        }

        public async Task<string> WriteAsync(string? currentSecretId, string name, string value, PushSecretChanges changes, CancellationToken cancellationToken)
        {
            if (!string.IsNullOrEmpty(currentSecretId) && await TryRotateAsync(currentSecretId, value, changes, cancellationToken))
            {
                return currentSecretId;
            }

            var secretId = await _secretService.SetAsync(new SetSecretRequest
            {
                Name = name,
                Type = SecretTypes.Service,
                Value = value,
                Tags = [Tag],
                Description = "Mobile push (Firebase)"
            }, cancellationToken);

            changes.AddCreated(secretId);
            return secretId;
        }

        public async Task<string?> FindIdByNameAsync(string name, CancellationToken cancellationToken)
        {
            var page = await _secretService.FindAsync(new SecretFilter { Search = name, PageSize = SearchPageSize }, cancellationToken);
            return page.Data.FirstOrDefault(s => string.Equals(s.Name, name, StringComparison.Ordinal))?.SecretId;
        }

        public async Task UndoAsync(PushSecretChanges changes)
        {
            foreach (var (secretId, oldValue) in changes.Rotated)
            {
                try
                {
                    await _secretService.RotateAsync(secretId, new RotateSecretRequest { Value = oldValue }, CancellationToken.None);
                }
                catch (Exception ex)
                {
                    // Type only: an exception message can name the secret.
                    _logger.LogError("Push settings: a rotated secret could not be rotated back ({ErrorType}).", ex.GetType().Name); // NOSONAR S6667 — type only
                }
            }

            foreach (var secretId in changes.Created)
            {
                await RetireQuietlyAsync(secretId);
            }
        }

        public async Task RetireQuietlyAsync(string secretId)
        {
            try
            {
                await LinkedSecretRetirement.RetireAsync(_secretService, secretId, CancellationToken.None);
            }
            catch (Exception ex)
            {
                _logger.LogError("Push settings: an unused secret could not be retired ({ErrorType}).", ex.GetType().Name); // NOSONAR S6667 — type only
            }
        }

        /// <summary>
        /// False when the pointer is broken (secret purged or archived): the caller then creates a new secret, like the
        /// captcha repair. The broken secret is left as it is.
        /// </summary>
        private async Task<bool> TryRotateAsync(string secretId, string value, PushSecretChanges changes, CancellationToken cancellationToken)
        {
            try
            {
                var oldValue = await _secretService.GetValueAsync(secretId, cancellationToken);
                await _secretService.RotateAsync(secretId, new RotateSecretRequest { Value = value }, cancellationToken);
                changes.AddRotated(secretId, oldValue);
                return true;
            }
            catch (SecretException ex) when (ex is SecretNotFoundException or SecretStateException)
            {
                _logger.LogWarning("Push settings: the linked secret is gone or archived, a new one is created ({ErrorType}).", ex.GetType().Name); // NOSONAR S6667 — type only
                return false;
            }
        }
    }
}
