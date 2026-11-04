namespace Configuration.DomainService.Mail.RequestModel
{
    public class DuplicateMailConfigurationRequest
    {
        public string ConfigurationId { get; set; }

        /// <summary>
        /// A new secret for the copy, required by providers that own one. A duplicate never
        /// shares the source's secret: two configurations pointing at one vault entry would let
        /// a rotation on either silently change the other, and a delete of either strand the
        /// survivor.
        /// </summary>
        public string? ClientSecret { get; set; }
    }
}
