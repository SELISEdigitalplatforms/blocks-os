using Configuration.DomainService.Mail.Enums;

namespace Configuration.DomainService.Mail.Mailbox.Services
{
    public class MailboxService : IMailboxService
    {
        private static readonly MailStatus[] AllowedFilterStatuses =
        [
            MailStatus.Sent,
            MailStatus.Delivered,
            MailStatus.Bounced,
            MailStatus.Complained,
            MailStatus.Rejected,
            MailStatus.Received
        ];

        private readonly IMailboxRepository _mailboxRepository;

        public MailboxService(IMailboxRepository mailboxRepository)
        {
            _mailboxRepository = mailboxRepository;
        }

        public async Task<GetMailBoxMailsResponse> GetMailBoxMailsAsync(GetMailBoxMailsRequest request)
        {
            if (!string.IsNullOrEmpty(request.Status) &&
                (!Enum.TryParse<MailStatus>(request.Status, true, out var status) ||
                 !AllowedFilterStatuses.Contains(status)))
            {
                var allowed = string.Join(", ", AllowedFilterStatuses);
                return new GetMailBoxMailsResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                    {
                        { "Status", $"Invalid status: {request.Status}. Allowed values are: {allowed}" }
                    }
                };
            }

            var (mails, count) = await _mailboxRepository.GetMailBoxAggregatedMailsAsync(request);
            return new GetMailBoxMailsResponse
            {
                IsSuccess = true,
                Mails = mails,
                TotalCount = count
            };
        }

        public async Task<GetMailBoxMailResponse> GetMailBoxMailAsync(GetMailBoxMailRequest request)
        {
            // An item id names one status row; resolve it to the message so the read still merges
            // every row of that mail (latest status, body backfilled from the Sent row).
            var messageId = !string.IsNullOrEmpty(request.ItemId)
                ? await _mailboxRepository.GetMessageIdByItemIdAsync(request.ItemId)
                : request.MessageId;
            var mail = string.IsNullOrEmpty(messageId)
                ? null
                : await _mailboxRepository.GetMailBoxMailAsync(messageId);
            if (mail == null)
            {
                return new GetMailBoxMailResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                    {
                        { "MessageId", "Mail not found" }
                    }
                };
            }

            return new GetMailBoxMailResponse
            {
                IsSuccess = true,
                Mail = mail,
                Content = MailContentParser.Parse(mail.RawMime)
            };
        }

        public async Task<GetMailBoxMailAttachmentResponse> GetMailBoxMailAttachmentAsync(GetMailBoxMailAttachmentRequest request)
        {
            var mail = await _mailboxRepository.GetMailBoxMailAsync(request.MessageId);
            var attachment = MailContentParser.ExtractAttachment(mail?.RawMime, request.Index);

            if (attachment is null)
            {
                return new GetMailBoxMailAttachmentResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                    {
                        { mail is null ? "MessageId" : "Index", mail is null ? "Mail not found" : "Attachment not found" }
                    }
                };
            }

            return new GetMailBoxMailAttachmentResponse
            {
                IsSuccess = true,
                Attachment = attachment
            };
        }
    }
}
