namespace Configuration.DomainService.Mail.Template
{
    /// <summary>
    /// <c>POST Mail/AssignTemplates</c>: point many templates of a configuration's organization at that
    /// configuration. Either explicit <see cref="TemplateIds"/>, or, with <see cref="AllMatching"/>, every
    /// template of the organization matching <see cref="SearchKey"/> and <see cref="Language"/> as the
    /// template list filters them.
    /// </summary>
    public class AssignTemplatesRequest
    {
        public string? ConfigurationId { get; set; }
        public List<string>? TemplateIds { get; set; }
        public bool AllMatching { get; set; }
        public string? SearchKey { get; set; }
        public string? Language { get; set; }
    }
}
