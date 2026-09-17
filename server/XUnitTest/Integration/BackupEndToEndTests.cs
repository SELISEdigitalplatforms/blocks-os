using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Blocks.Genesis;
using Cloud.LmtService.Models.ArchiveAndDelete;
using Cloud.LmtService.Models.Shared;
using Cloud.LmtService.Repositories.ArchiveAndDelete;
using Cloud.LmtService.Repositories.LogTraceBackup;
using Cloud.LmtService.Repositories.Logs;
using Cloud.LmtService.Repositories.Shared;
using Cloud.LmtService.Repositories.Trace;
using Cloud.LmtService.Services.ArchiveAndDelete;
using Cloud.LmtService.Utilities;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Bson;
using MongoDB.Driver;
using Moq;
using Parquet;

namespace XUnitTest.Integration
{
    /// <summary>
    /// Drives the whole backup through real MongoDB repositories, with only blob storage and the
    /// progress store stubbed. The Parquet file the job would have uploaded is captured and read
    /// back, so these tests assert on what actually reaches cold storage rather than on call counts.
    /// </summary>
    [Collection(MongoIntegrationCollection.Name)]
    public class BackupEndToEndTests
    {
        private readonly MongoIntegrationFixture _fixture;
        private readonly Mock<ILogTraceBackupRepository> _backupRepository = new();
        private readonly Mock<IBlobStorage> _blobStorage = new();
        private readonly Mock<ILmtArchiveRestoreConfigurationRepository> _configRepository = new();
        private readonly Dictionary<string, byte[]> _uploads = [];

        public BackupEndToEndTests(MongoIntegrationFixture fixture)
        {
            _fixture = fixture;

            _configRepository.Setup(r => r.GetLmtArchiveRestoreConfigurationsAsync())
                .ReturnsAsync(new LmtArchiveRestoreConfigurations { HotDataRetentionPeriodInDays = 0 });
            _backupRepository.Setup(r => r.CreateJobAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>()))
                .ReturnsAsync("run-e2e");
            _backupRepository.Setup(r => r.HasActiveRunAsync()).ReturnsAsync(false);
            _backupRepository.Setup(r => r.GetStaleRunningJobIdsAsync(It.IsAny<TimeSpan>())).ReturnsAsync([]);

            _blobStorage.Setup(b => b.SaveAsync(It.IsAny<UploadLogToStorageRequest>()))
                .ReturnsAsync((UploadLogToStorageRequest request) =>
                {
                    using var buffer = new MemoryStream();
                    request.Content.CopyTo(buffer);
                    _uploads[request.FileName] = buffer.ToArray();
                    return $"https://blob.test/{request.FileName}";
                });
        }

        private ArchiveService Service()
        {
            var secret = new Mock<IBlocksSecret>();
            secret.SetupGet(s => s.TraceConnectionString).Returns("mongodb://localhost:27017");
            secret.SetupGet(s => s.TraceDatabaseName).Returns(_fixture.DatabaseName);
            secret.SetupGet(s => s.LogConnectionString).Returns("mongodb://localhost:27017");
            secret.SetupGet(s => s.LogDatabaseName).Returns(_fixture.DatabaseName);

            var config = new ConfigurationBuilder().Build();

            return new ArchiveService(
                NullLogger<ArchiveService>.Instance,
                new LogRepository(secret.Object, _fixture.DbContextProvider, NullLogger<LogRepository>.Instance, config),
                new TraceRepository(secret.Object, _fixture.DbContextProvider, NullLogger<TraceRepository>.Instance, config),
                new Mock<IArchiveRepository>().Object,
                _backupRepository.Object,
                _blobStorage.Object,
                _configRepository.Object);
        }

        /// <summary>The backup window is yesterday, because HotDataRetentionPeriodInDays is 0.</summary>
        private static DateTime InWindow() => DateTime.UtcNow.Date.AddHours(-12);

        private static long RowCountOf(byte[] parquet)
        {
            using var stream = new MemoryStream(parquet);
            using var reader = ParquetReader.CreateAsync(stream).GetAwaiter().GetResult();
            return Enumerable.Range(0, reader.RowGroupCount)
                .Sum(i => reader.OpenRowGroupReader(i).RowCount);
        }

        [Fact]
        public async Task Backup_ArchivesEveryTraceInTheWindow_NotJustTheFirstBatch()
        {
            var tenant = "e2e" + Guid.NewGuid().ToString("N")[..10];
            var timestamp = InWindow();

            // More than one batch: this is exactly the case the old paged loop destroyed, because
            // it archived one page and then deleted the entire window.
            var traces = Enumerable.Range(0, Constants.TracesBatchSize + 250).Select(i => new BsonDocument
            {
                { "TraceId", $"trace-{i}" },
                { "ParentId", "" },
                { "OperationName", "op" },
                { "ServiceName", "svc" },
                { Constants.Timestamp, timestamp },
                { "Duration", 1.0 }
            }).ToList();

            await _fixture.Collection<BsonDocument>(tenant).InsertManyAsync(traces);

            await Service().StartBackupAsync();

            var upload = _uploads.Should().ContainSingle(u => u.Key.Contains(tenant)).Subject;
            RowCountOf(upload.Value).Should().Be(Constants.TracesBatchSize + 250,
                "every trace in the window must reach the Parquet file, not only the first batch");

            var remaining = await _fixture.Collection<BsonDocument>(tenant)
                .CountDocumentsAsync(Builders<BsonDocument>.Filter.Empty);
            remaining.Should().Be(0, "the window is deleted only once all of it is archived");
        }

        [Fact]
        public async Task Backup_KeepsEachTenantsLogsInTheirOwnFile()
        {
            var service = "blocks-e2e-" + Guid.NewGuid().ToString("N")[..8];
            var tenantA = "ea" + Guid.NewGuid().ToString("N")[..10];
            var tenantB = "eb" + Guid.NewGuid().ToString("N")[..10];
            var timestamp = InWindow();

            var logs = new List<BsonDocument>();
            logs.AddRange(Enumerable.Range(0, 6).Select(i => LogDoc(tenantA, service, $"a{i}", timestamp)));
            logs.AddRange(Enumerable.Range(0, 4).Select(i => LogDoc(tenantB, service, $"b{i}", timestamp)));
            await _fixture.Collection<BsonDocument>(service).InsertManyAsync(logs);

            await Service().StartBackupAsync();

            var uploadA = _uploads.Should().ContainSingle(u => u.Key.Contains(tenantA)).Subject;
            var uploadB = _uploads.Should().ContainSingle(u => u.Key.Contains(tenantB)).Subject;

            RowCountOf(uploadA.Value).Should().Be(6);
            RowCountOf(uploadB.Value).Should().Be(4, "tenant B's logs must not be filed under tenant A");

            var remaining = await _fixture.Collection<BsonDocument>(service)
                .CountDocumentsAsync(Builders<BsonDocument>.Filter.Empty);
            remaining.Should().Be(0);
        }

        [Fact]
        public async Task Backup_WhenBlobUploadFails_KeepsTheArchivedCopy()
        {
            var tenant = "ef" + Guid.NewGuid().ToString("N")[..10];
            var timestamp = InWindow();

            await _fixture.Collection<BsonDocument>(tenant).InsertOneAsync(new BsonDocument
            {
                { "TraceId", "t1" }, { "ParentId", "" }, { "OperationName", "op" },
                { "ServiceName", "svc" }, { Constants.Timestamp, timestamp }, { "Duration", 1.0 }
            });

            _blobStorage.Setup(b => b.SaveAsync(It.IsAny<UploadLogToStorageRequest>()))
                .ThrowsAsync(new InvalidOperationException("blob storage unavailable"));

            await Service().StartBackupAsync();

            // Source traces are gone (they were archived), so the archived copy is the only copy
            // left and must survive a failed upload for the next run to retry.
            var archiveDb = _fixture.DbContextProvider.GetDatabase("mongodb://localhost:27017", "TracesArchive");
            var archiveCollections = await (await archiveDb.ListCollectionNamesAsync()).ToListAsync();
            archiveCollections.Should().Contain(name => name.StartsWith(tenant),
                "a failed upload must not drop the archive collection");
        }

        private static BsonDocument LogDoc(string tenantId, string serviceName, string message, DateTime timestamp) => new()
        {
            { "TenantId", tenantId },
            { Constants.Timestamp, timestamp },
            { "Level", "Information" },
            { "Message", message },
            { "TraceId", "t1" },
            { "SpanId", "s1" },
            { "ServiceName", serviceName },
            { "ActionName", "act" },
            { "EnvironmentName", "env" },
            { "ParentId", "p1" },
            { "RequestPath", "/x" },
            { "Exception", "" },
            { "ParentSpanId", "ps1" }
        };
    }
}
