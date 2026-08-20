using Configuration.DomainService.Captcha.RequestModel;
using Configuration.DomainService.Captcha.ResponseModel;

namespace Configuration.DomainService.Captcha.Services
{
    /// <summary>
    /// Captcha configuration: a tenant may have multiple records, each identified by its own
    /// <see cref="CaptchaConfigResult.Id"/>.
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
        /// Creates a new captcha configuration record when <see cref="SaveCaptchaConfigRequest.Id"/>
        /// is null or empty, or updates the record it identifies otherwise. Rotates the linked
        /// secret's value when <see cref="SaveCaptchaConfigRequest.CaptchaSecret"/> is supplied;
        /// leaves it untouched otherwise.
        /// </summary>
        /// <exception cref="Blocks.Secrets.SecretValidationException">
        /// <see cref="SaveCaptchaConfigRequest.Id"/> was supplied but no such record exists.
        /// </exception>
        Task<CaptchaConfigResult> SaveAsync(SaveCaptchaConfigRequest request, CancellationToken cancellationToken = default);

        /// <summary>Reads one configuration record by its key. Returns null when it does not exist.</summary>
        Task<CaptchaConfigResult?> GetAsync(string key, CancellationToken cancellationToken = default);

        /// <summary>Reads every configuration record belonging to this tenant.</summary>
        Task<IReadOnlyList<CaptchaConfigResult>> GetListAsync(CancellationToken cancellationToken = default);

        /// <summary>
        /// Deletes the configuration record identified by <paramref name="key"/>, if any. If it
        /// has a linked secret, that secret is soft-deleted first; the record is removed only
        /// after that succeeds. A no-op, not an error, when there is nothing to delete.
        /// </summary>
        Task DeleteAsync(string key, CancellationToken cancellationToken = default);
    }
}
