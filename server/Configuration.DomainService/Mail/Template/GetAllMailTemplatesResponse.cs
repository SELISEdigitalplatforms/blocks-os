using Blocks.Genesis.Entities.Os;

namespace Configuration.DomainService.Mail.Template
{
    public class GetAllMailTemplatesResponse
    {
        public int TotalCount { get; set; }
        public List<EmailTemplate> Templates { get; set; } = [];
    }
}




