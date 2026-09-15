using System;
using System.Threading.Tasks;
using Blocks.Genesis;
using Cloud.LmtService.Repositories.Shared;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;
using Moq;
using XUnitTest.TestSupport;

namespace XUnitTest.Integration
{
    /// <summary>
    /// Which database the requester's address is read from.
    ///
    /// The console can impersonate a project, and while it does, BlocksContext.TenantId is the
    /// project's tenant — whose Users collection does not contain the console user. Their row is
    /// in the root database. So the handle has to be chosen from <c>Impersonated</c>, and a test
    /// only shows that through a provider that keeps the two databases apart:
    /// <see cref="SplitDatabaseContextProvider"/> resolves the root name to the fixture database
    /// and every tenant request to a separate one, so reading the wrong handle finds nothing.
    ///
    /// Running against a real mongod also covers the parts a mocked driver cannot: that ItemId
    /// really filters on <c>_id</c>, and that the Email projection binds.
    /// </summary>
    [Collection(MongoIntegrationCollection.Name)]
    public class RestoreUserRepositoryTests
    {
        private readonly MongoIntegrationFixture _fixture;

        public RestoreUserRepositoryTests(MongoIntegrationFixture fixture)
        {
            _fixture = fixture;
        }

        private static RestoreUserRepository NewRepository(IDbContextProvider provider)
        {
            var secret = new Mock<IBlocksSecret>();
            secret.SetupGet(s => s.DatabaseConnectionString).Returns(MongoIntegrationFixture.ConnectionString);

            return new RestoreUserRepository(
                provider,
                secret.Object,
                new Mock<ILogger<RestoreUserRepository>>().Object);
        }

        /// <summary>
        /// Written as a raw document rather than through the repository's own projection type: the
        /// User entity that owns this collection is what shapes it in production, and _id is the
        /// field its ItemId maps to.
        /// </summary>
        private static Task InsertUserAsync(IMongoDatabase database, string userId, string? email) =>
            database.GetCollection<BsonDocument>("Users").InsertOneAsync(new BsonDocument
            {
                { "_id", userId },
                { "Email", email is null ? BsonNull.Value : new BsonString(email) }
            });

        [Fact]
        public async Task GetEmailByUserIdAsync_ReadsTheTenantDatabase_WhenNotImpersonating()
        {
            var suffix = Guid.NewGuid().ToString("N");
            var userId = "u-" + suffix;
            var tenantDatabaseName = "tenantdb_" + suffix;

            var provider = new SplitDatabaseContextProvider(_fixture.Client, _fixture.Database, tenantDatabaseName);
            var tenantDatabase = _fixture.Client.GetDatabase(tenantDatabaseName);

            // The same id in both databases with different addresses, so the answer names which
            // handle was used rather than merely proving something was found.
            await InsertUserAsync(tenantDatabase, userId, "tenant@example.com");
            await InsertUserAsync(_fixture.Database, userId, "root@example.com");

            using var _ = new BlocksTestContext(tenantId: "t-" + suffix, userId: userId, impersonated: false);

            var email = await NewRepository(provider).GetEmailByUserIdAsync(userId);

            email.Should().Be("tenant@example.com");

            provider.Drop();
        }

        [Fact]
        public async Task GetEmailByUserIdAsync_ReadsTheRootDatabase_WhenImpersonating()
        {
            var suffix = Guid.NewGuid().ToString("N");
            var userId = "u-" + suffix;
            var tenantDatabaseName = "tenantdb_" + suffix;

            var provider = new SplitDatabaseContextProvider(_fixture.Client, _fixture.Database, tenantDatabaseName);
            var tenantDatabase = _fixture.Client.GetDatabase(tenantDatabaseName);

            await InsertUserAsync(tenantDatabase, userId, "tenant@example.com");
            await InsertUserAsync(_fixture.Database, userId, "root@example.com");

            using var _ = new BlocksTestContext(
                tenantId: "t-" + suffix, userId: userId, impersonated: true, originalTenantId: "root-" + suffix);

            var email = await NewRepository(provider).GetEmailByUserIdAsync(userId);

            email.Should().Be("root@example.com");

            provider.Drop();
        }

        /// <summary>
        /// The impersonated branch is what makes this reachable: the console user's row is only in
        /// the root database, so before the split the lookup came back empty for exactly the
        /// people most likely to be running a restore.
        /// </summary>
        [Fact]
        public async Task GetEmailByUserIdAsync_FindsTheConsoleUser_WhenOnlyTheRootDatabaseHasThem()
        {
            var suffix = Guid.NewGuid().ToString("N");
            var userId = "u-" + suffix;
            var tenantDatabaseName = "tenantdb_" + suffix;

            var provider = new SplitDatabaseContextProvider(_fixture.Client, _fixture.Database, tenantDatabaseName);

            await InsertUserAsync(_fixture.Database, userId, "console@example.com");

            using var _ = new BlocksTestContext(
                tenantId: "t-" + suffix, userId: userId, impersonated: true, originalTenantId: "root-" + suffix);

            var email = await NewRepository(provider).GetEmailByUserIdAsync(userId);

            email.Should().Be("console@example.com");

            provider.Drop();
        }

        [Fact]
        public async Task GetEmailByUserIdAsync_ReturnsNull_WhenNoSuchUserExists()
        {
            var suffix = Guid.NewGuid().ToString("N");
            var provider = new SplitDatabaseContextProvider(_fixture.Client, _fixture.Database, "tenantdb_" + suffix);

            using var _ = new BlocksTestContext(tenantId: "t-" + suffix, userId: "absent-" + suffix);

            var email = await NewRepository(provider).GetEmailByUserIdAsync("absent-" + suffix);

            email.Should().BeNull();

            provider.Drop();
        }

        [Fact]
        public async Task GetEmailByUserIdAsync_ReturnsNull_WhenTheUserRecordHasNoAddress()
        {
            var suffix = Guid.NewGuid().ToString("N");
            var userId = "u-" + suffix;
            var tenantDatabaseName = "tenantdb_" + suffix;

            var provider = new SplitDatabaseContextProvider(_fixture.Client, _fixture.Database, tenantDatabaseName);
            await InsertUserAsync(_fixture.Client.GetDatabase(tenantDatabaseName), userId, email: null);

            using var _ = new BlocksTestContext(tenantId: "t-" + suffix, userId: userId);

            var email = await NewRepository(provider).GetEmailByUserIdAsync(userId);

            email.Should().BeNull();

            provider.Drop();
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public async Task GetEmailByUserIdAsync_ReturnsNullWithoutQuerying_WhenThereIsNoUserId(string? userId)
        {
            var provider = new Mock<IDbContextProvider>(MockBehavior.Strict);

            using var _ = new BlocksTestContext();

            var email = await NewRepository(provider.Object).GetEmailByUserIdAsync(userId);

            email.Should().BeNull();
            provider.VerifyNoOtherCalls();
        }

        /// <summary>
        /// The address only decorates a notification, so a database that cannot be reached must
        /// cost the caller a log line, not their restore request.
        /// </summary>
        [Fact]
        public async Task GetEmailByUserIdAsync_ReturnsNull_WhenTheLookupThrows()
        {
            var provider = new Mock<IDbContextProvider>();
            provider
                .Setup(p => p.GetDatabase(It.IsAny<string>()))
                .Throws(new MongoConfigurationException("unreachable"));

            using var _ = new BlocksTestContext();

            var email = await NewRepository(provider.Object).GetEmailByUserIdAsync("user-1");

            email.Should().BeNull();
        }

    }
}
