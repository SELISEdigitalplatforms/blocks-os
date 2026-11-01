using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Blocks.Genesis;
using Blocks.Genesis.Entities.Os;
using DomainService.Projects;
using FluentAssertions;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Driver;
using Os.DataAccess.Notifications;

namespace XUnitTest.Integration
{
    /// <summary>
    /// What a new project receives from the seed: the built-in notification configs for project users (scope App or
    /// Both) and the Localization texts of their push messages. Run against the seed files as shipped (TestData).
    /// </summary>
    [Collection(MongoIntegrationCollection.Name)]
    public sealed class NotificationSeedCopyTests : IDisposable
    {
        private const string KeyPrefix = "notification-config:";
        private const int AppAndBothBuiltIns = 16;

        private readonly MongoIntegrationFixture _fixture;
        private readonly string _run = Guid.NewGuid().ToString("N")[..8];
        private readonly IMongoDatabase _seed;
        private readonly IMongoDatabase _project;

        public NotificationSeedCopyTests(MongoIntegrationFixture fixture)
        {
            _fixture = fixture;
            _seed = fixture.Client.GetDatabase($"nsc_{_run}_seed");
            _project = fixture.Client.GetDatabase($"nsc_{_run}_proj");
        }

        public void Dispose()
        {
            _fixture.Client.DropDatabase($"nsc_{_run}_seed");
            _fixture.Client.DropDatabase($"nsc_{_run}_proj");
        }

        private static BsonArray ReadSeedArray(string file) =>
            BsonDocument.Parse("{\"all\":" + File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "TestData", file)) + "}")["all"].AsBsonArray;

        private async Task SeedConfigsAsync(IEnumerable<BsonDocument> configs) =>
            await _seed.GetCollection<KeyValueEntry>(KeyValueSeedCopier.CollectionName).InsertManyAsync(configs.Select(c => new KeyValueEntry
            {
                ItemId = Guid.NewGuid().ToString(),
                Key = KeyPrefix + c["Name"].AsString,
                Value = c,
                CreatedDate = DateTime.UtcNow
            }));

        private async Task<List<NotificationConfiguration>> ProjectConfigsAsync()
        {
            var rows = await _project.GetCollection<KeyValueEntry>(KeyValueSeedCopier.CollectionName)
                .Find(Builders<KeyValueEntry>.Filter.Regex(e => e.Key, new BsonRegularExpression("^" + KeyPrefix))).ToListAsync();
            return rows.Select(r => BsonSerializer.Deserialize<NotificationConfiguration>(r.Value.AsBsonDocument)).ToList();
        }

        [Fact]
        public async Task A_new_project_gets_exactly_the_App_and_Both_built_ins_of_the_seed()
        {
            var seedConfigs = ReadSeedArray("notification-configs.builtin.json").Select(v => v.AsBsonDocument).ToList();
            await SeedConfigsAsync(seedConfigs);

            await KeyValueSeedCopier.CopyAsync(_seed, _project, "creator");

            var expected = seedConfigs.Where(c => c["Scope"].ToInt32() != (int)NotificationScope.Console).Select(c => c["Name"].AsString).ToList();
            expected.Should().HaveCount(AppAndBothBuiltIns);
            var copied = await ProjectConfigsAsync();
            copied.Select(c => c.Name).Should().BeEquivalentTo(expected);
            copied.Should().OnlyContain(c => c.Scope != NotificationScope.Console);
        }

        [Fact]
        public async Task Console_only_and_dropped_built_ins_never_reach_a_project_even_if_the_seed_still_has_them()
        {
            var console = new BsonDocument { { "Name", "data-schema-export" }, { "IsBuiltIn", true }, { "Scope", (int)NotificationScope.Console } };
            var dropped = new BsonDocument { { "Name", RetiredNotificationNames.All.First() }, { "IsBuiltIn", true }, { "Scope", (int)NotificationScope.App } };
            var app = new BsonDocument { { "Name", "kept" }, { "IsBuiltIn", true } }; // Scope left out = App (the stored default)
            await SeedConfigsAsync([console, dropped, app]);

            await KeyValueSeedCopier.CopyAsync(_seed, _project, "creator");

            (await ProjectConfigsAsync()).Select(c => c.Name).Should().Equal("kept");
        }

        [Fact]
        public async Task The_copy_carries_the_defaults_but_not_the_root_tenants_audience_or_switch_off()
        {
            var config = new BsonDocument
            {
                { "Name", "iam-account-locked" }, { "IsBuiltIn", true }, { "Scope", (int)NotificationScope.Both },
                { "Audience", new BsonDocument("Level", 2) }, { "IsDisabled", true }, { "AudienceLocked", true }, { "RateLimitPerMinute", 30 },
                { "DefaultAudience", new BsonDocument { { "Level", 2 }, { "Roles", new BsonArray { "admin" } } } },
                { "PushEnabled", true }, { "PushTemplate", new BsonDocument { { "TitleKey", "T" }, { "BodyKey", "B" } } }
            };
            await SeedConfigsAsync([config]);

            await KeyValueSeedCopier.CopyAsync(_seed, _project, "creator");

            var copy = (await ProjectConfigsAsync()).Single();
            copy.Audience.Should().BeNull();
            copy.IsDisabled.Should().BeFalse();
            copy.AudienceLocked.Should().BeTrue();
            copy.RateLimitPerMinute.Should().Be(30);
            copy.DefaultAudience!.Roles.Should().Equal("admin");
            copy.PushEnabled.Should().BeTrue();
            copy.PushTemplate!.TitleKey.Should().Be("T");
        }

        [Fact]
        public async Task A_config_the_project_already_has_keeps_its_value_and_a_retry_adds_no_duplicate()
        {
            await SeedConfigsAsync([new BsonDocument { { "Name", "kept" }, { "IsBuiltIn", true }, { "Description", "seed" } }]);
            await _project.GetCollection<KeyValueEntry>(KeyValueSeedCopier.CollectionName).InsertOneAsync(new KeyValueEntry
            {
                ItemId = "own", Key = KeyPrefix + "kept", Value = new BsonDocument { { "Name", "kept" }, { "Description", "tenant edit" } }
            });

            var inserted = await KeyValueSeedCopier.CopyAsync(_seed, _project, "creator");
            await KeyValueSeedCopier.CopyAsync(_seed, _project, "creator");

            inserted.Should().Be(0);
            var rows = await ProjectConfigsAsync();
            rows.Should().ContainSingle().Which.Description.Should().Be("tenant edit");
        }

        [Fact]
        public async Task Every_push_message_key_of_the_copied_built_ins_has_a_Localization_text_in_the_new_project()
        {
            await SeedConfigsAsync(ReadSeedArray("notification-configs.builtin.json").Select(v => v.AsBsonDocument));
            await SeedLocalizationAsync();

            await KeyValueSeedCopier.CopyAsync(_seed, _project, "creator");
            await NotificationLocalizationSeedCopier.CopyAsync(_seed, _project, "tenant-1", "creator");

            var module = await _project.GetCollection<BsonDocument>("BlocksLanguageModules").Find(new BsonDocument("ModuleName", "notifications")).SingleAsync();
            var keys = await _project.GetCollection<BsonDocument>("BlocksLanguageKeys").Find(new BsonDocument("ModuleId", module["_id"])).ToListAsync();
            var keyNames = keys.Select(k => k["KeyName"].AsString).ToList();
            var used = (await ProjectConfigsAsync()).Where(c => c.PushTemplate is not null)
                .SelectMany(c => new[] { c.PushTemplate!.TitleKey, c.PushTemplate.BodyKey });
            keyNames.Should().Contain(used);
            keys.Should().OnlyContain(k => k["TenantId"].AsString == "tenant-1" && k["ModuleId"] == module["_id"]);
            keys.SelectMany(k => k["Resources"].AsBsonArray).Should().OnlyContain(r => r["Culture"].AsString == "en");
        }

        [Fact]
        public async Task Localization_copy_is_insert_only_an_edited_text_stays_and_a_retry_adds_nothing()
        {
            await SeedLocalizationAsync();
            await NotificationLocalizationSeedCopier.CopyAsync(_seed, _project, "tenant-1", "creator");
            var keys = _project.GetCollection<BsonDocument>("BlocksLanguageKeys");
            var first = await keys.Find(FilterDefinition<BsonDocument>.Empty).FirstAsync();
            await keys.UpdateOneAsync(new BsonDocument("_id", first["_id"]), Builders<BsonDocument>.Update.Set("Value", "edited by the project"));
            var before = await keys.CountDocumentsAsync(FilterDefinition<BsonDocument>.Empty);

            var inserted = await NotificationLocalizationSeedCopier.CopyAsync(_seed, _project, "tenant-1", "creator");

            inserted.Should().Be(0);
            (await keys.CountDocumentsAsync(FilterDefinition<BsonDocument>.Empty)).Should().Be(before);
            (await keys.Find(new BsonDocument("_id", first["_id"])).SingleAsync())["Value"].AsString.Should().Be("edited by the project");
            (await _project.GetCollection<BsonDocument>("BlocksLanguageModules").CountDocumentsAsync(FilterDefinition<BsonDocument>.Empty)).Should().Be(1);
        }

        [Fact]
        public async Task A_seed_without_the_notifications_module_copies_nothing()
        {
            var inserted = await NotificationLocalizationSeedCopier.CopyAsync(_seed, _project, "tenant-1", "creator");

            inserted.Should().Be(0);
            (await _project.GetCollection<BsonDocument>("BlocksLanguageModules").CountDocumentsAsync(FilterDefinition<BsonDocument>.Empty)).Should().Be(0);
        }

        /// <summary>The seed file as apply-seeds writes it: module "notifications" in BlocksLanguageModules, its keys in BlocksLanguageKeys.</summary>
        private async Task SeedLocalizationAsync()
        {
            var file = BsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "TestData", "notification-localization.json")));
            var moduleId = Guid.NewGuid().ToString();
            await _seed.GetCollection<BsonDocument>("BlocksLanguageModules").InsertOneAsync(new BsonDocument
            {
                { "_id", moduleId }, { "ModuleName", file["Module"].AsString }, { "Name", file["Module"].AsString }, { "TenantId", "seed" }
            });
            await _seed.GetCollection<BsonDocument>("BlocksLanguageKeys").InsertManyAsync(file["Keys"].AsBsonArray.Select(k => new BsonDocument
            {
                { "_id", Guid.NewGuid().ToString() }, { "KeyName", k["KeyName"].AsString }, { "ModuleId", moduleId }, { "TenantId", "seed" },
                { "Value", k["Resources"][0]["Value"].AsString },
                { "Resources", new BsonArray(k["Resources"].AsBsonArray.Select(r => new BsonDocument
                    { { "Value", r["Value"].AsString }, { "Culture", r["Culture"].AsString }, { "CharacterLength", r["Value"].AsString.Length } })) }
            }));
        }
    }
}
