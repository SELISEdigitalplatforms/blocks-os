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
    [Collection(MongoIntegrationCollection.Name)]
    public class MailPreCheckTests
    {
        private readonly MongoIntegrationFixture _fixture;

        public MailPreCheckTests(MongoIntegrationFixture fixture)
        {
            _fixture = fixture;
        }

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

        private async Task<Seed> SeedAll(string language = "en-US", string? configId = null, bool withConfig = true, bool withUser = true, bool withTemplate = true, string? templateBody = null, string[]? orgIds = null)
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
                    { "TemplateBody", templateBody ?? "" },
                    { "OrganizationIds", new BsonArray(orgIds ?? Array.Empty<string>()) }
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

        [Theory]
        [MemberData(nameof(Implementations))]
        public async Task OrganizationTemplateIsPickedFirst_ThenFallbackToAnyWithPurposeAndLanguage(string impl)
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            using var _ = new IntegrationContext(tenant); // organization = "org-" + tenant
            var tag = Guid.NewGuid().ToString("N");
            var purpose = "orgpurpose-" + tag;
            await _fixture.Collection<BsonDocument>("MailServerConfigurations").InsertOneAsync(new BsonDocument { { "_id", "cfg-org-" + tag } });
            // generic template points at a config that does not exist; the org template at one that does
            await _fixture.Collection<BsonDocument>("EmailTemplates").InsertManyAsync(new[]
            {
                new BsonDocument { { "_id", "tg-" + tag }, { "Name", purpose }, { "Language", "en-US" }, { "MailConfigurationId", "missing-" + tag }, { "OrganizationIds", new BsonArray() } },
                new BsonDocument { { "_id", "to-" + tag }, { "Name", purpose }, { "Language", "en-US" }, { "MailConfigurationId", "cfg-org-" + tag }, { "OrganizationIds", new BsonArray(new[] { "org-" + tenant }) } }
            });

            (await Check(impl, purpose, "en-US", ["a@b.c"], true)).Should().BeNull();

            using var __ = new IntegrationContext(MongoIntegrationFixture.NewTenantId()); // another org: falls back to the generic one
            (await Check(impl, purpose, "en-US", ["a@b.c"], true)).Should().Contain("mail server configuration");
        }
    }
}
