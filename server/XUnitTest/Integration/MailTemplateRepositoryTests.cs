using System;
using System.Threading.Tasks;
using Configuration.DomainService.Mail.Entities;
using Configuration.DomainService.Mail.Template;
using Configuration.DomainService.Mail.Template.Services;
using FluentAssertions;
using MongoDB.Driver;

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

        private MailTemplateRepository NewRepository() => new(_fixture.DbContextProvider);

        private static EmailTemplate NewTemplate(string itemId, string name, string language,
            string? subject = null, string? mailConfigId = null)
            => new()
            {
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
        public async Task GetByNameAndLanguageAsync_MatchesBoth()
        {
            var name = "Name-" + Guid.NewGuid().ToString("N");
            var repo = NewRepository();
            await repo.SaveAsync(NewTemplate("a-" + name, name, "en"));
            await repo.SaveAsync(NewTemplate("b-" + name, name, "fr"));

            var en = await repo.GetByNameAndLanguageAsync(name, "en");
            var missing = await repo.GetByNameAndLanguageAsync(name, "de");

            en!.Language.Should().Be("en");
            missing.Should().BeNull();
        }

        [Fact]
        public async Task GetsAsync_FiltersBySearchKeyLanguageAndConfigWithPaging()
        {
            var tag = Guid.NewGuid().ToString("N");
            var cfg = "cfg-" + tag;
            var repo = NewRepository();
            await repo.SaveAsync(NewTemplate("t1-" + tag, "Alpha" + tag, "en", subject: "s", mailConfigId: cfg));
            await repo.SaveAsync(NewTemplate("t2-" + tag, "Alpha" + tag + "-two", "en", subject: "s", mailConfigId: cfg));
            await repo.SaveAsync(NewTemplate("t3-" + tag, "Beta" + tag, "fr", subject: "s", mailConfigId: cfg));

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
    }
}
