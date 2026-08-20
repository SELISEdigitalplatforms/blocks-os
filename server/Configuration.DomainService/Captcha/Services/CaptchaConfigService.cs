using Blocks.Genesis;
using Blocks.Secrets;
using Configuration.DomainService.Captcha.RequestModel;
using Configuration.DomainService.Captcha.ResponseModel;
using FluentValidation;

namespace Configuration.DomainService.Captcha.Services
{
    public class CaptchaConfigService : ICaptchaConfigService
    {
        private const string StoreKey = "captcha";

        private readonly IKeyValueStore _store;
        private readonly ISecretService _secretService;
        private readonly ISecretAuditService _audit;
        private readonly ISecretAuthorizationService _authorization;
        private readonly IValidator<SaveCaptchaConfigRequest> _validator;

        public CaptchaConfigService(
            IKeyValueStore store,
            ISecretService secretService,
            ISecretAuditService audit,
            ISecretAuthorizationService authorization,
            IValidator<SaveCaptchaConfigRequest> validator)
        {
            _store = store;
            _secretService = secretService;
            _audit = audit;
            _authorization = authorization;
            _validator = validator;
        }

        public async Task<CaptchaConfigResult> SaveAsync(SaveCaptchaConfigRequest request, CancellationToken cancellationToken = default)
        {
            ArgumentNullException.ThrowIfNull(request);

            var validationResult = await _validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
            if (!validationResult.IsValid)
            {
                throw new SecretValidationException(
                    string.Join(" ", validationResult.Errors.Select(e => e.ErrorMessage)),
                    "VALIDATION_FAILED");
            }

            var caller = _authorization.ResolveContext();
            var existing = await _store.GetAsync<CaptchaConfigResult>(StoreKey,true, cancellationToken).ConfigureAwait(false);
            var secretId = existing?.SecretId;

            // Empty is treated the same as omitted: a masked secret field a caller leaves
            // untouched round-trips as "" from most frontends, and neither case should rotate
            // the vault value.
            if (!string.IsNullOrEmpty(request.CaptchaSecret))
            {
                if (string.IsNullOrEmpty(secretId))
                {
                    secretId = await _secretService.SetAsync(new SetSecretRequest
                    {
                        Name = "captcha",
                        Type = SecretTypes.Service,
                        Value = request.CaptchaSecret,
                        Description=$"{request.Provider} configuration"
                    }, cancellationToken).ConfigureAwait(false);
                }
                else
                {
                    await _secretService.RotateAsync(secretId, new RotateSecretRequest { Value = request.CaptchaSecret }, cancellationToken).ConfigureAwait(false);
                }
            }

            var result = new CaptchaConfigResult
            {
                IsEnable = request.IsEnable,
                Provider = request.Provider,
                CaptchaKey = request.CaptchaKey,
                CaptchaGenerator = request.CaptchaGenerator,
                SecretId = secretId
            };

            await _store.SetAsync(StoreKey, result,true, cancellationToken).ConfigureAwait(false);

            var auditAction = existing is null ? SecretAuditActions.ConfigSet : SecretAuditActions.ConfigUpdate;
            await RecordAuditAsync(caller, auditAction, secretId, cancellationToken).ConfigureAwait(false);

            return result;
        }

        public Task<CaptchaConfigResult?> GetAsync(CancellationToken cancellationToken = default) =>
            _store.GetAsync<CaptchaConfigResult>(StoreKey,true, cancellationToken);

        public async Task DeleteAsync(CancellationToken cancellationToken = default)
        {
            var caller = _authorization.ResolveContext();
            var existing = await _store.GetAsync<CaptchaConfigResult>(StoreKey,true, cancellationToken).ConfigureAwait(false);

            if (existing is null)
            {
                // Idempotent: deleting a configuration that was never saved, or was already
                // deleted, is a no-op rather than an error.
                return;
            }

            // The linked secret is retired first: if this fails, the configuration is left in
            // place, still pointing at it, rather than deleting the configuration and stranding
            // a live secret that nothing references any more.
            if (!string.IsNullOrEmpty(existing.SecretId))
            {
                await _secretService.DeleteAsync(existing.SecretId, cancellationToken).ConfigureAwait(false);
            }

            await _store.DeleteAsync(StoreKey,true, cancellationToken).ConfigureAwait(false);

            await RecordAuditAsync(caller, SecretAuditActions.ConfigDelete, existing.SecretId, cancellationToken).ConfigureAwait(false);
        }

        /// <summary>
        /// Records a config-side audit row through the existing <c>ISecretAuditService</c>,
        /// without changing its signature: a throwaway <c>Secret</c> carrying only the name
        /// "captcha" is passed so <c>SecretName</c> on the log reads sensibly, even though no
        /// such secret document is read or written here.
        /// </summary>
        private Task RecordAuditAsync(SecretCallerContext caller, string action, string? secretId, CancellationToken cancellationToken) =>
            _audit.RecordAsync(
                caller,
                action,
                secret: new Secret { Name = "captcha" },
                secretId: secretId,
                cancellationToken: cancellationToken);
    }
}
