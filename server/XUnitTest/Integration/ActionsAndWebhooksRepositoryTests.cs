using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Configuration.DomainService.Actions;
using Configuration.DomainService.Shared.Services;
using Configuration.DomainService.Webhooks;
using FluentAssertions;
using MongoDB.Bson;
using MongoDB.Driver;
using Moq;
using XUnitTest.Webhooks;

namespace XUnitTest.Integration
{
    /// <summary>The atomic list updates and the history indexes, against a real mongod.</summary>
    [Collection(MongoIntegrationCollection.Name)]
    public class ActionsAndWebhooksRepositoryTests
    {
        private readonly IMongoDatabase _database;
        private readonly IMongoDatabase _rootDatabase;
        private readonly IDbContextProvider _provider;
        private readonly IKeyValueStore _keyValueStore;
        private readonly FixedTimeProvider _clock = new();

        public ActionsAndWebhooksRepositoryTests(MongoIntegrationFixture fixture)
        {
            _database = fixture.DbContextProvider.GetDatabase("", "aw-" + Guid.NewGuid().ToString("N")[..10]);
            var provider = new Mock<IDbContextProvider>();
            _rootDatabase = fixture.DbContextProvider.GetDatabase("", "awroot-" + Guid.NewGuid().ToString("N")[..10]);
            provider.Setup(p => p.GetDatabase()).Returns(_database);
            provider.Setup(p => p.GetDatabase(It.IsAny<string>(), It.IsAny<string>())).Returns(_rootDatabase);
            _provider = provider.Object;
            _keyValueStore = new MongoKeyValueStore(_provider, Mock.Of<IBlocksSecret>());
        }

        private IMongoCollection<BsonDocument> KeyValues => _database.GetCollection<BsonDocument>(KeyValueCollection.Name);

        private static BsonDocument Action(string name) => new()
        {
            { "Name", name }, { "Label", name }, { "Service", "iam" }, { "Payload", new BsonDocument() },
            { "Workflow", false }, { "Function", false }, { "Webhook", false }
        };

        private static BsonDocument CatalogAction(string name, string label = "", string payloadType = "string") => new()
        {
            { "Name", name }, { "Label", label == "" ? name : label }, { "Service", "iam" },
            { "Payload", new BsonDocument("userId", payloadType) },
            { "Workflow", false }, { "Function", false }, { "Webhook", false }
        };

        private static BsonDocument ActionRow(IEnumerable<BsonDocument> items) => new()
        {
            { "_id", Guid.NewGuid().ToString("N") }, { "Key", ActionConstants.ActionsKey },
            { "Value", new BsonArray(items) }, { "Tags", new BsonArray() }
        };

        private Task SeedCatalogAsync(params BsonDocument[] items) =>
            _rootDatabase.GetCollection<BsonDocument>(KeyValueCollection.Name).InsertOneAsync(ActionRow(items));

        private Task SeedTenantAsync(params BsonDocument[] items) => KeyValues.InsertOneAsync(ActionRow(items));

        private ActionsService Service() => new(
            new ActionsRepository(_keyValueStore, _provider, _clock), Microsoft.Extensions.Logging.Abstractions.NullLogger<ActionsService>.Instance);

        private static UpdateActionRequest Switch(string name, string target, bool enabled) =>
            new() { Name = name, Target = target, Enabled = enabled };

        private static WebhookEntry Webhook(string name) => new()
        {
            Id = Guid.NewGuid().ToString("N"),
            Name = name,
            NameKey = WebhookEntry.KeyOf(name),
            Url = "https://hooks.example.com/in",
            SecretRef = "sec-1",
            IsActive = true,
            Actions = ["iam.user.created"],
            CreatedDate = DateTime.UtcNow
        };

        [Fact]
        public async Task Actions_List_ShowsEveryCatalogAction_WithTheTenantFlags_AndHidesTenantOnlyNames()
        {
            await SeedCatalogAsync(CatalogAction("iam.user.created", "Created"), CatalogAction("iam.user.updated"));
            var service = Service();

            (await service.GetsAsync(CancellationToken.None)).Should().OnlyContain(a => !a.Workflow && !a.Function && !a.Webhook)
                .And.HaveCount(2, "no tenant row means every flag is off");

            var tenantCopy = CatalogAction("iam.user.created", "old label");
            tenantCopy["Webhook"] = true;
            var tenantOnly = CatalogAction("iam.gone");
            tenantOnly["Workflow"] = true;
            await SeedTenantAsync(tenantCopy, tenantOnly);

            var list = await service.GetsAsync(CancellationToken.None);

            list.Select(a => a.Name).Should().Equal("iam.user.created", "iam.user.updated");
            list[0].Should().BeEquivalentTo(new { Label = "Created", Webhook = true, Workflow = false });
            list[1].Webhook.Should().BeFalse();
        }

        [Fact]
        public async Task Actions_List_IsEmpty_WhenTheCatalogIsMissing()
        {
            await SeedTenantAsync(CatalogAction("iam.user.created"));

            (await Service().GetsAsync(CancellationToken.None)).Should().BeEmpty();
        }

        [Fact]
        public async Task Actions_Enable_CreatesTheTenantRowWithAFullCopyOfTheCatalogEntry()
        {
            await SeedCatalogAsync(CatalogAction("iam.user.created", "Created"));

            var outcome = await Service().UpdateAsync(Switch("iam.user.created", "webhook", true), CancellationToken.None);

            outcome.IsOk.Should().BeTrue();
            var row = await KeyValues.Find(new BsonDocument("Key", ActionConstants.ActionsKey)).SingleAsync();
            row["Tags"].AsBsonArray.Should().BeEmpty();
            row["CreatedDate"].IsValidDateTime.Should().BeTrue();
            var stored = await _keyValueStore.GetAsync<List<ActionDefinition>>(ActionConstants.ActionsKey, true, CancellationToken.None);
            stored.Should().ContainSingle().Which.Should().BeEquivalentTo(new
            {
                Name = "iam.user.created", Label = "Created", Service = "iam",
                Payload = new Dictionary<string, string> { ["userId"] = "string" },
                Webhook = true, Workflow = false, Function = false
            });
        }

        [Fact]
        public async Task Actions_Enable_ASecondFlagKeepsTheFirst_AndRefreshesTheItemFromTheCatalog()
        {
            await SeedCatalogAsync(CatalogAction("iam.user.created", "Created", "string"));
            var service = Service();
            await service.UpdateAsync(Switch("iam.user.created", "workflow", true), CancellationToken.None);
            await _rootDatabase.GetCollection<BsonDocument>(KeyValueCollection.Name).UpdateOneAsync(
                new BsonDocument("Key", ActionConstants.ActionsKey),
                Builders<BsonDocument>.Update.Set("Value.0.Label", "Renamed").Set("Value.0.Payload", new BsonDocument("userId", "string[]")));

            await service.UpdateAsync(Switch("iam.user.created", "function", true), CancellationToken.None);

            var stored = await _keyValueStore.GetAsync<List<ActionDefinition>>(ActionConstants.ActionsKey, true, CancellationToken.None);
            stored.Should().ContainSingle().Which.Should().BeEquivalentTo(new
            {
                Label = "Renamed", Workflow = true, Function = true, Webhook = false,
                Payload = new Dictionary<string, string> { ["userId"] = "string[]" }
            });
        }

        [Fact]
        public async Task Actions_Enable_TwoAdminsAtOnce_KeepBothFlags_AndMakeOneItem()
        {
            await SeedCatalogAsync(CatalogAction("iam.user.created"), CatalogAction("iam.user.updated"));
            await SeedTenantAsync(CatalogAction("iam.other"));
            var repository = new ActionsRepository(_keyValueStore, _provider, _clock);
            var entry = new ActionDefinition { Name = "iam.user.created", Label = "x", Service = "iam" };

            var results = await Task.WhenAll(
                repository.EnableAsync(entry, "Webhook", CancellationToken.None),
                repository.EnableAsync(entry, "Workflow", CancellationToken.None),
                repository.EnableAsync(entry, "Function", CancellationToken.None));

            results.Should().AllBeEquivalentTo(true);
            var stored = await repository.GetAllAsync(CancellationToken.None);
            stored!.Where(a => a.Name == "iam.user.created").Should().ContainSingle()
                .Which.Should().BeEquivalentTo(new { Webhook = true, Workflow = true, Function = true });
        }

        [Fact]
        public async Task Actions_Disable_RemovesTheItemOnlyWhenTheLastFlagGoes()
        {
            await SeedCatalogAsync(CatalogAction("iam.user.created"));
            var service = Service();
            await service.UpdateAsync(Switch("iam.user.created", "workflow", true), CancellationToken.None);
            await service.UpdateAsync(Switch("iam.user.created", "webhook", true), CancellationToken.None);

            await service.UpdateAsync(Switch("iam.user.created", "workflow", false), CancellationToken.None);
            var afterFirst = await _keyValueStore.GetAsync<List<ActionDefinition>>(ActionConstants.ActionsKey, true, CancellationToken.None);
            afterFirst.Should().ContainSingle().Which.Should().BeEquivalentTo(new { Workflow = false, Webhook = true });

            await service.UpdateAsync(Switch("iam.user.created", "webhook", false), CancellationToken.None);
            var afterLast = await _keyValueStore.GetAsync<List<ActionDefinition>>(ActionConstants.ActionsKey, true, CancellationToken.None);
            afterLast.Should().BeEmpty();
        }

        [Fact]
        public async Task Actions_Disable_WithNoItemOrNoRow_IsOk_AndWritesNothing()
        {
            await SeedCatalogAsync(CatalogAction("iam.user.created"));

            var outcome = await Service().UpdateAsync(Switch("iam.user.created", "webhook", false), CancellationToken.None);

            outcome.IsOk.Should().BeTrue();
            (await KeyValues.CountDocumentsAsync(new BsonDocument("Key", ActionConstants.ActionsKey))).Should().Be(0);
        }

        [Fact]
        public async Task Actions_Update_NameNotInTheCatalog_IsNotFound_AndAMissingCatalog_IsNotSeeded()
        {
            var service = Service();
            (await service.UpdateAsync(Switch("iam.user.created", "webhook", true), CancellationToken.None))
                .ErrorCode.Should().Be(ActionErrorCodes.ActionsNotSeeded);

            await SeedCatalogAsync(CatalogAction("iam.user.created"));
            await SeedTenantAsync(CatalogAction("iam.tenant.only"));
            (await service.UpdateAsync(Switch("iam.tenant.only", "webhook", true), CancellationToken.None))
                .ErrorCode.Should().Be(ActionErrorCodes.ActionNotFound);
        }

        [Fact]
        public async Task Webhooks_ConcurrentCreatesOfDifferentWebhooks_AreAllKept_AndANameIsUniqueIgnoringCase()
        {
            var repository = new WebhookRepository(_keyValueStore, _provider, _clock);

            var results = await Task.WhenAll(Enumerable.Range(0, 5).Select(i => repository.InsertAsync(Webhook("hook " + i), CancellationToken.None)));
            var duplicate = await repository.InsertAsync(Webhook("HOOK 3 "), CancellationToken.None);

            results.Should().AllSatisfy(r => r.Should().Be(WebhookWriteResult.Written));
            duplicate.Should().Be(WebhookWriteResult.NameTaken);
            (await repository.GetAllAsync(CancellationToken.None)).Should().HaveCount(5);
            (await KeyValues.CountDocumentsAsync(new BsonDocument("Key", ActionConstants.WebhooksKey))).Should().Be(1);
        }

        [Fact]
        public async Task Webhooks_UpdateChangesOnlyItsItem_AndRefusesANameAnotherWebhookHas()
        {
            var repository = new WebhookRepository(_keyValueStore, _provider, _clock);
            var first = Webhook("first");
            var second = Webhook("second");
            await repository.InsertAsync(first, CancellationToken.None);
            await repository.InsertAsync(second, CancellationToken.None);

            var renamed = await repository.UpdateAsync(new WebhookUpdate(first.Id, "First renamed", first.Url, false, ["a"], null, null, false), CancellationToken.None);
            var clash = await repository.UpdateAsync(new WebhookUpdate(first.Id, "SECOND", first.Url, true, ["a"], null, null, false), CancellationToken.None);
            var missing = await repository.UpdateAsync(new WebhookUpdate("nope", "x", first.Url, true, ["a"], null, null, false), CancellationToken.None);

            renamed.Should().Be(WebhookWriteResult.Written);
            clash.Should().Be(WebhookWriteResult.NameTaken);
            missing.Should().Be(WebhookWriteResult.NotFound);
            var stored = await repository.GetAllAsync(CancellationToken.None);
            stored.Single(w => w.Id == first.Id).Should().BeEquivalentTo(new { Name = "First renamed", IsActive = false, SecretRef = "sec-1" });
            stored.Single(w => w.Id == second.Id).Should().BeEquivalentTo(new { Name = "second", IsActive = true });
        }

        [Fact]
        public async Task Webhooks_TwentiethFinalFailureTurnsTheWebhookOff_AndASuccessResetsTheCounter()
        {
            var repository = new WebhookRepository(_keyValueStore, _provider, _clock);
            var hook = Webhook("flaky");
            await repository.InsertAsync(hook, CancellationToken.None);

            var counts = new List<WebhookFailureCount>();
            for (var i = 0; i < 20; i++)
            {
                counts.Add(await repository.RecordFinalFailureAsync(hook.Id, 20, "auto-off after 20 failures", CancellationToken.None));
            }

            counts.Take(19).Should().OnlyContain(c => !c.TurnedOff);
            counts[19].Should().Be(new WebhookFailureCount(20, true));
            (await repository.GetAsync(hook.Id, CancellationToken.None)).Should().BeEquivalentTo(new { IsActive = false, DisabledReason = "auto-off after 20 failures" });

            await repository.ResetFailuresAsync(hook.Id, CancellationToken.None);
            (await repository.GetAsync(hook.Id, CancellationToken.None))!.ConsecutiveFailures.Should().Be(0);
        }

        [Fact]
        public async Task Webhooks_DeleteRemovesOnlyThatItem()
        {
            var repository = new WebhookRepository(_keyValueStore, _provider, _clock);
            var keep = Webhook("keep");
            var drop = Webhook("drop");
            await repository.InsertAsync(keep, CancellationToken.None);
            await repository.InsertAsync(drop, CancellationToken.None);

            (await repository.DeleteAsync(drop.Id, CancellationToken.None)).Should().BeTrue();
            (await repository.DeleteAsync(drop.Id, CancellationToken.None)).Should().BeFalse();
            (await repository.GetAllAsync(CancellationToken.None)).Select(w => w.Id).Should().Equal(keep.Id);
        }

        [Fact]
        public async Task Deliveries_SameEventAndWebhook_GetsOneRowOnly_AndHasNoTtlIndex()
        {
            var repository = new WebhookDeliveryRepository(_provider, _clock);

            (await repository.InsertAsync(Delivery("evt_1", "w1"), CancellationToken.None)).Should().BeTrue();
            (await repository.InsertAsync(Delivery("evt_1", "w1"), CancellationToken.None)).Should().BeFalse();
            (await repository.InsertAsync(Delivery("evt_1", "w2"), CancellationToken.None)).Should().BeTrue();

            var indexes = await (await _database.GetCollection<BsonDocument>(WebhookDeliveryRepository.CollectionName).Indexes.ListAsync()).ToListAsync();
            indexes.Select(i => i["name"].AsString).Should().Contain([WebhookDeliveryRepository.EventWebhookIndexName, WebhookDeliveryRepository.WebhookCreatedIndexName]);
            indexes.Should().NotContain(i => i.Contains("expireAfterSeconds"));
        }

        [Fact]
        public async Task Deliveries_AnAttemptIsClaimedOnce_AndAFinishedRowClaimsNothing()
        {
            var repository = new WebhookDeliveryRepository(_provider, _clock);
            var row = Delivery("evt_2", "w1");
            await repository.InsertAsync(row, CancellationToken.None);

            var claims = await Task.WhenAll(repository.TryStartAttemptAsync(row.ItemId, 1, CancellationToken.None), repository.TryStartAttemptAsync(row.ItemId, 1, CancellationToken.None));
            claims.Count(c => c is not null).Should().Be(1);

            await repository.RecordAttemptAsync(row.ItemId, new WebhookAttempt { No = 1, HttpStatus = 200 }, WebhookDeliveryStatus.Delivered, null, CancellationToken.None);
            (await repository.TryStartAttemptAsync(row.ItemId, 2, CancellationToken.None)).Should().BeNull();
        }

        [Fact]
        public async Task Deliveries_ResendStartsOnceForADoneRow_AndNeverWhileInFlight()
        {
            var repository = new WebhookDeliveryRepository(_provider, _clock);
            var row = Delivery("evt_3", "w1");
            await repository.InsertAsync(row, CancellationToken.None);
            var staleBefore = _clock.Now.UtcDateTime.AddHours(-7);

            (await repository.TryStartResendAsync(row.ItemId, staleBefore, CancellationToken.None)).Should().BeNull("a pending row is in flight");

            await repository.MarkAsync(row.ItemId, WebhookDeliveryStatus.Failed, "secret missing", CancellationToken.None);
            var first = await repository.TryStartResendAsync(row.ItemId, staleBefore, CancellationToken.None);
            var second = await repository.TryStartResendAsync(row.ItemId, staleBefore, CancellationToken.None);

            first!.Status.Should().Be(WebhookDeliveryStatus.Failed);
            second.Should().BeNull();
            (await repository.GetAsync(row.ItemId, CancellationToken.None)).Should().BeEquivalentTo(new { Status = WebhookDeliveryStatus.Pending, RunAttempts = 0 });
        }

        [Fact]
        public async Task Deliveries_ListIsNewestFirst_FilteredAndPaged()
        {
            var repository = new WebhookDeliveryRepository(_provider, _clock);
            for (var i = 0; i < 3; i++)
            {
                var row = Delivery("evt_l" + i, "w9");
                row.CreatedDate = new DateTime(2026, 11, 1 + i, 0, 0, 0, DateTimeKind.Utc);
                await repository.InsertAsync(row, CancellationToken.None);
            }

            await repository.InsertAsync(Delivery("evt_other", "w8"), CancellationToken.None);

            var page = await repository.ListAsync(new WebhookDeliveriesQuery { WebhookId = "w9", Page = 1, PageSize = 2 }, CancellationToken.None);

            page.TotalCount.Should().Be(3);
            page.Items.Select(i => i.EventId).Should().Equal("evt_l2", "evt_l1");
        }

        private static WebhookDelivery Delivery(string eventId, string webhookId) => new()
        {
            ItemId = Guid.NewGuid().ToString("N"),
            EventId = eventId,
            Action = "iam.user.created",
            WebhookId = webhookId,
            Status = WebhookDeliveryStatus.Pending,
            Body = "{}",
            CreatedDate = DateTime.UtcNow,
            LastUpdatedDate = DateTime.UtcNow
        };
    }
}
