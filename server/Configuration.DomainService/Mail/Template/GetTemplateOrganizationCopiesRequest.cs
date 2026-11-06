namespace Configuration.DomainService.Mail.Template
{
    /// <summary><c>GET Mail/GetTemplateOrganizationCopies</c> (SPEC33 §6.2).</summary>
    public class GetTemplateOrganizationCopiesRequest
    {
        public string? TemplateId { get; set; }

        /// <summary>Comma-separated organization ids, at most 25.</summary>
        public string? OrganizationIds { get; set; }
    }
}
