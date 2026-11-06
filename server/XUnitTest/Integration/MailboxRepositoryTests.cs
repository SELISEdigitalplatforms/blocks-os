using System;
using System.Collections.Concurrent;
using System.Linq;
using System.Threading.Tasks;
using Blocks.Genesis;
using Configuration.DomainService.Mail.Mailbox;
using Configuration.DomainService.Mail.Mailbox.Services;
using FluentAssertions;
using Blocks.Genesis.Entities.Logic;
using MongoDB.Bson;
using MongoDB.Driver;
using MongoDB.Driver.Core.Events;
using Moq;

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
        public async Task GetMailBoxAggregatedMailsAsync_ReturnsEachRowsConfiguration_AndFiltersByIt()
        {
            var token = "TKN" + Guid.NewGuid().ToString("N");
            var now = DateTime.UtcNow;
            var first = Mail("c1-" + token, "In " + token, MailStatus.Received, now.AddMinutes(-2), inbound: true);
            first.MailServerConfigurationId = "cfg-1";
            var second = Mail("c2-" + token, "In " + token, MailStatus.Received, now.AddMinutes(-1), inbound: true);
            second.MailServerConfigurationId = "cfg-2";
            await SeedAsync(first, second);

            var (all, _) = await NewRepository().GetMailBoxAggregatedMailsAsync(new GetMailBoxMailsRequest
            {
                SearchText = token,
                IsInbound = true,
                PageNumber = 0,
                PageSize = 10
            });

            all.Select(m => (m.MessageId, m.MailServerConfigurationId)).Should().BeEquivalentTo(new[]
            {
                ("c1-" + token, "cfg-1"),
                ("c2-" + token, "cfg-2")
            });

            var (filtered, total) = await NewRepository().GetMailBoxAggregatedMailsAsync(new GetMailBoxMailsRequest
            {
                SearchText = token,
                IsInbound = true,
                MailServerConfigurationId = "cfg-2",
                PageNumber = 0,
                PageSize = 10
            });

            total.Should().Be(1);
            filtered.Single().MessageId.Should().Be("c2-" + token);
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
        public async Task GetMessageIdByItemIdAsync_ReturnsTheRowsMessageId()
        {
            var messageId = "item-" + Guid.NewGuid().ToString("N") + "@mail.gmail.com";
            var row = Mail(messageId, "Subj", MailStatus.Received, DateTime.UtcNow, inbound: true);
            await SeedAsync(row);

            var repository = NewRepository();

            (await repository.GetMessageIdByItemIdAsync(row.ItemId)).Should().Be(messageId);
            (await repository.GetMessageIdByItemIdAsync("nope-" + Guid.NewGuid().ToString("N"))).Should().BeNull();
        }

        [Fact]
        public async Task GetMailBoxMailAsync_WhenMissing_ReturnsNull()
        {
            var result = await NewRepository().GetMailBoxMailAsync("nope-" + Guid.NewGuid().ToString("N"));

            result.Should().BeNull();
        }

        private const int PreviewCap = 8_388_608;

        private static MailBoxEntity Inbound(string messageId, DateTime date, string rawMime)
        {
            var row = Mail(messageId, "Subj", MailStatus.Received, date, inbound: true);
            row.RawMime = rawMime;
            return row;
        }

        // A stored MIME of exactly `length` chars.
        private static string RawOfLength(int length)
        {
            const string head = "Subject: big\r\nContent-Type: text/plain\r\n\r\n";
            return head + new string('a', length - head.Length);
        }

        [Fact]
        public async Task GetMailBoxMailAsync_DoesNotReadTheStoredMime()
        {
            // H8/C6: the metadata read leaves RawMime in MongoDB.
            var messageId = "meta-" + Guid.NewGuid().ToString("N");
            await SeedAsync(Inbound(messageId, DateTime.UtcNow, "Subject: hi\r\n\r\nHello"));

            var result = await NewRepository().GetMailBoxMailAsync(messageId);

            result!.MessageId.Should().Be(messageId);
            result.RawMime.Should().BeNull();
        }

        [Fact]
        public async Task GetRawMimeAsync_ReturnsTheStoredMimeAndItsLength()
        {
            var messageId = "raw-" + Guid.NewGuid().ToString("N");
            const string raw = "Subject: hi\r\nContent-Type: text/plain\r\n\r\nGr\u00fc\u00dfe";
            await SeedAsync(Inbound(messageId, DateTime.UtcNow, raw));

            var result = await NewRepository().GetRawMimeAsync(messageId, null);

            // $strLenCP counts code points, so Latin-1 chars above 0x7F count once, like their byte.
            result!.Length.Should().Be(raw.Length);
            result.RawMime.Should().Be(raw);
        }

        [Fact]
        public async Task GetRawMimeAsync_NoRowWithStoredMime_ReturnsNull()
        {
            // Outbound rows store "" (and older rows may hold null); an unknown message has no rows.
            var messageId = "out-" + Guid.NewGuid().ToString("N");
            var withNull = Mail(messageId, "Subj", MailStatus.Delivered, DateTime.UtcNow);
            withNull.RawMime = null!;
            await SeedAsync(Mail(messageId, "Subj", MailStatus.Sent, DateTime.UtcNow.AddMinutes(-1)), withNull);

            var repository = NewRepository();

            (await repository.GetRawMimeAsync(messageId, null)).Should().BeNull();
            (await repository.GetRawMimeAsync(messageId, PreviewCap)).Should().BeNull();
            (await repository.GetRawMimeAsync("nope-" + Guid.NewGuid().ToString("N"), null)).Should().BeNull();
        }

        [Fact]
        public async Task GetRawMimeAsync_AtTheCap_ReturnsTheMime_AndAboveIt_OnlyTheLength()
        {
            // C4/H8/E3/E4.
            var atCap = "cap-" + Guid.NewGuid().ToString("N");
            var aboveCap = "over-" + Guid.NewGuid().ToString("N");
            await SeedAsync(
                Inbound(atCap, DateTime.UtcNow, RawOfLength(PreviewCap)),
                Inbound(aboveCap, DateTime.UtcNow, RawOfLength(PreviewCap + 1)));

            var repository = NewRepository();
            var at = await repository.GetRawMimeAsync(atCap, PreviewCap);
            var above = await repository.GetRawMimeAsync(aboveCap, PreviewCap);
            var uncapped = await repository.GetRawMimeAsync(aboveCap, null);

            at!.Length.Should().Be(PreviewCap);
            at.RawMime.Should().HaveLength(PreviewCap);
            above!.Length.Should().Be(PreviewCap + 1);
            above.RawMime.Should().BeNull();
            uncapped!.RawMime.Should().HaveLength(PreviewCap + 1);
        }

        [Fact]
        public async Task GetRawMimeAsync_DuplicateInboundRows_ReturnsTheNewest()
        {
            var messageId = "dup-" + Guid.NewGuid().ToString("N");
            var now = DateTime.UtcNow;
            await SeedAsync(
                Inbound(messageId, now.AddMinutes(-5), "Subject: old\r\n\r\nold"),
                Inbound(messageId, now, "Subject: new\r\n\r\nnew"),
                // A newer row without MIME does not hide the stored one.
                Mail(messageId, "Subj", MailStatus.Delivered, now.AddMinutes(1)));

            var result = await NewRepository().GetRawMimeAsync(messageId, null);

            result!.RawMime.Should().Be("Subject: new\r\n\r\nnew");
        }

        [Fact]
        public async Task DetailsReads_ManyRows_ReadTheMimeOnceWithLimitOneAndProjectItOutOfTheFind()
        {
            // C6: command monitoring on a client built from the fixture's connection string.
            var messageId = "mon-" + Guid.NewGuid().ToString("N");
            var now = DateTime.UtcNow;
            var rows = Enumerable.Range(0, 50)
                .Select(i => Mail(messageId, "Subj", MailStatus.Delivered, now.AddSeconds(-i)))
                .Append(Inbound(messageId, now.AddMinutes(-1), "Subject: a\r\n\r\na"))
                .Append(Inbound(messageId, now.AddMinutes(-2), "Subject: b\r\n\r\nb"))
                .ToArray();
            await SeedAsync(rows);

            var commands = new ConcurrentQueue<(string Name, BsonDocument Command)>();
            var settings = MongoClientSettings.FromConnectionString(MongoIntegrationFixture.ConnectionString);
            settings.ClusterConfigurator = cluster => cluster.Subscribe<CommandStartedEvent>(e =>
            {
                if (e.CommandName is "find" or "aggregate"
                    && e.DatabaseNamespace.DatabaseName == _fixture.DatabaseName
                    && e.Command.GetValue(e.CommandName, BsonNull.Value) == CollectionName)
                {
                    commands.Enqueue((e.CommandName, e.Command.DeepClone().AsBsonDocument));
                }
            });
            using var client = new MongoClient(settings);
            var provider = new Mock<IDbContextProvider>();
            provider.Setup(p => p.GetDatabase()).Returns(client.GetDatabase(_fixture.DatabaseName));
            var repository = new MailboxRepository(provider.Object);

            var mail = await repository.GetMailBoxMailAsync(messageId);
            var raw = await repository.GetRawMimeAsync(messageId, PreviewCap);

            mail!.RawMime.Should().BeNull();
            raw!.RawMime.Should().Be("Subject: a\r\n\r\na");

            var aggregates = commands.Where(c => c.Name == "aggregate").ToList();
            aggregates.Should().ContainSingle();
            aggregates[0].Command["pipeline"].AsBsonArray
                .Should().ContainSingle(stage => stage.AsBsonDocument.Contains("$limit"))
                .Which.AsBsonDocument["$limit"].ToInt32().Should().Be(1);

            var finds = commands.Where(c => c.Name == "find").ToList();
            finds.Should().ContainSingle();
            finds[0].Command["projection"].AsBsonDocument[nameof(MailBoxEntity.RawMime)].ToInt32().Should().Be(0);
        }
    }
}
