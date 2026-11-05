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
using Os.DataAccess.Notifications;
using XUnitTest.Notifications;
using XUnitTest.TestHelpers;
using XUnitTest.TestSupport;

namespace XUnitTest.Integration
{
    /// <summary>
    /// blocks-os#736 (SPEC34 §6.2): the Worker job that deletes the organizations' copies of a deleted Default template,
    /// on a real MongoDB. Each test has its own database, so "all organizations" sees only that test's organizations.
    /// </summary>
    [Collection(MongoIntegrationCollection.Name)]
    public sealed class EmailTemplateDeleteJobTests : IDisposable
    {
        private const string Tenant = "project-delete";
        private const string User = "admin-1";

        private readonly IMongoDatabase _database;
        private readonly OwnDatabaseProvider _provider;
        private readonly RecordingSender _sender = new();
        private readonly IDisposable _context = new BlocksTestContext(tenantId: Tenant, userId: User);

        public EmailTemplateDeleteJobTests(MongoIntegrationFixture fixture)
        {
            _database = fixture.DbContextProvider.GetDatabase("", "delete-" + Guid.NewGuid().ToString("N")[..10]);
            _provider = new OwnDatabaseProvider(_database);
        }

        public void Dispose() => _context.Dispose();

        private IMongoCollection<EmailTemplate> Templates => _database.GetCollection<EmailTemplate>("EmailTemplates");
        private IMongoCollection<BsonDocument> Organizations => _database.GetCollection<BsonDocument>("Organizations");

        private MailTemplateRepository Repository() => new(_provider, new PassThroughOsDataAccess());

        private EmailTemplateDeleteJob Job(IMailTemplateRepository? repository = null, IBuiltInNotificationSender? sender = null, IOrganizationReader? reader = null) =>
            new(repository ?? Repository(), reader ?? new OrganizationReader(_provider), sender ?? _sender, NullLogger<EmailTemplateDeleteJob>.Instance);

        private async Task SeedOrganizationsAsync(IEnumerable<string> ids, bool disabled = false) =>
            await Organizations.InsertManyAsync(ids.Select(id => new BsonDocument
            {
                { "_id", id }, { "Name", "Org " + id }, { "IsDisabled", disabled },
            }));

        private static EmailTemplate Template(string id, string? organizationId, string name = "OrderConfirmation", string language = "en-US") => new()
        {
            ItemId = id,
            Name = name,
            Language = language,
            OrganizationId = organizationId!,
            TemplateSubject = "Subject",
            TemplateBody = "<p>Body</p>",
        };

        private static EmailTemplateDeleteCommand Command(IEnumerable<string>? organizations = null, bool all = false) => new()
        {
            JobId = "job-" + Guid.NewGuid().ToString("N")[..8],
            TenantId = Tenant,
            OriginalTenantId = "root-tenant",
            RequestedByUserId = User,
            Name = "OrderConfirmation",
            Language = "en-US",
            AllOrganizations = all,
            OrganizationIds = organizations?.ToList() ?? [],
        };

        private async Task<List<string>> RemainingIdsAsync() =>
            (await Templates.Find(FilterDefinition<EmailTemplate>.Empty).ToListAsync()).Select(t => t.ItemId).OrderBy(id => id, StringComparer.Ordinal).ToList();

        private BuiltInNotification Notification() => _sender.Single(BuiltInNotificationNames.EmailTemplateDeleteFinished);

        [Fact] // H3, H5, example 1
        public async Task ASelectedOrganization_LosesItsCopy_AndTheRequesterIsNotified()
        {
            await SeedOrganizationsAsync(new[] { "umbrella", "globex" });
            await Templates.InsertManyAsync(new[] { Template("umbrella-copy", "umbrella"), Template("globex-copy", "globex") });
            var command = Command(new[] { "umbrella" });

            var result = await Job().RunAsync(command);

            result.Deleted.Should().Be(1);
            result.NotFound.Should().Be(0);
            (await RemainingIdsAsync()).Should().Equal("globex-copy");
            var notification = Notification();
            notification.Event.Should().Be("finished");
            notification.Title.Should().Be("Template deleted from organizations");
            notification.Description.Should().Be("OrderConfirmation · en-US: 1 deleted, 0 had no copy, 0 skipped, 0 failed.");
            notification.IsSuccess.Should().BeTrue();
            notification.Ids.Should().BeEquivalentTo(new Dictionary<string, string?> { { "jobId", command.JobId } });
            notification.UserIds.Should().Equal(User);
            notification.TenantId.Should().Be("root-tenant");
        }

        [Fact] // H4, C4, example 2: all enabled organizations; a disabled one keeps its copy
        public async Task AllOrganizations_DeleteEveryEnabledCopy_AndLeaveADisabledOrganizationAlone()
        {
            var enabled = Enumerable.Range(1, 12).Select(i => "org-" + i.ToString("00")).ToList();
            await SeedOrganizationsAsync(enabled);
            await SeedOrganizationsAsync(new[] { "org-disabled" }, disabled: true);
            await Templates.InsertManyAsync(enabled.Take(4).Select(o => Template(o + "-copy", o)).Append(Template("disabled-copy", "org-disabled")));

            var result = await Job().RunAsync(Command(all: true));

            result.Deleted.Should().Be(4);
            result.NotFound.Should().Be(8);
            (await RemainingIdsAsync()).Should().Equal("disabled-copy");
            Notification().Description.Should().Be("OrderConfirmation · en-US: 4 deleted, 8 had no copy, 0 skipped, 0 failed.");
        }

        [Fact] // H4: more than one page of organizations, batches never over 100
        public async Task AllOrganizations_ArePagedBy100()
        {
            var organizations = Enumerable.Range(0, 250).Select(i => "org-" + i.ToString("000")).ToList();
            await SeedOrganizationsAsync(organizations);
            await Templates.InsertManyAsync(organizations.Select(o => Template(o + "-copy", o)));

            var result = await Job().RunAsync(Command(all: true));

            result.Deleted.Should().Be(250);
            result.LargestBatch.Should().Be(100);
            (await RemainingIdsAsync()).Should().BeEmpty();
        }

        [Fact] // C4: unknown and disabled organizations are skipped and keep their templates
        public async Task UnknownAndDisabledOrganizations_AreSkipped()
        {
            await SeedOrganizationsAsync(new[] { "acme" });
            await SeedOrganizationsAsync(new[] { "off" }, disabled: true);
            await Templates.InsertManyAsync(new[] { Template("acme-copy", "acme"), Template("off-copy", "off") });

            var result = await Job().RunAsync(Command(new[] { "acme", "off", "nobody", "default" }));

            result.Deleted.Should().Be(1);
            result.Skipped.Should().Be(2);
            (await RemainingIdsAsync()).Should().Equal("off-copy");
            Notification().Description.Should().Be("OrderConfirmation · en-US: 1 deleted, 0 had no copy, 2 skipped, 0 failed.");
        }

        [Fact] // C8: only the Name + Language in the targeted organizations; Default and legacy templates are never touched
        public async Task OnlyTheNameAndLanguageInTargetedOrganizations_AreDeleted()
        {
            await SeedOrganizationsAsync(new[] { "acme", "globex" });
            await Templates.InsertManyAsync(new[]
            {
                Template("acme-copy", "acme"),
                Template("acme-other-name", "acme", name: "ShipmentUpdate"),
                Template("acme-other-language", "acme", language: "xx-XX"),
                Template("globex-copy", "globex"),
                Template("default-copy", "default"),
                Template("legacy-empty", ""),
            });
            await _database.GetCollection<BsonDocument>("EmailTemplates").InsertOneAsync(new BsonDocument
            {
                { "_id", "legacy-missing" }, { "Name", "OrderConfirmation" }, { "Language", "en-US" },
            });

            var result = await Job().RunAsync(Command(new[] { "acme" }));

            result.Deleted.Should().Be(1);
            (await RemainingIdsAsync()).Should().Equal("acme-other-language", "acme-other-name", "default-copy", "globex-copy", "legacy-empty", "legacy-missing");
        }

        [Fact] // C7, example 5: a second delivery deletes nothing more and reports what it found
        public async Task TheSameMessageTwice_EndsInTheSameState()
        {
            await SeedOrganizationsAsync(new[] { "umbrella" });
            await Templates.InsertOneAsync(Template("umbrella-copy", "umbrella"));
            var command = Command(new[] { "umbrella" });

            await Job().RunAsync(command);
            var second = await Job().RunAsync(command);

            second.Deleted.Should().Be(0);
            second.NotFound.Should().Be(1);
            (await RemainingIdsAsync()).Should().BeEmpty();
            _sender.Sent.Last().Description.Should().Be("OrderConfirmation · en-US: 0 deleted, 1 had no copy, 0 skipped, 0 failed.");
        }

        [Fact] // C6: a failed batch is reported, the next one still runs
        public async Task AFailedBatch_IsCounted_AndTheJobContinues()
        {
            var organizations = Enumerable.Range(0, 150).Select(i => "org-" + i.ToString("000")).ToList();
            await SeedOrganizationsAsync(organizations);
            await Templates.InsertManyAsync(organizations.Select(o => Template(o + "-copy", o)));

            var result = await Job(new FailingFirstDelete(Repository())).RunAsync(Command(organizations));

            result.Failed.Should().Be(100);
            result.Deleted.Should().Be(50);
            var notification = Notification();
            notification.IsSuccess.Should().BeFalse();
            notification.Event.Should().Be("finished-with-errors");
            notification.Description.Should().Be("OrderConfirmation · en-US: 50 deleted, 0 had no copy, 0 skipped, 100 failed.");
        }

        [Fact] // read failures: paging stops, the run is reported as not successful, nothing escapes
        public async Task AnOrganizationPagingFailure_IsReported_AndDoesNotEscape()
        {
            var reader = new Mock<IOrganizationReader>();
            reader.Setup(r => r.GetEnabledPageAsync(It.IsAny<string?>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new MongoException("down"));

            var run = () => Job(reader: reader.Object).RunAsync(Command(all: true));

            var result = (await run.Should().NotThrowAsync()).Subject;
            result.Incomplete.Should().BeTrue();
            Notification().IsSuccess.Should().BeFalse();
            Notification().Event.Should().Be("finished-with-errors");
        }

        [Fact] // read failures: a chunk that can't be checked counts as failed
        public async Task AnEnabledLookupFailure_CountsThatChunkAsFailed()
        {
            var reader = new Mock<IOrganizationReader>();
            reader.Setup(r => r.GetEnabledAmongAsync(It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new MongoException("down"));

            var result = await Job(reader: reader.Object).RunAsync(Command(new[] { "acme", "globex" }));

            result.Failed.Should().Be(2);
            Notification().IsSuccess.Should().BeFalse();
        }

        [Fact] // C9: no notification configuration (the sender fails) never fails the job
        public async Task ABrokenNotificationSender_StillDeletes()
        {
            await SeedOrganizationsAsync(new[] { "umbrella" });
            await Templates.InsertOneAsync(Template("umbrella-copy", "umbrella"));
            var sender = new Mock<IBuiltInNotificationSender>();
            sender.Setup(s => s.SendAsync(It.IsAny<BuiltInNotification>(), It.IsAny<CancellationToken>())).ThrowsAsync(new InvalidOperationException("no config"));

            var result = await Job(sender: sender.Object).RunAsync(Command(new[] { "umbrella" }));

            result.Deleted.Should().Be(1);
            (await RemainingIdsAsync()).Should().BeEmpty();
        }

        [Fact] // C9 with the real sender: its publisher failing is swallowed too
        public async Task TheRealSender_WithAFailingPublisher_StillDeletes()
        {
            await SeedOrganizationsAsync(new[] { "umbrella" });
            await Templates.InsertOneAsync(Template("umbrella-copy", "umbrella"));

            var result = await Job(sender: FailingNotifier.Sender()).RunAsync(Command(new[] { "umbrella" }));

            result.Deleted.Should().Be(1);
        }

        [Fact] // the notification goes to the project tenant when the requester has no other tenant
        public async Task WithoutAnOriginalTenant_TheNotificationGoesToTheProject()
        {
            await SeedOrganizationsAsync(new[] { "umbrella" });
            var command = Command(new[] { "umbrella" });
            command.OriginalTenantId = null;

            await Job().RunAsync(command);

            Notification().TenantId.Should().Be(Tenant);
        }

        /// <summary>A repository whose first delete fails, as a broken connection would.</summary>
        private sealed class FailingFirstDelete : IMailTemplateRepository
        {
            private readonly IMailTemplateRepository _inner;
            private int _batches;

            public FailingFirstDelete(IMailTemplateRepository inner) => _inner = inner;

            public Task<long> DeleteOrganizationCopiesAsync(string name, string language, IReadOnlyCollection<string> organizationIds) =>
                Interlocked.Increment(ref _batches) == 1
                    ? throw new MongoException("connection lost")
                    : _inner.DeleteOrganizationCopiesAsync(name, language, organizationIds);

            public Task SaveAsync(EmailTemplate template) => _inner.SaveAsync(template);
            public Task<EmailTemplate?> GetByIdAsync(string itemId) => _inner.GetByIdAsync(itemId);
            public Task<EmailTemplate?> GetForViewAsync(string itemId) => _inner.GetForViewAsync(itemId);
            public Task<EmailTemplate?> GetByNameAndLanguageAsync(string name, string language, string organizationId) => _inner.GetByNameAndLanguageAsync(name, language, organizationId);
            public Task<GetAllMailTemplatesResponse> GetsAsync(GetAllMailTemplatesRequest request) => _inner.GetsAsync(request);
            public Task DeleteAsync(string itemId) => _inner.DeleteAsync(itemId);
            public Task<long> CountByMailConfigurationIdAsync(string mailConfigurationId) => _inner.CountByMailConfigurationIdAsync(mailConfigurationId);
            public Task<long> CountOutsideOrganizationAsync(IReadOnlyCollection<string> templateIds, string organizationId) => _inner.CountOutsideOrganizationAsync(templateIds, organizationId);
            public Task<int> AssignConfigurationAsync(string configurationId, string organizationId, IReadOnlyCollection<string>? templateIds, string? searchKey, string? language) =>
                _inner.AssignConfigurationAsync(configurationId, organizationId, templateIds, searchKey, language);
            public Task<List<EmailTemplate>> GetOrganizationCopiesAsync(string name, string language, IReadOnlyCollection<string> organizationIds) =>
                _inner.GetOrganizationCopiesAsync(name, language, organizationIds);
            public Task<OrganizationCopyBatchResult> WriteOrganizationCopiesAsync(EmailTemplate source, IReadOnlyCollection<string> organizationIds, bool replace, string tenantId, string userId) =>
                _inner.WriteOrganizationCopiesAsync(source, organizationIds, replace, tenantId, userId);
        }

        /// <summary>Every collection from one database: the test's own.</summary>
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
