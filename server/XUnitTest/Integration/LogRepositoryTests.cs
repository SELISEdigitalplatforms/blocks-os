using System;
using System.Linq;
using System.Threading.Tasks;
using Cloud.LmtService.Models.Logs;
using Cloud.LmtService.Repositories.Logs;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Bson;
using Moq;
using Blocks.Genesis;

namespace XUnitTest.Integration
{
    [Collection(MongoIntegrationCollection.Name)]
    public class LogRepositoryTests
    {
        private readonly MongoIntegrationFixture _fixture;

        public LogRepositoryTests(MongoIntegrationFixture fixture)
        {
            _fixture = fixture;
        }

        private LogRepository NewRepository()
        {
            var secret = new Mock<IBlocksSecret>();
            secret.SetupGet(s => s.LogConnectionString).Returns("mongodb://localhost:27017");
            secret.SetupGet(s => s.LogDatabaseName).Returns(_fixture.DatabaseName);
            var config = new ConfigurationBuilder().Build();
            return new LogRepository(secret.Object, _fixture.DbContextProvider,
                NullLogger<LogRepository>.Instance, config);
        }

        private async Task SeedAsync(string serviceCollection, params BsonDocument[] docs)
        {
            await _fixture.Collection<BsonDocument>(serviceCollection).InsertManyAsync(docs);
        }

        private static BsonDocument Log(string tenantId, DateTime timestamp, string message,
            string level = "Information", string traceId = "t", string spanId = "s")
            => new()
            {
                { "TenantId", tenantId },
                { "Timestamp", timestamp },
                { "Message", message },
                { "Level", level },
                { "TraceId", traceId },
                { "SpanId", spanId }
            };

        [Fact]
        public async Task GetLogs_LiveLogRequest_ReturnsOnlyNewerLogsForTenant()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            var svc = "svc-" + tenant;
            var baseline = DateTime.UtcNow.AddMinutes(-10);
            await SeedAsync(svc,
                Log(tenant, baseline.AddMinutes(-5), "old"),
                Log(tenant, baseline.AddMinutes(5), "new1"),
                Log(tenant, baseline.AddMinutes(6), "new2"),
                Log("other-tenant", baseline.AddMinutes(7), "wrong-tenant"));

            using var _ = new IntegrationContext(tenant);
            var result = await NewRepository().GetLogs(new LiveLogRequest
            {
                Name = svc,
                LastDate = baseline
            });

            var list = result.ToList();
            list.Should().HaveCount(2);
            list.Should().OnlyContain(l => l.Message == "new1" || l.Message == "new2");
            list.First().Message.Should().Be("new2");
        }

        [Fact]
        public async Task GetLogs_GetLogsRequest_FiltersSearchAndLevelAndPaginates()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            var svc = "svc-" + tenant;
            var now = DateTime.UtcNow;
            await SeedAsync(svc,
                Log(tenant, now.AddMinutes(-1), "error alpha", level: "Error"),
                Log(tenant, now.AddMinutes(-2), "error beta", level: "Error"),
                Log(tenant, now.AddMinutes(-3), "info gamma", level: "Information"));

            using var _ = new IntegrationContext(tenant);
            var (logs, count) = await NewRepository().GetLogs(new GetLogsRequest
            {
                ServiceName = svc,
                Search = "error",
                Page = 0,
                PageSize = 10,
                Filter = new GetLogsRequestFilter { Level = "Error" }
            });

            count.Should().Be(2);
            logs.Should().OnlyContain(l => l.Level == "Error");
        }

        [Fact]
        public async Task GetLogs_GetLogsRequest_FiltersByTraceAndSpanAndDateRange()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            var svc = "svc-" + tenant;
            var now = DateTime.UtcNow;
            await SeedAsync(svc,
                Log(tenant, now.AddMinutes(-1), "match", traceId: "tr-1", spanId: "sp-1"),
                Log(tenant, now.AddMinutes(-2), "wrong-trace", traceId: "tr-2", spanId: "sp-1"),
                Log(tenant, now.AddYears(-1), "too-old", traceId: "tr-1", spanId: "sp-1"));

            using var _ = new IntegrationContext(tenant);
            var (logs, count) = await NewRepository().GetLogs(new GetLogsRequest
            {
                ServiceName = svc,
                Page = 0,
                PageSize = 10,
                Filter = new GetLogsRequestFilter
                {
                    TraceId = "tr-1",
                    SpanId = "sp-1",
                    StartDate = now.AddDays(-1),
                    EndDate = now
                }
            });

            count.Should().Be(1);
            logs.Single().Message.Should().Be("match");
        }

        [Fact]
        public async Task GetLogs_LogsByDateRequest_FiltersAndTakesPageSize()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            var svc = "svc-" + tenant;
            var now = DateTime.UtcNow;
            await SeedAsync(svc,
                Log(tenant, now.AddMinutes(-1), "keep one", level: "Warning"),
                Log(tenant, now.AddMinutes(-2), "keep two", level: "Warning"),
                Log(tenant, now.AddMinutes(-3), "keep three", level: "Warning"),
                Log(tenant, now.AddMinutes(-4), "drop info", level: "Information"));

            using var _ = new IntegrationContext(tenant);
            var (logs, count) = await NewRepository().GetLogs(new LogsByDateRequest
            {
                ServiceName = svc,
                Page = 0,
                PageSize = 2,
                Filter = new LogsByLastDateRequestFilter
                {
                    Level = "Warning",
                    StartDate = now.AddMinutes(-10),
                    EndDate = now
                }
            });

            count.Should().Be(3);
            logs.Should().HaveCount(2);
            logs.Should().OnlyContain(l => l.Level == "Warning");
        }

        [Fact]
        public async Task GetLogs_UsesServiceNamesListWhenNameMissing()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            var svcA = "svca-" + tenant;
            var svcB = "svcb-" + tenant;
            var now = DateTime.UtcNow;
            await SeedAsync(svcA, Log(tenant, now.AddMinutes(-1), "from a"));
            await SeedAsync(svcB, Log(tenant, now.AddMinutes(-2), "from b"));

            using var _ = new IntegrationContext(tenant);
            var (logs, count) = await NewRepository().GetLogs(new GetLogsRequest
            {
                ServiceNames = new System.Collections.Generic.List<string> { svcA, svcB },
                Page = 0,
                PageSize = 10
            });

            count.Should().Be(2);
            logs.Should().HaveCount(2);
        }
    }
}
