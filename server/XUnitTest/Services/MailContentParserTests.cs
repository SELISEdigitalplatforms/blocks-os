using System.Text;
using Configuration.DomainService.Mail.Mailbox.Services;
using FluentAssertions;
using MimeKit;

namespace XUnitTest.Services
{
    public class MailContentParserTests
    {
        // Spec §5: MB = 1,048,576 bytes; parse and attachment stream are each <= 17 MB.
        internal const long AllocationBudget = 17 * 1_048_576;

        internal static readonly byte[] InvoiceBytes = Enumerable.Range(0, 300).Select(i => (byte)(i * 7 + 1)).ToArray();

        /// <summary>
        /// The §5 fixture: one random attachment of <paramref name="attachmentBytes"/>, stored the way
        /// blocks-logic stores inbound mail (<c>MimeMessage.ToString()</c>).
        /// </summary>
        internal static string LargeRaw(int attachmentBytes)
        {
            var message = new MimeMessage();
            message.From.Add(new MailboxAddress("Sender", "sender@example.com"));
            message.To.Add(new MailboxAddress("", "to@example.com"));
            message.Cc.Add(new MailboxAddress("Copy", "cc@example.com"));
            message.Subject = "Invoice";
            var builder = new BodyBuilder { TextBody = "Plain invoice", HtmlBody = "<p>HTML invoice</p>" };
            var data = new byte[attachmentBytes];
            new Random(729).NextBytes(data);
            builder.Attachments.Add("invoice.bin", data, new ContentType("application", "octet-stream"));
            message.Body = builder.ToMessageBody();
            return message.ToString();
        }

        /// <summary>A text/plain body of UTF-8 "Grüße" sent as 8bit, stored by MimeMessage.ToString().</summary>
        internal static string EightBitRaw()
        {
            var message = new MimeMessage();
            message.From.Add(new MailboxAddress("", "a@example.com"));
            var part = new TextPart("plain") { ContentTransferEncoding = ContentEncoding.EightBit };
            part.SetText(Encoding.UTF8, "Grüße");
            message.Body = part;
            return message.ToString();
        }

        private static long AllocatedBy(Action action)
        {
            action(); // warm-up
            var before = GC.GetAllocatedBytesForCurrentThread();
            action();
            return GC.GetAllocatedBytesForCurrentThread() - before;
        }

        private static byte[] ReadAll(Stream stream)
        {
            using (stream)
            using (var copy = new MemoryStream())
            {
                stream.CopyTo(copy);
                return copy.ToArray();
            }
        }

        internal static string Raw()
        {
            var message = new MimeMessage();
            message.From.Add(new MailboxAddress("Sender", "sender@example.com"));
            message.To.Add(new MailboxAddress("", "to@example.com"));
            message.Cc.Add(new MailboxAddress("Copy", "cc@example.com"));
            message.Subject = "Invoice";

            var builder = new BodyBuilder
            {
                TextBody = "Plain invoice",
                HtmlBody = "<p>HTML invoice</p>"
            };
            builder.Attachments.Add("invoice.pdf", InvoiceBytes, new ContentType("application", "pdf"));
            message.Body = builder.ToMessageBody();

            return message.ToString();
        }

        [Fact]
        public void Parse_ExtractsBothBodiesTheCcAndAttachmentMetadata()
        {
            var content = MailContentParser.Parse(Raw());

            content.Should().NotBeNull();
            content!.HtmlBody.Should().Contain("<p>HTML invoice</p>");
            content.TextBody.Should().Contain("Plain invoice");
            content.Cc.Should().Contain("cc@example.com");
            content.Attachments.Should().ContainSingle();
            content.Attachments[0].FileName.Should().Be("invoice.pdf");
            content.Attachments[0].ContentType.Should().Be("application/pdf");
            content.Attachments[0].Size.Should().BeInRange(290, 310);
        }

        [Fact]
        public void ExtractAttachment_ReturnsTheDecodedFile()
        {
            var attachment = MailContentParser.ExtractAttachment(Raw(), 0);

            attachment.Should().NotBeNull();
            attachment!.FileName.Should().Be("invoice.pdf");
            attachment.ContentType.Should().Be("application/pdf");
            Convert.FromBase64String(attachment.ContentBase64).Should().Equal(InvoiceBytes);
        }

        [Theory]
        [InlineData(1)]
        [InlineData(-1)]
        public void ExtractAttachment_AnIndexThatDoesNotResolve_ReturnsNull(int index)
        {
            MailContentParser.ExtractAttachment(Raw(), index).Should().BeNull();
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public void Parse_NoStoredMime_ReturnsNull(string? raw)
        {
            MailContentParser.Parse(raw).Should().BeNull();
        }

        [Fact]
        public void Parse_EightBitUtf8Body_DecodesAsSent()
        {
            // E6/H7: on 01e89a27 the UTF-8 re-encoding of the Latin-1 string gave "GrÃ¼Ãe".
            MailContentParser.Parse(EightBitRaw())!.TextBody!.Trim().Should().Be("Grüße");
        }

        [Fact]
        public void Parse_ACharAboveLatin1_BecomesAQuestionMarkWithoutThrowing()
        {
            // C12: no writer produces such a char; the Latin-1 encoder replaces it with '?'.
            var raw = "Subject: hi\r\nContent-Type: text/plain\r\n\r\nA\u20ACB";

            var content = MailContentParser.Parse(raw);

            content!.TextBody.Should().Be("A?B");
        }

        [Fact]
        public void Parse_MalformedMessage_ReturnsNull()
        {
            // MimeKit throws FormatException when there are no headers to parse.
            MailContentParser.Parse("x").Should().BeNull();
        }

        [Fact]
        public void Parse_ElevenMiBAttachment_StaysWithinTheAllocationBudget()
        {
            // C7.
            var raw = LargeRaw(11 * 1_048_576);

            var allocated = AllocatedBy(() => MailContentParser.Parse(raw));

            allocated.Should().BeLessThanOrEqualTo(AllocationBudget);
        }

        [Fact]
        public void OpenAttachment_StreamsTheOriginalBytes()
        {
            // H5.
            var attachment = MailContentParser.OpenAttachment(Raw(), 0);

            attachment!.FileName.Should().Be("invoice.pdf");
            attachment.ContentType.Should().Be("application/pdf");
            ReadAll(attachment.Content).Should().Equal(InvoiceBytes);
        }

        [Fact]
        public void OpenAttachment_EightBitTextAttachment_IsByteExact()
        {
            // H7: an 8bit part's bytes come back as stored, not re-encoded.
            var utf8 = Encoding.UTF8.GetBytes("Grüße, 8-bit");
            var message = new MimeMessage();
            message.From.Add(new MailboxAddress("", "a@example.com"));
            var multipart = new Multipart("mixed") { new TextPart("plain") { Text = "see attached" } };
            multipart.Add(new MimePart("text", "plain")
            {
                FileName = "notes.txt",
                ContentTransferEncoding = ContentEncoding.EightBit,
                Content = new MimeContent(new MemoryStream(utf8))
            });
            message.Body = multipart;

            var attachment = MailContentParser.OpenAttachment(message.ToString(), 0);

            attachment!.FileName.Should().Be("notes.txt");
            ReadAll(attachment.Content).Should().Equal(utf8);
        }

        [Fact]
        public void OpenAttachment_AttachedMessage_IsTheWholeMessageFromTheStart()
        {
            var inner = new MimeMessage();
            inner.From.Add(new MailboxAddress("", "inner@example.com"));
            inner.Subject = "Inner";
            inner.Body = new TextPart("plain") { Text = "inner body" };
            var outer = new MimeMessage();
            outer.From.Add(new MailboxAddress("", "outer@example.com"));
            var builder = new BodyBuilder { TextBody = "forwarded" };
            builder.Attachments.Add(new MessagePart
            {
                Message = inner,
                ContentDisposition = new ContentDisposition(ContentDisposition.Attachment)
            });
            outer.Body = builder.ToMessageBody();

            var attachment = MailContentParser.OpenAttachment(outer.ToString(), 0);

            attachment!.FileName.Should().Be("attached-message.eml");
            attachment.ContentType.Should().Be("message/rfc822");
            attachment.Content.Position.Should().Be(0);
            Encoding.Latin1.GetString(ReadAll(attachment.Content)).Should().Contain("Subject: Inner").And.Contain("inner body");
        }

        [Theory]
        [InlineData(1)]
        [InlineData(-1)]
        public void OpenAttachment_AnIndexThatDoesNotResolve_ReturnsNull(int index)
        {
            MailContentParser.OpenAttachment(Raw(), index).Should().BeNull();
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData("x")]
        public void OpenAttachment_NoOrMalformedMime_ReturnsNull(string? raw)
        {
            MailContentParser.OpenAttachment(raw, 0).Should().BeNull();
        }

        [Fact]
        public void OpenAttachment_ElevenMiBAttachment_StaysWithinTheAllocationBudget()
        {
            // C8: open attachment 0 and copy it fully.
            var raw = LargeRaw(11 * 1_048_576);

            var allocated = AllocatedBy(() =>
            {
                using var content = MailContentParser.OpenAttachment(raw, 0)!.Content;
                content.CopyTo(Stream.Null);
            });

            allocated.Should().BeLessThanOrEqualTo(AllocationBudget);
        }

        [Fact]
        public void ExtractAttachment_MatchesTheStreamedBytes()
        {
            // H6: the obsolete route encodes the same bytes the file route streams.
            var raw = Raw();

            var extracted = Convert.FromBase64String(MailContentParser.ExtractAttachment(raw, 0)!.ContentBase64);

            extracted.Should().Equal(ReadAll(MailContentParser.OpenAttachment(raw, 0)!.Content));
        }
    }
}
