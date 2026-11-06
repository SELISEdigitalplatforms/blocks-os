using System;
using System.Linq;
using System.Threading.Tasks;
using Configuration.DomainService.Mail.Template;
using Configuration.DomainService.Mail.Template.Services;
using FluentAssertions;
using MongoDB.Driver;
using Blocks.Genesis.Entities.Os;

namespace XUnitTest.Integration
{
    [Collection(MongoIntegrationCollection.Name)]
    public class MailTemplateRepositoryTests
    {
        private const string CollectionName = "EmailTemplates";
        private readonly MongoIntegrationFixture _fixture;

        public MailTemplateRepositoryTests(MongoIntegrationFixture fixture)
        {
            _fixture = fixture;
        }

        private MailTemplateRepository NewRepository() => new(_fixture.DbContextProvider, new XUnitTest.TestHelpers.PassThroughOsDataAccess());

        private static EmailTemplate NewTemplate(string itemId, string name, string language,
            string? subject = null, string? mailConfigId = null, string organizationId = "default")
            => new()
            {
                OrganizationId = organizationId,
                ItemId = itemId,
                Name = name,
                Language = language,
                TemplateSubject = subject ?? name + " subject",
                MailConfigurationId = mailConfigId
            };

        [Fact]
        public async Task SaveAsync_UpsertsAndGetByIdReturnsIt()
        {
            var id = "tpl-" + Guid.NewGuid().ToString("N");
            var repo = NewRepository();

            await repo.SaveAsync(NewTemplate(id, "Welcome", "en"));
            (await repo.GetByIdAsync(id))!.Name.Should().Be("Welcome");

            // Upsert on the same id updates in place.
            await repo.SaveAsync(NewTemplate(id, "Welcome Updated", "en"));
            (await repo.GetByIdAsync(id))!.Name.Should().Be("Welcome Updated");
        }

        [Fact]
        public async Task GetByNameAndLanguageAsync_MatchesBothWithinTheOrganization()
        {
            var name = "Name-" + Guid.NewGuid().ToString("N");
            var repo = NewRepository();
            await repo.SaveAsync(NewTemplate("a-" + name, name, "en"));
            await repo.SaveAsync(NewTemplate("b-" + name, name, "xx-XX"));
            await repo.SaveAsync(NewTemplate("c-" + name, name, "yy-YY", organizationId: "acme"));

            (await repo.GetByNameAndLanguageAsync(name, "en", "default"))!.ItemId.Should().Be("a-" + name);
            (await repo.GetByNameAndLanguageAsync(name, "zz-ZZ", "default")).Should().BeNull();
            // SPEC31 H3: another organization's template doesn't count, either way round.
            (await repo.GetByNameAndLanguageAsync(name, "en", "acme")).Should().BeNull();
            (await repo.GetByNameAndLanguageAsync(name, "yy-YY", "default")).Should().BeNull();
            (await repo.GetByNameAndLanguageAsync(name, "yy-YY", "acme"))!.ItemId.Should().Be("c-" + name);
        }

        [Theory] // SPEC31: missing or empty OrganizationId = Default
        [InlineData(false)]
        [InlineData(true)]
        public async Task GetByNameAndLanguageAsync_DefaultIncludesTemplatesStoredWithoutAnOrganization(bool emptyString)
        {
            var name = "Legacy-" + Guid.NewGuid().ToString("N");
            await InsertRawAsync("raw-" + name, name, "en", emptyString ? "" : null);
            var repo = NewRepository();

            (await repo.GetByNameAndLanguageAsync(name, "en", "default"))!.ItemId.Should().Be("raw-" + name);
            (await repo.GetByNameAndLanguageAsync(name, "en", "acme")).Should().BeNull();
        }

        [Fact]
        public async Task GetsAsync_FiltersBySearchKeyLanguageAndConfigWithPaging()
        {
            var tag = Guid.NewGuid().ToString("N");
            var cfg = "cfg-" + tag;
            var repo = NewRepository();
            await repo.SaveAsync(NewTemplate("t1-" + tag, "Alpha" + tag, "en", subject: "s", mailConfigId: cfg));
            await repo.SaveAsync(NewTemplate("t2-" + tag, "Alpha" + tag + "-two", "en", subject: "s", mailConfigId: cfg));
            await repo.SaveAsync(NewTemplate("t3-" + tag, "Beta" + tag, "xx-XX", subject: "s", mailConfigId: cfg));

            var byConfig = await repo.GetsAsync(new GetAllMailTemplatesRequest
            {
                MailConfigurationId = cfg,
                PageNumber = 0,
                PageSize = 10
            });
            byConfig.TotalCount.Should().Be(3);

            var byLanguage = await repo.GetsAsync(new GetAllMailTemplatesRequest
            {
                MailConfigurationId = cfg,
                Language = "en",
                PageNumber = 0,
                PageSize = 10
            });
            byLanguage.TotalCount.Should().Be(2);

            var bySearch = await repo.GetsAsync(new GetAllMailTemplatesRequest
            {
                MailConfigurationId = cfg,
                SearchKey = "Beta" + tag,
                PageNumber = 0,
                PageSize = 10
            });
            bySearch.TotalCount.Should().Be(1);

            var paged = await repo.GetsAsync(new GetAllMailTemplatesRequest
            {
                MailConfigurationId = cfg,
                PageNumber = 0,
                PageSize = 2,
                IsDescending = true
            });
            paged.Templates.Should().HaveCount(2);
            paged.TotalCount.Should().Be(3);
        }

        [Fact]
        public async Task DeleteAsync_RemovesTemplate()
        {
            var id = "del-" + Guid.NewGuid().ToString("N");
            var repo = NewRepository();
            await repo.SaveAsync(NewTemplate(id, "ToDelete", "en"));

            await repo.DeleteAsync(id);

            (await repo.GetByIdAsync(id)).Should().BeNull();
        }
            /// <summary>A document as written before organizations: no OrganizationId element (null) or an empty one.</summary>
        private Task InsertRawAsync(string itemId, string name, string language, string? organizationId, string? mailConfigId = null)
        {
            var document = new MongoDB.Bson.BsonDocument
            {
                { "_id", itemId }, { "Name", name }, { "Language", language }, { "TemplateSubject", name + " subject" },
                { "MailConfigurationId", mailConfigId is null ? MongoDB.Bson.BsonNull.Value : mailConfigId }
            };
            if (organizationId is not null)
            {
                document.Add("OrganizationId", organizationId);
            }
            return _fixture.Collection<MongoDB.Bson.BsonDocument>(CollectionName).InsertOneAsync(document);
        }

        [Fact]
        public async Task GetsAsync_ForAnOrganization_ReturnsOnlyItsTemplatesPagedWithItsTotal() // H4, example 5
        {
            var tag = Guid.NewGuid().ToString("N");
            var cfg = "cfg-" + tag;
            var org = "org-" + tag;
            var repo = NewRepository();
            for (var i = 0; i < 14; i++)
            {
                await repo.SaveAsync(NewTemplate($"o{i:D2}-{tag}", $"Acme{i:D2}{tag}", "en-US", mailConfigId: cfg, organizationId: org));
            }
            for (var i = 0; i < 5; i++)
            {
                await repo.SaveAsync(NewTemplate($"d{i:D2}-{tag}", $"Default{i:D2}{tag}", "en-US", mailConfigId: cfg));
            }

            var page = await repo.GetsAsync(new GetAllMailTemplatesRequest { OrganizationId = org, MailConfigurationId = cfg, PageNumber = 0, PageSize = 10 });
            var second = await repo.GetsAsync(new GetAllMailTemplatesRequest { OrganizationId = org, MailConfigurationId = cfg, PageNumber = 1, PageSize = 10 });

            page.TotalCount.Should().Be(14);
            page.Templates.Should().HaveCount(10).And.OnlyContain(t => t.OrganizationId == org);
            second.Templates.Should().HaveCount(4).And.OnlyContain(t => t.OrganizationId == org);
        }

        [Theory] // H5, example 6: no organization = Default, including documents stored without one
        [InlineData(null)]
        [InlineData("")]
        [InlineData("default")]
        public async Task GetsAsync_ForTheDefaultOrganization_IncludesTemplatesStoredWithoutOne(string? organizationId)
        {
            var tag = Guid.NewGuid().ToString("N");
            var cfg = "cfg-" + tag;
            var repo = NewRepository();
            await InsertRawAsync("missing-" + tag, "Missing" + tag, "en-US", null, cfg);
            await InsertRawAsync("empty-" + tag, "Empty" + tag, "en-US", "", cfg);
            await repo.SaveAsync(NewTemplate("default-" + tag, "Default" + tag, "en-US", mailConfigId: cfg));
            await repo.SaveAsync(NewTemplate("acme-" + tag, "Acme" + tag, "en-US", mailConfigId: cfg, organizationId: "acme"));

            var page = await repo.GetsAsync(new GetAllMailTemplatesRequest { OrganizationId = organizationId, MailConfigurationId = cfg, PageNumber = 0, PageSize = 10 });

            page.TotalCount.Should().Be(3);
            page.Templates.Select(t => t.ItemId).Should().BeEquivalentTo(new[] { "missing-" + tag, "empty-" + tag, "default-" + tag });
            // §6.2/§6.3: items carry their organization, normalized.
            page.Templates.Should().OnlyContain(t => t.OrganizationId == "default");
        }

        [Theory] // §6.3
        [InlineData(null)]
        [InlineData("")]
        public async Task GetForViewAsync_ReturnsDefaultForATemplateStoredWithoutAnOrganization(string? stored)
        {
            var id = "view-" + Guid.NewGuid().ToString("N");
            await InsertRawAsync(id, "View" + id, "en-US", stored);

            (await NewRepository().GetForViewAsync(id))!.OrganizationId.Should().Be("default");
        }

        [Fact]
        public async Task SaveAsync_KeepsCreatedFromDefault() // C10 at the storage level
        {
            var id = "cfd-" + Guid.NewGuid().ToString("N");
            var repo = NewRepository();
            var template = NewTemplate(id, "Copy" + id, "en-US", organizationId: "acme");
            template.CreatedFromDefault = true;
            await repo.SaveAsync(template);

            var stored = await repo.GetByIdAsync(id);
            stored!.TemplateSubject = "Edited";
            await repo.SaveAsync(stored);

            (await repo.GetByIdAsync(id))!.CreatedFromDefault.Should().BeTrue();
        }
    }
}
