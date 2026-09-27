using Configuration.DomainService.Mail.Mailbox.Services;
using FluentAssertions;
using MimeKit;

namespace XUnitTest.Services
{
    public class MailContentParserTests
    {
        private static string Raw()
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
            builder.Attachments.Add("invoice.pdf", new byte[300], new ContentType("application", "pdf"));
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
            Convert.FromBase64String(attachment.ContentBase64).Should().HaveCount(300);
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
    }
}
