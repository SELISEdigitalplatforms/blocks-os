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
