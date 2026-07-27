using System.Collections.Generic;
using System.Threading.Tasks;
using Configuration.DomainService.Mail.Entities;
using Configuration.DomainService.Mail.Enums;
using Configuration.DomainService.Mail.Mailbox;
using Configuration.DomainService.Mail.Mailbox.Services;
using FluentAssertions;
using Moq;

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
    }
}
