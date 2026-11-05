namespace Configuration.DomainService.Mail.Template
{
    /// <summary>
    /// <c>POST Mail/DeleteTemplateAcrossOrganizations</c>: delete a Default template now and its organizations' own copies
    /// in the OS Worker (SPEC34 §6.1). "Only the Default organization's template" keeps using <c>DELETE Mail/DeleteTemplate</c>.
    /// </summary>
    public class DeleteTemplateAcrossOrganizationsRequest
    {
        public string? TemplateId { get; set; }

        /// <summary>Every enabled organization of the project; <see cref="OrganizationIds"/> is then ignored.</summary>
        public bool AllOrganizations { get; set; }

        /// <summary>The organizations whose copies are deleted when not all; 1..1000 distinct ids, "default" ignored.</summary>
        public List<string>? OrganizationIds { get; set; }
    }
}
