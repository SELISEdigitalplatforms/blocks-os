using Blocks.Genesis.Entities.Logic;

namespace Configuration.DomainService.Mail.Mailbox.Services
{
    public interface IMailboxRepository
    {
        Task<(List<MailBoxEntityResponse> Mails, long TotalCount)> GetMailBoxAggregatedMailsAsync(GetMailBoxMailsRequest request);
        Task<MailBoxEntity?> GetMailBoxMailAsync(string messageId);
        Task<string?> GetMessageIdByItemIdAsync(string itemId);
    }
}
