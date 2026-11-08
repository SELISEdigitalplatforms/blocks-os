namespace Configuration.DomainService.Mail.Template
{
    public class SaveMailTemplateRequest
    {
        public string? ItemId { get; set; }
        public string? MailConfigurationId { get; set; }
        public string? TemplateBody { get; set; }
        public string? JsonContent { get; set; }
        public string? ImageId { get; set; }
        public string? ImageUrl { get; set; }
        public string? Language { get; set; }
        public string? Name { get; set; }
        public string? TemplateSubject { get; set; }

        /// <summary>
        /// The template's organization. On a create, missing or blank means the Default organization; on an
        /// edit, missing keeps the stored one and any other value is refused, since it can't change.
        /// </summary>
        public string? OrganizationId { get; set; }
    }
}




