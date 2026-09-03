using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Blocks.Genesis;
using DomainService.Entities;
using DomainService.People;
using DomainService.Projects;
using FluentAssertions;
using MongoDB.Driver;
using Moq;
using XUnitTest.TestSupport;

namespace XUnitTest.Integration
{
    [Collection(MongoIntegrationCollection.Name)]
    public class PeopleRepositoryTests
    {
        private readonly MongoIntegrationFixture _fixture;

        public PeopleRepositoryTests(MongoIntegrationFixture fixture)
        {
            _fixture = fixture;
        }

        private readonly Mock<ITenants> _tenants = new();
        private readonly Mock<IProjectRepository> _projectRepo = new();

        private PeopleRepository NewRepository() => NewRepository(_fixture.DbContextProvider);

        private PeopleRepository NewRepository(IDbContextProvider provider)
        {
            _tenants.Setup(t => t.GetTenantByID(It.IsAny<string>()))
                    .Returns(new Tenant
                    {
                        Environment = "dev",
                        DbConnectionString = "mongodb://x",
                        JwtTokenParameters = new JwtTokenParameters { IssueDate = DateTime.UtcNow, PrivateCertificatePassword = "p" }
                    });
            var secret = new Mock<IBlocksSecret>();
            secret.SetupGet(s => s.DatabaseConnectionString).Returns("mongodb://localhost:27017");
            return new PeopleRepository(provider, _tenants.Object, _projectRepo.Object, secret.Object);
        }

        private Task InsertPeopleAsync(params ProjectPeople[] people)
            => _fixture.Collection<ProjectPeople>("ProjectPeoples").InsertManyAsync(people);

        private Task InsertUsersAsync(params User[] users)
            => _fixture.Collection<User>("Users").InsertManyAsync(users);

        private static ProjectPeople Person(string userId, string tenantId, string email,
            bool confirmed = true, bool creator = false)
            => new()
            {
                ItemId = Guid.NewGuid().ToString("N"),
                UserId = userId,
                TenantId = tenantId,
                Email = email,
                IsInvitationConfirmed = confirmed,
                IsInvitationSent = true,
                IsCreator = creator
            };

        private static User NewUser(string id, string email, string first, string last)
            => new() { ItemId = id, Email = email, FirstName = first, LastName = last, Active = true, IsVerified = true };

        [Fact]
        public async Task GetPeoplesAsync_ReturnsDistinctPeopleWithDetailsAndOwnership()
        {
            var suffix = Guid.NewGuid().ToString("N");
            var tenantA = "tA-" + suffix;
            var tenantB = "tB-" + suffix;
            var owner = "owner-" + suffix;
            var member = "member-" + suffix;
            // Context user is the owner so IsOwner resolves true.
            using var _ = new IntegrationContext(suffix, userId: owner);

            _projectRepo.Setup(r => r.GetProjectIdsByGroupId("grp-" + suffix))
                        .ReturnsAsync(new List<string> { tenantA, tenantB });

            await InsertPeopleAsync(
                Person(owner, tenantA, "owner@x.com", creator: true),
                Person(owner, tenantB, "owner@x.com", creator: true),
                Person(member, tenantA, "member@x.com"));
            await InsertUsersAsync(
                NewUser(owner, "owner@x.com", "Olivia", "Owner"),
                NewUser(member, "member@x.com", "Mike", "Member"));

            var (peoples, totalCount, peoplesTotalCount, isOwner) = await NewRepository().GetPeoplesAsync(
                new GetPeoplesRequest { ProjectGroupId = "grp-" + suffix, Page = 0, PageSize = 10 });

            totalCount.Should().Be(3);
            peoplesTotalCount.Should().Be(2);
            isOwner.Should().BeTrue();
            peoples.Should().Contain(p => p.peopleDetails.Email == "owner@x.com");
            peoples.Should().Contain(p => p.peopleDetails.FirstName == "Mike");
        }

        [Fact]
        public async Task GetPeoplesAsync_SearchByEmail_FiltersOnProjectPeople()
        {
            var suffix = Guid.NewGuid().ToString("N");
            var tenant = "t-" + suffix;
            using var _ = new IntegrationContext("ctx-" + suffix);
            _projectRepo.Setup(r => r.GetProjectIdsByGroupId("grp-" + suffix))
                        .ReturnsAsync(new List<string> { tenant });

            await InsertPeopleAsync(
                Person("u1-" + suffix, tenant, "alice@example.com"),
                Person("u2-" + suffix, tenant, "bob@example.com"));
            await InsertUsersAsync(
                NewUser("u1-" + suffix, "alice@example.com", "Alice", "A"),
                NewUser("u2-" + suffix, "bob@example.com", "Bob", "B"));

            var (peoples, _, peoplesTotalCount, _) = await NewRepository().GetPeoplesAsync(
                new GetPeoplesRequest
                {
                    ProjectGroupId = "grp-" + suffix,
                    Page = 0,
                    PageSize = 10,
                    Filter = "alice",
                    SearchField = PeopleSearchFields.Email
                });

            peoplesTotalCount.Should().Be(1);
            peoples.Should().ContainSingle(p => p.peopleDetails.Email == "alice@example.com");
        }

        [Fact]
        public async Task GetPeoplesAsync_SearchByName_UsesUsersCollection()
        {
            var suffix = Guid.NewGuid().ToString("N");
            var tenant = "t-" + suffix;
            using var _ = new IntegrationContext("ctx-" + suffix);
            _projectRepo.Setup(r => r.GetProjectIdsByGroupId("grp-" + suffix))
                        .ReturnsAsync(new List<string> { tenant });

            await InsertPeopleAsync(
                Person("u1-" + suffix, tenant, "carol@example.com"),
                Person("u2-" + suffix, tenant, "dave@example.com"));
            await InsertUsersAsync(
                NewUser("u1-" + suffix, "carol@example.com", "Carol", "Zephyr"),
                NewUser("u2-" + suffix, "dave@example.com", "Dave", "Young"));

            var (peoples, _, peoplesTotalCount, _) = await NewRepository().GetPeoplesAsync(
                new GetPeoplesRequest
                {
                    ProjectGroupId = "grp-" + suffix,
                    Page = 0,
                    PageSize = 10,
                    Filter = "Zephyr",
                    SearchField = PeopleSearchFields.Name
                });

            peoplesTotalCount.Should().Be(1);
            peoples.Should().ContainSingle(p => p.peopleDetails.LastName == "Zephyr");
        }

        [Fact]
        public async Task GetPeoplesAsync_ConfirmedFilter_ExcludesUnconfirmed()
        {
            var suffix = Guid.NewGuid().ToString("N");
            var tenant = "t-" + suffix;
            using var _ = new IntegrationContext("ctx-" + suffix);
            _projectRepo.Setup(r => r.GetProjectIdsByGroupId("grp-" + suffix))
                        .ReturnsAsync(new List<string> { tenant });

            await InsertPeopleAsync(
                Person("u1-" + suffix, tenant, "conf@example.com", confirmed: true),
                Person("u2-" + suffix, tenant, "pending@example.com", confirmed: false));
            await InsertUsersAsync(
                NewUser("u1-" + suffix, "conf@example.com", "C", "One"),
                NewUser("u2-" + suffix, "pending@example.com", "P", "Two"));

            var (_, _, peoplesTotalCount, _) = await NewRepository().GetPeoplesAsync(
                new GetPeoplesRequest
                {
                    ProjectGroupId = "grp-" + suffix,
                    Page = 0,
                    PageSize = 10,
                    IsInvitationConfirmed = true
                });

            peoplesTotalCount.Should().Be(1);
        }

        [Fact]
        public async Task GetPeoplesAsync_NoMatches_ReturnsEmpty()
        {
            var suffix = Guid.NewGuid().ToString("N");
            using var _ = new IntegrationContext("ctx-" + suffix);
            _projectRepo.Setup(r => r.GetProjectIdsByGroupId("grp-" + suffix))
                        .ReturnsAsync(new List<string> { "unused-" + suffix });

            var (peoples, totalCount, peoplesTotalCount, isOwner) = await NewRepository().GetPeoplesAsync(
                new GetPeoplesRequest { ProjectGroupId = "grp-" + suffix, Page = 0, PageSize = 10 });

            peoples.Should().BeEmpty();
            totalCount.Should().Be(0);
            peoplesTotalCount.Should().Be(0);
            isOwner.Should().BeFalse();
        }

        [Fact]
        public async Task GetProjectByIdAsync_ReturnsTenant()
        {
            var suffix = Guid.NewGuid().ToString("N");
            using var _ = new IntegrationContext("ctx-" + suffix);
            await _fixture.Collection<Tenant>("Tenants").InsertOneAsync(new Tenant
            {
                ItemId = "p-" + suffix,
                TenantId = "tid-" + suffix,
                Name = "Proj",
                DbConnectionString = "x",
                JwtTokenParameters = new JwtTokenParameters { IssueDate = DateTime.UtcNow, PrivateCertificatePassword = "p" }
            });

            var result = await NewRepository().GetProjectByIdAsync("tid-" + suffix);

            result.Should().NotBeNull();
            result.TenantId.Should().Be("tid-" + suffix);
        }

        [Fact]
        public async Task Users_GetByEmailListAndById()
        {
            var suffix = Guid.NewGuid().ToString("N");
            using var _ = new IntegrationContext("ctx-" + suffix);
            await InsertUsersAsync(
                NewUser("u1-" + suffix, "e1-" + suffix + "@x.com", "F1", "L1"),
                NewUser("u2-" + suffix, "e2-" + suffix + "@x.com", "F2", "L2"));

            var repo = NewRepository();
            var byEmails = await repo.GetUsersByEmailAsync(new List<string> { "e1-" + suffix + "@x.com" });
            var byId = await repo.GetUserByIdAsync("u2-" + suffix);
            var byEmail = await repo.GetUserByEmailAsync("e2-" + suffix + "@x.com");

            byEmails.Should().ContainSingle();
            byId.FirstName.Should().Be("F2");
            byEmail.ItemId.Should().Be("u2-" + suffix);
        }

        [Fact]
        public async Task InsertRemoveUpdateProjectPeople_Lifecycle()
        {
            var suffix = Guid.NewGuid().ToString("N");
            var tenant = "t-" + suffix;
            using var _ = new IntegrationContext("ctx-" + suffix);
            var repo = NewRepository();

            var p1 = Person("u1-" + suffix, tenant, "p1@x.com", confirmed: false);
            var p2 = Person("u1-" + suffix, tenant, "p1@x.com", confirmed: false);
            (await repo.InsertPeoplesAsync(new List<ProjectPeople> { p1, p2 })).Should().BeTrue();

            (await repo.UpdateProjectPeoples(new List<string> { p1.ItemId })).Should().BeTrue();
            var reloaded = await repo.GetProjectPeopleAsync(p1.ItemId);
            reloaded.IsInvitationConfirmed.Should().BeTrue();

            (await repo.GetProjectPeoplesAsync("u1-" + suffix, new List<string> { tenant })).Should().HaveCount(2);
            (await repo.GetProjectPeopleByTenantIdAndUserIdAsync(tenant, "u1-" + suffix)).Should().NotBeNull();

            (await repo.RemovePeoplesAsync("p1@x.com", new List<string> { tenant })).Should().BeTrue();
            (await repo.GetProjectPeoplesAsync("u1-" + suffix, new List<string> { tenant })).Should().BeEmpty();
        }

        [Fact]
        public async Task IsOwner_And_UpdateOwnership()
        {
            var suffix = Guid.NewGuid().ToString("N");
            var tenant = "t-" + suffix;
            var user = "u-" + suffix;
            using var _ = new IntegrationContext("ctx-" + suffix);
            var repo = NewRepository();
            var person = Person(user, tenant, "own@x.com", creator: true);
            await InsertPeopleAsync(person);

            (await repo.IsOwner(user, new List<string> { tenant })).Should().BeTrue();
            (await repo.IsOwner("someone-else", new List<string> { tenant })).Should().BeFalse();

            (await repo.UpdateProjectPeopleOwnerShipAsync(new List<string> { person.ItemId }, false)).Should().BeTrue();
            (await repo.IsOwner(user, new List<string> { tenant })).Should().BeFalse();
        }

        [Fact]
        public async Task IsOwner_IsFalse_ForAnEmptyTenantList()
        {
            using var _ = new IntegrationContext("ctx-" + Guid.NewGuid().ToString("N"));
            (await NewRepository().IsOwner("u1", new List<string>())).Should().BeFalse();
        }

        [Fact]
        public async Task ProjectPeoples_IsReadFromTheRootDb_WhenImpersonating()
        {
            // Every request made from inside a project is impersonated, so BlocksContext.TenantId
            // is the project's own tenant and the bare IDbContextProvider.GetCollection resolves
            // to that project's database. ProjectPeoples is never written there -- ProjectRepository
            // pins all of its writes to the root database -- so these reads came back empty, and
            // because ProjectAccessService decides ownership from exactly these rows, the owner of
            // a project was refused as a non-member of it: Project/Create and Project/Disable both
            // answered "Only the project owner can do this" with rows=0; ownerRows=0.
            var suffix = Guid.NewGuid().ToString("N");
            var tenant = "t-" + suffix;
            var user = "u-" + suffix;

            var provider = new SplitDatabaseContextProvider(_fixture.Client, _fixture.Database, "tenantdb_" + suffix);
            using var _ = new BlocksTestContext(tenantId: tenant, userId: user, impersonated: true,
                                                originalTenantId: "root-" + suffix);
            var repo = NewRepository(provider);

            // Written the way provisioning writes it: through the root database, not through the
            // repository under test.
            await InsertPeopleAsync(Person(user, tenant, "own@x.com", creator: true));

            (await repo.GetProjectPeoplesAsync(user, new List<string> { tenant })).Should().HaveCount(1);
            (await repo.IsOwner(user, new List<string> { tenant })).Should().BeTrue();
            (await repo.GetProjectPeopleByTenantIdAndUserIdAsync(tenant, user)).Should().NotBeNull();

            provider.Drop();
        }
    }
}
