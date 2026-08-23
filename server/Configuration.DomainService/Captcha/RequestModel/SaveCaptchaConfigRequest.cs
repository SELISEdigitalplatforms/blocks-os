namespace Configuration.DomainService.Captcha.RequestModel
{
    public class SaveCaptchaConfigRequest
    {
        /// <summary>
        /// Identifies which configuration record to update. Null or empty creates a new record
        /// instead; the generated <see cref="ResponseModel.CaptchaConfigResult.Id"/> is returned
        /// so the caller can update the same record on a later call.
        /// </summary>
        public string? Id { get; set; }

        public bool IsEnable { get; set; }

        public string Provider { get; set; } = string.Empty;

        /// <summary>The provider's site key. Not sensitive — shown in the page the widget renders on.</summary>
        public string CaptchaKey { get; set; } = string.Empty;

        public string CaptchaGenerator { get; set; } = string.Empty;

        /// <summary>
        /// The new plaintext captcha secret, if it has changed. Null or empty means "leave the
        /// linked secret, if any, untouched" — a masked field a caller does not edit should
        /// round-trip this way rather than as the placeholder text.
        /// </summary>
        public string? CaptchaSecret { get; set; }
    }
}
