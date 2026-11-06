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
                using var message = Load(rawMime);

                // Every field is read before the message (and the source it parses from) is disposed.
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
        /// <see cref="Parse"/> lists them, as a stream read straight from the stored message. Null
        /// when the message cannot be parsed or the index does not resolve to a file part or an
        /// attached message.
        /// </summary>
        public static MailBoxMailAttachmentFile? OpenAttachment(string? rawMime, int index)
        {
            if (string.IsNullOrWhiteSpace(rawMime) || index < 0)
            {
                return null;
            }

            try
            {
                // Not disposed here: a part's content stream reads from the message's source until
                // the caller has copied it out. Both are in memory, so the GC reclaims them.
                var message = Load(rawMime);
                var entity = message.Attachments.ElementAtOrDefault(index);
                if (entity is null)
                {
                    return null;
                }

                Stream content;
                switch (entity)
                {
                    case MimePart part:
                        content = part.Content.Open();
                        break;
                    case MessagePart attached:
                        var written = new MemoryStream();
                        attached.Message.WriteTo(written);
                        written.Position = 0;
                        content = written;
                        break;
                    default:
                        return null;
                }

                return new MailBoxMailAttachmentFile
                {
                    FileName = FileNameOf(entity),
                    ContentType = entity.ContentType.MimeType,
                    Content = content
                };
            }
            catch (FormatException)
            {
                return null;
            }
        }

        /// <summary>
        /// <see cref="OpenAttachment"/> as Base64, for the obsolete JSON attachment route.
        /// </summary>
        public static MailBoxMailAttachmentContent? ExtractAttachment(string? rawMime, int index)
        {
            var attachment = OpenAttachment(rawMime, index);
            if (attachment is null)
            {
                return null;
            }

            using var content = new MemoryStream();
            using (attachment.Content)
            {
                attachment.Content.CopyTo(content);
            }

            return new MailBoxMailAttachmentContent
            {
                FileName = attachment.FileName,
                ContentType = attachment.ContentType,
                ContentBase64 = Convert.ToBase64String(content.GetBuffer(), 0, (int)content.Length)
            };
        }

        /// <summary>
        /// Loads a stored message. It was stored with <c>MimeMessage.ToString()</c>, which decodes
        /// the message bytes as Latin-1, one char per byte, so Latin-1 restores the exact bytes and
        /// 8-bit content decodes as sent. The persistent load keeps part content as ranges of this
        /// one buffer instead of copying it. A char above U+00FF, which that writer never produces,
        /// becomes '?'.
        /// </summary>
        private static MimeMessage Load(string rawMime) =>
            MimeMessage.Load(
                new ParserOptions(),
                new MemoryStream(Encoding.Latin1.GetBytes(rawMime), writable: false),
                persistent: true);

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
