using System.Collections.Generic;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Configuration.DomainService.Mail.Mailbox;
using Configuration.DomainService.Mail.Mailbox.Services;
using FluentAssertions;
using Moq;
using Blocks.Genesis.Entities.Logic;

namespace XUnitTest.Services
{
    public class MailboxServiceTests
    {
        private readonly Mock<IMailboxRepository> _repo = new();
        private MailboxService Service() => new(_repo.Object);

        [Fact]
        public async Task GetMailBoxMailsAsync_InvalidStatus_ReturnsError()
        {
            var response = await Service().GetMailBoxMailsAsync(new GetMailBoxMailsRequest { Status = "NotAStatus" });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("Status");
            _repo.Verify(r => r.GetMailBoxAggregatedMailsAsync(It.IsAny<GetMailBoxMailsRequest>()), Times.Never);
        }

        [Fact]
        public async Task GetMailBoxMailsAsync_DisallowedStatus_ReturnsError()
        {
            // Unknown is a valid enum value but not in the allowed filter list.
            var response = await Service().GetMailBoxMailsAsync(new GetMailBoxMailsRequest { Status = "Unknown" });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("Status");
        }

        [Fact]
        public async Task GetMailBoxMailsAsync_ValidStatus_ReturnsMails()
        {
            var mails = new List<MailBoxEntityResponse> { new() { ItemId = "m1" } };
            _repo.Setup(r => r.GetMailBoxAggregatedMailsAsync(It.IsAny<GetMailBoxMailsRequest>()))
                 .ReturnsAsync((mails, 5L));

            var response = await Service().GetMailBoxMailsAsync(new GetMailBoxMailsRequest { Status = "Sent" });

            response.IsSuccess.Should().BeTrue();
            response.TotalCount.Should().Be(5);
            response.Mails.Should().HaveCount(1);
        }

        [Fact]
        public async Task GetMailBoxMailsAsync_NoStatus_ReturnsMails()
        {
            _repo.Setup(r => r.GetMailBoxAggregatedMailsAsync(It.IsAny<GetMailBoxMailsRequest>()))
                 .ReturnsAsync((new List<MailBoxEntityResponse>(), 0L));

            var response = await Service().GetMailBoxMailsAsync(new GetMailBoxMailsRequest());

            response.IsSuccess.Should().BeTrue();
        }

        [Fact]
        public async Task GetMailBoxMailAsync_NotFound_ReturnsError()
        {
            _repo.Setup(r => r.GetMailBoxMailAsync("missing")).ReturnsAsync((MailBoxEntity?)null);

            var response = await Service().GetMailBoxMailAsync(new GetMailBoxMailRequest { MessageId = "missing" });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("MessageId");
        }

        [Fact]
        public async Task GetMailBoxMailAsync_Found_ReturnsMail()
        {
            var mail = new MailBoxEntity { ItemId = "m1", MessageId = "msg-1", Status = MailStatus.Sent };
            _repo.Setup(r => r.GetMailBoxMailAsync("msg-1")).ReturnsAsync(mail);

            var response = await Service().GetMailBoxMailAsync(new GetMailBoxMailRequest { MessageId = "msg-1" });

            response.IsSuccess.Should().BeTrue();
            response.Mail.Should().BeSameAs(mail);
        }

        [Fact]
        public async Task GetMailBoxMailAsync_ByItemId_ResolvesMessageId()
        {
            var mail = new MailBoxEntity { ItemId = "row-1", MessageId = "CAP+x@mail.gmail.com", Status = MailStatus.Received };
            _repo.Setup(r => r.GetMessageIdByItemIdAsync("row-1")).ReturnsAsync("CAP+x@mail.gmail.com");
            _repo.Setup(r => r.GetMailBoxMailAsync("CAP+x@mail.gmail.com")).ReturnsAsync(mail);

            var response = await Service().GetMailBoxMailAsync(new GetMailBoxMailRequest { ItemId = "row-1" });

            response.IsSuccess.Should().BeTrue();
            response.Mail.Should().BeSameAs(mail);
        }

        [Fact]
        public async Task GetMailBoxMailAsync_UnknownItemId_ReturnsError()
        {
            _repo.Setup(r => r.GetMessageIdByItemIdAsync("missing")).ReturnsAsync((string?)null);

            var response = await Service().GetMailBoxMailAsync(new GetMailBoxMailRequest { ItemId = "missing" });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("MessageId");
            _repo.Verify(r => r.GetMailBoxMailAsync(It.IsAny<string>()), Times.Never);
        }

        private const int PreviewCap = 8_388_608;

        // The repository's cap, as GetRawMimeAsync applies it in MongoDB.
        private void StoreRawMime(string messageId, string raw) =>
            _repo.Setup(r => r.GetRawMimeAsync(messageId, It.IsAny<int?>()))
                 .ReturnsAsync((string _, int? max) => new MailBoxRawMime
                 {
                     Length = raw.Length,
                     RawMime = max is null || raw.Length <= max ? raw : null
                 });

        private void StoreMail(string messageId, string? itemId = null)
        {
            _repo.Setup(r => r.GetMailBoxMailAsync(messageId))
                 .ReturnsAsync(new MailBoxEntity { ItemId = itemId ?? "row-1", MessageId = messageId, Status = MailStatus.Received, RawMime = "stale" });
            if (itemId is not null)
            {
                _repo.Setup(r => r.GetMessageIdByItemIdAsync(itemId)).ReturnsAsync(messageId);
            }
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

        [Fact]
        public async Task GetMailBoxMailAsync_InboundMail_ParsesTheStoredMimeAndOmitsIt()
        {
            // E1/H1/H3: by item id, one capped raw read, RawMime never on the wire.
            const string raw = "Subject: hi\r\nContent-Type: text/plain\r\n\r\nHello";
            StoreMail("msg-1", "row-1");
            StoreRawMime("msg-1", raw);

            var response = await Service().GetMailBoxMailAsync(new GetMailBoxMailRequest { ItemId = "row-1" });

            response.IsSuccess.Should().BeTrue();
            response.Mail.RawMime.Should().BeNull();
            response.Content!.TextBody.Should().Be("Hello");
            response.Content.Attachments.Should().BeEmpty();
            response.Content.RawMimeLength.Should().Be(raw.Length);
            response.Content.PreviewTooLarge.Should().BeFalse();
            _repo.Verify(r => r.GetRawMimeAsync("msg-1", PreviewCap), Times.Once);
            _repo.Verify(r => r.GetRawMimeAsync(It.IsAny<string>(), It.IsAny<int?>()), Times.Once);
        }

        [Fact]
        public async Task GetMailBoxMailAsync_AttachmentMetadataAndCc_AreAsParsed()
        {
            StoreMail("msg-1");
            StoreRawMime("msg-1", MailContentParserTests.Raw());

            var content = (await Service().GetMailBoxMailAsync(new GetMailBoxMailRequest { MessageId = "msg-1" })).Content!;

            content.HtmlBody.Should().Contain("<p>HTML invoice</p>");
            content.Cc.Should().Contain("cc@example.com");
            content.Attachments.Should().ContainSingle().Which.FileName.Should().Be("invoice.pdf");
        }

        [Fact]
        public async Task GetMailBoxMailAsync_NoStoredMime_ReturnsNullContent()
        {
            // E2/H2: outbound mail.
            StoreMail("msg-1");

            var response = await Service().GetMailBoxMailAsync(new GetMailBoxMailRequest { MessageId = "msg-1" });

            response.IsSuccess.Should().BeTrue();
            response.Content.Should().BeNull();
            response.Mail.RawMime.Should().BeNull();
        }

        [Fact]
        public async Task GetMailBoxMailAsync_AboveTheCap_ReturnsTheLengthOnly()
        {
            // E3/H8: the repository returns the length without the string.
            StoreMail("msg-1");
            _repo.Setup(r => r.GetRawMimeAsync("msg-1", PreviewCap))
                 .ReturnsAsync(new MailBoxRawMime { Length = PreviewCap + 1, RawMime = null });

            var response = await Service().GetMailBoxMailAsync(new GetMailBoxMailRequest { MessageId = "msg-1" });

            response.Content.Should().BeEquivalentTo(new MailBoxMailContent
            {
                HtmlBody = null,
                TextBody = null,
                Cc = null,
                ReplyTo = null,
                Attachments = [],
                RawMimeLength = PreviewCap + 1,
                PreviewTooLarge = true
            });
        }

        [Theory]
        [InlineData("x")]
        [InlineData("   ")]
        public async Task GetMailBoxMailAsync_UnparseableMime_KeepsTheLengthSoTheSourceStaysAvailable(string raw)
        {
            // C5: today this returned null content and hid Original and .eml.
            StoreMail("msg-1");
            StoreRawMime("msg-1", raw);

            var response = await Service().GetMailBoxMailAsync(new GetMailBoxMailRequest { MessageId = "msg-1" });

            response.Content.Should().BeEquivalentTo(new MailBoxMailContent
            {
                Attachments = [],
                RawMimeLength = raw.Length,
                PreviewTooLarge = false
            });
        }

        [Fact]
        public async Task GetMailBoxMailAsync_EightBitBody_DecodesAsSent()
        {
            // E6/H7.
            StoreMail("msg-1");
            StoreRawMime("msg-1", MailContentParserTests.EightBitRaw());

            var response = await Service().GetMailBoxMailAsync(new GetMailBoxMailRequest { MessageId = "msg-1" });

            response.Content!.TextBody!.Trim().Should().Be("Grüße");
        }

        [Fact]
        public async Task GetMailBoxMailAsync_NeitherIdGiven_ReturnsMailNotFoundWithoutReading()
        {
            // C1.
            var response = await Service().GetMailBoxMailAsync(new GetMailBoxMailRequest());

            response.Errors.Should().Equal(new Dictionary<string, string> { ["MessageId"] = "Mail not found" });
            _repo.Verify(r => r.GetRawMimeAsync(It.IsAny<string>(), It.IsAny<int?>()), Times.Never);
        }

        [Theory]
        [InlineData(11)]
        [InlineData(5)]
        public async Task GetMailBoxMailAsync_LargeMail_SerializesWithinSixtyFourKiB(int attachmentMiB)
        {
            // C9: 11 MiB is above the cap (preview skipped); 5 MiB (about 7.2 M chars) is parsed.
            var raw = MailContentParserTests.LargeRaw(attachmentMiB * 1_048_576);
            StoreMail("msg-1");
            StoreRawMime("msg-1", raw);

            var response = await Service().GetMailBoxMailAsync(new GetMailBoxMailRequest { MessageId = "msg-1" });
            var json = JsonSerializer.SerializeToUtf8Bytes(response, new JsonSerializerOptions(JsonSerializerDefaults.Web));

            response.Content!.PreviewTooLarge.Should().Be(raw.Length > PreviewCap);
            response.Content.RawMimeLength.Should().Be(raw.Length);
            json.Length.Should().BeLessThanOrEqualTo(65_536);
        }

        [Fact]
        public async Task GetMailBoxMailSourceAsync_ReturnsTheStoredBytes()
        {
            // E5/H3/H4/H7: by item id; the bytes are the Latin-1 bytes of the stored string.
            var raw = MailContentParserTests.EightBitRaw();
            StoreMail("msg-1", "row-1");
            StoreRawMime("msg-1", raw);

            var response = await Service().GetMailBoxMailSourceAsync(new GetMailBoxMailRequest { ItemId = "row-1" });

            response.IsSuccess.Should().BeTrue();
            response.Content.Should().Equal(Encoding.Latin1.GetBytes(raw));
            _repo.Verify(r => r.GetRawMimeAsync("msg-1", null), Times.Once);
            _repo.Verify(r => r.GetMailBoxMailAsync(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task GetMailBoxMailSourceAsync_OutboundMail_ReturnsNoStoredSource()
        {
            // E10/C2.
            StoreMail("msg-1");

            var response = await Service().GetMailBoxMailSourceAsync(new GetMailBoxMailRequest { MessageId = "msg-1" });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().Equal(new Dictionary<string, string> { ["RawMime"] = "No stored message source" });
            _repo.Verify(r => r.GetMailBoxMailAsync("msg-1"), Times.Once);
        }

        [Theory]
        [InlineData("nope", null)]
        [InlineData(null, "nope")]
        [InlineData(null, null)]
        public async Task GetMailBoxMailSourceAsync_UnknownMail_ReturnsMailNotFound(string? itemId, string? messageId)
        {
            // E9/C1.
            var response = await Service().GetMailBoxMailSourceAsync(new GetMailBoxMailRequest { ItemId = itemId, MessageId = messageId });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().Equal(new Dictionary<string, string> { ["MessageId"] = "Mail not found" });
        }

        [Fact]
        public async Task GetMailBoxMailAttachmentFileAsync_StreamsTheAttachment()
        {
            // E7/H3/H5: one raw read, no metadata read.
            StoreMail("msg-1", "row-1");
            StoreRawMime("msg-1", MailContentParserTests.Raw());

            var response = await Service().GetMailBoxMailAttachmentFileAsync(
                new GetMailBoxMailAttachmentFileRequest { ItemId = "row-1", Index = 0 });

            response.IsSuccess.Should().BeTrue();
            response.FileName.Should().Be("invoice.pdf");
            ReadAll(response.Content!).Should().Equal(MailContentParserTests.InvoiceBytes);
            _repo.Verify(r => r.GetRawMimeAsync("msg-1", null), Times.Once);
            _repo.Verify(r => r.GetMailBoxMailAsync(It.IsAny<string>()), Times.Never);
        }

        [Theory]
        [InlineData(5)]
        [InlineData(1)]
        [InlineData(-1)]
        public async Task GetMailBoxMailAttachmentFileAsync_IndexThatDoesNotResolve_ReturnsAttachmentNotFound(int index)
        {
            // E8/C3.
            StoreMail("msg-1");
            StoreRawMime("msg-1", MailContentParserTests.Raw());

            var response = await Service().GetMailBoxMailAttachmentFileAsync(
                new GetMailBoxMailAttachmentFileRequest { MessageId = "msg-1", Index = index });

            response.Errors.Should().Equal(new Dictionary<string, string> { ["Index"] = "Attachment not found" });
        }

        [Fact]
        public async Task GetMailBoxMailAttachmentFileAsync_UnparseableMime_ReturnsAttachmentNotFound()
        {
            // C3.
            StoreMail("msg-1");
            StoreRawMime("msg-1", "x");

            var response = await Service().GetMailBoxMailAttachmentFileAsync(
                new GetMailBoxMailAttachmentFileRequest { MessageId = "msg-1", Index = 0 });

            response.Errors.Should().Equal(new Dictionary<string, string> { ["Index"] = "Attachment not found" });
        }

        [Fact]
        public async Task GetMailBoxMailAttachmentFileAsync_MailWithoutMime_ReturnsAttachmentNotFound()
        {
            // C3.
            StoreMail("msg-1");

            var response = await Service().GetMailBoxMailAttachmentFileAsync(
                new GetMailBoxMailAttachmentFileRequest { MessageId = "msg-1", Index = 0 });

            response.Errors.Should().Equal(new Dictionary<string, string> { ["Index"] = "Attachment not found" });
            _repo.Verify(r => r.GetMailBoxMailAsync("msg-1"), Times.Once);
        }

        [Theory]
        [InlineData("nope", null)]
        [InlineData(null, "nope")]
        [InlineData(null, null)]
        public async Task GetMailBoxMailAttachmentFileAsync_UnknownMail_ReturnsMailNotFound(string? itemId, string? messageId)
        {
            // C1.
            var response = await Service().GetMailBoxMailAttachmentFileAsync(
                new GetMailBoxMailAttachmentFileRequest { ItemId = itemId, MessageId = messageId });

            response.Errors.Should().Equal(new Dictionary<string, string> { ["MessageId"] = "Mail not found" });
        }

        [Fact]
        public async Task GetMailBoxMailAttachmentAsync_ObsoleteRoute_KeepsItsBase64Contract()
        {
            // E12/H6.
            StoreRawMime("msg-1", MailContentParserTests.Raw());

            var response = await Service().GetMailBoxMailAttachmentAsync(
                new GetMailBoxMailAttachmentRequest { MessageId = "msg-1", Index = 0 });

            response.IsSuccess.Should().BeTrue();
            response.Attachment!.FileName.Should().Be("invoice.pdf");
            response.Attachment.ContentType.Should().Be("application/pdf");
            Convert.FromBase64String(response.Attachment.ContentBase64).Should().Equal(MailContentParserTests.InvoiceBytes);
            _repo.Verify(r => r.GetRawMimeAsync("msg-1", null), Times.Once);
            _repo.Verify(r => r.GetMailBoxMailAsync(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task GetMailBoxMailAttachmentAsync_ObsoleteRoute_UnknownMail_ReturnsMailNotFound()
        {
            var response = await Service().GetMailBoxMailAttachmentAsync(
                new GetMailBoxMailAttachmentRequest { MessageId = "nope", Index = 0 });

            response.Errors.Should().Equal(new Dictionary<string, string> { ["MessageId"] = "Mail not found" });
        }

        [Fact]
        public async Task GetMailBoxMailAttachmentAsync_ObsoleteRoute_MailWithoutMime_ReturnsAttachmentNotFound()
        {
            StoreMail("msg-1");

            var response = await Service().GetMailBoxMailAttachmentAsync(
                new GetMailBoxMailAttachmentRequest { MessageId = "msg-1", Index = 0 });

            response.Errors.Should().Equal(new Dictionary<string, string> { ["Index"] = "Attachment not found" });
        }

        [Fact]
        public async Task GetMailBoxMailAttachmentAsync_ObsoleteRoute_IndexOutOfRange_ReturnsAttachmentNotFound()
        {
            StoreRawMime("msg-1", MailContentParserTests.Raw());

            var response = await Service().GetMailBoxMailAttachmentAsync(
                new GetMailBoxMailAttachmentRequest { MessageId = "msg-1", Index = 3 });

            response.Errors.Should().Equal(new Dictionary<string, string> { ["Index"] = "Attachment not found" });
            _repo.Verify(r => r.GetMailBoxMailAsync(It.IsAny<string>()), Times.Never);
        }
    }
}
