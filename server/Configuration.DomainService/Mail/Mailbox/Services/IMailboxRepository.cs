using Blocks.Genesis.Entities.Logic;

namespace Configuration.DomainService.Mail.Mailbox.Services
{
    public interface IMailboxRepository
    {
        Task<(List<MailBoxEntityResponse> Mails, long TotalCount)> GetMailBoxAggregatedMailsAsync(GetMailBoxMailsRequest request);

        /// <summary>The mail's latest row, without <see cref="MailBoxEntity.RawMime"/>.</summary>
        Task<MailBoxEntity?> GetMailBoxMailAsync(string messageId);

        /// <summary>
        /// The stored MIME of the newest row of the message that has one, or null when none has.
        /// When it is longer than <paramref name="maxLength"/> characters, only its length is read.
        /// </summary>
        Task<MailBoxRawMime?> GetRawMimeAsync(string messageId, int? maxLength);

        Task<string?> GetMessageIdByItemIdAsync(string itemId);
    }
}
