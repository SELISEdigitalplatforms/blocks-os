using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Cloud.LmtService.Models.Trace;
using Cloud.LmtService.Repositories.Trace;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Bson;
using Moq;
using Blocks.Genesis;

namespace XUnitTest.Integration
{
    [Collection(MongoIntegrationCollection.Name)]
    public class TraceRepositoryTests
    {
        private readonly MongoIntegrationFixture _fixture;

        public TraceRepositoryTests(MongoIntegrationFixture fixture)
        {
            _fixture = fixture;
        }

        private TraceRepository NewRepository()
        {
            var secret = new Mock<IBlocksSecret>();
            secret.SetupGet(s => s.TraceConnectionString).Returns("mongodb://localhost:27017");
            secret.SetupGet(s => s.TraceDatabaseName).Returns(_fixture.DatabaseName);
            var config = new ConfigurationBuilder().Build();
            return new TraceRepository(secret.Object, _fixture.DbContextProvider,
                NullLogger<TraceRepository>.Instance, config);
        }

        private async Task SeedAsync(string tenant, params BsonDocument[] docs)
        {
            await _fixture.Collection<BsonDocument>(tenant).InsertManyAsync(docs);
        }

        private static BsonDocument Trace(
            string traceId,
            string operationName,
            string serviceName,
            DateTime timestamp,
            string? parentId = "",
            int statusCode = 200,
            bool usage = true,
            double duration = 5,
            int throughput = 100)
            => new()
            {
                { "TraceId", traceId },
                { "ParentId", parentId ?? (BsonValue)BsonNull.Value },
                { "OperationName", operationName },
                { "ServiceName", serviceName },
                { "Timestamp", timestamp },
                { "Duration", duration },
                {
                    "Attributes", new BsonDocument
                    {
                        { "response.status.code", statusCode },
                        { "throughput.total.bytes", throughput.ToString() },
                        { "usage", usage }
                    }
                }
            };

        [Fact]
        public async Task GetTraces_Single_ReturnsMatchingTraceById()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            var now = DateTime.UtcNow;
            await SeedAsync(tenant,
                Trace("trace-a", "GET /a", "svc", now, parentId: ""),
                Trace("trace-a", "child", "svc", now, parentId: "trace-a"),
                Trace("trace-b", "GET /b", "svc", now, parentId: ""));

            using var _ = new IntegrationContext(tenant);
            var result = await NewRepository().GetTraces(new GetTraceRequest { TraceId = "trace-a" });

            var list = result.ToList();
            list.Should().HaveCount(2);
            list.Should().OnlyContain(t => t.TraceId == "trace-a");
        }

        [Fact]
        public async Task GetTraces_List_ReturnsOnlyRootSpansWithCount()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            var now = DateTime.UtcNow;
            await SeedAsync(tenant,
                Trace("root-1", "GET /x", "svc", now, parentId: ""),
                Trace("root-2", "GET /y", "svc", now.AddSeconds(-1), parentId: null),
                Trace("child-1", "child", "svc", now, parentId: "root-1"));

            using var _ = new IntegrationContext(tenant);
            var (traces, count) = await NewRepository().GetTraces(new GetTracesRequest
            {
                Page = 0,
                PageSize = 10
            });

            count.Should().Be(2);
            traces.Should().HaveCount(2);
        }

        [Fact]
        public async Task GetTraces_List_FiltersBySearchServicesAndStatusCodes()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            var now = DateTime.UtcNow;
            await SeedAsync(tenant,
                Trace("t-match", "GET /orders", "orders-svc", now, parentId: "", statusCode: 500),
                Trace("t-otherop", "GET /users", "orders-svc", now, parentId: "", statusCode: 500),
                Trace("t-othersvc", "GET /orders", "users-svc", now, parentId: "", statusCode: 500),
                Trace("t-othercode", "GET /orders", "orders-svc", now, parentId: "", statusCode: 200));

            using var _ = new IntegrationContext(tenant);
            var (traces, count) = await NewRepository().GetTraces(new GetTracesRequest
            {
                Page = 0,
                PageSize = 10,
                Search = "orders",
                Filter = new GetTracesRequestFilter
                {
                    Services = new List<string> { "orders-svc" },
                    Excepts = new List<string> { "excluded-svc" },
                    StartDate = now.AddMinutes(-5),
                    EndDate = now.AddMinutes(5),
                    StatusCodes = new List<int> { 500 }
                }
            });

            count.Should().Be(1);
            traces.Single().TraceId.Should().Be("t-match");
        }

        [Fact]
        public async Task GetTraces_List_TreatsUnmarkedFilterDatesAsUtcNotServerLocal()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();

            // Stored timestamps are UTC and callers of this API send UTC. A caller that omits
            // the trailing 'Z' hands the repository a Kind.Unspecified DateTime, which Mongo's
            // default serializer would run through ToUniversalTime() -- reading it as
            // server-local and shifting the whole window by the server's offset.
            var insideUtc = new DateTime(2026, 3, 14, 9, 30, 0, DateTimeKind.Utc);
            var localOffset = TimeZoneInfo.Local.GetUtcOffset(insideUtc);

            // Where the requested window lands if the unmarked dates are (incorrectly) read
            // as server-local: a trace at this instant must NOT come back.
            var shiftedUtc = insideUtc - localOffset;

            await SeedAsync(tenant,
                Trace("t-inside-window", "GET /inside", "tz-svc", insideUtc, parentId: ""),
                Trace("t-shifted-window", "GET /shifted", "tz-svc", shiftedUtc, parentId: ""));

            using var _ = new IntegrationContext(tenant);
            var (traces, count) = await NewRepository().GetTraces(new GetTracesRequest
            {
                Page = 0,
                PageSize = 10,
                Filter = new GetTracesRequestFilter
                {
                    Services = new List<string> { "tz-svc" },
                    StartDate = new DateTime(2026, 3, 14, 9, 25, 0, DateTimeKind.Unspecified),
                    EndDate = new DateTime(2026, 3, 14, 9, 35, 0, DateTimeKind.Unspecified)
                }
            });

            // On a machine whose local offset is zero both candidates are the same instant, so
            // the window legitimately returns both; anywhere else only the UTC reading matches.
            var expected = localOffset == TimeSpan.Zero
                ? new[] { "t-inside-window", "t-shifted-window" }
                : new[] { "t-inside-window" };

            traces.Select(t => t.TraceId).Should().BeEquivalentTo(expected);
            count.Should().Be(expected.Length);
        }

        [Fact]
        public async Task GetServiceAnalytics_AggregatesUsageTaggedTraces()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            var now = DateTime.UtcNow;
            await SeedAsync(tenant,
                Trace("a", "op1", "svc-analytics", now, statusCode: 200, usage: true, duration: 10),
                Trace("b", "op2", "svc-analytics", now, statusCode: 404, usage: true, duration: 20),
                Trace("c", "op3", "svc-analytics", now, statusCode: 500, usage: false, duration: 30));

            using var _ = new IntegrationContext(tenant);
            var result = await NewRepository().GetServiceAnalytics(
                now.AddMinutes(-5), now.AddMinutes(5), "svc-analytics");

            var rows = result.Should().BeAssignableTo<List<Dictionary<string, object>>>().Subject;
            rows.Should().ContainSingle();
            var row = rows.Single();
            Convert.ToInt32(row["TotalRequests"]).Should().Be(2);
            Convert.ToInt32(row["Status2xx"]).Should().Be(1);
            Convert.ToInt32(row["Status4xx"]).Should().Be(1);
        }

        [Fact]
        public async Task GetOperationalAnalytics_GroupsByOperationName()
        {
            var tenant = MongoIntegrationFixture.NewTenantId();
            var now = DateTime.UtcNow;
            await SeedAsync(tenant,
                Trace("a", "shared-op", "ops-svc", now, statusCode: 200, duration: 10),
                Trace("b", "shared-op", "ops-svc", now, statusCode: 500, duration: 30));

            using var _ = new IntegrationContext(tenant);
            var result = await NewRepository().GetOperationalAnalytics(
                now.AddMinutes(-5), now.AddMinutes(5), "ops-svc", "shared");

            var rows = result.Should().BeAssignableTo<List<Dictionary<string, object>>>().Subject;
            rows.Should().ContainSingle();
            var row = rows.Single();
            Convert.ToInt32(row["TotalRequests"]).Should().Be(2);
            Convert.ToInt32(row["Status5xx"]).Should().Be(1);
        }
    }
}
