using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Blocks.Genesis;
using Cloud.LmtService.Models.ArchiveAndDelete;
using Cloud.LmtService.Repositories.Logs;
using Cloud.LmtService.Repositories.Trace;
using Cloud.LmtService.Utilities;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Bson;
using MongoDB.Driver;
using Moq;

namespace XUnitTest.Integration
{
    /// <summary>
    /// The backup job reads whole windows of traces and logs. It streams them in batches rather
    /// than paging with Skip, because the old paged reads were interleaved with deletes and lost
    /// everything past the first batch. These tests pin the streaming contract against a real
    /// MongoDB: every matching document is yielded exactly once, and nothing outside the window is.
    /// </summary>
    [Collection(MongoIntegrationCollection.Name)]
    public class BackupStreamingRepositoryTests
    {
        private readonly MongoIntegrationFixture _fixture;

        public BackupStreamingRepositoryTests(MongoIntegrationFixture fixture)
        {
            _fixture = fixture;
        }

        private TraceRepository NewTraceRepository()
        {
            var secret = new Mock<IBlocksSecret>();
            secret.SetupGet(s => s.TraceConnectionString).Returns("mongodb://localhost:27017");
            secret.SetupGet(s => s.TraceDatabaseName).Returns(_fixture.DatabaseName);
            return new TraceRepository(secret.Object, _fixture.DbContextProvider,
                NullLogger<TraceRepository>.Instance, new ConfigurationBuilder().Build());
        }

        private LogRepository NewLogRepository()
        {
            var secret = new Mock<IBlocksSecret>();
            secret.SetupGet(s => s.LogConnectionString).Returns("mongodb://localhost:27017");
            secret.SetupGet(s => s.LogDatabaseName).Returns(_fixture.DatabaseName);
            return new LogRepository(secret.Object, _fixture.DbContextProvider,
                NullLogger<LogRepository>.Instance, new ConfigurationBuilder().Build());
        }

        private static TenantLogsRequest Window(string tenant, DateTime start, DateTime end) => new()
        {
            ProjectKey = tenant,
            Filter = new TenantLogsRequestByFilter { StartDate = start, EndDate = end }
        };

        private async Task SeedTraceAsync(string collection, string traceId, DateTime timestamp)
        {
            await _fixture.Collection<BsonDocument>(collection).InsertOneAsync(new BsonDocument
            {
                { "TraceId", traceId },
                { "ParentId", "" },
                { "OperationName", "op" },
                { "ServiceName", "svc" },
                { Constants.Timestamp, timestamp },
                { "Duration", 1.0 }
            });
        }

        private async Task SeedLogAsync(string collection, string tenantId, string message, DateTime timestamp)
        {
            await _fixture.Collection<BsonDocument>(collection).InsertOneAsync(new BsonDocument
            {
                { "TenantId", tenantId },
                { Constants.Timestamp, timestamp },
                { "Level", "Information" },
                { "Message", message },
                { "TraceId", "t1" },
                { "SpanId", "s1" },
                { "ServiceName", collection },
                { "ActionName", "act" },
                { "EnvironmentName", "env" },
                { "ParentId", "p1" },
                { "RequestPath", "/x" },
                { "Exception", "" },
                { "ParentSpanId", "ps1" }
            });
        }

        [Fact]
        public async Task StreamTracesByCollection_YieldsEveryTraceInWindowExactlyOnce()
        {
            var tenant = "st" + Guid.NewGuid().ToString("N")[..10];
            var now = DateTime.UtcNow;
            var start = now.AddDays(-1);
            var end = now.AddDays(1);

            for (var i = 0; i < 25; i++)
                await SeedTraceAsync(tenant, $"in-{i}", now);

            // Outside the window on both sides - must never be streamed.
            await SeedTraceAsync(tenant, "before", start.AddMinutes(-5));
            await SeedTraceAsync(tenant, "after", end.AddMinutes(5));

            var batches = new List<int>();
            var traceIds = new List<string>();

            await foreach (var batch in NewTraceRepository()
                .StreamTracesByCollectionAsync(tenant, Window(tenant, start, end), batchSize: 10))
            {
                batches.Add(batch.Count);
                traceIds.AddRange(batch.Select(t => t.TraceId));
            }

            // 25 in-window traces stream as two full batches plus a remainder.
            batches.Should().Equal(new[] { 10, 10, 5 });
            traceIds.Should().HaveCount(25).And.OnlyHaveUniqueItems();
            traceIds.Should().NotContain("before").And.NotContain("after");
        }

        [Fact]
        public async Task StreamTracesByCollection_OnEmptyWindow_YieldsNothing()
        {
            var tenant = "se" + Guid.NewGuid().ToString("N")[..10];
            var now = DateTime.UtcNow;
            await SeedTraceAsync(tenant, "old", now.AddDays(-30));

            var batchCount = 0;
            await foreach (var _ in NewTraceRepository()
                .StreamTracesByCollectionAsync(tenant, Window(tenant, now.AddDays(-1), now.AddDays(1)), batchSize: 10))
            {
                batchCount++;
            }

            batchCount.Should().Be(0);
        }

        [Fact]
        public async Task StreamTracesByCollection_WhenCollectionIsUnreadable_Throws()
        {
            // A read failure must stay distinguishable from an empty window, otherwise the caller
            // drops an archive collection it never managed to upload.
            var prefix = "sb" + Guid.NewGuid().ToString("N")[..8];
            var source = $"{prefix}source";
            await SeedTraceAsync(source, "x", DateTime.UtcNow);
            await _fixture.Database.CreateViewAsync($"{prefix}broken", source,
                new EmptyPipelineDefinition<BsonDocument>().AppendStage<BsonDocument, BsonDocument, BsonDocument>(
                    new BsonDocument("$project", new BsonDocument
                    {
                        { Constants.Timestamp, 1 },
                        { "x", new BsonDocument("$divide", new BsonArray { 1, 0 }) }
                    })));

            var now = DateTime.UtcNow;
            var act = async () =>
            {
                await foreach (var _ in NewTraceRepository().StreamTracesByCollectionAsync(
                    $"{prefix}broken", Window($"{prefix}broken", now.AddDays(-1), now.AddDays(1)), 10))
                {
                }
            };

            await act.Should().ThrowAsync<MongoDB.Driver.MongoCommandException>();
        }

        /// <summary>
        /// A repository wired to an unreachable MongoDB, so enumeration genuinely fails rather than
        /// being simulated with a mock.
        /// </summary>
        private static (TraceRepository Traces, LogRepository Logs) UnreachableRepositories()
        {
            var settings = MongoClientSettings.FromConnectionString("mongodb://127.0.0.1:1");
            settings.ServerSelectionTimeout = TimeSpan.FromMilliseconds(400);
            settings.ConnectTimeout = TimeSpan.FromMilliseconds(400);
            var database = new MongoClient(settings).GetDatabase("unreachable");

            var provider = new Mock<IDbContextProvider>();
            provider.Setup(p => p.GetDatabase(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool>()))
                .Returns(database);

            var secret = new Mock<IBlocksSecret>();
            var config = new ConfigurationBuilder().Build();

            return (
                new TraceRepository(secret.Object, provider.Object, NullLogger<TraceRepository>.Instance, config),
                new LogRepository(secret.Object, provider.Object, NullLogger<LogRepository>.Instance, config));
        }

        [Fact]
        public async Task GetDistinctTracesCollectionNames_WhenTheDatabaseIsUnreachable_Throws()
        {
            // Returning an empty list here is indistinguishable from "no traces in this window",
            // which let the backup report success after archiving nothing.
            var now = DateTime.UtcNow;
            var act = async () => await UnreachableRepositories().Traces
                .GetDistinctTracesCollectionNamesAsync(now.AddDays(-1), now);

            await act.Should().ThrowAsync<TimeoutException>();
        }

        [Fact]
        public async Task GetTraceArchiveCollections_WhenTheDatabaseIsUnreachable_Throws()
        {
            // The blob phase drives off this list, and it is also what retries the carryover
            // collections from earlier runs. An empty list on failure silently skips all of it.
            var act = async () => await UnreachableRepositories().Traces.GetArchiveCollectionsAsync();

            await act.Should().ThrowAsync<TimeoutException>();
        }

        [Fact]
        public async Task GetLogArchiveCollections_WhenTheDatabaseIsUnreachable_Throws()
        {
            var act = async () => await UnreachableRepositories().Logs.GetArchiveCollectionsAsync();

            await act.Should().ThrowAsync<TimeoutException>();
        }

        [Fact]
        public async Task GetDistinctBlocksServiceNames_WhenTheDatabaseIsUnreachable_Throws()
        {
            var now = DateTime.UtcNow;
            var act = async () => await UnreachableRepositories().Logs
                .GetDistinctBlocksServiceNamesAsync(now.AddDays(-1), now);

            await act.Should().ThrowAsync<TimeoutException>();
        }

        [Fact]
        public async Task StreamBlocksServiceLogs_YieldsEveryTenantsLogsInWindow()
        {
            var service = "blocks-" + Guid.NewGuid().ToString("N")[..10];
            var now = DateTime.UtcNow;
            var tenantA = "tenantA" + Guid.NewGuid().ToString("N")[..6];
            var tenantB = "tenantB" + Guid.NewGuid().ToString("N")[..6];

            for (var i = 0; i < 12; i++) await SeedLogAsync(service, tenantA, $"a{i}", now);
            for (var i = 0; i < 8; i++) await SeedLogAsync(service, tenantB, $"b{i}", now);

            var all = new List<StoredLog>();
            await foreach (var batch in NewLogRepository().StreamBlocksServiceLogsAsync(
                service, Window(string.Empty, now.AddDays(-1), now.AddDays(1)), batchSize: 7))
            {
                all.AddRange(batch);
            }

            all.Should().HaveCount(20);
            all.Count(l => l.TenantId == tenantA).Should().Be(12);
            all.Count(l => l.TenantId == tenantB).Should().Be(8);
        }

        [Fact]
        public async Task StreamManagedServiceLogs_CarriesTheFullLogPayload()
        {
            // The managed-service read used a narrower projection than the blocks-service read, so
            // six fields were archived blank. Both paths must capture the same payload.
            var service = "managed-" + Guid.NewGuid().ToString("N")[..10];
            var now = DateTime.UtcNow;
            await SeedLogAsync(service, "tenant-x", "hello", now);

            var all = new List<StoredLog>();
            await foreach (var batch in NewLogRepository().StreamManagedServiceLogsAsync(
                service, Window(string.Empty, now.AddDays(-1), now.AddDays(1)), batchSize: 10))
            {
                all.AddRange(batch);
            }

            var log = all.Should().ContainSingle().Subject;
            log.TenantId.Should().Be("tenant-x");
            log.Message.Should().Be("hello");
            log.ActionName.Should().Be("act");
            log.EnvironmentName.Should().Be("env");
            log.RequestPath.Should().Be("/x");
            log.ParentSpanId.Should().Be("ps1");
        }
    }
}
