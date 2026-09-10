using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Blocks.Genesis;
using Cloud.LmtService.Models.ColdRestore;
using Cloud.LmtService.Models.Logs;
using Cloud.LmtService.Models.Trace;
using Cloud.LmtService.Repositories.ColdRestore;
using Cloud.LmtService.Repositories.Shared;
using Cloud.LmtService.Models.Shared;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Driver;
using Moq;

namespace XUnitTest.Integration
{
    /// <summary>
    /// Reads over the per-request result collections a restore writes. The Logs page queries these
    /// the same way the Tracing page does, so the service filter, the row's service name and the
    /// paging offset all have to behave the way the hot log endpoints behave.
    /// </summary>
    [Collection(MongoIntegrationCollection.Name)]
    public class LogTraceRestoreResultRepositoryTests : IDisposable
    {
        private const string RestoreDatabaseName = "LogTraceRestore";
        private const string ConnectionString = "mongodb://localhost:27017";

        private readonly MongoIntegrationFixture _fixture;
        private readonly string _tenant;

        public LogTraceRestoreResultRepositoryTests(MongoIntegrationFixture fixture)
        {
            _fixture = fixture;
            _tenant = MongoIntegrationFixture.NewTenantId();

            BlocksContext.SetContext(BlocksContext.Create(
                tenantId: _tenant,
                roles: [],
                userId: "user-1",
                isAuthenticated: true,
                requestUri: "/",
                organizationId: "org-1",
                expireOn: DateTime.UtcNow.AddHours(1),
                email: "user@example.com",
                permissions: [],
                userName: "user",
                phoneNumber: null,
                displayName: "User",
                oauthToken: null,
                originalTenantId: _tenant));
        }

        public void Dispose()
        {
            BlocksContext.ClearContext();
            GC.SuppressFinalize(this);
        }

        private LogTraceRestoreResultRepository NewRepository()
        {
            var secret = new Mock<IBlocksSecret>();
            secret.SetupGet(s => s.TraceConnectionString).Returns(ConnectionString);

            var configRepository = new Mock<ILmtArchiveRestoreConfigurationRepository>();
            configRepository
                .Setup(r => r.GetLmtArchiveRestoreConfigurationsAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(new LmtArchiveRestoreConfigurations { RetentionDay = 7 });

            return new LogTraceRestoreResultRepository(
                secret.Object,
                _fixture.DbContextProvider,
                NullLogger<LogTraceRestoreResultRepository>.Instance,
                configRepository.Object,
                new ConfigurationBuilder().Build());
        }

        /// <summary>
        /// The repository resolves its own database by name, so a test has to seed through the same
        /// provider call rather than the fixture's primary database.
        /// </summary>
        private IMongoDatabase RestoreDatabase() =>
            _fixture.DbContextProvider.GetDatabase(ConnectionString, RestoreDatabaseName);

        private async Task SeedLogsAsync(string requestId, params RestoreLogResultRecord[] rows) =>
            await RestoreDatabase()
                .GetCollection<RestoreLogResultRecord>($"Logs_{requestId}")
                .InsertManyAsync(rows);

        private async Task SeedTracesAsync(string requestId, params RestoreTraceResultRecord[] rows) =>
            await RestoreDatabase()
                .GetCollection<RestoreTraceResultRecord>($"Trace_{requestId}")
                .InsertManyAsync(rows);

        private RestoreLogResultRecord Log(
            string requestId,
            DateTime timestamp,
            string message,
            string serviceName = "blocks-iam-api",
            string level = "Information",
            string? tenantId = null) => new()
            {
                RequestId = requestId,
                TenantId = tenantId ?? _tenant,
                SourceDate = timestamp.Date,
                Timestamp = timestamp,
                Level = level,
                Message = message,
                TraceId = "trace-" + message,
                SpanId = "span-" + message,
                ServiceName = serviceName,
                ExpireAt = DateTime.UtcNow.AddDays(7)
            };

        private RestoreTraceResultRecord Trace(
            string requestId,
            DateTime timestamp,
            string operationName,
            string serviceName = "blocks-iam-api") => new()
            {
                RequestId = requestId,
                TenantId = _tenant,
                SourceDate = timestamp.Date,
                Timestamp = timestamp,
                TraceId = "trace-" + operationName,
                OperationName = operationName,
                ServiceName = serviceName,
                ParentId = string.Empty,
                ExpireAt = DateTime.UtcNow.AddDays(7)
            };

        private static GetRestoredLogsRequest LogsRequest(
            string requestId,
            int page = 0,
            int pageSize = 20,
            List<string>? serviceNames = null,
            string? serviceName = null,
            GetLogsRequestFilter? filter = null) => new()
            {
                RequestId = requestId,
                Page = page,
                PageSize = pageSize,
                ServiceNames = serviceNames ?? [],
                ServiceName = serviceName,
                Filter = filter
            };

        private static readonly DateTime Aug3 = new(2026, 8, 3, 9, 12, 41, DateTimeKind.Utc);

        [Fact]
        public async Task GetRestoredLogsAsync_ReturnsOnlyTheSelectedServices()
        {
            var requestId = Guid.NewGuid().ToString("N");
            await SeedLogsAsync(requestId,
                Log(requestId, Aug3, "iam-row", "blocks-iam-api"),
                Log(requestId, Aug3.AddSeconds(-1), "mail-row", "blocks-mail-api"),
                Log(requestId, Aug3.AddSeconds(-2), "storage-row", "blocks-storage-api"));

            var (rows, total) = await NewRepository().GetRestoredLogsAsync(
                LogsRequest(requestId, serviceNames: ["blocks-iam-api", "blocks-storage-api"]));

            rows.Select(r => r.Message).Should().BeEquivalentTo(["iam-row", "storage-row"]);
            total.Should().Be(2);
        }

        [Fact]
        public async Task GetRestoredLogsAsync_ReturnsEveryService_WhenNoServiceIsSelected()
        {
            var requestId = Guid.NewGuid().ToString("N");
            await SeedLogsAsync(requestId,
                Log(requestId, Aug3, "iam-row", "blocks-iam-api"),
                Log(requestId, Aug3.AddSeconds(-1), "mail-row", "blocks-mail-api"));

            var (rows, total) = await NewRepository().GetRestoredLogsAsync(LogsRequest(requestId));

            rows.Should().HaveCount(2);
            total.Should().Be(2);
        }

        /// <summary>
        /// The trace detail view still sends a single ServiceName, so the list form must not
        /// replace it.
        /// </summary>
        [Fact]
        public async Task GetRestoredLogsAsync_StillHonoursTheSingleServiceName()
        {
            var requestId = Guid.NewGuid().ToString("N");
            await SeedLogsAsync(requestId,
                Log(requestId, Aug3, "iam-row", "blocks-iam-api"),
                Log(requestId, Aug3.AddSeconds(-1), "mail-row", "blocks-mail-api"));

            var (rows, _) = await NewRepository().GetRestoredLogsAsync(
                LogsRequest(requestId, serviceName: "blocks-mail-api"));

            rows.Select(r => r.Message).Should().BeEquivalentTo(["mail-row"]);
        }

        /// <summary>
        /// Without this the restored list renders every row with a blank service badge, because the
        /// projection dropped the field the row was filtered on.
        /// </summary>
        [Fact]
        public async Task GetRestoredLogsAsync_CarriesTheServiceNameOfEachRow()
        {
            var requestId = Guid.NewGuid().ToString("N");
            await SeedLogsAsync(requestId, Log(requestId, Aug3, "iam-row", "blocks-iam-api"));

            var (rows, _) = await NewRepository().GetRestoredLogsAsync(LogsRequest(requestId));

            rows.Single().ServiceName.Should().Be("blocks-iam-api");
        }

        /// <summary>
        /// Pages are 0-based everywhere else in the platform (the hot log and trace repositories
        /// both skip <c>page * pageSize</c>), and the client's pager counts from 0. Treating page 0
        /// and page 1 as the same page hides a row and makes the last page unreachable.
        /// </summary>
        [Fact]
        public async Task GetRestoredLogsAsync_PagesFromZero()
        {
            var requestId = Guid.NewGuid().ToString("N");
            await SeedLogsAsync(requestId,
                Log(requestId, Aug3, "newest"),
                Log(requestId, Aug3.AddSeconds(-1), "middle"),
                Log(requestId, Aug3.AddSeconds(-2), "oldest"));

            var repository = NewRepository();

            var (firstPage, total) = await repository.GetRestoredLogsAsync(LogsRequest(requestId, page: 0, pageSize: 1));
            var (secondPage, _) = await repository.GetRestoredLogsAsync(LogsRequest(requestId, page: 1, pageSize: 1));
            var (thirdPage, _) = await repository.GetRestoredLogsAsync(LogsRequest(requestId, page: 2, pageSize: 1));

            total.Should().Be(3);
            firstPage.Single().Message.Should().Be("newest");
            secondPage.Single().Message.Should().Be("middle");
            thirdPage.Single().Message.Should().Be("oldest");
        }

        [Fact]
        public async Task GetRestoredTracesAsync_PagesFromZero()
        {
            var requestId = Guid.NewGuid().ToString("N");
            await SeedTracesAsync(requestId,
                Trace(requestId, Aug3, "newest"),
                Trace(requestId, Aug3.AddSeconds(-1), "middle"),
                Trace(requestId, Aug3.AddSeconds(-2), "oldest"));

            var repository = NewRepository();

            var (firstPage, total) = await repository.GetRestoredTracesAsync(
                new GetRestoredTracesRequest { RequestId = requestId, Page = 0, PageSize = 1 });
            var (secondPage, _) = await repository.GetRestoredTracesAsync(
                new GetRestoredTracesRequest { RequestId = requestId, Page = 1, PageSize = 1 });

            total.Should().Be(3);
            firstPage.Single().OperationName.Should().Be("newest");
            secondPage.Single().OperationName.Should().Be("middle");
        }

        /// <summary>
        /// A negative page can arrive from a hand-edited URL; it must read the first page rather
        /// than throw a negative skip at Mongo.
        /// </summary>
        [Fact]
        public async Task GetRestoredLogsAsync_TreatsANegativePageAsTheFirstPage()
        {
            var requestId = Guid.NewGuid().ToString("N");
            await SeedLogsAsync(requestId, Log(requestId, Aug3, "newest"), Log(requestId, Aug3.AddSeconds(-1), "middle"));

            var (rows, _) = await NewRepository().GetRestoredLogsAsync(LogsRequest(requestId, page: -3, pageSize: 1));

            rows.Single().Message.Should().Be("newest");
        }

        [Fact]
        public async Task GetRestoredLogsAsync_NeverReturnsAnotherTenantsRows()
        {
            var requestId = Guid.NewGuid().ToString("N");
            await SeedLogsAsync(requestId,
                Log(requestId, Aug3, "mine"),
                Log(requestId, Aug3.AddSeconds(-1), "theirs", tenantId: MongoIntegrationFixture.NewTenantId()));

            var (rows, total) = await NewRepository().GetRestoredLogsAsync(LogsRequest(requestId));

            rows.Select(r => r.Message).Should().BeEquivalentTo(["mine"]);
            total.Should().Be(1);
        }

        [Fact]
        public async Task GetRestoredLogsAsync_ReturnsNothing_WhenTheRequestHasNoRestoredLogs()
        {
            var (rows, total) = await NewRepository().GetRestoredLogsAsync(
                LogsRequest(Guid.NewGuid().ToString("N")));

            rows.Should().BeEmpty();
            total.Should().Be(0);
        }

        [Fact]
        public async Task GetRestoredLogsAsync_NarrowsToTheRequestedTimeWindow()
        {
            var requestId = Guid.NewGuid().ToString("N");
            await SeedLogsAsync(requestId,
                Log(requestId, Aug3, "inside"),
                Log(requestId, Aug3.AddDays(2), "after"));

            var (rows, _) = await NewRepository().GetRestoredLogsAsync(LogsRequest(
                requestId,
                filter: new GetLogsRequestFilter
                {
                    StartDate = Aug3.AddHours(-1),
                    EndDate = Aug3.AddHours(1)
                }));

            rows.Select(r => r.Message).Should().BeEquivalentTo(["inside"]);
        }
    }
}
