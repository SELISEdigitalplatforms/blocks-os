namespace Configuration.DomainService.Mail.Template
{
    /// <summary>
    /// The copy job the API queues on <c>blocks_os_email_template_listener</c> and the OS Worker runs (SPEC33 §6.3).
    /// It carries the project tenant, so the Worker acts only there.
    /// </summary>
    public class EmailTemplateCopyCommand
    {
        public string JobId { get; set; } = string.Empty;

        /// <summary>The project whose templates and organizations the job reads and writes.</summary>
        public string TenantId { get; set; } = string.Empty;

        /// <summary>The requester's own tenant when a console user acts in the project; the notification goes there.</summary>
        public string? OriginalTenantId { get; set; }

        public string RequestedByUserId { get; set; } = string.Empty;
        public string TemplateId { get; set; } = string.Empty;
        public bool AllOrganizations { get; set; }
        public List<string> OrganizationIds { get; set; } = [];

        /// <summary><see cref="EmailTemplateCopyExisting.Keep"/> or <see cref="EmailTemplateCopyExisting.Replace"/>.</summary>
        public string Existing { get; set; } = EmailTemplateCopyExisting.Keep;
    }

    /// <summary>The two values of <see cref="EmailTemplateCopyCommand.Existing"/> and of the request's <c>existing</c>.</summary>
    public static class EmailTemplateCopyExisting
    {
        public const string Keep = "keep";
        public const string Replace = "replace";
    }
}
