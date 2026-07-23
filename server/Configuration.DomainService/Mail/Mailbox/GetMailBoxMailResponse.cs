using Blocks.Genesis;
using Configuration.DomainService.Mail.Entities;

namespace Configuration.DomainService.Mail.Mailbox
{
    public class GetMailBoxMailResponse : BaseResponse
    {
        public MailBoxEntity Mail { get; set; }
    }
}
