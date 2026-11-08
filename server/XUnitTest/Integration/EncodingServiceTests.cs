using System;
using System.Threading.Tasks;
using Blocks.Genesis;
using DomainService.Shared;
using DomainService.Shared.Utilities;
using FluentAssertions;
using MongoDB.Driver;
using Moq;

namespace XUnitTest.Integration
{
    [Collection(MongoIntegrationCollection.Name)]
    public class EncodingServiceTests
    {
        private readonly MongoIntegrationFixture _fixture;

        public EncodingServiceTests(MongoIntegrationFixture fixture)
        {
            _fixture = fixture;
        }

        private EncodingService NewService()
        {
            var secret = new Mock<IBlocksSecret>();
            secret.SetupGet(s => s.DatabaseConnectionString).Returns("mongodb://localhost:27017");
            secret.SetupGet(s => s.RootDatabaseName).Returns(_fixture.DatabaseName);
            return new EncodingService(_fixture.DbContextProvider, secret.Object);
        }

        [Fact]
        public async Task EncodeToBase26Async_EmptyInput_ReturnsEmpty()
        {
            var result = await NewService().EncodeToBase26Async("", "grp", 5);

            result.Should().BeEmpty();
        }

        [Fact]
        public async Task EncodeToBase26Async_NumberInput_EncodesTruncatesAndPersists()
        {
            var input = "1234567890";
            var group = "grp-" + Guid.NewGuid().ToString("N");

            var result = await NewService().EncodeToBase26Async(input, group, 5);

            result.Should().NotBeNullOrEmpty();
            result.Length.Should().BeLessThanOrEqualTo(5);
            result.Should().MatchRegex("^[a-z]+$");

            var stored = await _fixture.Collection<BlocksGuid>("BlocksGuids")
                .Find(Builders<BlocksGuid>.Filter.Eq(x => x.OriginalValue, input))
                .FirstOrDefaultAsync();
            stored.Should().NotBeNull();
            stored.TenantGroupId.Should().Be(group);
        }

        [Fact]
        public async Task EncodeToBase26Async_IsIdempotentForSameInput()
        {
            var input = Guid.NewGuid().ToString();
            var svc = NewService();

            var first = await svc.EncodeToBase26Async(input, "grp", 6);
            var second = await svc.EncodeToBase26Async(input, "grp", 6);

            second.Should().Be(first);
            var count = await _fixture.Collection<BlocksGuid>("BlocksGuids")
                .CountDocumentsAsync(Builders<BlocksGuid>.Filter.Eq(x => x.OriginalValue, input));
            count.Should().Be(1);
        }

        [Fact]
        public async Task EncodeToBase26Async_RepositoryIdsWithSamePrefix_GetDistinctStableDomains()
        {
            // These real repository IDs encoded to esbolgs and esboltz, which
            // both became esbol after the old uniqueness check had completed.
            var service = NewService();
            var group = "prefix-collision-" + Guid.NewGuid().ToString("N");
            var one = await service.EncodeToBase26Async("1450238522", group, 5);
            var crm = await service.EncodeToBase26Async("1450239237", group, 5);
            var sales = await service.EncodeToBase26Async("1450238867", group, 5);

            new[] { one, crm, sales }.Should().OnlyHaveUniqueItems();
            foreach (var encoded in new[] { one, crm, sales })
            {
                encoded.Should().MatchRegex("^[a-z]{1,5}$");
            }

            (await service.EncodeToBase26Async("1450238522", group, 5)).Should().Be(one);
            (await service.EncodeToBase26Async("1450238867", group, 5)).Should().Be(sales);
            var stored = await _fixture.Collection<BlocksGuid>("BlocksGuids")
                .Find(x => x.OriginalValue == "1450238867").SingleAsync();
            stored.EncodedValue.Should().Be(sales);
        }

        [Fact]
        public async Task EncodeToBase26Async_GuidsWithSamePrefix_GetDistinctDomains()
        {
            var service = NewService();
            var first = await service.EncodeToBase26Async("80000000-0000-0000-0000-000000000000", "guid-prefix", 5);
            var second = await service.EncodeToBase26Async("80000001-0000-0000-0000-000000000000", "guid-prefix", 5);

            first.Should().NotBe(second);
        }

        [Fact]
        public async Task EncodeToBase26Async_ZeroDoesNotReuseAnOccupiedEncoding()
        {
            var service = NewService();
            var guidEncoding = await service.EncodeToBase26Async(Guid.Empty.ToString(), "zero-collision", 5);
            var numberEncoding = await service.EncodeToBase26Async("0", "zero-collision", 5);

            numberEncoding.Should().NotBe(guidEncoding);
        }

        [Theory]
        [InlineData(0)]
        [InlineData(-1)]
        public async Task EncodeToBase26Async_InvalidLengthIsRejected(int length)
        {
            var action = () => NewService().EncodeToBase26Async("123", "invalid-length", length);

            await action.Should().ThrowAsync<ArgumentOutOfRangeException>();
        }

        [Fact]
        public async Task EncodeToBase26Async_GuidInput_Encodes()
        {
            var input = Guid.NewGuid().ToString();

            var result = await NewService().EncodeToBase26Async(input, "grp", 4);

            result.Should().NotBeNullOrEmpty();
            result.Length.Should().BeLessThanOrEqualTo(4);
            result.Should().MatchRegex("^[a-z]+$");
        }

        [Fact]
        public async Task EncodeToBase26Async_NonNumericNonGuidInput_Encodes()
        {
            var input = "some-random-slug-" + Guid.NewGuid().ToString("N");

            var result = await NewService().EncodeToBase26Async(input, "grp", 8);

            result.Should().NotBeNullOrEmpty();
            result.Should().MatchRegex("^[a-z]+$");
        }
    }
}
