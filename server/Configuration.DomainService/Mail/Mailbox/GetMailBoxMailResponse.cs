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

    public class GetMailBoxMailAttachmentRequest
    {
        public string MessageId { get; set; } = string.Empty;

        /// <summary>Position in <see cref="MailBoxMailContent.Attachments"/>.</summary>
        public int Index { get; set; }
    }

    public class GetMailBoxMailAttachmentResponse : BaseResponse
    {
        public MailBoxMailAttachmentContent? Attachment { get; set; }
    }

    public class MailBoxMailAttachmentContent
    {
        public string FileName { get; set; } = string.Empty;
        public string ContentType { get; set; } = string.Empty;

        /// <summary>
        /// Base64 so the file travels through the same JSON client as every other mail read.
        /// </summary>
        public string ContentBase64 { get; set; } = string.Empty;
    }

    /// <summary>Metadata only; the content stays in the stored MIME.</summary>
    public class MailBoxMailAttachment
    {
        public string FileName { get; set; } = string.Empty;
        public string ContentType { get; set; } = string.Empty;
        public long? Size { get; set; }
    }
}
