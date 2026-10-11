using Blocks.Genesis;
using Configuration.DomainService.Captcha.ResponseModel;
using Configuration.DomainService.Captcha.Services;
using Configuration.DomainService.Shared.Services;

namespace Configuration.DomainService.Shared.Secrets
{
    /// <inheritdoc />
    /// <remarks>
    /// Two reads, both against the caller's own tenant database: every CAPTCHA record under the
    /// shared store key, and the mail configurations whose reference equals the id. No secret is
    /// read, so the answer is the same whether the secret is active, archived or already purged —
    /// which is what lets the Purge dialog still name the configurations it is about to break.
    /// </remarks>
    public sealed class SecretDependentLookup : ISecretDependentLookup
    {
        private readonly IKeyValueStore _store;
        private readonly IConfigurationRepository _configurationRepository;

        public SecretDependentLookup(IKeyValueStore store, IConfigurationRepository configurationRepository)
        {
            _store = store;
            _configurationRepository = configurationRepository;
        }

        public async Task<SecretDependentsResult> FindAsync(string secretId, CancellationToken cancellationToken = default)
        {
            ArgumentException.ThrowIfNullOrWhiteSpace(secretId);

            var captchas = await _store
                .GetAllAsync<CaptchaConfigResult>(CaptchaConfigService.StoreKey, tags: null, impersonated: true, cancellationToken: cancellationToken)
                .ConfigureAwait(false);

            var mails = await _configurationRepository
                .GetMailConfigurationsByClientSecretReferenceAsync(secretId)
                .ConfigureAwait(false);

            var dependents = captchas
                .Where(item => string.Equals(item.Value.SecretId, secretId, StringComparison.Ordinal))
                .Select(item => new SecretDependent
                {
                    Kind = SecretDependent.CaptchaKind,
                    Id = item.ItemId,
                    Name = item.Value.Provider
                })
                .Concat(mails.Select(mail => new SecretDependent
                {
                    Kind = SecretDependent.MailKind,
                    Id = mail.ItemId,
                    Name = mail.Name
                }))
                .ToList();

            return new SecretDependentsResult { SecretId = secretId, Dependents = dependents };
        }
    }
}
