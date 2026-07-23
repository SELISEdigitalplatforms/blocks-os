using Configuration.DomainService.Mail.Entities;

namespace Configuration.DomainService.Mail.Template
{
    public class GetAllMailTemplatesResponse
    {
        public int TotalCount { get; set; }
        public List<EmailTemplate> Templates { get; set; } = [];
    }
}




