using System.Diagnostics.CodeAnalysis;
using Blocks.Genesis;
using Blocks.Genesis.Entities.Logic;

namespace Configuration.DomainService.Mail.Mailbox
{
    public class GetMailBoxMailResponse : BaseResponse
    {
        /// <summary>
        /// The mail's metadata. <see cref="MailBoxEntity.RawMime"/> is always null here: the stored
        /// message can run to megabytes, so it is served on demand by GetMailBoxMailSource.
        /// </summary>
        public MailBoxEntity Mail { get; set; }

        /// <summary>
        /// The message as a reader sees it, parsed from the stored MIME. Null when there is no
        /// stored MIME (outbound mail). When the MIME is too large to preview or cannot be parsed,
        /// it carries only <see cref="MailBoxMailContent.RawMimeLength"/>, and the client falls back
        /// to <see cref="MailBoxEntity.Body"/>.
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

        /// <summary>Characters in the stored MIME, which equals its size in bytes.</summary>
        public long RawMimeLength { get; set; }

        /// <summary>
        /// The stored MIME is above the preview cap, so it was neither read nor parsed: the bodies are
        /// null and the attachment list is empty. The source download still serves it.
        /// </summary>
        public bool PreviewTooLarge { get; set; }
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

    public class GetMailBoxMailAttachmentFileRequest
    {
        // Nullable so that a missing id reaches the service and gets its 404: with nullable
        // reference types on, a non-nullable string would be implicitly required (400).
        public string? ItemId { get; set; }
        public string? MessageId { get; set; }

        /// <summary>Position in <see cref="MailBoxMailContent.Attachments"/>.</summary>
        public int Index { get; set; }
    }

    /// <summary>The stored message, as the bytes it was received as.</summary>
    public class GetMailBoxMailSourceResponse : BaseResponse
    {
        [SuppressMessage("Performance", "CA1819:Properties should not return arrays",
            Justification = "The bytes are handed to File() as they are; a copy would double the memory.")]
        public byte[]? Content { get; set; }
    }

    /// <summary>One attachment as a stream of its decoded content.</summary>
    public class GetMailBoxMailAttachmentFileResponse : BaseResponse
    {
        public string FileName { get; set; } = string.Empty;
        public Stream? Content { get; set; }
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

    /// <summary>One attachment, opened for reading from the stored MIME.</summary>
    public class MailBoxMailAttachmentFile
    {
        public string FileName { get; set; } = string.Empty;
        public string ContentType { get; set; } = string.Empty;
        public Stream Content { get; set; } = Stream.Null;
    }

    /// <summary>Metadata only; the content stays in the stored MIME.</summary>
    public class MailBoxMailAttachment
    {
        public string FileName { get; set; } = string.Empty;
        public string ContentType { get; set; } = string.Empty;
        public long? Size { get; set; }
    }
}
