using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Blocks.Genesis.Entities.Os;
using Configuration.DomainService.Mail.Template.Services;
using FluentAssertions;
using MongoDB.Bson;
using MongoDB.Driver;
using XUnitTest.TestSupport;

namespace XUnitTest.Integration
{
    /// <summary>
    /// blocks-os#734 (SPEC32 §6): the single bulk update behind POST Mail/AssignTemplates, on a real MongoDB.
    /// The collection is shared with other tests, so every test works on names with its own unique prefix.
    /// </summary>
    [Collection(MongoIntegrationCollection.Name)]
    public class MailTemplateAssignRepositoryTests
    {
        private readonly MongoIntegrationFixture _fixture;

        public MailTemplateAssignRepositoryTests(MongoIntegrationFixture fixture)
        {
            _fixture = fixture;
        }

        private MailTemplateRepository NewRepository() => new(_fixture.DbContextProvider, new XUnitTest.TestHelpers.PassThroughOsDataAccess());

        private IMongoCollection<EmailTemplate> Templates() => _fixture.DbContextProvider.GetCollection<EmailTemplate>("EmailTemplates");

        private static string Prefix() => "assign" + Guid.NewGuid().ToString("N")[..10];

        private static EmailTemplate Template(string id, string name, string? organizationId, string language = "en-US", string? config = null) => new()
        {
            ItemId = id,
            Name = name,
            Language = language,
            OrganizationId = organizationId!,
            TemplateSubject = name + " subject",
            TemplateBody = "<p>" + name + "</p>",
            JsonContent = "{\"n\":\"" + name + "\"}",
            MailConfigurationId = config,
            CreatedFromDefault = id.EndsWith("-cfd", StringComparison.Ordinal),
            LastUpdatedBy = "before",
            LastUpdatedDate = new DateTime(2020, 1, 1, 0, 0, 0, DateTimeKind.Utc),
        };

        private async Task<EmailTemplate> Stored(string id) =>
            await Templates().Find(t => t.ItemId == id).FirstAsync();

        [Fact] // H1, H4, C10, example 2
        public async Task ExplicitIds_SetOnlyTheConfiguration_AndSkipThoseAlreadyOnIt()
        {
            var p = Prefix();
            await Templates().InsertManyAsync(new[]
            {
                Template(p + "-a1", p + "A", "acme"),
                Template(p + "-a2-cfd", p + "B", "acme", config: "acme-marketing"),
                Template(p + "-a3", p + "C", "acme"),
                Template(p + "-a4", p + "D", "acme", config: "acme-smtp"),
            });
            using var _ = new BlocksTestContext(userId: "assigner");

            var updated = await NewRepository().AssignConfigurationAsync("acme-smtp", "acme",
                new[] { p + "-a1", p + "-a2-cfd", p + "-a3", p + "-a4" }, null, null);

            updated.Should().Be(3);
            foreach (var id in new[] { p + "-a1", p + "-a2-cfd", p + "-a3" })
            {
                var after = await Stored(id);
                after.MailConfigurationId.Should().Be("acme-smtp");
                after.LastUpdatedBy.Should().Be("assigner");
                after.LastUpdatedDate.Should().BeAfter(new DateTime(2021, 1, 1, 0, 0, 0, DateTimeKind.Utc));
            }

            // C10: nothing else changes.
            var changed = await Stored(p + "-a2-cfd");
            changed.Name.Should().Be(p + "B");
            changed.Language.Should().Be("en-US");
            changed.OrganizationId.Should().Be("acme");
            changed.TemplateSubject.Should().Be(p + "B subject");
            changed.TemplateBody.Should().Be("<p>" + p + "B</p>");
            changed.JsonContent.Should().Be("{\"n\":\"" + p + "B\"}");
            changed.CreatedFromDefault.Should().BeTrue();

            // H4: the one already on it is untouched.
            (await Stored(p + "-a4")).LastUpdatedBy.Should().Be("before");
        }

        [Fact] // C3 safety: an id of another organization is never updated, even if the service check were skipped
        public async Task ExplicitIds_NeverReachAnotherOrganization()
        {
            var p = Prefix();
            await Templates().InsertManyAsync(new[]
            {
                Template(p + "-a1", p + "A", "acme"),
                Template(p + "-d1", p + "A", null),
                Template(p + "-g1", p + "A", "globex"),
            });
            using var _ = new BlocksTestContext();

            var updated = await NewRepository().AssignConfigurationAsync("acme-smtp", "acme",
                new[] { p + "-a1", p + "-d1", p + "-g1", p + "-gone" }, null, null);

            updated.Should().Be(1);
            (await Stored(p + "-d1")).MailConfigurationId.Should().BeNull();
            (await Stored(p + "-g1")).MailConfigurationId.Should().BeNull();
        }

        [Fact] // H2, H3, example 3: all matching, across pages, same search rules as GetTemplates
        public async Task AllMatching_UpdatesEveryMatchingTemplateOfTheOrganization()
        {
            var p = Prefix();
            var templates = Enumerable.Range(0, 14)
                .Select(i => Template($"{p}-o{i}", $"{p}Order{i:00}", "acme", config: i == 0 ? "acme-smtp" : null))
                .Append(Template(p + "-other", p + "Invoice", "acme"))
                .Append(Template(p + "-globex", p + "Order99", "globex"))
                .ToList();
            // The search also matches the subject, as GetTemplates does.
            templates.Add(Template(p + "-subj", p + "Zeta", "acme"));
            templates[^1].TemplateSubject = "Your " + p.ToUpperInvariant() + "ORDER update";
            await Templates().InsertManyAsync(templates);
            using var _ = new BlocksTestContext();

            var updated = await NewRepository().AssignConfigurationAsync("acme-smtp", "acme", null, p + "order", null);

            // 14 names match (case-insensitive) minus the one already on it, plus the one whose subject matches.
            updated.Should().Be(14);
            (await Stored(p + "-other")).MailConfigurationId.Should().BeNull();
            (await Stored(p + "-globex")).MailConfigurationId.Should().BeNull();
            (await Stored(p + "-subj")).MailConfigurationId.Should().Be("acme-smtp");
        }

        [Fact] // H3, example 6: the language filter, and a search key with regex characters is literal
        public async Task AllMatching_FiltersByLanguage_AndEscapesTheSearchKey()
        {
            var p = Prefix();
            await Templates().InsertManyAsync(new[]
            {
                Template(p + "-x", p + "Mail", null, language: "xx-XX"),
                Template(p + "-e", p + "Mail", null, language: "en-US"),
                Template(p + "-dot", p + "M.il", null, language: "xx-XX"),
            });
            using var _ = new BlocksTestContext();

            var updated = await NewRepository().AssignConfigurationAsync("gmail-test", "default", null, p + "M.il", "xx-XX");

            updated.Should().Be(1);
            (await Stored(p + "-dot")).MailConfigurationId.Should().Be("gmail-test");
            (await Stored(p + "-x")).MailConfigurationId.Should().BeNull();
            (await Stored(p + "-e")).MailConfigurationId.Should().BeNull();
        }

        [Fact] // H5: the Default organization includes templates stored without an organization
        public async Task DefaultOrganization_IncludesMissingAndEmptyOrganization()
        {
            var p = Prefix();
            await Templates().InsertManyAsync(new[]
            {
                Template(p + "-default", p + "A", "default"),
                Template(p + "-empty", p + "B", ""),
                Template(p + "-acme", p + "C", "acme"),
            });
            // A document written before organizations existed has no OrganizationId element at all.
            await _fixture.DbContextProvider.GetCollection<BsonDocument>("EmailTemplates").InsertOneAsync(new BsonDocument
            {
                { "_id", p + "-missing" }, { "Name", p + "D" }, { "Language", "en-US" }, { "TemplateSubject", "s" },
            });
            using var _ = new BlocksTestContext();

            var updated = await NewRepository().AssignConfigurationAsync("gmail-test", "default", null, p, null);

            updated.Should().Be(3);
            (await Stored(p + "-acme")).MailConfigurationId.Should().BeNull();
            var missing = await _fixture.DbContextProvider.GetCollection<BsonDocument>("EmailTemplates")
                .Find(new BsonDocument("_id", p + "-missing")).FirstAsync();
            missing["MailConfigurationId"].AsString.Should().Be("gmail-test");
            missing.Contains("OrganizationId").Should().BeFalse("the assign sets the configuration only");
        }

        [Fact] // C3: the check counts existing ids outside the organization; unknown ids don't count (C8)
        public async Task CountOutsideOrganization_CountsOnlyExistingForeignIds()
        {
            var p = Prefix();
            await Templates().InsertManyAsync(new[]
            {
                Template(p + "-a1", p + "A", "acme"),
                Template(p + "-d1", p + "B", null),
                Template(p + "-g1", p + "C", "globex"),
            });
            var repo = NewRepository();

            (await repo.CountOutsideOrganizationAsync(new[] { p + "-a1", p + "-d1", p + "-g1", p + "-gone" }, "acme")).Should().Be(2);
            (await repo.CountOutsideOrganizationAsync(new[] { p + "-a1", p + "-gone" }, "acme")).Should().Be(0);
            (await repo.CountOutsideOrganizationAsync(new[] { p + "-d1" }, "default")).Should().Be(0);
            (await repo.CountOutsideOrganizationAsync(new[] { p + "-a1", p + "-d1" }, "default")).Should().Be(1);
        }
    }
}
