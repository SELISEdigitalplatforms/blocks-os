using Blocks.Secrets;
using FluentAssertions;
using MongoDB.Driver;
using Moq;
using Xunit;

namespace XUnitTest.Secrets
{
    /// <summary>
    /// Index creation is gated once per cluster, not once per process.
    /// </summary>
    /// <remarks>
    /// The flag this replaced would index whichever connection a request reached first and leave
    /// the rest bare. That matters most for <c>ix_tenant_item</c>, which is unique: a cluster
    /// that never got it would accept a duplicate secret id without complaint.
    /// </remarks>
    public sealed class SecretStoreIndexesTests
    {
        [Fact]
        public void The_first_caller_on_a_cluster_ensures_and_the_rest_do_not()
        {
            var collection = CollectionOn(Mock.Of<IMongoClient>(), "SecretStore.Secrets");

            SecretStoreIndexes.ShouldEnsure(collection).Should().BeTrue();
            SecretStoreIndexes.ShouldEnsure(collection).Should().BeFalse();
            SecretStoreIndexes.ShouldEnsure(collection).Should().BeFalse();
        }

        [Fact]
        public void Every_cluster_is_ensured_separately()
        {
            // Same database name, same collection name, different connection — which is exactly
            // the shape three-connection placement produces.
            var main = CollectionOn(Mock.Of<IMongoClient>(), "SecretStore.Secrets");
            var dev = CollectionOn(Mock.Of<IMongoClient>(), "SecretStore.Secrets");
            var other = CollectionOn(Mock.Of<IMongoClient>(), "SecretStore.Secrets");

            SecretStoreIndexes.ShouldEnsure(main).Should().BeTrue();
            SecretStoreIndexes.ShouldEnsure(dev).Should().BeTrue();
            SecretStoreIndexes.ShouldEnsure(other).Should().BeTrue();

            SecretStoreIndexes.ShouldEnsure(dev).Should().BeFalse();
        }

        [Fact]
        public void Each_collection_on_a_cluster_is_ensured_separately()
        {
            var client = Mock.Of<IMongoClient>();
            var secrets = CollectionOn(client, "SecretStore.Secrets");
            var auditLogs = CollectionOn(client, "SecretStore.SecretAuditLogs");

            SecretStoreIndexes.ShouldEnsure(secrets).Should().BeTrue();
            SecretStoreIndexes.ShouldEnsure(auditLogs).Should().BeTrue();

            SecretStoreIndexes.ShouldEnsure(secrets).Should().BeFalse();
            SecretStoreIndexes.ShouldEnsure(auditLogs).Should().BeFalse();
        }

        [Fact]
        public void A_new_client_for_the_same_cluster_is_ensured_again()
        {
            // Genesis keeps one client per connection string for the life of the process, so a
            // second client means a genuinely new connection. Re-ensuring is the safe answer:
            // creating an index that already exists is a no-op, skipping one that does not is not.
            var first = CollectionOn(Mock.Of<IMongoClient>(), "SecretStore.Secrets");
            SecretStoreIndexes.ShouldEnsure(first).Should().BeTrue();

            var second = CollectionOn(Mock.Of<IMongoClient>(), "SecretStore.Secrets");
            SecretStoreIndexes.ShouldEnsure(second).Should().BeTrue();
        }

        private static IMongoCollection<Secret> CollectionOn(IMongoClient client, string fullName)
        {
            var database = new Mock<IMongoDatabase>();
            database.SetupGet(d => d.Client).Returns(client);

            var collection = new Mock<IMongoCollection<Secret>>();
            collection.SetupGet(c => c.Database).Returns(database.Object);
            collection.SetupGet(c => c.CollectionNamespace).Returns(CollectionNamespace.FromFullName(fullName));

            return collection.Object;
        }
    }
}
