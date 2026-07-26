using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Cloud.DomainService.Models;
using Cloud.DomainService.Repositories;
using Cloud.DomainService.Requests;
using FluentAssertions;
using Moq;
using Blocks.Genesis;
using MongoDB.Driver;

namespace XUnitTest.Integration
{
    [Collection(MongoIntegrationCollection.Name)]
    public class ApiEndpointConfigRepositoryTests
    {
        private const string CollectionName = "Permissions";
        private readonly MongoIntegrationFixture _fixture;

        public ApiEndpointConfigRepositoryTests(MongoIntegrationFixture fixture)
        {
            _fixture = fixture;
        }

        private ApiEndpointConfigRepository NewRepository()
        {
            var secret = new Mock<IBlocksSecret>();
            return new ApiEndpointConfigRepository(_fixture.DbContextProvider, secret.Object);
        }

        private async Task SeedAsync(params ApiEndpointConfig[] items)
        {
            await _fixture.Collection<ApiEndpointConfig>(CollectionName).InsertManyAsync(items);
        }

        private static ApiEndpointConfig NewConfig(string resource, string resourceGroup, string? name = null)
            => new()
            {
                ItemId = System.Guid.NewGuid().ToString("N"),
                Resource = resource,
                ResourceGroup = resourceGroup,
                Name = name ?? resource
            };

        [Fact]
        public async Task GetListAsync_ExcludesReservedResourceGroups()
        {
            var included = NewConfig("svc::CtrlB::Post", "storage");
            var reservedA = NewConfig("svc::CtrlA::Get", "communication");
            var reservedB = NewConfig("svc::CtrlA::Get", "identifier");
            await SeedAsync(reservedA, reservedB, included);

            // Shared collection: page through everything and assert the invariant.
            var (data, _) = await NewRepository().GetListAsync(
                new GetApiEndpointConfigsRequest { Page = 0, PageSize = 500 });

            var reserved = new[] { "communication", "configuration", "identifier", "idp", "lmt", "uds" };
            data.Should().NotContain(x => reserved.Contains(x.ResourceGroup!));
            data.Should().Contain(x => x.ItemId == included.ItemId);
            data.Should().NotContain(x => x.ItemId == reservedA.ItemId);
            data.Should().NotContain(x => x.ItemId == reservedB.ItemId);
        }

        [Fact]
        public async Task GetListAsync_FiltersByResourceGroup()
        {
            var group = "grp-" + System.Guid.NewGuid().ToString("N");
            await SeedAsync(
                NewConfig("svc::CtrlA::Get", group),
                NewConfig("svc::CtrlB::Post", "otherstorage"));

            var (data, count) = await NewRepository().GetListAsync(
                new GetApiEndpointConfigsRequest
                {
                    Page = 0,
                    PageSize = 50,
                    Filter = new ApiEndpointConfigFilter { ResourceGroup = group }
                });

            data.Should().OnlyContain(x => x.ResourceGroup == group);
            count.Should().Be(1);
        }

        [Fact]
        public async Task GetListAsync_FiltersByControllerAndMethod_AndSplitsResource()
        {
            var group = "grp-" + System.Guid.NewGuid().ToString("N");
            await SeedAsync(
                NewConfig("svc::Orders::Create", group),
                NewConfig("svc::Orders::Delete", group),
                NewConfig("svc::Users::Create", group));

            var (data, _) = await NewRepository().GetListAsync(
                new GetApiEndpointConfigsRequest
                {
                    Page = 0,
                    PageSize = 50,
                    Filter = new ApiEndpointConfigFilter
                    {
                        ResourceGroup = group,
                        Controller = "Orders",
                        Method = "Create"
                    }
                });

            data.Should().ContainSingle();
            var only = data.Single();
            only.Controller.Should().Be("Orders");
            only.Method.Should().Be("Create");
            only.Service.Should().Be(group);
        }

        [Fact]
        public async Task GetListAsync_FiltersByControllerOnly()
        {
            var group = "grp-" + System.Guid.NewGuid().ToString("N");
            await SeedAsync(
                NewConfig("svc::Widgets::Create", group),
                NewConfig("svc::Widgets::Delete", group),
                NewConfig("svc::Gadgets::Create", group));

            var (data, _) = await NewRepository().GetListAsync(
                new GetApiEndpointConfigsRequest
                {
                    Page = 0,
                    PageSize = 50,
                    Filter = new ApiEndpointConfigFilter { ResourceGroup = group, Controller = "Widgets" }
                });

            data.Should().HaveCount(2);
            data.Should().OnlyContain(x => x.Controller == "Widgets");
        }

        [Fact]
        public async Task GetListAsync_FiltersByMethodOnly()
        {
            var group = "grp-" + System.Guid.NewGuid().ToString("N");
            await SeedAsync(
                NewConfig("svc::Alpha::Purge", group),
                NewConfig("svc::Beta::Purge", group),
                NewConfig("svc::Beta::Keep", group));

            var (data, _) = await NewRepository().GetListAsync(
                new GetApiEndpointConfigsRequest
                {
                    Page = 0,
                    PageSize = 50,
                    Filter = new ApiEndpointConfigFilter { ResourceGroup = group, Method = "Purge" }
                });

            data.Should().HaveCount(2);
            data.Should().OnlyContain(x => x.Method == "Purge");
        }

        [Fact]
        public async Task GetListAsync_Paginates()
        {
            var group = "grp-" + System.Guid.NewGuid().ToString("N");
            var seed = Enumerable.Range(0, 5)
                .Select(i => NewConfig($"svc::Ctrl{i}::Get", group))
                .ToArray();
            await SeedAsync(seed);

            var (page0, count) = await NewRepository().GetListAsync(
                new GetApiEndpointConfigsRequest
                {
                    Page = 0,
                    PageSize = 2,
                    Filter = new ApiEndpointConfigFilter { ResourceGroup = group }
                });
            var (page2, _) = await NewRepository().GetListAsync(
                new GetApiEndpointConfigsRequest
                {
                    Page = 2,
                    PageSize = 2,
                    Filter = new ApiEndpointConfigFilter { ResourceGroup = group }
                });

            count.Should().Be(5);
            page0.Should().HaveCount(2);
            page2.Should().HaveCount(1);
        }

        [Fact]
        public async Task UpdateAsync_ModifiesMatchingDocument()
        {
            var config = NewConfig("svc::Ctrl::Get", "updatable-" + System.Guid.NewGuid().ToString("N"));
            await SeedAsync(config);

            var modified = await NewRepository().UpdateAsync(config.ItemId, true, true, "tester");

            modified.Should().BeTrue();
            var stored = await _fixture.Collection<ApiEndpointConfig>(CollectionName)
                .Find(Builders<ApiEndpointConfig>.Filter.Eq(x => x.ItemId, config.ItemId))
                .FirstAsync();
            stored.IsCaptchaRequired.Should().BeTrue();
            stored.IsMFARequired.Should().BeTrue();
            stored.LastUpdatedBy.Should().Be("tester");
        }

        [Fact]
        public async Task UpdateAsync_WhenNoMatch_ReturnsFalse()
        {
            var modified = await NewRepository().UpdateAsync("does-not-exist", true, false, "tester");

            modified.Should().BeFalse();
        }

        [Fact]
        public async Task BulkUpdateAsync_UpdatesAllMatchingAndReturnsCount()
        {
            var group = "bulk-" + System.Guid.NewGuid().ToString("N");
            var a = NewConfig("svc::A::Get", group);
            var b = NewConfig("svc::B::Get", group);
            await SeedAsync(a, b);

            var count = await NewRepository().BulkUpdateAsync(
                new List<string> { a.ItemId, b.ItemId }, true, false, "bulk-tester");

            count.Should().Be(2);
        }
    }
}
