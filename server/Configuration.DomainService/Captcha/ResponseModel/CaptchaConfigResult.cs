namespace Configuration.DomainService.Captcha.ResponseModel
{
    /// <summary>
    /// Captcha configuration as returned to a caller — and also the exact shape persisted via
    /// Genesis's <c>IKeyValueStore</c>, so no separate storage DTO is needed.
    /// </summary>
    /// <remarks>
    /// Never carries a secret value. <see cref="SecretId"/> is a pointer only — resolving it
    /// into plaintext is a separate, independently permissioned and audited call against
    /// <c>ISecretService</c>, which this type has no part in.
    /// </remarks>
    public class CaptchaConfigResult
    {
        /// <summary>
        /// Unique identifier for this configuration record. Generated on create; callers must
        /// send it back on <see cref="RequestModel.SaveCaptchaConfigRequest.Id"/> to update this
        /// record instead of creating a new one, and to address it on get/delete.
        /// </summary>
        public string Id { get; set; } = string.Empty;

        public bool IsEnable { get; set; }

        public string Provider { get; set; } = string.Empty;

        public string CaptchaKey { get; set; } = string.Empty;

        public string CaptchaGenerator { get; set; } = string.Empty;

        /// <summary>Id of the linked secret holding the captcha secret, or null when none is set.</summary>
        public string? SecretId { get; set; }
    }
}
