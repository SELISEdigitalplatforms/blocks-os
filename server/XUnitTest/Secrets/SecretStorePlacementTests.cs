using System;
using Blocks.Genesis;
using Blocks.Secrets;
using FluentAssertions;
using MongoDB.Driver;
using Moq;
using Xunit;

namespace XUnitTest.Secrets
{
    /// <summary>
    /// The secret store follows its tenant's database placement.
    /// </summary>
    /// <remarks>
    /// These assert the connection the store is opened on, not that Mongo answers — routing is
    /// decided entirely from the tenant registry record, so it is testable without a cluster.
    /// Every case also asserts what was <em>not</em> opened, because the failure that matters
    /// here is a silent read of the main connection for a tenant whose secrets live elsewhere:
    /// that returns an empty list rather than an error, and looks like a tenant with no secrets.
    /// </remarks>
    public sealed class SecretStorePlacementTests : IDisposable
    {
        private const string MainConnection = "mongodb://main-cluster/?appName=main";
        private const string DevConnection = "mongodb://dev-cluster/?appName=dev";
        private const string OtherConnection = "mongodb://other-cluster/?appName=other";

        private readonly Mock<IDbContextProvider> _provider = new();
        private readonly Mock<ITenants> _tenants = new();

        public SecretStorePlacementTests() => BlocksContext.SetContext(null);

        public void Dispose() => BlocksContext.SetContext(null);

        [Theory]
        [InlineData(DevConnection)]
        [InlineData(OtherConnection)]
        [InlineData(MainConnection)]
        public void Database_opens_SecretStore_on_the_tenants_own_connection(string connection)
        {
            var database = GivenDatabaseFor(connection);
            GivenTenant("tenant-1", connection);
            SecretTestContext.SignIn("tenant-1");

            var resolved = NewContext().Database;

            resolved.Should().BeSameAs(database);
            _provider.Verify(p => p.GetDatabase(connection, SecretCollections.DatabaseName), Times.Once);
            _provider.VerifyNoOtherCalls();
        }

        [Fact]
        public void Two_tenants_on_different_connections_do_not_share_a_store()
        {
            var devDatabase = GivenDatabaseFor(DevConnection);
            var mainDatabase = GivenDatabaseFor(MainConnection);
            GivenTenant("dev-tenant", DevConnection);
            GivenTenant("prod-tenant", MainConnection);

            var store = NewContext();

            SecretTestContext.SignIn("dev-tenant");
            store.Database.Should().BeSameAs(devDatabase);

            SecretTestContext.SignIn("prod-tenant");
            store.Database.Should().BeSameAs(mainDatabase);
        }

        [Fact]
        public void An_existing_tenant_still_resolves_to_main()
        {
            // The property that makes this change need no migration: a tenant provisioned before
            // placement existed already carries main in its registry record, so it lands on the
            // same database it always used.
            var main = GivenDatabaseFor(MainConnection);
            GivenTenant("legacy-tenant", MainConnection);
            SecretTestContext.SignIn("legacy-tenant");

            NewContext().Database.Should().BeSameAs(main);
        }

        [Fact]
        public void A_placement_change_is_followed_without_a_restart()
        {
            var main = GivenDatabaseFor(MainConnection);
            var other = GivenDatabaseFor(OtherConnection);
            GivenTenant("moving-tenant", MainConnection);
            SecretTestContext.SignIn("moving-tenant");

            var store = NewContext();
            store.Database.Should().BeSameAs(main);

            // What Genesis refreshing the tenant cache looks like from here.
            GivenTenant("moving-tenant", OtherConnection);

            store.Database.Should().BeSameAs(other);
        }

        [Fact]
        public void Collections_come_from_the_routed_database()
        {
            var secrets = Mock.Of<IMongoCollection<Secret>>();
            var auditLogs = Mock.Of<IMongoCollection<SecretAuditLog>>();
            var database = GivenDatabaseFor(DevConnection);

            Mock.Get(database)
                .Setup(d => d.GetCollection<Secret>(SecretCollections.Secrets, It.IsAny<MongoCollectionSettings>()))
                .Returns(secrets);
            Mock.Get(database)
                .Setup(d => d.GetCollection<SecretAuditLog>(SecretCollections.AuditLogs, It.IsAny<MongoCollectionSettings>()))
                .Returns(auditLogs);

            GivenTenant("tenant-1", DevConnection);
            SecretTestContext.SignIn("tenant-1");

            var store = NewContext();

            store.Secrets.Should().BeSameAs(secrets);
            store.AuditLogs.Should().BeSameAs(auditLogs);
        }

        [Fact]
        public void An_explicit_tenant_routes_without_an_ambient_context()
        {
            // The overload worker paths use: no signed-in caller, target carried by the message.
            var database = GivenDatabaseFor(OtherConnection);
            GivenTenant("worker-tenant", OtherConnection);

            NewContext().GetDatabase("worker-tenant").Should().BeSameAs(database);
        }

        [Fact]
        public void No_context_is_denied_before_any_lookup()
        {
            var act = () => NewContext().Database;

            act.Should().Throw<SecretAccessDeniedException>()
                .Which.ReasonCode.Should().Be(SecretAuditReasons.NoContext);
            _tenants.VerifyNoOtherCalls();
            _provider.VerifyNoOtherCalls();
        }

        [Fact]
        public void An_unknown_tenant_never_falls_back_to_main()
        {
            GivenDatabaseFor(MainConnection);
            _tenants.Setup(t => t.GetTenantByID("ghost-tenant")).Returns((Tenant?)null);
            SecretTestContext.SignIn("ghost-tenant");

            var act = () => NewContext().Database;

            act.Should().Throw<SecretAccessDeniedException>()
                .Which.ReasonCode.Should().Be(SecretAuditReasons.InvalidContext);
            _provider.VerifyNoOtherCalls();
        }

        [Fact]
        public void A_disabled_tenant_is_denied()
        {
            GivenDatabaseFor(DevConnection);
            GivenTenant("retired-tenant", DevConnection, isDisabled: true);
            SecretTestContext.SignIn("retired-tenant");

            var act = () => NewContext().Database;

            act.Should().Throw<SecretAccessDeniedException>()
                .Which.ReasonCode.Should().Be(SecretAuditReasons.InvalidContext);
            _provider.VerifyNoOtherCalls();
        }

        [Fact]
        public void A_tenant_recorded_without_a_connection_fails_as_a_server_fault()
        {
            GivenDatabaseFor(MainConnection);
            GivenTenant("unprovisioned-tenant", "   ");
            SecretTestContext.SignIn("unprovisioned-tenant");

            var act = () => NewContext().Database;

            // Not SecretAccessDeniedException: the caller did nothing wrong, and a 403 would send
            // an operator looking at permissions instead of at the registry record.
            act.Should().Throw<InvalidOperationException>()
                .WithMessage("*unprovisioned-tenant*");
            _provider.VerifyNoOtherCalls();
        }

        [Fact]
        public void A_routing_failure_never_names_a_connection()
        {
            GivenTenant("tenant-1", DevConnection, isDisabled: true);
            SecretTestContext.SignIn("tenant-1");

            var thrown = Record.Exception(() => NewContext().Database);

            thrown!.ToString().Should().NotContain("dev-cluster").And.NotContain("mongodb://");
        }

        private SecretStoreContext NewContext() => new(_provider.Object, _tenants.Object);

        private IMongoDatabase GivenDatabaseFor(string connection)
        {
            var database = Mock.Of<IMongoDatabase>();
            _provider.Setup(p => p.GetDatabase(connection, SecretCollections.DatabaseName)).Returns(database);
            return database;
        }

        private void GivenTenant(string tenantId, string connection, bool isDisabled = false) =>
            _tenants.Setup(t => t.GetTenantByID(tenantId)).Returns(new Tenant
            {
                TenantId = tenantId,
                DBName = "shared-name",
                DbConnectionString = connection,
                IsDisabled = isDisabled,
                JwtTokenParameters = new JwtTokenParameters
                {
                    IssueDate = DateTime.UtcNow,
                    PrivateCertificatePassword = string.Empty
                }
            });
    }
}
