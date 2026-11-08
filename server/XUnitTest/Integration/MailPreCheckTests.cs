using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Blocks.Genesis;
using FluentAssertions;
using MongoDB.Bson;
using XUnitTest.TestSupport;
using IdentifierPreCheck = DomainService.Migration.MailPreCheck;
using LmtPreCheck = Cloud.LmtService.Services.ColdRestore.MailPreCheck;

namespace XUnitTest.Integration
{
    /// <summary>
    /// MailPreCheck runs the checks the retired mail driver (4.0.0) ran in the request (template for purpose +
    /// language, the template's mail server configuration, a registered recipient). There is one copy per
    /// project (Identifier and Cloud.LmtService); both are tested with the same cases against a throwaway DB.
    /// </summary>
    /// <remarks>
    /// Each test gets its own database: the configuration chain falls back to any project default or
    /// Default-organization default in the collection, which other tests' documents would otherwise supply.
    /// </remarks>
    public sealed class MailPreCheckTests : IDisposable
    {
        private readonly MongoIntegrationFixture _fixture = new();

        public void Dispose() => _fixture.Dispose();

        public static IEnumerable<object[]> Implementations => new[]
        {
            new object[] { "identifier" },
            new object[] { "lmt" }
        };

        private Task<string?> Check(string impl, string? purpose, string? language, IEnumerable<string>? to, bool phoneAsEmail, IReadOnlyDictionary<string, string>? body = null) =>
            impl == "identifier"
                ? IdentifierPreCheck.FindFailureAsync(_fixture.DbContextProvider, new XUnitTest.TestHelpers.PassThroughOsDataAccess(), purpose, language, to, phoneAsEmail, body)
                : LmtPreCheck.FindFailureAsync(_fixture.DbContextProvider, new XUnitTest.TestHelpers.PassThroughOsDataAccess(), purpose, language, to, phoneAsEmail, body);

        private sealed record Seed(string Purpose, string Email);

        private async Task<Seed> SeedAll(string language = "en-US", string? configId = null, bool withConfig = true, bool withUser = true, bool withTemplate = true, string? templateBody = null)
        {
            var tag = Guid.NewGuid().ToString("N");
            var purpose = "purpose-" + tag;
            var email = tag + "@example.com";
            configId ??= "cfg-" + tag;
            if (withConfig)
            {
                await _fixture.Collection<BsonDocument>("MailServerConfigurations").InsertOneAsync(new BsonDocument { { "_id", configId } });
            }
            if (withTemplate)
            {
                await _fixture.Collection<BsonDocument>("EmailTemplates").InsertOneAsync(new BsonDocument
                {
                    { "_id", "t-" + tag }, { "Name", purpose }, { "Language", language }, { "MailConfigurationId", configId },
                    { "TemplateBody", templateBody ?? "" }
                });
            }
            if (withUser)
            {
                await _fixture.Collection<BsonDocument>("Users").InsertOneAsync(new BsonDocument { { "_id", "u-" + tag }, { "Email", email } });
            }
            return new Seed(purpose, email);
        }

        [Theory]
        [MemberData(nameof(Implementations))]
        public async Task AllChecksPass_ReturnsNull(string impl)
        {
            using var _ = new IntegrationContext(MongoIntegrationFixture.NewTenantId());
            var seed = await SeedAll();

            (await Check(impl, seed.Purpose, "en-US", [seed.Email], false)).Should().BeNull();
        }

        [Theory]
        [MemberData(nameof(Implementations))]
        public async Task TemplateMissing_Fails(string impl)
        {
            using var _ = new IntegrationContext(MongoIntegrationFixture.NewTenantId());
            var seed = await SeedAll(withTemplate: false);

            (await Check(impl, seed.Purpose, "en-US", [seed.Email], false)).Should().Contain("template");
        }

        [Theory]
        [MemberData(nameof(Implementations))]
        public async Task WrongLanguage_Fails(string impl)
        {
            using var _ = new IntegrationContext(MongoIntegrationFixture.NewTenantId());
            var seed = await SeedAll(language: "de-DE");

            (await Check(impl, seed.Purpose, "en-US", [seed.Email], false)).Should().Contain("template");
        }

        [Theory]
        [MemberData(nameof(Implementations))]
        public async Task MailServerConfigMissing_Fails(string impl)
        {
            using var _ = new IntegrationContext(MongoIntegrationFixture.NewTenantId());
            var seed = await SeedAll(withConfig: false);

            (await Check(impl, seed.Purpose, "en-US", [seed.Email], false)).Should().Contain("mail server configuration");
        }

        [Theory]
        [MemberData(nameof(Implementations))]
        public async Task TemplateWithEmptyMailConfigurationId_Fails(string impl)
        {
            using var _ = new IntegrationContext(MongoIntegrationFixture.NewTenantId());
            var seed = await SeedAll(configId: "", withConfig: false);

            (await Check(impl, seed.Purpose, "en-US", [seed.Email], false)).Should().Contain("mail server configuration");
        }

        [Theory]
        [MemberData(nameof(Implementations))]
        public async Task RecipientNotARegisteredUser_Fails_UnlessPhoneNumberAsEmail(string impl)
        {
            using var _ = new IntegrationContext(MongoIntegrationFixture.NewTenantId());
            var seed = await SeedAll(withUser: false);

            (await Check(impl, seed.Purpose, "en-US", [seed.Email], false)).Should().Contain("registered user");
            (await Check(impl, seed.Purpose, "en-US", [seed.Email], true)).Should().BeNull();
        }

        [Theory]
        [MemberData(nameof(Implementations))]
        public async Task NoTenantContext_Fails(string impl)
        {
            BlocksContext.ClearContext();
            var seed = await SeedAll();

            (await Check(impl, seed.Purpose, "en-US", [seed.Email], true)).Should().Contain("tenant");
        }

        [Theory]
        [MemberData(nameof(Implementations))]
        public async Task EmptyPurposeLanguageOrRecipients_Fail(string impl)
        {
            using var _ = new IntegrationContext(MongoIntegrationFixture.NewTenantId());

            (await Check(impl, "", "en-US", ["a@b.c"], true)).Should().NotBeNull();
            (await Check(impl, "p", null, ["a@b.c"], true)).Should().NotBeNull();
            (await Check(impl, "p", "en-US", [], true)).Should().NotBeNull();
            (await Check(impl, "p", "en-US", null, true)).Should().NotBeNull();
        }

        [Theory]
        [MemberData(nameof(Implementations))]
        public async Task TwoRecipients_OneRegistered_Passes(string impl)
        {
            using var _ = new IntegrationContext(MongoIntegrationFixture.NewTenantId());
            var seed = await SeedAll();

            (await Check(impl, seed.Purpose, "en-US", [seed.Email, "nobody-" + Guid.NewGuid().ToString("N") + "@example.com"], false)).Should().BeNull();
        }

        [Theory]
        [MemberData(nameof(Implementations))]
        public async Task BodyPlaceholderMissing_Fails_AndPresent_Passes(string impl)
        {
            using var _ = new IntegrationContext(MongoIntegrationFixture.NewTenantId());
            var seed = await SeedAll(templateBody: "<p>{{TwoFactorCode}} and {{x:tier}}</p>");

            (await Check(impl, seed.Purpose, "en-US", [seed.Email], false, new Dictionary<string, string> { ["TwoFactorCode"] = "1" }))
                .Should().Contain("placeholder");
            (await Check(impl, seed.Purpose, "en-US", [seed.Email], false, null)).Should().Contain("placeholder");
            (await Check(impl, seed.Purpose, "en-US", [seed.Email], false, new Dictionary<string, string> { ["TwoFactorCode"] = "1", ["tier"] = "Cold" }))
                .Should().BeNull();
        }

        [Theory]
        [MemberData(nameof(Implementations))]
        public async Task TemplateWithoutPlaceholders_PassesWithoutBodyData(string impl)
        {
            using var _ = new IntegrationContext(MongoIntegrationFixture.NewTenantId());
            var seed = await SeedAll(templateBody: "<p>plain</p>");

            (await Check(impl, seed.Purpose, "en-US", [seed.Email], false, null)).Should().BeNull();
        }

        // ---- SPEC31 §6.6 / H14: the Default organization's template, then the configuration chain ----

        private Task Templates(params BsonDocument[] templates) =>
            _fixture.Collection<BsonDocument>("EmailTemplates").InsertManyAsync(templates);

        private Task Configs(params BsonDocument[] configs) =>
            _fixture.Collection<BsonDocument>("MailServerConfigurations").InsertManyAsync(configs);

        private static BsonDocument Template(string id, string purpose, string? configId, string? organizationId, bool omitOrganization = false)
        {
            var doc = new BsonDocument { { "_id", id }, { "Name", purpose }, { "Language", "en-US" }, { "MailConfigurationId", configId is null ? BsonNull.Value : configId }, { "TemplateBody", "" } };
            if (!omitOrganization)
            {
                doc.Add("OrganizationId", organizationId is null ? BsonNull.Value : organizationId);
            }
            return doc;
        }

        private static BsonDocument Config(string id, string? organizationId = "default", bool inbound = false, bool organizationDefault = false, bool projectDefault = false) =>
            new()
            {
                { "_id", id }, { "OrganizationId", organizationId is null ? BsonNull.Value : organizationId }, { "IsInbound", inbound },
                { "IsOrganizationDefault", organizationDefault }, { "IsDefault", projectDefault }
            };

        [Theory]
        [MemberData(nameof(Implementations))]
        public async Task OnlyTheDefaultOrganizationsTemplateCounts(string impl)
        {
            using var _ = new IntegrationContext(MongoIntegrationFixture.NewTenantId());
            await Configs(Config("cfg-ok"));
            // An organization's own template, and the field the retired driver read, are ignored.
            await Templates(new BsonDocument
            {
                { "_id", "t-acme" }, { "Name", "p" }, { "Language", "en-US" }, { "MailConfigurationId", "cfg-ok" },
                { "OrganizationId", "acme" }, { "OrganizationIds", new BsonArray(new[] { "acme" }) }
            });

            (await Check(impl, "p", "en-US", ["a@b.c"], true)).Should().Contain("template");
        }

        [Theory]
        [MemberData(nameof(Implementations))]
        public async Task DefaultTemplate_StoredWithDefaultEmptyNullOrNoOrganization_IsFound(string impl)
        {
            using var _ = new IntegrationContext(MongoIntegrationFixture.NewTenantId());
            await Configs(Config("cfg-ok"));
            await Templates(
                Template("t1", "p-default", "cfg-ok", "default"),
                Template("t2", "p-empty", "cfg-ok", ""),
                Template("t3", "p-null", "cfg-ok", null),
                Template("t4", "p-missing", "cfg-ok", null, omitOrganization: true));

            foreach (var purpose in new[] { "p-default", "p-empty", "p-null", "p-missing" })
            {
                (await Check(impl, purpose, "en-US", ["a@b.c"], true)).Should().BeNull(purpose);
            }
        }

        [Theory]
        [MemberData(nameof(Implementations))]
        public async Task SeveralDefaultTemplates_TheLowestIdIsUsed(string impl)
        {
            using var _ = new IntegrationContext(MongoIntegrationFixture.NewTenantId());
            await Configs(Config("cfg-ok"));
            // Inserted out of order: "t-b" points at a missing configuration, "t-a" (lower id) at a real one.
            await Templates(Template("t-b", "p", "cfg-missing", "default"), Template("t-a", "p", "cfg-ok", "default"));

            (await Check(impl, "p", "en-US", ["a@b.c"], true)).Should().BeNull();
        }

        [Theory]
        [MemberData(nameof(Implementations))]
        public async Task InboundTemplateConfiguration_FallsBackToTheDefaultOrganizationsDefault(string impl)
        {
            using var _ = new IntegrationContext(MongoIntegrationFixture.NewTenantId());
            await Configs(Config("cfg-inbox", inbound: true));
            await Templates(Template("t", "p", "cfg-inbox", "default"));

            (await Check(impl, "p", "en-US", ["a@b.c"], true)).Should().Contain("mail server configuration");

            await Configs(Config("cfg-org-default", organizationDefault: true));
            (await Check(impl, "p", "en-US", ["a@b.c"], true)).Should().BeNull();
        }

        [Theory]
        [MemberData(nameof(Implementations))]
        public async Task EmptyTemplateConfiguration_UsesTheDefaultOrganizationsDefault(string impl)
        {
            using var _ = new IntegrationContext(MongoIntegrationFixture.NewTenantId());
            await Templates(Template("t", "p", "", "default"));
            // Another organization's default and an inbound default don't count.
            await Configs(Config("cfg-acme", organizationId: "acme", organizationDefault: true), Config("cfg-inbound", inbound: true, organizationDefault: true));

            (await Check(impl, "p", "en-US", ["a@b.c"], true)).Should().Contain("mail server configuration");

            await Configs(Config("cfg-legacy", organizationId: null, organizationDefault: true));
            (await Check(impl, "p", "en-US", ["a@b.c"], true)).Should().BeNull();
        }

        [Theory]
        [MemberData(nameof(Implementations))]
        public async Task NoOrganizationDefault_UsesTheProjectDefault_ButNeverAnInboundOne(string impl)
        {
            using var _ = new IntegrationContext(MongoIntegrationFixture.NewTenantId());
            await Templates(Template("t", "p", null, "default"));
            await Configs(Config("cfg-inbound-project", inbound: true, projectDefault: true));

            (await Check(impl, "p", "en-US", ["a@b.c"], true)).Should().Contain("mail server configuration");

            await Configs(Config("cfg-project", organizationId: "acme", projectDefault: true));
            (await Check(impl, "p", "en-US", ["a@b.c"], true)).Should().BeNull();
        }
    }
}
