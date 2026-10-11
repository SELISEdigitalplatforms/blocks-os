using Blocks.Genesis;
using Blocks.Secrets;
using Configuration.DomainService.Captcha.RequestModel;
using Configuration.DomainService.Captcha.ResponseModel;
using Configuration.DomainService.Shared.Secrets;
using FluentValidation;
using Microsoft.Extensions.Logging;

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
        /// <para>
        /// Internal so <see cref="SecretDependentLookup"/> reads the same key rather than a copy.
        /// </para>
        /// </remarks>
        internal const string StoreKey = "captcha";

        /// <summary>
        /// Name given to every linked secret. Secret names are not unique, so each record's
        /// secret can carry the same readable name; <see cref="CaptchaConfigResult.SecretId"/>
        /// is what actually links a configuration to its value.
        /// </summary>
        private const string SecretName = "captcha";

        /// <summary>How a configuration is named in status warnings, alongside its id.</summary>
        private const string ConfigurationKind = "captcha";

        private readonly IKeyValueStore _store;
        private readonly ISecretService _secretService;
        private readonly ISecretAuditService _audit;
        private readonly ISecretAuthorizationService _authorization;
        private readonly IValidator<SaveCaptchaConfigRequest> _validator;
        private readonly ILogger<CaptchaConfigService> _logger;

        public CaptchaConfigService(
            IKeyValueStore store,
            ISecretService secretService,
            ISecretAuditService audit,
            ISecretAuthorizationService authorization,
            IValidator<SaveCaptchaConfigRequest> validator,
            ILogger<CaptchaConfigService> logger)
        {
            _store = store;
            _secretService = secretService;
            _audit = audit;
            _authorization = authorization;
            _validator = validator;
            _logger = logger;
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

            // One metadata read, needed both to decide between rotate and repair and to report
            // the pointer's state in the response — including when no new value was sent, which
            // is how the enable/disable toggle saves.
            var secretStatus = await ResolveStatusAsync(request.Id, secretId, cancellationToken).ConfigureAwait(false);

            // Set only when this save created a replacement for a dead pointer, so a failed write
            // below knows there is a secret of its own to retire.
            string? repairedSecretId = null;

            // Empty is treated the same as omitted: a masked secret field a caller leaves
            // untouched round-trips as "" from most frontends, and neither case should rotate
            // the vault value.
            if (!string.IsNullOrEmpty(request.CaptchaSecret))
            {
                if (string.IsNullOrEmpty(secretId) || LinkedSecretStatus.IsBroken(secretStatus))
                {
                    // A broken pointer cannot be rotated — the secret service only rotates active
                    // or locked secrets — so it is replaced: a new secret, and the same record
                    // repointed at it. The old secret is left exactly as it is, still restorable
                    // from the Secrets screen but no longer referenced.
                    var isRepair = !string.IsNullOrEmpty(secretId);

                    secretId = await _secretService.SetAsync(new SetSecretRequest
                    {
                        Name = SecretName,
                        Type = SecretTypes.Service,
                        Value = request.CaptchaSecret,
                        Description = $"{request.Provider} configuration"
                    }, cancellationToken).ConfigureAwait(false);

                    secretStatus = LinkedSecretStatus.Active;
                    repairedSecretId = isRepair ? secretId : null;
                }
                else
                {
                    // Active, locked, or unavailable. An unknown state is treated as healthy: the
                    // rotate either succeeds or fails through the existing exception filter, which
                    // is today's behaviour.
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

                // Always the same ItemId: blocks-iam picks the first enabled record ordered by
                // ItemId, so a repair that re-created the record could change which one it uses.
                bool updated;
                try
                {
                    updated = await _store.UpdateByIdAsync(id, record, true, cancellationToken).ConfigureAwait(false);
                }
                catch
                {
                    await CompensateRepairAsync(repairedSecretId, id).ConfigureAwait(false);
                    throw;
                }

                if (!updated)
                {
                    // Removed between the read above and this write.
                    await CompensateRepairAsync(repairedSecretId, id).ConfigureAwait(false);
                    throw new SecretValidationException($"Captcha configuration '{id}' was not found.", "NOT_FOUND");
                }
            }
            else
            {
                id = await _store.AddAsync(StoreKey, record, tags: null, impersonated: true, cancellationToken: cancellationToken).ConfigureAwait(false);
            }

            record.Id = id;
            record.SecretStatus = secretStatus;

            var auditAction = isUpdate ? SecretAuditActions.ConfigUpdate : SecretAuditActions.ConfigSet;
            await RecordAuditAsync(caller, auditAction, secretId, cancellationToken).ConfigureAwait(false);

            return record;
        }

        public async Task<CaptchaConfigResult?> GetAsync(string id, CancellationToken cancellationToken = default)
        {
            var item = await _store.GetByIdAsync<CaptchaConfigResult>(id, true, cancellationToken).ConfigureAwait(false);
            return item is null ? null : await WithStatusAsync(item, cancellationToken).ConfigureAwait(false);
        }

        public async Task<IReadOnlyList<CaptchaConfigResult>> GetListAsync(CancellationToken cancellationToken = default)
        {
            var items = await _store
                .GetAllAsync<CaptchaConfigResult>(StoreKey, tags: null, impersonated: true, cancellationToken: cancellationToken)
                .ConfigureAwait(false);

            // Sequential on purpose: ISecretService is scoped and not documented as safe for
            // concurrent use, and a tenant has a handful of captcha records at most.
            var results = new List<CaptchaConfigResult>(items.Count);
            foreach (var item in items)
            {
                results.Add(await WithStatusAsync(item, cancellationToken).ConfigureAwait(false));
            }

            return results;
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
            // a live secret that nothing references any more. A secret that is already archived
            // or purged counts as retired, so a configuration whose secret was removed from the
            // Secrets screen can still be deleted; that secret is not touched.
            if (!string.IsNullOrEmpty(secretId))
            {
                await LinkedSecretRetirement.RetireAsync(_secretService, secretId, cancellationToken).ConfigureAwait(false);
            }

            await _store.DeleteByIdAsync(id, true, cancellationToken).ConfigureAwait(false);

            await RecordAuditAsync(caller, SecretAuditActions.ConfigDelete, secretId, cancellationToken).ConfigureAwait(false);
        }

        /// <summary>
        /// Stamps the store's <c>ItemId</c> onto the record on the way out — the stored payload
        /// does not carry it, so this is where a configuration gets the id callers address it by —
        /// together with the linked secret's current status.
        /// </summary>
        private async Task<CaptchaConfigResult> WithStatusAsync(KeyValueItem<CaptchaConfigResult> item, CancellationToken cancellationToken)
        {
            item.Value.Id = item.ItemId;
            item.Value.SecretStatus = await ResolveStatusAsync(item.ItemId, item.Value.SecretId, cancellationToken).ConfigureAwait(false);
            return item.Value;
        }

        private Task<string> ResolveStatusAsync(string? configurationId, string? secretId, CancellationToken cancellationToken) =>
            LinkedSecretStatus.ResolveAsync(_secretService, secretId, _logger, ConfigurationKind, configurationId, cancellationToken);

        /// <summary>
        /// Retires the secret a repair just created when the record could not be repointed at it,
        /// so a failed save leaves no unreferenced active secret behind. Best effort: the caller
        /// rethrows the original failure either way.
        /// </summary>
        private async Task CompensateRepairAsync(string? repairedSecretId, string configurationId)
        {
            if (string.IsNullOrEmpty(repairedSecretId))
            {
                return;
            }

            try
            {
                await _secretService.DeleteAsync(repairedSecretId, CancellationToken.None).ConfigureAwait(false);
            }
            catch (Exception exception)
            {
                _logger.LogError(
                    exception,
                    "Captcha configuration repair failed and its new secret could not be retired. Reconcile configuration {ConfigurationId}.",
                    configurationId);
            }
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
