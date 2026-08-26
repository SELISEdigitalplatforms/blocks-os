using Blocks.Genesis;
using Blocks.Secrets;
using Configuration.DomainService.Captcha.RequestModel;
using Configuration.DomainService.Captcha.ResponseModel;
using FluentValidation;

namespace Configuration.DomainService.Captcha.Services
{
    public class CaptchaConfigService : ICaptchaConfigService
    {
        /// <summary>
        /// The single key every captcha configuration is stored under.
        /// </summary>
        /// <remarks>
        /// Records are told apart by the store's own <c>ItemId</c>, not by the key, so the key
        /// carries no identity and never varies. This is the multi-value side of
        /// <see cref="IKeyValueStore"/> — <c>AddAsync</c>, <c>GetAllAsync</c> and the
        /// <c>*ById</c> methods. The single-value side (<c>SetAsync</c>, <c>GetAsync</c>) must
        /// never be used on this key: mixing the two leaves reads returning an arbitrary record.
        /// </remarks>
        private const string StoreKey = "captcha";

        /// <summary>
        /// Name given to every linked secret. Secret names are not unique, so each record's
        /// secret can carry the same readable name; <see cref="CaptchaConfigResult.SecretId"/>
        /// is what actually links a configuration to its value.
        /// </summary>
        private const string SecretName = "captcha";

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
            var isUpdate = !string.IsNullOrWhiteSpace(request.Id);

            CaptchaConfigResult? existing = null;
            if (isUpdate)
            {
                var item = await _store.GetByIdAsync<CaptchaConfigResult>(request.Id!, true, cancellationToken).ConfigureAwait(false);
                if (item is null)
                {
                    throw new SecretValidationException($"Captcha configuration '{request.Id}' was not found.", "NOT_FOUND");
                }

                existing = item.Value;
            }

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
                        Name = SecretName,
                        Type = SecretTypes.Service,
                        Value = request.CaptchaSecret,
                        Description = $"{request.Provider} configuration"
                    }, cancellationToken).ConfigureAwait(false);
                }
                else
                {
                    await _secretService.RotateAsync(secretId, new RotateSecretRequest { Value = request.CaptchaSecret }, cancellationToken).ConfigureAwait(false);
                }
            }

            // Id is deliberately left unset on the stored copy. The store's ItemId is the
            // identity; persisting it a second time inside the payload would leave two things to
            // keep in step, and a stale one would be indistinguishable from the real one.
            var record = new CaptchaConfigResult
            {
                IsEnable = request.IsEnable,
                Provider = request.Provider,
                CaptchaKey = request.CaptchaKey,
                CaptchaGenerator = request.CaptchaGenerator,
                SecretId = secretId
            };

            string id;
            if (isUpdate)
            {
                id = request.Id!;

                if (!await _store.UpdateByIdAsync(id, record, true, cancellationToken).ConfigureAwait(false))
                {
                    // Removed between the read above and this write.
                    throw new SecretValidationException($"Captcha configuration '{id}' was not found.", "NOT_FOUND");
                }
            }
            else
            {
                id = await _store.AddAsync(StoreKey, record, tags: null, impersonated: true, cancellationToken: cancellationToken).ConfigureAwait(false);
            }

            record.Id = id;

            var auditAction = isUpdate ? SecretAuditActions.ConfigUpdate : SecretAuditActions.ConfigSet;
            await RecordAuditAsync(caller, auditAction, secretId, cancellationToken).ConfigureAwait(false);

            return record;
        }

        public async Task<CaptchaConfigResult?> GetAsync(string id, CancellationToken cancellationToken = default)
        {
            var item = await _store.GetByIdAsync<CaptchaConfigResult>(id, true, cancellationToken).ConfigureAwait(false);
            return item is null ? null : WithId(item);
        }

        public async Task<IReadOnlyList<CaptchaConfigResult>> GetListAsync(CancellationToken cancellationToken = default)
        {
            var items = await _store
                .GetAllAsync<CaptchaConfigResult>(StoreKey, tags: null, impersonated: true, cancellationToken: cancellationToken)
                .ConfigureAwait(false);

            return items.Select(WithId).ToList();
        }

        public async Task DeleteAsync(string id, CancellationToken cancellationToken = default)
        {
            var caller = _authorization.ResolveContext();
            var item = await _store.GetByIdAsync<CaptchaConfigResult>(id, true, cancellationToken).ConfigureAwait(false);

            if (item is null)
            {
                // Idempotent: deleting a configuration that was never saved, or was already
                // deleted, is a no-op rather than an error.
                return;
            }

            var secretId = item.Value.SecretId;

            // The linked secret is retired first: if this fails, the configuration is left in
            // place, still pointing at it, rather than deleting the configuration and stranding
            // a live secret that nothing references any more.
            if (!string.IsNullOrEmpty(secretId))
            {
                await _secretService.DeleteAsync(secretId, cancellationToken).ConfigureAwait(false);
            }

            await _store.DeleteByIdAsync(id, true, cancellationToken).ConfigureAwait(false);

            await RecordAuditAsync(caller, SecretAuditActions.ConfigDelete, secretId, cancellationToken).ConfigureAwait(false);
        }

        /// <summary>
        /// Stamps the store's <c>ItemId</c> onto the record on the way out — the stored payload
        /// does not carry it, so this is where a configuration gets the id callers address it by.
        /// </summary>
        private static CaptchaConfigResult WithId(KeyValueItem<CaptchaConfigResult> item)
        {
            item.Value.Id = item.ItemId;
            return item.Value;
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
                secret: new Secret { Name = SecretName },
                secretId: secretId,
                cancellationToken: cancellationToken);
    }
}
