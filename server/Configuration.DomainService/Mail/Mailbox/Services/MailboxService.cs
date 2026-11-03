using System.Text;
using Blocks.Genesis.Entities.Logic;

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

        /// <summary>
        /// The largest stored MIME, in characters, that the details read loads and parses (8 MiB).
        /// Above it the page offers only the source download.
        /// </summary>
        internal const int PreviewMaxLength = 8_388_608;

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
            ArgumentNullException.ThrowIfNull(request);

            var messageId = await ResolveMessageIdAsync(request.ItemId, request.MessageId).ConfigureAwait(false);
            var mail = messageId is null
                ? null
                : await _mailboxRepository.GetMailBoxMailAsync(messageId).ConfigureAwait(false);
            if (mail == null)
            {
                return new GetMailBoxMailResponse
                {
                    IsSuccess = false,
                    Errors = MailNotFound()
                };
            }

            var raw = await _mailboxRepository.GetRawMimeAsync(messageId!, PreviewMaxLength).ConfigureAwait(false);
            // The entity declares RawMime non-nullable; the projection left it unread, and it is null on
            // the wire because the source has its own endpoint.
            mail.RawMime = null!;

            return new GetMailBoxMailResponse
            {
                IsSuccess = true,
                Mail = mail,
                Content = ContentOf(raw)
            };
        }

        public async Task<GetMailBoxMailSourceResponse> GetMailBoxMailSourceAsync(GetMailBoxMailRequest request)
        {
            ArgumentNullException.ThrowIfNull(request);

            var messageId = await ResolveMessageIdAsync(request.ItemId, request.MessageId).ConfigureAwait(false);
            var raw = messageId is null
                ? null
                : await _mailboxRepository.GetRawMimeAsync(messageId, null).ConfigureAwait(false);
            if (raw?.RawMime is null)
            {
                return new GetMailBoxMailSourceResponse
                {
                    IsSuccess = false,
                    Errors = await MailExistsAsync(messageId).ConfigureAwait(false)
                        ? new Dictionary<string, string> { { "RawMime", "No stored message source" } }
                        : MailNotFound()
                };
            }

            return new GetMailBoxMailSourceResponse
            {
                IsSuccess = true,
                // The stored string holds one Latin-1 char per message byte (see MailContentParser).
                Content = Encoding.Latin1.GetBytes(raw.RawMime)
            };
        }

        public async Task<GetMailBoxMailAttachmentFileResponse> GetMailBoxMailAttachmentFileAsync(GetMailBoxMailAttachmentFileRequest request)
        {
            ArgumentNullException.ThrowIfNull(request);

            var messageId = await ResolveMessageIdAsync(request.ItemId, request.MessageId).ConfigureAwait(false);
            var raw = messageId is null
                ? null
                : await _mailboxRepository.GetRawMimeAsync(messageId, null).ConfigureAwait(false);
            if (raw?.RawMime is null)
            {
                return new GetMailBoxMailAttachmentFileResponse
                {
                    IsSuccess = false,
                    Errors = await MailExistsAsync(messageId).ConfigureAwait(false) ? AttachmentNotFound() : MailNotFound()
                };
            }

            var attachment = MailContentParser.OpenAttachment(raw.RawMime, request.Index);
            if (attachment is null)
            {
                return new GetMailBoxMailAttachmentFileResponse
                {
                    IsSuccess = false,
                    Errors = AttachmentNotFound()
                };
            }

            return new GetMailBoxMailAttachmentFileResponse
            {
                IsSuccess = true,
                FileName = attachment.FileName,
                Content = attachment.Content
            };
        }

        public async Task<GetMailBoxMailAttachmentResponse> GetMailBoxMailAttachmentAsync(GetMailBoxMailAttachmentRequest request)
        {
            ArgumentNullException.ThrowIfNull(request);

            var raw = await _mailboxRepository.GetRawMimeAsync(request.MessageId, null).ConfigureAwait(false);
            var attachment = MailContentParser.ExtractAttachment(raw?.RawMime, request.Index);

            if (attachment is null)
            {
                return new GetMailBoxMailAttachmentResponse
                {
                    IsSuccess = false,
                    Errors = raw is null && !await MailExistsAsync(request.MessageId).ConfigureAwait(false)
                        ? MailNotFound()
                        : AttachmentNotFound()
                };
            }

            return new GetMailBoxMailAttachmentResponse
            {
                IsSuccess = true,
                Attachment = attachment
            };
        }

        /// <summary>
        /// An item id names one status row; resolve it to the message so a read still covers every
        /// row of that mail (latest status, body backfilled from the Sent row). The item id wins.
        /// </summary>
        private async Task<string?> ResolveMessageIdAsync(string? itemId, string? messageId)
        {
            var resolved = !string.IsNullOrEmpty(itemId)
                ? await _mailboxRepository.GetMessageIdByItemIdAsync(itemId).ConfigureAwait(false)
                : messageId;
            return string.IsNullOrEmpty(resolved) ? null : resolved;
        }

        // Only asked once the stored MIME is missing, to tell an unknown mail from one without it.
        private async Task<bool> MailExistsAsync(string? messageId) =>
            !string.IsNullOrEmpty(messageId) && await _mailboxRepository.GetMailBoxMailAsync(messageId).ConfigureAwait(false) is not null;

        private static MailBoxMailContent? ContentOf(MailBoxRawMime? raw)
        {
            if (raw is null)
            {
                return null;
            }

            // Unparseable: no bodies and no attachments, so the client falls back to the Body captured
            // at sync time and still offers the source. Too large: the same, flagged PreviewTooLarge,
            // and the client offers only the source download.
            var content = (raw.RawMime is null ? null : MailContentParser.Parse(raw.RawMime))
                ?? new MailBoxMailContent();
            content.RawMimeLength = raw.Length;
            content.PreviewTooLarge = raw.RawMime is null;
            return content;
        }

        private static Dictionary<string, string> MailNotFound() =>
            new() { { "MessageId", "Mail not found" } };

        private static Dictionary<string, string> AttachmentNotFound() =>
            new() { { "Index", "Attachment not found" } };
    }
}
