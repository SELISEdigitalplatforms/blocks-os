using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Configuration.DomainService.DataGateway.Entities;
using Configuration.DomainService.DataGateway.RequestModel;
using Configuration.DomainService.DataGateway.Services;
using Configuration.DomainService.Shared.Services;
using FluentAssertions;
using FluentValidation;
using FluentValidation.Results;
using MongoDB.Bson;
using Moq;
using StackExchange.Redis;
using XUnitTest.TestHelpers;
using XUnitTest.TestSupport;

namespace XUnitTest.Integration
{
    /// <summary>
    /// os SPEC2 R-X-REDIS-TX against a real throwaway Redis (never a shared one):
    /// <c>docker run -d --rm --name os2-test-redis -p 127.0.0.1:16390:6379 redis:7-alpine</c> then
    /// <c>TEST_REDIS=127.0.0.1:16390 dotnet test …</c>. Without TEST_REDIS the test returns at once (the fake-Redis
    /// unit tests still cover the shape).
    /// </summary>
    public class DataGatewayRedisTransactionTests
    {
        [Fact]
        public async Task Save_WritesOneTransaction_ThreeFields_DropsLegacyValueField_NoKeyDelete()
        {
            var endpoint = Environment.GetEnvironmentVariable("TEST_REDIS");
            if (string.IsNullOrWhiteSpace(endpoint)) return;

            await using var mux = await ConnectionMultiplexer.ConnectAsync(endpoint + ",allowAdmin=false");
            var db = mux.GetDatabase();
            var tenant = "os2-it-" + Guid.NewGuid().ToString("N");
            // A legacy hash with the value field, as old data wrote it.
            await db.HashSetAsync(tenant, new[] { new HashEntry("DbConnectionString", "bGVnYWN5"), new HashEntry("DatabaseName", "old") });

            var cache = new Mock<ICacheClient>();
            cache.Setup(c => c.CacheDatabase()).Returns(db);
            var repo = new Mock<IConfigurationRepository>();
            repo.Setup(r => r.GetDataGatewayRootAsync(tenant)).ReturnsAsync(new DataGatewayConfiguration
            {
                ItemId = tenant, ConfigItemId = "cfg", DbConnectionSecretId = "default", DatabaseName = "old", ValueChangedAfterDeploy = true
            });
            repo.Setup(r => r.SetDataGatewayRootFieldsAsync(tenant, It.IsAny<BsonDocument>(), It.IsAny<System.Collections.Generic.IEnumerable<string>?>())).ReturnsAsync(1);
            var validator = new Mock<IValidator<SaveDataGatewayConfigurationRequest>>();
            validator.Setup(v => v.ValidateAsync(It.IsAny<SaveDataGatewayConfigurationRequest>(), It.IsAny<CancellationToken>())).ReturnsAsync(new ValidationResult());
            var service = new DataGatewayConfigurationService(repo.Object, validator.Object, new FakeSecretService(), cache.Object,
                DataGatewayTestSupport.Mode(true), new RecordingLogger<DataGatewayConfigurationService>());

            try
            {
                using var _ = new BlocksTestContext(tenant);
                var response = await service.SaveDataGatewayConfigurationAsync(new SaveDataGatewayConfigurationRequest
                { UpdateRequest = true, ItemId = "cfg", ConnectionString = "default", DatabaseName = "crm" });

                response.IsSuccess.Should().BeTrue();
                var hash = (await db.HashGetAllAsync(tenant)).ToDictionary(e => e.Name.ToString(), e => e.Value.ToString());
                hash.Keys.Should().BeEquivalentTo(new[] { "DbConnectionSecretId", "DatabaseName", "Version" });
                hash["DbConnectionSecretId"].Should().Be("default");
                hash["DatabaseName"].Should().Be("crm");
                Math.Abs(long.Parse(hash["Version"]) - DateTime.UtcNow.Ticks).Should().BeLessThan(TimeSpan.FromMinutes(1).Ticks);
            }
            finally
            {
                await db.KeyDeleteAsync(tenant);
            }
        }
    }
}
