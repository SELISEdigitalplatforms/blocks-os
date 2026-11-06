using Blocks.Genesis;

namespace Configuration.DomainService.Mail.Template
{
    /// <summary>How many templates now use the configuration; templates that already did are not counted.</summary>
    public class AssignTemplatesResponse : BaseMutationResponse
    {
        public int UpdatedCount { get; set; }
    }
}
