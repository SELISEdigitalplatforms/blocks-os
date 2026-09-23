using Blocks.Genesis;
using Configuration.DomainService.Mail.Entities;

namespace Configuration.DomainService.Mail.Mailbox
{
    public class GetMailBoxMailResponse : BaseResponse
    {
        public MailBoxEntity Mail { get; set; }

        /// <summary>
        /// The message as a reader sees it, parsed from <see cref="MailBoxEntity.RawMime"/>. Null
        /// when there is no stored MIME (outbound mail) or it cannot be parsed; the client then
        /// falls back to <see cref="MailBoxEntity.Body"/>.
        /// </summary>
        public MailBoxMailContent? Content { get; set; }
    }

    public class MailBoxMailContent
    {
        public string? HtmlBody { get; set; }
        public string? TextBody { get; set; }
        public string? Cc { get; set; }
        public string? ReplyTo { get; set; }
        public List<MailBoxMailAttachment> Attachments { get; set; } = [];
    }

    /// <summary>Metadata only; the content stays in the stored MIME.</summary>
    public class MailBoxMailAttachment
    {
        public string FileName { get; set; } = string.Empty;
        public string ContentType { get; set; } = string.Empty;
        public long? Size { get; set; }
    }
}
