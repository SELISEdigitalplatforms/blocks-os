using DomainService.Projects;
using FluentAssertions;
using MongoDB.Bson;

namespace XUnitTest.Services
{
    public class TenantConfigurationEmbeddingTests
    {
        private static BsonDocument SeedTenantConfiguration() => new()
        {
            { "_id", "tc-seed" },
            { "IsMultiOrgEnabled", true },
            { "DefaultRolesForNewUserOnSignUp", new BsonArray { "clouduser" } },
            { "CreatedBy", "seed-author" },
            { "LastUpdatedBy", "seed-author" }
        };

        [Fact]
        public void Apply_IdentityWithoutField_EmbedsStampedCopyOfSeed_AndLeavesSeedUntouched()
        {
            var identity = new BsonDocument { { "_id", "idc" }, { "AccountActionBaseUrl", "https://app" } };
            var seed = SeedTenantConfiguration();

            var applied = TenantConfigurationEmbedding.Apply(identity, seed, "creator");

            applied.Should().BeTrue();
            var embedded = identity[TenantConfigurationEmbedding.FieldName].AsBsonDocument;
            embedded["_id"].AsString.Should().Be("tc-seed");
            embedded["IsMultiOrgEnabled"].AsBoolean.Should().BeTrue();
            embedded["DefaultRolesForNewUserOnSignUp"].AsBsonArray.Should().ContainSingle().Which.AsString.Should().Be("clouduser");
            embedded["CreatedBy"].AsString.Should().Be("creator");
            embedded["LastUpdatedBy"].AsString.Should().Be("creator");
            identity["AccountActionBaseUrl"].AsString.Should().Be("https://app");
            seed["CreatedBy"].AsString.Should().Be("seed-author");
        }

        [Fact]
        public void Apply_MigratedSeedIdentity_KeepsItsOwnField_AndStampsIt()
        {
            var identity = new BsonDocument
            {
                { "_id", "idc" },
                { TenantConfigurationEmbedding.FieldName, new BsonDocument { { "IsMultiOrgEnabled", false }, { "CreatedBy", "seed-author" } } }
            };

            var applied = TenantConfigurationEmbedding.Apply(identity, SeedTenantConfiguration(), "creator");

            applied.Should().BeTrue();
            var embedded = identity[TenantConfigurationEmbedding.FieldName].AsBsonDocument;
            embedded["IsMultiOrgEnabled"].AsBoolean.Should().BeFalse();
            embedded.Contains("DefaultRolesForNewUserOnSignUp").Should().BeFalse();
            embedded["CreatedBy"].AsString.Should().Be("creator");
        }

        [Fact]
        public void Apply_FieldNotADocument_ReplacesItWithSeedCopy()
        {
            var identity = new BsonDocument { { "_id", "idc" }, { TenantConfigurationEmbedding.FieldName, BsonNull.Value } };

            var applied = TenantConfigurationEmbedding.Apply(identity, SeedTenantConfiguration(), "creator");

            applied.Should().BeTrue();
            identity[TenantConfigurationEmbedding.FieldName].AsBsonDocument["_id"].AsString.Should().Be("tc-seed");
        }

        [Fact]
        public void Apply_NoFieldAndNoSeed_ChangesNothing()
        {
            var identity = new BsonDocument { { "_id", "idc" } };

            var applied = TenantConfigurationEmbedding.Apply(identity, null, "creator");

            applied.Should().BeFalse();
            identity.Contains(TenantConfigurationEmbedding.FieldName).Should().BeFalse();
        }
    }
}
