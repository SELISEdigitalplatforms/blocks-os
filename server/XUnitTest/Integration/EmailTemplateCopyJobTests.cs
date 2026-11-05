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
    /// blocks-os#735 (SPEC33 §6.3): the Worker job that copies a Default template to organizations, on a real MongoDB.
    /// Each test has its own database, so "all organizations" sees only that test's organizations.
    /// </summary>
    [Collection(MongoIntegrationCollection.Name)]
    public sealed class EmailTemplateCopyJobTests : IDisposable
    {
        private const string Tenant = "project-copy";
        private const string User = "admin-1";

        private readonly IMongoDatabase _database;
        private readonly OwnDatabaseProvider _provider;
        private readonly RecordingSender _sender = new();
        private readonly IDisposable _context = new BlocksTestContext(tenantId: Tenant, userId: User);

        public EmailTemplateCopyJobTests(MongoIntegrationFixture fixture)
        {
            _database = fixture.DbContextProvider.GetDatabase("", "copy-" + Guid.NewGuid().ToString("N")[..10]);
            _provider = new OwnDatabaseProvider(_database);
        }

        public void Dispose() => _context.Dispose();

        private IMongoCollection<EmailTemplate> Templates => _database.GetCollection<EmailTemplate>("EmailTemplates");
        private IMongoCollection<BsonDocument> Organizations => _database.GetCollection<BsonDocument>("Organizations");

        private MailTemplateRepository Repository() => new(_provider, new PassThroughOsDataAccess());

        private EmailTemplateCopyJob Job(IMailTemplateRepository? repository = null, IBuiltInNotificationSender? sender = null) =>
            new(repository ?? Repository(), new OrganizationReader(_provider), sender ?? _sender, NullLogger<EmailTemplateCopyJob>.Instance);

        private async Task SeedOrganizationsAsync(IEnumerable<string> ids, bool disabled = false) =>
            await Organizations.InsertManyAsync(ids.Select(id => new BsonDocument
            {
                { "_id", id }, { "Name", "Org " + id }, { "IsDisabled", disabled },
            }));

        private static EmailTemplate Source(string id = "d-order", string? organizationId = "default") => new()
        {
            ItemId = id,
            Name = "OrderConfirmation",
            Language = "en-US",
            OrganizationId = organizationId!,
            TemplateSubject = "Your order",
            TemplateBody = "<p>Thanks for your order</p>",
            JsonContent = "{\"v\":1}",
            ImageId = "img-1",
            ImageUrl = "https://cdn.example.com/img-1.png",
            MailConfigurationId = "default-smtp",
            CreatedFromDefault = false,
        };

        private static EmailTemplateCopyCommand Command(IEnumerable<string>? organizations = null, string existing = "keep", bool all = false, string templateId = "d-order") => new()
        {
            JobId = Guid.NewGuid().ToString(),
            TenantId = Tenant,
            OriginalTenantId = "root-tenant",
            RequestedByUserId = User,
            TemplateId = templateId,
            AllOrganizations = all,
            OrganizationIds = organizations?.ToList() ?? [],
            Existing = existing,
        };

        private async Task<List<EmailTemplate>> CopiesAsync() =>
            await Templates.Find(t => t.Name == "OrderConfirmation" && t.OrganizationId != "default").ToListAsync();

        private static EmailTemplate OwnCopy(string organizationId, string id) => new()
        {
            ItemId = id,
            Name = "OrderConfirmation",
            Language = "en-US",
            OrganizationId = organizationId,
            TemplateSubject = "Their subject",
            TemplateBody = "<p>Their body</p>",
            JsonContent = "{\"theirs\":true}",
            ImageId = "their-img",
            ImageUrl = "https://cdn.example.com/theirs.png",
            MailConfigurationId = organizationId + "-smtp",
            CreatedFromDefault = false,
            LastUpdatedBy = "them",
        };

        [Fact] // H2, H6, example 1
        public async Task SelectedOrganizations_EachGetOneCopy_AndTheRequesterIsNotified()
        {
            await SeedOrganizationsAsync(new[] { "acme", "globex", "initech" });
            await Templates.InsertOneAsync(Source());
            var command = Command(new[] { "acme", "globex", "initech" });

            var result = await Job().RunAsync(command);

            result.Created.Should().Be(3);
            var copies = await CopiesAsync();
            copies.Select(c => c.OrganizationId).Should().BeEquivalentTo("acme", "globex", "initech");
            foreach (var copy in copies)
            {
                copy.ItemId.Should().Be(OrganizationCopyIds.For(Tenant, copy.OrganizationId, "OrderConfirmation", "en-US"));
                copy.Language.Should().Be("en-US");
                copy.TemplateSubject.Should().Be("Your order");
                copy.TemplateBody.Should().Be("<p>Thanks for your order</p>");
                copy.JsonContent.Should().Be("{\"v\":1}");
                copy.ImageId.Should().Be("img-1");
                copy.ImageUrl.Should().Be("https://cdn.example.com/img-1.png");
                copy.MailConfigurationId.Should().BeEmpty();
                copy.CreatedFromDefault.Should().BeTrue();
                copy.CreatedBy.Should().Be(User);
                copy.LastUpdatedBy.Should().Be(User);
                copy.GeneratedBy.Should().Be(User);
                copy.CreatedDate.Should().BeAfter(DateTime.UtcNow.AddMinutes(-5));
            }

            var sent = _sender.Single(BuiltInNotificationNames.EmailTemplateCopyFinished);
            sent.ConfigurationName.Should().Be("os-email-template-copy-finished");
            sent.Event.Should().Be("finished");
            sent.IsSuccess.Should().BeTrue();
            sent.Title.Should().Be("Template copied to organizations");
            sent.Description.Should().Be("OrderConfirmation · en-US: 3 created, 0 replaced, 0 kept, 0 skipped, 0 failed.");
            sent.Ids.Should().BeEquivalentTo(new Dictionary<string, string?> { { "templateId", "d-order" }, { "jobId", command.JobId } });
            sent.UserIds.Should().Equal(User);
            sent.TenantId.Should().Be("root-tenant");
        }

        [Fact] // H5, example 2
        public async Task Replace_OverwritesTheContent_AndKeepsIdConfigurationAndOrigin()
        {
            await SeedOrganizationsAsync(new[] { "acme", "globex", "initech", "umbrella" });
            await Templates.InsertManyAsync(new[] { Source(), OwnCopy("umbrella", "u-own") });

            var result = await Job().RunAsync(Command(new[] { "acme", "globex", "initech", "umbrella" }, "replace"));

            result.Created.Should().Be(3);
            result.Replaced.Should().Be(1);
            var umbrella = await Templates.Find(t => t.ItemId == "u-own").SingleAsync();
            umbrella.OrganizationId.Should().Be("umbrella");
            umbrella.TemplateSubject.Should().Be("Your order");
            umbrella.TemplateBody.Should().Be("<p>Thanks for your order</p>");
            umbrella.JsonContent.Should().Be("{\"v\":1}");
            umbrella.ImageId.Should().Be("img-1");
            umbrella.ImageUrl.Should().Be("https://cdn.example.com/img-1.png");
            umbrella.MailConfigurationId.Should().Be("umbrella-smtp");
            umbrella.CreatedFromDefault.Should().BeFalse();
            umbrella.LastUpdatedBy.Should().Be(User);
            (await CopiesAsync()).Should().HaveCount(4);
            _sender.Single(BuiltInNotificationNames.EmailTemplateCopyFinished).Description
                .Should().Be("OrderConfirmation · en-US: 3 created, 1 replaced, 0 kept, 0 skipped, 0 failed.");
        }

        [Fact] // H4
        public async Task Keep_LeavesAnExistingCopyUnchanged()
        {
            await SeedOrganizationsAsync(new[] { "acme", "umbrella" });
            await Templates.InsertManyAsync(new[] { Source(), OwnCopy("umbrella", "u-own") });

            var result = await Job().RunAsync(Command(new[] { "acme", "umbrella" }, "keep"));

            result.Created.Should().Be(1);
            result.Kept.Should().Be(1);
            var umbrella = await Templates.Find(t => t.ItemId == "u-own").SingleAsync();
            umbrella.TemplateSubject.Should().Be("Their subject");
            umbrella.TemplateBody.Should().Be("<p>Their body</p>");
            umbrella.LastUpdatedBy.Should().Be("them");
        }

        [Fact] // H3, example 3: every enabled organization, read in pages of 100, written in batches of 100
        public async Task AllOrganizations_PagesThroughEveryEnabledOrganization_ExceptDisabledOnes()
        {
            var enabled = Enumerable.Range(0, 205).Select(i => $"org{i:D3}").ToList();
            await SeedOrganizationsAsync(enabled);
            await SeedOrganizationsAsync(new[] { "zz-disabled" }, disabled: true);
            await Templates.InsertManyAsync(new[] { Source(), OwnCopy("org007", "own-7"), OwnCopy("org150", "own-150") });

            var result = await Job().RunAsync(Command(all: true));

            result.Created.Should().Be(203);
            result.Kept.Should().Be(2);
            result.Skipped.Should().Be(0);
            result.LargestBatch.Should().Be(100);
            var copies = await CopiesAsync();
            copies.Should().HaveCount(205);
            copies.Should().NotContain(c => c.OrganizationId == "zz-disabled");
            copies.Should().NotContain(c => c.OrganizationId == "default");
        }

        [Fact] // C3
        public async Task UnknownAndDisabledOrganizations_AreSkipped()
        {
            await SeedOrganizationsAsync(new[] { "acme" });
            await SeedOrganizationsAsync(new[] { "closed" }, disabled: true);
            await Templates.InsertOneAsync(Source());

            var result = await Job().RunAsync(Command(new[] { "acme", "ghost", "closed" }));

            result.Created.Should().Be(1);
            result.Skipped.Should().Be(2);
            (await CopiesAsync()).Select(c => c.OrganizationId).Should().Equal("acme");
            _sender.Single(BuiltInNotificationNames.EmailTemplateCopyFinished).Description
                .Should().Be("OrderConfirmation · en-US: 1 created, 0 replaced, 0 kept, 2 skipped, 0 failed.");
        }

        [Fact] // C4, example 6: the same message twice ends in the same state
        public async Task TheSameMessageTwice_StillLeavesOneCopyPerOrganization()
        {
            await SeedOrganizationsAsync(new[] { "acme", "globex", "initech" });
            await Templates.InsertOneAsync(Source());
            var command = Command(new[] { "acme", "globex", "initech" });

            await Job().RunAsync(command);
            var second = await Job().RunAsync(command);

            second.Created.Should().Be(0);
            second.Kept.Should().Be(3);
            (await CopiesAsync()).Should().HaveCount(3);
        }

        [Fact] // C4, #735 Q3: two jobs at the same moment never make two copies in one organization
        public async Task TwoJobsAtOnce_NeverCreateTwoCopiesInOneOrganization()
        {
            var organizations = Enumerable.Range(0, 60).Select(i => $"race{i:D2}").ToList();
            await SeedOrganizationsAsync(organizations);
            await Templates.InsertOneAsync(Source());

            // Several rounds: a single round can miss the moment two inserts meet.
            for (var round = 0; round < 8; round++)
            {
                await Templates.DeleteManyAsync(t => t.OrganizationId != "default");
                var results = await Task.WhenAll(
                    Job().RunAsync(Command(organizations, "replace")),
                    Job().RunAsync(Command(organizations, "replace")),
                    Job().RunAsync(Command(organizations, "keep")));

                var copies = await CopiesAsync();
                copies.Should().HaveCount(60);
                copies.GroupBy(c => c.OrganizationId).Should().OnlyContain(g => g.Count() == 1);
                results.Sum(r => r.Created).Should().Be(60);
                results.Should().OnlyContain(r => r.Failed == 0);
                results.Should().OnlyContain(r => r.Created + r.Replaced + r.Kept == 60);
            }
        }

        [Fact] // C5: a failed batch is reported and the next batch still runs
        public async Task AFailedBatch_IsCounted_AndTheJobContinues()
        {
            var organizations = Enumerable.Range(0, 150).Select(i => $"b{i:D3}").ToList();
            await SeedOrganizationsAsync(organizations);
            await Templates.InsertOneAsync(Source());
            var failingFirst = new FailingFirstBatch(Repository());

            var result = await Job(failingFirst).RunAsync(Command(organizations));

            result.Failed.Should().Be(100);
            result.Created.Should().Be(50);
            var sent = _sender.Single(BuiltInNotificationNames.EmailTemplateCopyFinished);
            sent.IsSuccess.Should().BeFalse();
            sent.Event.Should().Be("finished-with-errors");
            sent.Description.Should().Be("OrderConfirmation · en-US: 50 created, 0 replaced, 0 kept, 0 skipped, 100 failed.");
        }

        [Fact] // C6
        public async Task ADeletedSource_CreatesNothing_AndSendsAFailure()
        {
            await SeedOrganizationsAsync(new[] { "acme" });
            var command = Command(new[] { "acme" }, templateId: "deleted");

            var result = await Job().RunAsync(command);

            result.SourceFound.Should().BeFalse();
            (await Templates.CountDocumentsAsync(FilterDefinition<EmailTemplate>.Empty)).Should().Be(0);
            var sent = _sender.Single(BuiltInNotificationNames.EmailTemplateCopyFinished);
            sent.IsSuccess.Should().BeFalse();
            sent.Event.Should().Be("finished-with-errors"); // §6.3 knows only finished / finished-with-errors
            sent.Ids["templateId"].Should().Be("deleted");
            sent.Ids["jobId"].Should().Be(command.JobId);
            sent.TenantId.Should().Be("root-tenant");
        }

        [Fact] // C1 on the Worker side: an organization's template is never used as a source
        public async Task AnOrganizationTemplateAsSource_CreatesNothing()
        {
            await SeedOrganizationsAsync(new[] { "globex" });
            await Templates.InsertOneAsync(Source("acme-order", "acme"));

            var result = await Job().RunAsync(Command(new[] { "globex" }, templateId: "acme-order"));

            result.SourceFound.Should().BeFalse();
            (await Templates.CountDocumentsAsync(t => t.OrganizationId == "globex")).Should().Be(0);
            _sender.Single(BuiltInNotificationNames.EmailTemplateCopyFinished).IsSuccess.Should().BeFalse();
        }

        [Fact] // C7: a notification that can't be sent never undoes the copy
        public async Task ABrokenNotificationSender_DoesNotFailTheJob()
        {
            await SeedOrganizationsAsync(new[] { "acme" });
            await Templates.InsertOneAsync(Source());
            var throwing = new Mock<IBuiltInNotificationSender>();
            throwing.Setup(s => s.SendAsync(It.IsAny<BuiltInNotification>(), It.IsAny<CancellationToken>())).ThrowsAsync(new InvalidOperationException("down"));

            var result = await Job(sender: throwing.Object).RunAsync(Command(new[] { "acme" }));

            result.Created.Should().Be(1);
            (await CopiesAsync()).Should().ContainSingle();
        }

        [Fact] // the notification goes to the project tenant when there is no console tenant
        public async Task WithoutAnOriginalTenant_TheProjectIsNotified()
        {
            await SeedOrganizationsAsync(new[] { "acme" });
            await Templates.InsertOneAsync(Source());
            var command = Command(new[] { "acme" });
            command.OriginalTenantId = null;

            await Job().RunAsync(command);

            _sender.Single(BuiltInNotificationNames.EmailTemplateCopyFinished).TenantId.Should().Be(Tenant);
        }

        [Fact] // §6.2 read: only organization copies with the same Name + Language, among the given organizations
        public async Task OrganizationCopies_AreFoundByNameAndLanguage_InTheGivenOrganizations()
        {
            await Templates.InsertManyAsync(new[]
            {
                Source(),
                OwnCopy("acme", "acme-own"),
                OwnCopy("globex", "globex-own"),
                new EmailTemplate { ItemId = "acme-other-lang", Name = "OrderConfirmation", Language = "xx-XX", OrganizationId = "acme" },
                new EmailTemplate { ItemId = "acme-other-name", Name = "Invoice", Language = "en-US", OrganizationId = "acme" },
            });

            var copies = await Repository().GetOrganizationCopiesAsync("OrderConfirmation", "en-US", new[] { "acme", "initech", "default" });

            copies.Select(c => c.ItemId).Should().Equal("acme-own");
        }

        [Fact] // the enabled organizations among a list, in one read
        public async Task Reader_FindsTheEnabledOrganizationsAmongTheGivenIds()
        {
            await SeedOrganizationsAsync(new[] { "acme", "globex" });
            await SeedOrganizationsAsync(new[] { "closed" }, disabled: true);
            await Organizations.InsertOneAsync(new BsonDocument { { "_id", "no-flag" }, { "Name", "No flag" } });

            var enabled = await new OrganizationReader(_provider).GetEnabledAmongAsync(new[] { "acme", "closed", "ghost", "no-flag", "default" });

            enabled.Should().BeEquivalentTo("acme", "no-flag");
        }

        [Fact] // the deterministic copy id: stable, distinct per tenant / organization / Name / Language, GUID-shaped
        public void CopyIds_AreStableAndDistinct()
        {
            var id = OrganizationCopyIds.For("t", "acme", "OrderConfirmation", "en-US");
            id.Should().Be(OrganizationCopyIds.For("t", "acme", "OrderConfirmation", "en-US"));
            Guid.TryParse(id, out var guid).Should().BeTrue();
            guid.ToString("D")[14].Should().Be('8');
            new[]
            {
                OrganizationCopyIds.For("t2", "acme", "OrderConfirmation", "en-US"),
                OrganizationCopyIds.For("t", "globex", "OrderConfirmation", "en-US"),
                OrganizationCopyIds.For("t", "acme", "Invoice", "en-US"),
                OrganizationCopyIds.For("t", "acme", "OrderConfirmation", "xx-XX"),
                // The parts are separated, so shifting text between them never collides.
                OrganizationCopyIds.For("t", "acmeO", "rderConfirmation", "en-US"),
            }.Should().OnlyHaveUniqueItems().And.NotContain(id);
        }

        /// <summary>A repository whose first batch write fails, as a broken connection would.</summary>
        private sealed class FailingFirstBatch : IMailTemplateRepository
        {
            private readonly IMailTemplateRepository _inner;
            private int _batches;

            public FailingFirstBatch(IMailTemplateRepository inner) => _inner = inner;

            public Task<OrganizationCopyBatchResult> WriteOrganizationCopiesAsync(EmailTemplate source, IReadOnlyCollection<string> organizationIds, bool replace, string tenantId, string userId) =>
                Interlocked.Increment(ref _batches) == 1
                    ? throw new MongoException("connection lost")
                    : _inner.WriteOrganizationCopiesAsync(source, organizationIds, replace, tenantId, userId);

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
            public Task<long> DeleteOrganizationCopiesAsync(string name, string language, IReadOnlyCollection<string> organizationIds) =>
                _inner.DeleteOrganizationCopiesAsync(name, language, organizationIds);
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
