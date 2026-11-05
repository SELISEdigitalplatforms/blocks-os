namespace Configuration.DomainService.Mail.Template
{
    /// <summary><c>POST Mail/CopyTemplateToOrganizations</c>: give organizations their own copy of a Default template (SPEC33 §6.1).</summary>
    public class CopyTemplateToOrganizationsRequest
    {
        public string? TemplateId { get; set; }

        /// <summary>Every enabled organization of the project; <see cref="OrganizationIds"/> is then ignored.</summary>
        public bool AllOrganizations { get; set; }

        /// <summary>The organizations to copy to when not all; 1..1000 distinct ids, "default" ignored.</summary>
        public List<string>? OrganizationIds { get; set; }

        /// <summary>What happens to an organization that already has the Name + Language: "keep" or "replace".</summary>
        public string? Existing { get; set; }
    }
}
