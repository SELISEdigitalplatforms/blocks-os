using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Blocks.Genesis.Entities.Os;
using Configuration.DomainService.Mail.Template;
using Configuration.DomainService.Mail.Template.Services;
using Configuration.DomainService.Organizations;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Bson;
using MongoDB.Driver;
using Moq;
using Os.DataAccess;
using Os.DataAccess.Notifications;
using XUnitTest.Notifications;
using XUnitTest.TestHelpers;
using XUnitTest.TestSupport;

namespace XUnitTest.Integration
{
    /// <summary>
    /// blocks-os#735 review fixes: the copy job never ends without a notification, and a batch counts only what it
    /// really wrote (reads that fail, an id collision that isn't a race, a copy deleted between read and write).
    /// </summary>
    [Collection(MongoIntegrationCollection.Name)]
    public sealed class EmailTemplateCopyReviewTests : IDisposable
    {
        private const string Tenant = "project-review";
        private const string User = "admin-1";

        private readonly IMongoDatabase _database;
        private readonly OwnDatabaseProvider _provider;
        private readonly RecordingSender _sender = new();
        private readonly IDisposable _context = new BlocksTestContext(tenantId: Tenant, userId: User);

        public EmailTemplateCopyReviewTests(MongoIntegrationFixture fixture)
        {
            _database = fixture.DbContextProvider.GetDatabase("", "copyrv-" + Guid.NewGuid().ToString("N")[..10]);
            _provider = new OwnDatabaseProvider(_database);
        }

        public void Dispose() => _context.Dispose();

        private IMongoCollection<EmailTemplate> Templates => _database.GetCollection<EmailTemplate>("EmailTemplates");
        private IMongoCollection<BsonDocument> Organizations => _database.GetCollection<BsonDocument>("Organizations");

        private async Task SeedOrganizationsAsync(IEnumerable<string> ids) =>
            await Organizations.InsertManyAsync(ids.Select(id => new BsonDocument { { "_id", id }, { "Name", "Org " + id } }));

        private static EmailTemplate Source() => new()
        {
            ItemId = "d-order",
            Name = "OrderConfirmation",
            Language = "en-US",
            OrganizationId = "default",
            TemplateSubject = "Your order",
            TemplateBody = "<p>Thanks</p>",
        };

        private static EmailTemplate Copy(string organizationId, string id) => new()
        {
            ItemId = id,
            Name = "OrderConfirmation",
            Language = "en-US",
            OrganizationId = organizationId,
            TemplateSubject = "Theirs",
            TemplateBody = "<p>Theirs</p>",
        };

        private static EmailTemplateCopyCommand Command(IEnumerable<string>? organizations = null, string existing = "keep", bool all = false) => new()
        {
            JobId = "job-1",
            TenantId = Tenant,
            RequestedByUserId = User,
            TemplateId = "d-order",
            AllOrganizations = all,
            OrganizationIds = organizations?.ToList() ?? [],
            Existing = existing,
        };

        private EmailTemplateCopyJob Job(IMailTemplateRepository repository, IOrganizationReader? reader = null) =>
            new(repository, reader ?? new OrganizationReader(_provider), _sender, NullLogger<EmailTemplateCopyJob>.Instance);

        private MailTemplateRepository Repository(IOsDataAccess? dataAccess = null) => new(_provider, dataAccess ?? new HookedDataAccess(null));

        private BuiltInNotification Notification() => _sender.Single(BuiltInNotificationNames.EmailTemplateCopyFinished);

        [Fact] // C6 + review: a source that can't even be read still ends in a failure notification, not an exception
        public async Task ASourceReadFailure_IsReported_AndDoesNotEscape()
        {
            var repository = new Mock<IMailTemplateRepository>();
            repository.Setup(r => r.GetByIdAsync("d-order")).ThrowsAsync(new MongoException("connection lost"));

            var run = () => Job(repository.Object).RunAsync(Command(new[] { "acme" }));

            var result = (await run.Should().NotThrowAsync()).Subject;
            result.SourceFound.Should().BeFalse();
            Notification().IsSuccess.Should().BeFalse();
            Notification().Event.Should().Be("finished-with-errors");
        }

        [Fact] // §6.3 has only "finished" and "finished-with-errors"
        public async Task AMissingSource_IsReportedAsFinishedWithErrors()
        {
            await Job(Repository()).RunAsync(Command(new[] { "acme" }));

            Notification().Event.Should().Be("finished-with-errors");
            Notification().IsSuccess.Should().BeFalse();
        }

        [Fact] // C5 + review: when paging all organizations fails, the job stops paging, reports it and still notifies
        public async Task AnOrganizationPagingFailure_StopsPaging_AndIsReported()
        {
            await Templates.InsertOneAsync(Source());
            var reader = new Mock<IOrganizationReader>();
            reader.SetupSequence(r => r.GetEnabledPageAsync(It.IsAny<string?>(), EmailTemplateCopyJob.BatchSize, It.IsAny<CancellationToken>()))
                .ReturnsAsync(Enumerable.Range(0, 100).Select(i => new OrganizationSummary($"org{i:D3}", "")).ToList())
                .ThrowsAsync(new MongoException("connection lost"));

            var run = () => Job(Repository(), reader.Object).RunAsync(Command(all: true));

            var result = (await run.Should().NotThrowAsync()).Subject;
            result.Created.Should().Be(100);
            result.Incomplete.Should().BeTrue();
            Notification().IsSuccess.Should().BeFalse();
            Notification().Event.Should().Be("finished-with-errors");
        }

        [Fact] // C5 + review: a failed lookup of the selected organizations counts that chunk as failed and goes on
        public async Task AnEnabledLookupFailure_CountsThatChunkAsFailed_AndContinues()
        {
            await Templates.InsertOneAsync(Source());
            var ids = Enumerable.Range(0, 150).Select(i => $"org{i:D3}").ToList();
            await SeedOrganizationsAsync(ids);
            var real = new OrganizationReader(_provider);
            var calls = 0;
            var reader = new Mock<IOrganizationReader>();
            reader.Setup(r => r.GetEnabledAmongAsync(It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>()))
                .Returns((IReadOnlyCollection<string> chunk, CancellationToken ct) =>
                    Interlocked.Increment(ref calls) == 1 ? throw new MongoException("connection lost") : real.GetEnabledAmongAsync(chunk, ct));

            var result = await Job(Repository(), reader.Object).RunAsync(Command(ids));

            result.Failed.Should().Be(100);
            result.Created.Should().Be(50);
            Notification().IsSuccess.Should().BeFalse();
        }

        [Fact] // review: an _id that exists without this key is not a race; the organization has no copy, so it failed
        public async Task AnIdCollisionWithoutTheKey_IsCountedAsFailed()
        {
            await Templates.InsertOneAsync(Source());
            await SeedOrganizationsAsync(new[] { "acme", "globex" });
            var taken = Copy("acme", OrganizationCopyIds.For(Tenant, "acme", "OrderConfirmation", "en-US"));
            taken.Name = "SomethingElse";
            await Templates.InsertOneAsync(taken);

            var result = await Job(Repository()).RunAsync(Command(new[] { "acme", "globex" }));

            result.Created.Should().Be(1);
            result.Kept.Should().Be(0);
            result.Failed.Should().Be(1);
        }

        [Fact] // review: a copy another job inserts between the read and the write is kept (Keep) ...
        public async Task ARacedCopy_IsKept_WithKeep()
        {
            await Templates.InsertOneAsync(Source());
            await SeedOrganizationsAsync(new[] { "acme" });
            var repository = Repository(new HookedDataAccess(() => Templates.InsertOne(Copy("acme", OrganizationCopyIds.For(Tenant, "acme", "OrderConfirmation", "en-US")))));

            var result = await Job(repository).RunAsync(Command(new[] { "acme" }));

            result.Should().BeEquivalentTo(new { Created = 0, Kept = 1, Replaced = 0, Failed = 0 }, o => o.ExcludingMissingMembers());
        }

        [Fact] // ... and overwritten (Replace), counted from what the update really matched
        public async Task ARacedCopy_IsReplaced_WithReplace()
        {
            await Templates.InsertOneAsync(Source());
            await SeedOrganizationsAsync(new[] { "acme" });
            var repository = Repository(new HookedDataAccess(() => Templates.InsertOne(Copy("acme", "someone-elses-id"))));

            var result = await Job(repository).RunAsync(Command(new[] { "acme" }, "replace"));

            result.Should().BeEquivalentTo(new { Created = 0, Kept = 0, Replaced = 1, Failed = 0 }, o => o.ExcludingMissingMembers());
            (await Templates.Find(t => t.OrganizationId == "acme").ToListAsync()).Should().ContainSingle()
                .Which.TemplateBody.Should().Be("<p>Thanks</p>");
        }

        [Fact] // review: Replaced counts copies the update matched; one deleted between read and write is not replaced
        public async Task ACopyDeletedBeforeTheReplace_IsNotCountedAsReplaced()
        {
            await Templates.InsertOneAsync(Source());
            await SeedOrganizationsAsync(new[] { "acme", "globex" });
            await Templates.InsertManyAsync(new[] { Copy("acme", "acme-own"), Copy("globex", "globex-own") });
            var repository = Repository(new HookedDataAccess(() => Templates.DeleteOne(t => t.ItemId == "globex-own")));

            var result = await Job(repository).RunAsync(Command(new[] { "acme", "globex" }, "replace"));

            result.Replaced.Should().Be(1);
            result.Failed.Should().Be(1);
            Notification().IsSuccess.Should().BeFalse();
        }

        /// <summary>Lets everything through and runs a hook once, between a batch's read and its write.</summary>
        private sealed class HookedDataAccess : IOsDataAccess
        {
            private readonly Action? _beforeWrite;
            private int _ran;

            public HookedDataAccess(Action? beforeWrite) => _beforeWrite = beforeWrite;

            public Task<ReadScope<T>> ReadAsync<T>(string schema, FilterDefinition<T> filter, string callSite, string? tenantId = null, bool useProjection = true) =>
                Task.FromResult(new ReadScope<T>(true, filter, null));

            public Task<FilterDefinition<T>?> EditFilterAsync<T>(string schema, FilterDefinition<T> filter, string callSite, string? tenantId = null)
            {
                if (_beforeWrite is not null && Interlocked.Exchange(ref _ran, 1) == 0)
                    _beforeWrite();
                return Task.FromResult<FilterDefinition<T>?>(filter);
            }

            public Task<FilterDefinition<T>?> DeleteFilterAsync<T>(string schema, FilterDefinition<T> filter, string callSite, string? tenantId = null) =>
                Task.FromResult<FilterDefinition<T>?>(filter);
            public Task<bool> InsertAllowedAsync(string schema, string callSite, string? tenantId = null) => Task.FromResult(true);
            public Task<T> PrepareWriteAsync<T>(string schema, T entity, bool isInsert, string callSite, string? tenantId = null) => Task.FromResult(entity);
            public Task<T> PrepareUpsertAsync<T>(string schema, T entity, IMongoCollection<T> collection, FilterDefinition<T> filter, string callSite, string? tenantId = null) =>
                Task.FromResult(entity);
            public Task<T> PrepareReplaceAsync<T>(string schema, T entity, IMongoCollection<T> collection, FilterDefinition<T> filter, string callSite, string? tenantId = null) =>
                Task.FromResult(entity);
            public Task CheckUpdateAsync<T>(string schema, UpdateDefinition<T> update, string callSite, string? tenantId = null) => Task.CompletedTask;
        }

        private sealed class OwnDatabaseProvider : IDbContextProvider
        {
            private readonly IMongoDatabase _database;

            public OwnDatabaseProvider(IMongoDatabase database) => _database = database;

            public IMongoDatabase GetDatabase(string tenantId) => _database;
            public IMongoDatabase? GetDatabase() => _database;
            public IMongoDatabase GetDatabase(string connectionString, string databaseName, bool isCacheRefreshed = false) => _database;
            public IMongoCollection<T> GetCollection<T>(string collectionName) => _database.GetCollection<T>(collectionName);
            public IMongoCollection<T> GetCollection<T>(string tenantId, string collectionName) => _database.GetCollection<T>(collectionName);
        }
    }
}
