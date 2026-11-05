using Blocks.Genesis;

namespace Configuration.DomainService.Mail.Template
{
    /// <summary>The organizations, among the ones asked about, that have their own template with the same Name + Language.</summary>
    public class GetTemplateOrganizationCopiesResponse : BaseMutationResponse
    {
        public List<TemplateOrganizationCopy> Copies { get; set; } = [];
    }

    public class TemplateOrganizationCopy
    {
        public string OrganizationId { get; set; } = string.Empty;
        public string TemplateId { get; set; } = string.Empty;
        public DateTime LastUpdatedDate { get; set; }
    }
}
