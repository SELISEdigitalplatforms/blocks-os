using System;
using System.Linq;
using System.Threading.Tasks;
using Configuration.DomainService.Mail.Entities;
using Configuration.DomainService.Mail.Enums;
using Configuration.DomainService.Mail.Mailbox;
using Configuration.DomainService.Mail.Mailbox.Services;
using FluentAssertions;

namespace XUnitTest.Integration
{
    [Collection(MongoIntegrationCollection.Name)]
    public class MailboxRepositoryTests
    {
        private const string CollectionName = "MailBoxEntitys";
        private readonly MongoIntegrationFixture _fixture;

        public MailboxRepositoryTests(MongoIntegrationFixture fixture)
        {
            _fixture = fixture;
        }

        private MailboxRepository NewRepository() => new(_fixture.DbContextProvider);

        private Task SeedAsync(params MailBoxEntity[] entities)
            => _fixture.Collection<MailBoxEntity>(CollectionName).InsertManyAsync(entities);

        private static MailBoxEntity Mail(string messageId, string subject, MailStatus status, DateTime date,
            string body = "body", bool inbound = false, string from = "a@x.com", string to = "b@x.com")
            => new()
            {
                ItemId = Guid.NewGuid().ToString("N"),
                MessageId = messageId,
                Subject = subject,
                From = from,
                To = to,
                Body = body,
                Status = status,
                Error = string.Empty,
                Date = date,
                RawMime = string.Empty,
                IsInbound = inbound
            };

        [Fact]
        public async Task GetMailBoxAggregatedMailsAsync_GroupsByMessageAndBuildsTimeline()
        {
            var token = "TKN" + Guid.NewGuid().ToString("N");
            var now = DateTime.UtcNow;
            await SeedAsync(
                Mail("m1-" + token, "Hello " + token, MailStatus.Sent, now.AddMinutes(-2)),
                Mail("m1-" + token, "Hello " + token, MailStatus.Delivered, now.AddMinutes(-1)),
                Mail("m2-" + token, "Other " + token, MailStatus.Sent, now.AddMinutes(-3)));

            var (mails, total) = await NewRepository().GetMailBoxAggregatedMailsAsync(new GetMailBoxMailsRequest
            {
                SearchText = token,
                PageNumber = 0,
                PageSize = 10
            });

            total.Should().Be(2);
            var m1 = mails.Single(m => m.MessageId == "m1-" + token);
            m1.Status.Should().Be(MailStatus.Delivered);
            m1.Timeline.Should().HaveCount(2);
        }

        [Fact]
        public async Task GetMailBoxAggregatedMailsAsync_FiltersByLatestStatus()
        {
            var token = "TKN" + Guid.NewGuid().ToString("N");
            var now = DateTime.UtcNow;
            await SeedAsync(
                Mail("d1-" + token, "S " + token, MailStatus.Sent, now.AddMinutes(-2)),
                Mail("d1-" + token, "S " + token, MailStatus.Delivered, now.AddMinutes(-1)),
                Mail("d2-" + token, "S " + token, MailStatus.Sent, now.AddMinutes(-1)));

            var (mails, total) = await NewRepository().GetMailBoxAggregatedMailsAsync(new GetMailBoxMailsRequest
            {
                SearchText = token,
                Status = "Delivered",
                PageNumber = 0,
                PageSize = 10
            });

            total.Should().Be(1);
            mails.Single().MessageId.Should().Be("d1-" + token);
        }

        [Fact]
        public async Task GetMailBoxAggregatedMailsAsync_FiltersByInboundAndDateRange()
        {
            var token = "TKN" + Guid.NewGuid().ToString("N");
            var now = DateTime.UtcNow;
            await SeedAsync(
                Mail("in-" + token, "In " + token, MailStatus.Received, now.AddMinutes(-1), inbound: true),
                Mail("out-" + token, "Out " + token, MailStatus.Sent, now.AddMinutes(-1), inbound: false),
                Mail("old-" + token, "Old " + token, MailStatus.Received, now.AddYears(-1), inbound: true));

            var (_, total) = await NewRepository().GetMailBoxAggregatedMailsAsync(new GetMailBoxMailsRequest
            {
                SearchText = token,
                IsInbound = true,
                SendDateRange = new DateRange
                {
                    StartDate = now.AddDays(-1).ToString("o"),
                    EndDate = now.ToString("o")
                },
                PageNumber = 0,
                PageSize = 10
            });

            total.Should().Be(1);
        }

        [Fact]
        public async Task GetMailBoxMailAsync_ReturnsLatestAndFallsBackToSentBody()
        {
            var messageId = "single-" + Guid.NewGuid().ToString("N");
            var now = DateTime.UtcNow;
            await SeedAsync(
                Mail(messageId, "Subj", MailStatus.Sent, now.AddMinutes(-3), body: "the-real-body"),
                Mail(messageId, "Subj", MailStatus.Delivered, now.AddMinutes(-1), body: ""));

            var result = await NewRepository().GetMailBoxMailAsync(messageId);

            result.Should().NotBeNull();
            result!.Status.Should().Be(MailStatus.Delivered);
            // Latest (Delivered) had an empty body, so it is backfilled from the Sent record.
            result.Body.Should().Be("the-real-body");
        }

        [Fact]
        public async Task GetMailBoxMailAsync_WhenMissing_ReturnsNull()
        {
            var result = await NewRepository().GetMailBoxMailAsync("nope-" + Guid.NewGuid().ToString("N"));

            result.Should().BeNull();
        }
    }
}
