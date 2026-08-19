using Configuration.DomainService.Captcha.RequestModel;
using Configuration.DomainService.Captcha.ResponseModel;

namespace Configuration.DomainService.Captcha.Services
{
    /// <summary>
    /// Captcha configuration: one per tenant.
    /// </summary>
    /// <remarks>
    /// Non-secret fields are stored via Genesis's own <c>IKeyValueStore</c>, which already
    /// resolves each tenant's own database — no dedicated entity or collection is needed for
    /// them. The captcha secret itself, if set, is never stored here: it lives in the existing
    /// secret vault behind <c>ISecretService</c> (from the <c>Blocks.Secrets</c> package),
    /// unmodified, and is referenced by <see cref="CaptchaConfigResult.SecretId"/>. This service
    /// owns no vault logic of its own; it only decides when to call <c>SetAsync</c>,
    /// <c>RotateAsync</c> or <c>DeleteAsync</c> on the linked secret.
    /// </remarks>
    public interface ICaptchaConfigService
    {
        /// <summary>
        /// Creates or updates the captcha configuration. Rotates the linked secret's value when
        /// <see cref="SaveCaptchaConfigRequest.SecretValue"/> is supplied; leaves it untouched
        /// otherwise.
        /// </summary>
        Task<CaptchaConfigResult> SaveAsync(SaveCaptchaConfigRequest request, CancellationToken cancellationToken = default);

        /// <summary>Reads the configuration. Returns null when nothing has been saved yet.</summary>
        Task<CaptchaConfigResult?> GetAsync(CancellationToken cancellationToken = default);

        /// <summary>
        /// Deletes the configuration, if any. If it has a linked secret, that secret is
        /// soft-deleted first; the configuration is removed only after that succeeds. A no-op,
        /// not an error, when there is nothing to delete.
        /// </summary>
        Task DeleteAsync(CancellationToken cancellationToken = default);
    }
}
