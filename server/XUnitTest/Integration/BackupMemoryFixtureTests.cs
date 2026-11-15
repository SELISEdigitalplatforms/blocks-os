using System;
using System.Diagnostics;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Cloud.LmtService.Models.ArchiveAndDelete;
using Cloud.LmtService.Models.LogTraceBackup;
using Cloud.LmtService.Models.Shared;
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
using Xunit.Abstractions;
using XUnitTest.TestSupport;

namespace XUnitTest.Integration
{
    /// <summary>
    /// Runs with no other test in parallel, so the process working set reflects the backup alone.
    /// </summary>
    [CollectionDefinition(Name, DisableParallelization = true)]
    public sealed class BackupMemoryCollection : ICollectionFixture<MongoIntegrationFixture>
    {
        public const string Name = "lmt-backup-memory";
    }

    /// <summary>
    /// The worker is OOM-killed under a 1 GiB limit because the backup used to hold up to 24
    /// batches of 10,000 documents at once. This backs up one tenant-day of large records - 50,000
    /// traces and 50,000 logs of about 20 KB across three services, about 2 GB in all - and checks
    /// that the process grows by no more than 1 GiB while doing it.
    /// </summary>
    [Collection(BackupMemoryCollection.Name)]
    public class BackupMemoryFixtureTests
    {
        private const long OneGiB = 1024L * 1024 * 1024;
        private const int RecordsPerKind = 50_000;
        private const int SeedChunk = 500;

        private static readonly DateTime Day = new(2026, 10, 12, 0, 0, 0, DateTimeKind.Utc);

        private readonly MongoIntegrationFixture _fixture;
        private readonly ITestOutputHelper _output;

        public BackupMemoryFixtureTests(MongoIntegrationFixture fixture, ITestOutputHelper output)
        {
            _fixture = fixture;
            _output = output;
        }

        private IMongoDatabase Database(string name) =>
            _fixture.DbContextProvider.GetDatabase(MongoIntegrationFixture.ConnectionString, name);

        [Fact]
        public async Task LargeRecords_PeakWorkingSetGrowthStaysWithinOneGiB()
        {
            const string tenant = "memtenant";
            string[] services = ["blocks-mem-a", "blocks-mem-b", "SB-mem-c"];
            var payload = new string('x', 20 * 1024);

            for (var chunk = 0; chunk < RecordsPerKind / SeedChunk; chunk++)
            {
                var timestamp = Day.AddHours(12).AddSeconds(chunk);
                var serviceName = services[chunk % services.Length];

                await Database("Traces").GetCollection<BsonDocument>(tenant).InsertManyAsync(
                    Enumerable.Range(0, SeedChunk).Select(i => new BsonDocument
                    {
                        { "TraceId", $"t{chunk}-{i}" }, { "ParentId", "" }, { "OperationName", "op" }, { "ServiceName", "svc" },
                        { Constants.Timestamp, timestamp }, { "Duration", 1.0 }, { "Attributes", new BsonDocument("payload", payload) }
                    }));
                await Database("Logs").GetCollection<BsonDocument>(serviceName).InsertManyAsync(
                    Enumerable.Range(0, SeedChunk).Select(i => new BsonDocument
                    {
                        { "TenantId", tenant }, { Constants.Timestamp, timestamp }, { "Level", "Information" }, { "Message", payload },
                        { "TraceId", $"t{chunk}-{i}" }, { "SpanId", "s1" }, { "ServiceName", serviceName }
                    }));
            }

            // Every other day of the catch-up window is done, so the run backs up this one day.
            var jobs = Database("LogTraceBackupTrack").GetCollection<LogTraceBackupJob>("LogTraceBackupJobs");
            await jobs.InsertManyAsync(Enumerable.Range(0, 59).Select(i => new LogTraceBackupJob
            {
                RunId = Guid.NewGuid().ToString(),
                Status = LogTraceBackupJobStatus.Completed,
                DataDateFrom = Day.AddDays(-59 + i),
                DataDateTo = Day.AddDays(-58 + i)
            }));

            var recorder = new BackupCallRecorder();
            var uploadedFiles = 0L;
            var service = Service(recorder, () => Interlocked.Increment(ref uploadedFiles));

            var (growth, elapsed) = await MeasurePeakGrowthAsync(service.StartBackupAsync);

            _output.WriteLine($"Peak working-set growth {growth / 1048576.0:F1} MiB in {elapsed.TotalSeconds:F1} s");

            growth.Should().BeLessThanOrEqualTo(OneGiB);
            recorder.BatchSizes.Should().NotBeEmpty().And.OnlyContain(size => size <= Constants.BackupBatchSize);
            Interlocked.Read(ref uploadedFiles).Should().Be(2, "one trace file and one log file for the tenant-day");
            (await jobs.Find(j => j.DataDateFrom == Day).SingleAsync()).Status.Should().Be(LogTraceBackupJobStatus.Completed);
        }

        private ArchiveService Service(BackupCallRecorder recorder, Action onUpload)
        {
            var secret = new Mock<IBlocksSecret>();
            secret.SetupGet(s => s.TraceConnectionString).Returns(MongoIntegrationFixture.ConnectionString);
            secret.SetupGet(s => s.TraceDatabaseName).Returns("Traces");
            secret.SetupGet(s => s.LogConnectionString).Returns(MongoIntegrationFixture.ConnectionString);
            secret.SetupGet(s => s.LogDatabaseName).Returns("Logs");
            var config = new ConfigurationBuilder().Build();

            var configRepository = new Mock<ILmtArchiveRestoreConfigurationRepository>();
            configRepository.Setup(r => r.GetLmtArchiveRestoreConfigurationsAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(new LmtArchiveRestoreConfigurations { HotDataRetentionPeriodInDays = 30 });

            // Drains the upload without keeping it, so the file itself does not count against the run.
            var blob = new Mock<IBlobStorage>();
            blob.Setup(b => b.SaveAsync(It.IsAny<UploadLogToStorageRequest>()))
                .ReturnsAsync((UploadLogToStorageRequest request) =>
                {
                    request.Content.CopyTo(System.IO.Stream.Null);
                    onUpload();
                    return $"https://blob.test/{request.FileName}";
                });

            return new ArchiveService(
                NullLogger<ArchiveService>.Instance,
                new RecordingLogRepository(
                    new LogRepository(secret.Object, _fixture.DbContextProvider, NullLogger<LogRepository>.Instance, config), recorder),
                new RecordingTraceRepository(
                    new TraceRepository(secret.Object, _fixture.DbContextProvider, NullLogger<TraceRepository>.Instance, config), recorder),
                new LogTraceBackupRepository(secret.Object, _fixture.DbContextProvider, NullLogger<LogTraceBackupRepository>.Instance),
                blob.Object,
                configRepository.Object,
                new ManualTimeProvider(new DateTimeOffset(2026, 11, 12, 1, 0, 0, TimeSpan.Zero)));
        }

        /// <summary>
        /// Samples the process working set every 10 ms on a dedicated thread while the action runs,
        /// and returns its peak rise above the level after a full collection beforehand.
        /// </summary>
        private static async Task<(long Growth, TimeSpan Elapsed)> MeasurePeakGrowthAsync(Func<Task> action)
        {
            GC.Collect();
            GC.WaitForPendingFinalizers();
            GC.Collect();

            using var process = Process.GetCurrentProcess();
            process.Refresh();
            var start = process.WorkingSet64;
            var peak = start;
            using var stopped = new ManualResetEventSlim();

            var sampler = new Thread(() =>
            {
                do
                {
                    process.Refresh();
                    peak = Math.Max(peak, process.WorkingSet64);
                }
                while (!stopped.Wait(10));
            }) { IsBackground = true };
            sampler.Start();

            var stopwatch = Stopwatch.StartNew();
            try
            {
                await action();
            }
            finally
            {
                stopwatch.Stop();
                stopped.Set();
                sampler.Join();
            }

            return (peak - start, stopwatch.Elapsed);
        }
    }
}
