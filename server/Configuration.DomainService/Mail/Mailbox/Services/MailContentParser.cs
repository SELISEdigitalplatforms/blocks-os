using System.Text;
using MimeKit;

namespace Configuration.DomainService.Mail.Mailbox.Services
{
    /// <summary>
    /// Turns a stored raw message into what the details page shows.
    /// </summary>
    /// <remarks>
    /// Parsing happens on read, not on sync, so messages that were stored before this existed get
    /// the same view. The HTML is returned as the sender wrote it: the client renders it in a
    /// sandboxed frame with scripts disabled, which is where untrusted markup has to be contained.
    /// </remarks>
    public static class MailContentParser
    {
        public static MailBoxMailContent? Parse(string? rawMime)
        {
            if (string.IsNullOrWhiteSpace(rawMime))
            {
                return null;
            }

            try
            {
                using var stream = new MemoryStream(Encoding.UTF8.GetBytes(rawMime));
                var message = MimeMessage.Load(stream);

                return new MailBoxMailContent
                {
                    HtmlBody = message.HtmlBody,
                    TextBody = message.TextBody,
                    Cc = message.Cc.Count > 0 ? message.Cc.ToString() : null,
                    ReplyTo = message.ReplyTo.Count > 0 ? message.ReplyTo.ToString() : null,
                    Attachments = message.Attachments
                        .Select(entity => new MailBoxMailAttachment
                        {
                            FileName = FileNameOf(entity),
                            ContentType = entity.ContentType.MimeType,
                            Size = EstimateSize(entity)
                        })
                        .ToList()
                };
            }
            catch (FormatException)
            {
                // A malformed message still has the Body captured at sync time to fall back on.
                return null;
            }
        }

        /// <summary>
        /// The decoded content of the attachment at <paramref name="index"/>, in the same order
        /// <see cref="Parse"/> lists them. Null when the message or the index does not resolve.
        /// </summary>
        public static MailBoxMailAttachmentContent? ExtractAttachment(string? rawMime, int index)
        {
            if (string.IsNullOrWhiteSpace(rawMime) || index < 0)
            {
                return null;
            }

            try
            {
                using var stream = new MemoryStream(Encoding.UTF8.GetBytes(rawMime));
                var message = MimeMessage.Load(stream);
                var entity = message.Attachments.ElementAtOrDefault(index);
                if (entity is null)
                {
                    return null;
                }

                using var content = new MemoryStream();
                switch (entity)
                {
                    case MimePart part:
                        part.Content.DecodeTo(content);
                        break;
                    case MessagePart attached:
                        attached.Message.WriteTo(content);
                        break;
                    default:
                        return null;
                }

                return new MailBoxMailAttachmentContent
                {
                    FileName = FileNameOf(entity),
                    ContentType = entity.ContentType.MimeType,
                    ContentBase64 = Convert.ToBase64String(content.ToArray())
                };
            }
            catch (FormatException)
            {
                return null;
            }
        }

        private static string FileNameOf(MimeEntity entity) =>
            entity switch
            {
                MimePart part when !string.IsNullOrWhiteSpace(part.FileName) => part.FileName,
                MessagePart => "attached-message.eml",
                _ => "attachment"
            };

        /// <summary>
        /// The decoded size, estimated from the encoded length rather than by decoding — this is
        /// a label on a chip, and decoding every attachment to measure it would cost a full copy.
        /// </summary>
        private static long? EstimateSize(MimeEntity entity)
        {
            if (entity is not MimePart { Content.Stream: { CanSeek: true } content } part)
            {
                return null;
            }

            var encodedLength = content.Length;
            return part.ContentTransferEncoding == ContentEncoding.Base64
                ? encodedLength * 3 / 4
                : encodedLength;
        }
    }
}
