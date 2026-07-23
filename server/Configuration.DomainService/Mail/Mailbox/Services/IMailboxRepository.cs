using Configuration.DomainService.Mail.Entities;

namespace Configuration.DomainService.Mail.Mailbox.Services
{
    public interface IMailboxRepository
    {
        Task<(List<MailBoxEntityResponse> Mails, long TotalCount)> GetMailBoxAggregatedMailsAsync(GetMailBoxMailsRequest request);
        Task<MailBoxEntity?> GetMailBoxMailAsync(string messageId);
    }
}
