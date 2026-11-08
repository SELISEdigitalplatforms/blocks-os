namespace Configuration.DomainService.Mail.Template
{
    /// <summary>
    /// The job the API queues on <c>blocks_os_email_template_listener</c> after deleting a Default template, and the OS
    /// Worker runs (SPEC34 §6.2): delete the organizations' templates with the same Name + Language. It carries the
    /// Name + Language because the Default template is already gone, and the project tenant, so the Worker acts only there.
    /// </summary>
    public class EmailTemplateDeleteCommand
    {
        public string JobId { get; set; } = string.Empty;

        /// <summary>The project whose templates and organizations the job reads and deletes.</summary>
        public string TenantId { get; set; } = string.Empty;

        /// <summary>The requester's own tenant when a console user acts in the project; the notification goes there.</summary>
        public string? OriginalTenantId { get; set; }

        public string RequestedByUserId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Language { get; set; } = string.Empty;
        public bool AllOrganizations { get; set; }
        public List<string> OrganizationIds { get; set; } = [];
    }
}
