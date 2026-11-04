using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Blocks.Genesis.Entities.Os;
using Configuration.DomainService.Mail.Template.Services;
using Configuration.DomainService.Organizations;
using Configuration.DomainService.Shared.Services;
using FluentAssertions;
using MongoDB.Bson;
using MongoDB.Driver;
using XUnitTest.TestHelpers;

namespace XUnitTest.Integration
{
    /// <summary>
    /// blocks-os#732 (SPEC30) against a real MongoDB: the organization filter of the list, the
    /// one-update clearing of organization defaults, the usage count and the organization reader.
    /// The collections are shared with other tests, so every id carries a per-test tag.
    /// </summary>
    [Collection(MongoIntegrationCollection.Name)]
    public class MailConfigurationOrganizationRepositoryTests
    {
        private const string MailCollection = "MailServerConfigurations";
        private readonly MongoIntegrationFixture _fixture;
        private readonly string _tag = Guid.NewGuid().ToString("N");

        public MailConfigurationOrganizationRepositoryTests(MongoIntegrationFixture fixture)
        {
            _fixture = fixture;
        }

        private ConfigurationRepository Repository() =>
            new(_fixture.DbContextProvider, new InMemoryKeyValueStore(), new PassThroughOsDataAccess());

        private string Id(string name) => $"{name}-{_tag}";

        /// <summary>Writes the raw document, so a test can leave <c>OrganizationId</c> out entirely.</summary>
        private Task InsertAsync(string name, BsonValue? organizationId, bool isOrganizationDefault = false, DateTime? lastUpdated = null)
        {
            var document = new BsonDocument
            {
                { "_id", Id(name) },
                { "Name", Id(name) },
                { "Host", "smtp.example.com" },
                { "Port", 587 },
                { "IsOrganizationDefault", isOrganizationDefault },
                { "LastUpdatedDate", lastUpdated ?? new DateTime(2026, 11, 4, 9, 0, 0, DateTimeKind.Utc) }
            };
            if (organizationId is not null)
            {
                document["OrganizationId"] = organizationId;
            }
            return _fixture.Collection<BsonDocument>(MailCollection).InsertOneAsync(document);
        }

        private async Task<BsonDocument> RawAsync(string name) =>
            await _fixture.Collection<BsonDocument>(MailCollection).Find(new BsonDocument("_id", Id(name))).SingleAsync();

        private async Task SeedListAsync()
        {
            await InsertAsync("acme", $"acme-{_tag}");
            await InsertAsync("globex", $"globex-{_tag}");
            await InsertAsync("missing", null);
            await InsertAsync("null", BsonNull.Value);
            await InsertAsync("empty", "");
            await InsertAsync("default", "default");
        }

        // ---------- H4, H5, C4 ----------

        [Fact]
        public async Task GetAll_ForAnOrganization_ReturnsItsAndTheDefaultOrganizationsConfigurations()
        {
            await SeedListAsync();

            var ids = (await Repository().GetAllMailConfigurationsAsync($"acme-{_tag}")).Select(c => c.ItemId).ToList();

            ids.Should().Contain(new[] { Id("acme"), Id("missing"), Id("null"), Id("empty"), Id("default") });
            ids.Should().NotContain(Id("globex"));
        }

        [Fact]
        public async Task GetAll_ForTheDefaultOrganization_ReturnsOnlyItsConfigurations()
        {
            await SeedListAsync();

            var ids = (await Repository().GetAllMailConfigurationsAsync("default")).Select(c => c.ItemId).ToList();

            ids.Should().Contain(new[] { Id("missing"), Id("null"), Id("empty"), Id("default") });
            ids.Should().NotContain(new[] { Id("acme"), Id("globex") });
        }

        [Fact]
        public async Task GetAll_WithoutAnOrganization_ReturnsEverything()
        {
            await SeedListAsync();

            var ids = (await Repository().GetAllMailConfigurationsAsync(null)).Select(c => c.ItemId).ToList();

            ids.Should().Contain(new[] { Id("acme"), Id("globex"), Id("missing"), Id("null"), Id("empty"), Id("default") });
        }

        [Fact]
        public async Task GetAll_ReturnsTheOrganizationDefaultMark()
        {
            await InsertAsync("marked", $"acme-{_tag}", isOrganizationDefault: true);

            var marked = (await Repository().GetAllMailConfigurationsAsync($"acme-{_tag}")).Single(c => c.ItemId == Id("marked"));

            marked.IsOrganizationDefault.Should().BeTrue();
        }

        // ---------- H3, C5 ----------

        [Fact]
        public async Task ClearOtherOrganizationDefaults_LeavesOnlyTheLatestOfThatOrganization()
        {
            var savedAt = new DateTime(2026, 11, 4, 10, 0, 0, DateTimeKind.Utc);
            await InsertAsync("older", $"acme-{_tag}", true, savedAt.AddMinutes(-5));
            await InsertAsync("kept", $"acme-{_tag}", true, savedAt);
            await InsertAsync("newer", $"acme-{_tag}", true, savedAt.AddSeconds(1));
            await InsertAsync("other-org", $"globex-{_tag}", true, savedAt.AddMinutes(-5));

            await Repository().ClearOtherOrganizationDefaultsAsync($"acme-{_tag}", Id("kept"), savedAt);

            (await RawAsync("older"))["IsOrganizationDefault"].AsBoolean.Should().BeFalse();
            // A later save of the same organization wins: it is not cleared by an earlier one, and the
            // earlier save gives up its own mark rather than leave two.
            (await RawAsync("newer"))["IsOrganizationDefault"].AsBoolean.Should().BeTrue();
            (await RawAsync("kept"))["IsOrganizationDefault"].AsBoolean.Should().BeFalse();
            (await RawAsync("other-org"))["IsOrganizationDefault"].AsBoolean.Should().BeTrue();
        }

        [Fact]
        public async Task ClearOtherOrganizationDefaults_ForTheDefaultOrganization_CoversDocumentsWithoutAnOrganization()
        {
            var savedAt = new DateTime(2026, 11, 4, 10, 0, 0, DateTimeKind.Utc);
            await InsertAsync("d-missing", null, true, savedAt.AddMinutes(-1));
            await InsertAsync("d-empty", "", true, savedAt.AddMinutes(-1));
            await InsertAsync("d-kept", "default", true, savedAt);
            await InsertAsync("d-acme", $"acme-{_tag}", true, savedAt.AddMinutes(-1));

            await Repository().ClearOtherOrganizationDefaultsAsync("default", Id("d-kept"), savedAt);

            (await RawAsync("d-missing"))["IsOrganizationDefault"].AsBoolean.Should().BeFalse();
            (await RawAsync("d-empty"))["IsOrganizationDefault"].AsBoolean.Should().BeFalse();
            (await RawAsync("d-kept"))["IsOrganizationDefault"].AsBoolean.Should().BeTrue();
            (await RawAsync("d-acme"))["IsOrganizationDefault"].AsBoolean.Should().BeTrue();
        }

        [Fact]
        public async Task SavingTwoDefaultsOfOneOrganization_LeavesExactlyOneMarked()
        {
            var repo = Repository();
            var first = new MailServerConfiguration { ItemId = Id("first"), Name = Id("first"), OrganizationId = $"acme-{_tag}", IsOrganizationDefault = true, LastUpdatedDate = DateTime.UtcNow };
            await repo.SaveMailConfigurationAsync(first);
            await repo.ClearOtherOrganizationDefaultsAsync(first.OrganizationId, first.ItemId, first.LastUpdatedDate);

            var second = new MailServerConfiguration { ItemId = Id("second"), Name = Id("second"), OrganizationId = $"acme-{_tag}", IsOrganizationDefault = true, LastUpdatedDate = first.LastUpdatedDate.AddMilliseconds(10) };
            await repo.SaveMailConfigurationAsync(second);
            await repo.ClearOtherOrganizationDefaultsAsync(second.OrganizationId, second.ItemId, second.LastUpdatedDate);

            var marked = (await repo.GetAllMailConfigurationsAsync($"acme-{_tag}"))
                .Where(c => c.OrganizationId == $"acme-{_tag}" && c.IsOrganizationDefault)
                .Select(c => c.ItemId);
            marked.Should().Equal(Id("second"));
        }

        [Fact]
        public async Task ClearOtherOrganizationDefaults_WhenASlowerEarlierSaveLandsLast_KeepsOnlyTheLatest()
        {
            // B (later stamp) saves and clears before A's document lands; A then clears and spares B.
            var repo = Repository();
            var tA = new DateTime(2026, 11, 4, 10, 0, 0, DateTimeKind.Utc);
            var tB = tA.AddMilliseconds(5);
            await InsertAsync("race-b", $"acme-{_tag}", true, tB);
            await repo.ClearOtherOrganizationDefaultsAsync($"acme-{_tag}", Id("race-b"), tB);
            await InsertAsync("race-a", $"acme-{_tag}", true, tA);
            await repo.ClearOtherOrganizationDefaultsAsync($"acme-{_tag}", Id("race-a"), tA);

            (await RawAsync("race-a"))["IsOrganizationDefault"].AsBoolean.Should().BeFalse();
            (await RawAsync("race-b"))["IsOrganizationDefault"].AsBoolean.Should().BeTrue();
        }

        [Fact]
        public async Task ClearOtherOrganizationDefaults_OnATimestampTie_KeepsExactlyOne()
        {
            var repo = Repository();
            // Sub-millisecond ticks differ, as two in-memory stamps would; MongoDB keeps milliseconds.
            var t = new DateTime(2026, 11, 4, 10, 0, 0, DateTimeKind.Utc);
            await InsertAsync("tie-1", $"acme-{_tag}", true, t);
            await InsertAsync("tie-2", $"acme-{_tag}", true, t);
            await repo.ClearOtherOrganizationDefaultsAsync($"acme-{_tag}", Id("tie-1"), t.AddTicks(300));
            await repo.ClearOtherOrganizationDefaultsAsync($"acme-{_tag}", Id("tie-2"), t.AddTicks(100));

            var marked = new[] { "tie-1", "tie-2" };
            var flags = new List<bool>();
            foreach (var name in marked)
            {
                flags.Add((await RawAsync(name))["IsOrganizationDefault"].AsBoolean);
            }
            flags.Count(f => f).Should().Be(1);
        }

        // ---------- C4: the project default record ----------

        [Fact]
        public async Task UpdateMailSenderName_WritesTheDefaultOrganizationOnADocumentWithoutOne()
        {
            await InsertAsync("project-default", null);

            await Repository().UpdateMailSenderNameAsync(Id("project-default"), "Contoso", DateTime.UtcNow, "user-1");

            var raw = await RawAsync("project-default");
            raw["OrganizationId"].AsString.Should().Be("default");
            raw["SenderName"].AsString.Should().Be("Contoso");
        }

        // ---------- H6 ----------

        [Fact]
        public async Task CountByMailConfigurationId_CountsEveryTemplateDocumentNamingIt()
        {
            var templates = new MailTemplateRepository(_fixture.DbContextProvider, new PassThroughOsDataAccess());
            var configurationId = Id("cfg");
            foreach (var (id, language, configuration) in new[]
            {
                ("t1-en", "en", configurationId),
                ("t1-other", "xx", configurationId),
                ("t2-en", "en", configurationId),
                ("t3-en", "en", Id("another"))
            })
            {
                await templates.SaveAsync(new EmailTemplate { ItemId = Id(id), Name = id, Language = language, TemplateSubject = "s", MailConfigurationId = configuration });
            }

            (await templates.CountByMailConfigurationIdAsync(configurationId)).Should().Be(3);
            (await templates.CountByMailConfigurationIdAsync(Id("unused"))).Should().Be(0);
        }

        // ---------- §6.6 ----------

        private async Task SeedOrganizationsAsync()
        {
            var organizations = _fixture.Collection<BsonDocument>(OrganizationReader.CollectionName);
            await organizations.InsertManyAsync(new[]
            {
                new BsonDocument { { "_id", Id("org-a") }, { "Name", "Acme Corp" }, { "IsDisabled", false } },
                new BsonDocument { { "_id", Id("org-b") }, { "Name", "Globex" } },
                new BsonDocument { { "_id", Id("org-c") }, { "Name", "Initech" }, { "IsDisabled", true } },
                new BsonDocument { { "_id", Id("org-d") }, { "Name", "Umbrella" }, { "IsDisabled", false }, { "Theme", new BsonDocument("Primary", "#000") } }
            });
        }

        [Fact]
        public async Task OrganizationReader_ExistsEnabled_IsTrueOnlyForEnabledOrganizationsAndDefault()
        {
            await SeedOrganizationsAsync();
            var reader = new OrganizationReader(_fixture.DbContextProvider);

            (await reader.ExistsEnabledAsync(Id("org-a"))).Should().BeTrue();
            (await reader.ExistsEnabledAsync(Id("org-b"))).Should().BeTrue("an organization without the flag is enabled");
            (await reader.ExistsEnabledAsync(Id("org-c"))).Should().BeFalse("it is disabled");
            (await reader.ExistsEnabledAsync(Id("org-ghost"))).Should().BeFalse();
            (await reader.ExistsEnabledAsync("default")).Should().BeTrue();
        }

        [Fact]
        public async Task OrganizationReader_GetEnabledPage_PagesEnabledOrganizationsByIdWithIdAndName()
        {
            await SeedOrganizationsAsync();
            var reader = new OrganizationReader(_fixture.DbContextProvider);

            List<OrganizationSummary> Mine(IEnumerable<OrganizationSummary> page) =>
                page.Where(o => o.ItemId.EndsWith(_tag, StringComparison.Ordinal)).ToList();

            // Ordered by id, disabled ones left out, id and name only.
            Mine(await reader.GetEnabledPageAsync(null, 100)).Should().Equal(
                new OrganizationSummary(Id("org-a"), "Acme Corp"),
                new OrganizationSummary(Id("org-b"), "Globex"),
                new OrganizationSummary(Id("org-d"), "Umbrella"));

            // Keyset paging: strictly after the given id.
            Mine(await reader.GetEnabledPageAsync(Id("org-a"), 100)).Select(o => o.ItemId).Should().Equal(Id("org-b"), Id("org-d"));
            (await reader.GetEnabledPageAsync(null, 1)).Should().HaveCount(1);
        }

        [Fact]
        public async Task OrganizationReader_GetEnabledPage_RejectsANonPositiveSize()
        {
            var reader = new OrganizationReader(_fixture.DbContextProvider);

            await reader.Invoking(r => r.GetEnabledPageAsync(null, 0)).Should().ThrowAsync<ArgumentOutOfRangeException>();
        }
    }
}
