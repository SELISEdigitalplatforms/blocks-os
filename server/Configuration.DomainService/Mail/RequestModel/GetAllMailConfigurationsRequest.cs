namespace Configuration.DomainService.Mail.RequestModel
{
    public class GetAllMailConfigurationsRequest
    {
        /// <summary>
        /// Missing: every configuration, as before organizations. <c>"default"</c>: the Default
        /// organization's only. Any other id: that organization's plus the Default organization's,
        /// which every organization shares.
        /// </summary>
        public string? OrganizationId { get; set; }
    }
}
