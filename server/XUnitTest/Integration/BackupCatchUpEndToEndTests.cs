using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
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
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Bson;
using MongoDB.Driver;
using Moq;
using Parquet;
using XUnitTest.TestSupport;

namespace XUnitTest.Integration
{
    [CollectionDefinition(Name)]
    public sealed class BackupCatchUpCollection : ICollectionFixture<MongoIntegrationFixture>
    {
        public const string Name = "lmt-backup-catch-up";
    }

    /// <summary>
    /// The catch-up backup end to end: real MongoDB repositories and job store, with only blob
    /// storage and the clock replaced. "Today" is 2026-11-12 and hot retention 30 days, so
    /// 2026-10-12 is the latest day a run may back up and 2026-08-14 the oldest. Each test starts
    /// from empty databases.
    /// </summary>
    [Collection(BackupCatchUpCollection.Name)]
    public class BackupCatchUpEndToEndTests
    {
        private const string TracesDatabase = "Traces";
        private const string LogsDatabase = "Logs";
        private const string BlocksService = "blocks-alpha";
        private const string ManagedService = "SB-beta";

        private static readonly DateTime FirstDay = Day(8, 14);
        private static readonly DateTime D1 = Day(10, 10);
        private static readonly DateTime D2 = Day(10, 11);
        private static readonly DateTime D3 = Day(10, 12);

        private readonly MongoIntegrationFixture _fixture;
        private readonly ManualTimeProvider _clock = new(new DateTimeOffset(2026, 11, 12, 1, 0, 0, TimeSpan.Zero));
        private readonly BackupCallRecorder _recorder = new();
        private readonly RecordingLogger<ArchiveService> _logger = new();
        private readonly Mock<ILmtArchiveRestoreConfigurationRepository> _config = new();
        private readonly Mock<IBlobStorage> _blob = new();
        private readonly ConcurrentDictionary<string, byte[]> _uploads = new();

        public BackupCatchUpEndToEndTests(MongoIntegrationFixture fixture)
        {
            _fixture = fixture;

            foreach (var name in new[] { TracesDatabase, LogsDatabase, "TracesArchive", "LogsArchive", "LogTraceBackupTrack" })
                _fixture.Client.DropDatabase(Database(name).DatabaseNamespace.DatabaseName);

            _config.Setup(r => r.GetLmtArchiveRestoreConfigurationsAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(new LmtArchiveRestoreConfigurations { HotDataRetentionPeriodInDays = 30 });

            _blob.Setup(b => b.SaveAsync(It.IsAny<UploadLogToStorageRequest>()))
                .ReturnsAsync((UploadLogToStorageRequest request) =>
                {
                    using var buffer = new MemoryStream();
                    request.Content.CopyTo(buffer);
                    _uploads[request.FileName] = buffer.ToArray();
                    return $"https://blob.test/{request.FileName}";
                });
        }

        // ── Harness ──────────────────────────────────────────────────────────────

        private static DateTime Day(int month, int day) => new(2026, month, day, 0, 0, 0, DateTimeKind.Utc);

        private IMongoDatabase Database(string name) =>
            _fixture.DbContextProvider.GetDatabase(MongoIntegrationFixture.ConnectionString, name);

        private IMongoCollection<LogTraceBackupJob> Jobs() =>
            Database("LogTraceBackupTrack").GetCollection<LogTraceBackupJob>("LogTraceBackupJobs");

        private ArchiveService Service()
        {
            var secret = new Mock<IBlocksSecret>();
            secret.SetupGet(s => s.TraceConnectionString).Returns(MongoIntegrationFixture.ConnectionString);
            secret.SetupGet(s => s.TraceDatabaseName).Returns(TracesDatabase);
            secret.SetupGet(s => s.LogConnectionString).Returns(MongoIntegrationFixture.ConnectionString);
            secret.SetupGet(s => s.LogDatabaseName).Returns(LogsDatabase);
            var config = new ConfigurationBuilder().Build();

            return new ArchiveService(
                _logger,
                new RecordingLogRepository(
                    new LogRepository(secret.Object, _fixture.DbContextProvider, NullLogger<LogRepository>.Instance, config), _recorder),
                new RecordingTraceRepository(
                    new TraceRepository(secret.Object, _fixture.DbContextProvider, NullLogger<TraceRepository>.Instance, config), _recorder),
                new LogTraceBackupRepository(secret.Object, _fixture.DbContextProvider, NullLogger<LogTraceBackupRepository>.Instance),
                _blob.Object,
                _config.Object,
                _clock);
        }

        /// <summary>Records every day of the window as backed up, except the ones given.</summary>
        private async Task AllDoneExceptAsync(params DateTime[] pending)
        {
            var jobs = new List<LogTraceBackupJob>();
            for (var day = FirstDay; day <= D3; day = day.AddDays(1))
            {
                if (!pending.Contains(day))
                    jobs.Add(NewJob(day, LogTraceBackupJobStatus.Completed));
            }

            await Jobs().InsertManyAsync(jobs);
        }

        private static LogTraceBackupJob NewJob(DateTime day, string status, DateTime? heartbeat = null) => new()
        {
            RunId = Guid.NewGuid().ToString(),
            Status = status,
            DataDateFrom = day,
            DataDateTo = day.AddDays(1),
            StartTime = heartbeat ?? day,
            LastHeartbeatAt = heartbeat ?? day
        };

        private Task AddJobsAsync(DateTime day, string status, int count) =>
            Jobs().InsertManyAsync(Enumerable.Range(0, count).Select(_ => NewJob(day, status)));

        private async Task<List<LogTraceBackupJob>> JobsOfAsync(DateTime day) =>
            await Jobs().Find(j => j.DataDateFrom == day).SortBy(j => j.StartTime).ToListAsync();

        private Task SeedTracesAsync(string tenant, DateTime day, int count) =>
            Database(TracesDatabase).GetCollection<BsonDocument>(tenant).InsertManyAsync(
                Enumerable.Range(0, count).Select(i => TraceDoc($"{tenant}-{day:MMdd}-{i}", day.AddHours(12).AddMilliseconds(i))));

        private Task SeedLogsAsync(string service, string tenant, DateTime day, int count) =>
            Database(LogsDatabase).GetCollection<BsonDocument>(service).InsertManyAsync(
                Enumerable.Range(0, count).Select(i => LogDoc(service, tenant, $"{tenant}-{day:MMdd}-{i}", day.AddHours(12).AddMilliseconds(i))));

        private static BsonDocument TraceDoc(string traceId, DateTime timestamp) => new()
        {
            { "TraceId", traceId }, { "ParentId", "" }, { "OperationName", "op" }, { "ServiceName", "svc" },
            { Constants.Timestamp, timestamp }, { "Duration", 1.0 }
        };

        private static BsonDocument LogDoc(string service, string tenant, string message, DateTime timestamp) => new()
        {
            { "TenantId", tenant }, { Constants.Timestamp, timestamp }, { "Level", "Information" }, { "Message", message },
            { "TraceId", "t1" }, { "SpanId", "s1" }, { "ServiceName", service }
        };

        private Task<long> SourceTracesAsync(string tenant) =>
            Database(TracesDatabase).GetCollection<BsonDocument>(tenant).CountDocumentsAsync(FilterDefinition<BsonDocument>.Empty);

        private Task<long> SourceLogsAsync(string service, string tenant) =>
            Database(LogsDatabase).GetCollection<BsonDocument>(service).CountDocumentsAsync(Builders<BsonDocument>.Filter.Eq("TenantId", tenant));

        private async Task<List<string>> ArchiveCollectionsAsync(string database) =>
            await (await Database(database).ListCollectionNamesAsync()).ToListAsync();

        private static string TraceBlob(string tenant, DateTime day) =>
            $"Tenants/{tenant}/traces/traces_{ArchiveCollectionNaming.Build(tenant, day, day.AddDays(1))}.parquet";

        private static string LogBlob(string tenant, DateTime day) =>
            $"Tenants/{tenant}/logs/logs_{ArchiveCollectionNaming.Build(tenant, day, day.AddDays(1))}.parquet";

        private long RowsIn(string blobPath)
        {
            _uploads.Should().ContainKey(blobPath);
            using var stream = new MemoryStream(_uploads[blobPath]);
            using var reader = ParquetReader.CreateAsync(stream).GetAwaiter().GetResult();
            return Enumerable.Range(0, reader.RowGroupCount).Sum(i => reader.OpenRowGroupReader(i).RowCount);
        }

        // ── 1. Backlog ───────────────────────────────────────────────────────────

        [Fact]
        public async Task Backlog_BacksUpEachPendingDayOldestFirst_IntoTheExistingBlobPaths()
        {
            await AllDoneExceptAsync(D1, D2, D3);
            foreach (var day in new[] { D1, D2, D3 })
            {
                await AddJobsAsync(day, LogTraceBackupJobStatus.Abandoned, 1);
                await SeedTracesAsync("T1", day, 30);
                await SeedTracesAsync("T2", day, 20);
                await SeedLogsAsync(BlocksService, "T1", day, 15);
                await SeedLogsAsync(ManagedService, "T1", day, 5);
                await SeedLogsAsync(ManagedService, "T2", day, 7);
            }

            await Service().StartBackupAsync();

            var created = await Jobs().Find(j => j.Status != LogTraceBackupJobStatus.Abandoned && j.DataDateFrom >= D1)
                .SortBy(j => j.StartTime).ToListAsync();
            created.Select(j => j.DataDateFrom).Should().Equal(D1, D2, D3);
            created.Should().OnlyContain(j => j.Status == LogTraceBackupJobStatus.Completed && j.EndTime != null);
            created.Select(j => j.DataDateTo).Should().Equal(D2, D3, D3.AddDays(1));
            (await Jobs().Find(j => j.Status == LogTraceBackupJobStatus.Running).AnyAsync()).Should().BeFalse();

            foreach (var day in new[] { D1, D2, D3 })
            {
                RowsIn(TraceBlob("T1", day)).Should().Be(30);
                RowsIn(TraceBlob("T2", day)).Should().Be(20);
                RowsIn(LogBlob("T1", day)).Should().Be(20);
                RowsIn(LogBlob("T2", day)).Should().Be(7);
            }

            (await SourceTracesAsync("T1")).Should().Be(0);
            (await SourceTracesAsync("T2")).Should().Be(0);
            (await SourceLogsAsync(BlocksService, "T1")).Should().Be(0);
            (await SourceLogsAsync(ManagedService, "T2")).Should().Be(0);
            (await ArchiveCollectionsAsync("TracesArchive")).Should().BeEmpty();
            (await ArchiveCollectionsAsync("LogsArchive")).Should().BeEmpty();
        }

        // ── 2. Batch and concurrency bounds ──────────────────────────────────────

        [Fact]
        public async Task Bounds_ReadsAtMostAThousandPerBatch_FourUnitsAtOnce_OnePhaseAtATime()
        {
            await AllDoneExceptAsync(D2, D3);
            foreach (var tenant in Enumerable.Range(0, 6).Select(i => $"T{i}"))
            {
                await SeedTracesAsync(tenant, D3, tenant == "T0" ? 2_500 : 50);
                await SeedLogsAsync(BlocksService, tenant, D3, 40);
                await SeedLogsAsync($"blocks-svc{tenant}", tenant, D2, 30);
                await SeedLogsAsync($"SB-svc{tenant}", tenant, D3, 30);
            }

            await Service().StartBackupAsync();

            _recorder.BatchSizes.Should().NotBeEmpty().And.OnlyContain(size => size <= 1000);
            foreach (var phase in new[]
            {
                BackupCallRecorder.TraceArchiving, BackupCallRecorder.BlocksLogArchiving, BackupCallRecorder.ManagedLogArchiving,
                BackupCallRecorder.LogUpload, BackupCallRecorder.TraceUpload
            })
            {
                _recorder.MaxInFlight(phase).Should().BeInRange(1, 4, phase);
            }

            _recorder.Overlaps.Should().BeEmpty("no two phases may run at once");
            RowsIn(TraceBlob("T0", D3)).Should().Be(2_500, "a tenant larger than one batch still lands whole");
        }

        // ── 3 and 4. Leftovers from crashed runs ─────────────────────────────────

        [Fact]
        public async Task PartialLeftover_IsRemovedFirst_SoTheUploadHoldsEachSourceRecordOnce()
        {
            await AllDoneExceptAsync(D3);
            await SeedTracesAsync("T1", D3, 1_500);
            await SeedLogsAsync(BlocksService, "T1", D3, 50);
            await SeedLogsAsync("blocks-gamma", "T1", D3, 30);

            // A crashed run had archived 40 % of T1's traces, and part of one service's logs.
            var collection = ArchiveCollectionNaming.Build("T1", D3, D3.AddDays(1));
            await Database("TracesArchive").GetCollection<StoredTrace>(collection).InsertManyAsync(
                Enumerable.Range(0, 600).Select(i => new StoredTrace { TraceId = $"T1-1012-{i}", TenantId = "T1" }));
            await Database("LogsArchive").GetCollection<StoredLog>(collection).InsertManyAsync(
                Enumerable.Range(0, 20).Select(i => new StoredLog { ServiceName = BlocksService, TenantId = "T1", Message = $"T1-1012-{i}" }));

            await Service().StartBackupAsync();

            RowsIn(TraceBlob("T1", D3)).Should().Be(1_500);
            RowsIn(LogBlob("T1", D3)).Should().Be(80);
            (await JobsOfAsync(D3)).Single().Status.Should().Be(LogTraceBackupJobStatus.Completed);
        }

        [Fact]
        public async Task OnlyCopyLeftover_IsKept_AndUploaded()
        {
            await AllDoneExceptAsync(D3);
            var oldDay = Day(10, 1);
            var collection = ArchiveCollectionNaming.Build("T1", oldDay, oldDay.AddDays(1));
            await Database("TracesArchive").GetCollection<StoredTrace>(collection).InsertManyAsync(
                Enumerable.Range(0, 5).Select(i => new StoredTrace { TraceId = $"old-{i}", TenantId = "T1" }));
            await Database("LogsArchive").GetCollection<StoredLog>(collection).InsertManyAsync(
                Enumerable.Range(0, 4).Select(i => new StoredLog { ServiceName = BlocksService, TenantId = "T1", Message = $"old-{i}" }));
            // The service still has logs of other days and tenants; only T1's window counts.
            await SeedLogsAsync(BlocksService, "T2", oldDay, 3);
            await SeedLogsAsync(BlocksService, "T1", D3, 2);

            await Service().StartBackupAsync();

            RowsIn(TraceBlob("T1", oldDay)).Should().Be(5);
            RowsIn(LogBlob("T1", oldDay)).Should().Be(4);
            (await ArchiveCollectionsAsync("TracesArchive")).Should().NotContain(collection, "it is dropped once uploaded");
        }

        [Fact]
        public async Task CompleteCopyOfADoneDay_WhoseSourceDeleteFailed_IsKept_AndUploaded()
        {
            // 10-05 is done, but its source traces survived a failed delete and its upload failed:
            // the archive copy is complete and nothing will archive that day again.
            await AllDoneExceptAsync(D3);
            var doneDay = Day(10, 5);
            var collection = ArchiveCollectionNaming.Build("T1", doneDay, doneDay.AddDays(1));
            await SeedTracesAsync("T1", doneDay, 7);
            await Database("TracesArchive").GetCollection<StoredTrace>(collection).InsertManyAsync(
                Enumerable.Range(0, 7).Select(i => new StoredTrace { TraceId = $"T1-1005-{i}", TenantId = "T1" }));

            await Service().StartBackupAsync();

            RowsIn(TraceBlob("T1", doneDay)).Should().Be(7);
        }

        // ── 5. Stuck day ─────────────────────────────────────────────────────────

        [Fact]
        public async Task StuckDay_IsSkippedWithItsReason_AndTheNextDaysAreProcessed()
        {
            await AllDoneExceptAsync(D1, D2, D3);
            await AddJobsAsync(D1, LogTraceBackupJobStatus.Abandoned, 3);
            await SeedTracesAsync("T1", D1, 10);
            await SeedTracesAsync("T1", D2, 10);

            await Service().StartBackupAsync();

            var skipped = (await JobsOfAsync(D1)).Where(j => j.Status != LogTraceBackupJobStatus.Abandoned).Should().ContainSingle().Subject;
            skipped.Status.Should().Be(LogTraceBackupJobStatus.Skipped);
            skipped.ErrorReason.Should().Be("Skipped after 3 failed attempts");
            skipped.EndTime.Should().NotBeNull();
            (await JobsOfAsync(D2)).Single().Status.Should().Be(LogTraceBackupJobStatus.Completed);
            (await JobsOfAsync(D3)).Single().Status.Should().Be(LogTraceBackupJobStatus.Completed);
            _uploads.Keys.Should().NotContain(TraceBlob("T1", D1), "a skipped day is not archived");
            (await SourceTracesAsync("T1")).Should().Be(10, "the skipped day's traces stay in place");
        }

        // ── 6. Time budget ───────────────────────────────────────────────────────

        [Fact]
        public async Task TimeBudget_StopsStartingDays_LeavingTheRestPendingWithoutAnAttempt()
        {
            await AllDoneExceptAsync(D1, D2, D3);
            _recorder.OnDayStart = () =>
            {
                _clock.Advance(TimeSpan.FromMinutes(70));
                return Task.CompletedTask;
            };

            await Service().StartBackupAsync();

            (await JobsOfAsync(D1)).Single().Status.Should().Be(LogTraceBackupJobStatus.Completed);
            (await JobsOfAsync(D2)).Single().Status.Should().Be(LogTraceBackupJobStatus.Completed);
            (await JobsOfAsync(D3)).Should().BeEmpty();
        }

        // ── 7. Concurrent trigger ────────────────────────────────────────────────

        [Fact]
        public async Task ConcurrentTrigger_DuringARun_CreatesNoJob()
        {
            await AllDoneExceptAsync(D1, D2, D3);
            var secondTriggerJobs = -1L;
            var days = 0;
            _recorder.OnDayStart = async () =>
            {
                if (++days != 2) return;

                // Day 2 is running and day 1 has been handed over: a second trigger must be refused.
                var before = await Jobs().CountDocumentsAsync(FilterDefinition<LogTraceBackupJob>.Empty);
                await Service().StartBackupAsync();
                secondTriggerJobs = await Jobs().CountDocumentsAsync(FilterDefinition<LogTraceBackupJob>.Empty) - before;
            };

            await Service().StartBackupAsync();

            secondTriggerJobs.Should().Be(0);
            _logger.Entries.Should().Contain(e => e.Message.Contains("A backup run is already active; skipping this trigger."));

            // The handover order itself is pinned by ArchiveServiceCatchUpTests; here both days finish.
            (await JobsOfAsync(D1)).Single().Status.Should().Be(LogTraceBackupJobStatus.Completed);
            (await JobsOfAsync(D2)).Single().Status.Should().Be(LogTraceBackupJobStatus.Completed);
            (await Jobs().Find(j => j.Status == LogTraceBackupJobStatus.Running).AnyAsync()).Should().BeFalse();
        }

        // ── 8. Crash ─────────────────────────────────────────────────────────────

        [Fact]
        public async Task Crash_TheStaleJobIsAbandoned_CountedAsAnAttempt_AndTheDayRedone()
        {
            await AllDoneExceptAsync(D3);
            var crashed = NewJob(D3, LogTraceBackupJobStatus.Running, DateTime.UtcNow.AddHours(-4));
            await Jobs().InsertOneAsync(crashed);
            await SeedTracesAsync("T1", D3, 10);

            await Service().StartBackupAsync();

            var jobs = await JobsOfAsync(D3);
            jobs.Should().HaveCount(2);
            jobs.Single(j => j.RunId == crashed.RunId).Status.Should().Be(LogTraceBackupJobStatus.Abandoned);
            jobs.Single(j => j.RunId != crashed.RunId).Status.Should().Be(LogTraceBackupJobStatus.Completed);
            RowsIn(TraceBlob("T1", D3)).Should().Be(10);

            var pending = BackupDayPlan.PendingDays(Day(11, 12), 30, [jobs.Single(j => j.RunId == crashed.RunId)]);
            pending.Single(d => d.Start == D3).FailedAttempts.Should().Be(1);
        }

        // ── 9. Failures ──────────────────────────────────────────────────────────

        [Fact]
        public async Task ATenantsArchiveFailure_KeepsItsSource_AndEndsTheDayWithErrors()
        {
            await AllDoneExceptAsync(D3);
            await SeedTracesAsync("T1", D3, 10);
            await SeedTracesAsync("T2", D3, 10);
            _recorder.FailTraceArchiveForTenant = "T2";

            await Service().StartBackupAsync();

            (await SourceTracesAsync("T2")).Should().Be(10);
            (await SourceTracesAsync("T1")).Should().Be(0);
            (await JobsOfAsync(D3)).Single().Status.Should().Be(LogTraceBackupJobStatus.CompletedWithErrors);
            (await Database("LogTraceBackupTrack").GetCollection<TraceBackupFileProgress>("TraceBackupFileProgressTracker")
                .Find(p => p.TenantId == "T2" && p.Status == BackupFileStatus.ArchiveFailed).AnyAsync()).Should().BeTrue();
        }

        [Fact]
        public async Task ABlobUploadThatFailsEveryRetry_KeepsTheArchive_AndEndsTheDayWithErrors()
        {
            await AllDoneExceptAsync(D3);
            await SeedTracesAsync("T1", D3, 10);
            _blob.Setup(b => b.SaveAsync(It.IsAny<UploadLogToStorageRequest>()))
                .ThrowsAsync(new InvalidOperationException("blob storage unavailable"));

            await Service().StartBackupAsync();

            _blob.Verify(b => b.SaveAsync(It.IsAny<UploadLogToStorageRequest>()), Times.Exactly(Constants.fileUploadRetries));
            (await ArchiveCollectionsAsync("TracesArchive")).Should().Contain(ArchiveCollectionNaming.Build("T1", D3, D3.AddDays(1)));
            (await JobsOfAsync(D3)).Single().Status.Should().Be(LogTraceBackupJobStatus.CompletedWithErrors);
        }

        [Fact]
        public async Task AReconciliationFailure_LeavesThatCollection_AndTheRunGoesOn()
        {
            await AllDoneExceptAsync(D3);
            var failing = ArchiveCollectionNaming.Build("T9", D3, D3.AddDays(1));
            await Database("LogsArchive").GetCollection<StoredLog>(failing).InsertManyAsync(
                Enumerable.Range(0, 3).Select(i => new StoredLog { ServiceName = BlocksService, TenantId = "T9", Message = $"m{i}" }));
            await SeedTracesAsync("T1", D3, 10);
            _recorder.FailReconciliationOf = failing;

            await Service().StartBackupAsync();

            _logger.Entries.Should().Contain(e => e.Level == LogLevel.Error && e.Message.Contains(failing));
            RowsIn(LogBlob("T9", D3)).Should().Be(3, "the collection was left as it was");
            (await JobsOfAsync(D3)).Single().Status.Should().Be(LogTraceBackupJobStatus.Completed);
            RowsIn(TraceBlob("T1", D3)).Should().Be(10);
        }

        // ── 10. Boundaries ───────────────────────────────────────────────────────

        [Fact]
        public async Task ADayOlderThanTheTtlHorizon_NeverGetsAJob()
        {
            var tooOld = FirstDay.AddDays(-1);
            await AllDoneExceptAsync(D3);
            await AddJobsAsync(tooOld, LogTraceBackupJobStatus.Abandoned, 1);
            await SeedTracesAsync("T1", tooOld, 4);

            await Service().StartBackupAsync();

            (await JobsOfAsync(tooOld)).Should().OnlyContain(j => j.Status == LogTraceBackupJobStatus.Abandoned);
            (await SourceTracesAsync("T1")).Should().Be(4);
            (await JobsOfAsync(D3)).Should().ContainSingle();
        }

        [Fact]
        public async Task MissingConfiguration_ThrowsAsBefore_AndCreatesNoJob()
        {
            _config.Setup(r => r.GetLmtArchiveRestoreConfigurationsAsync(It.IsAny<CancellationToken>()))
                .ThrowsAsync(new InvalidOperationException("LMT configuration is missing."));

            var act = () => Service().StartBackupAsync();

            await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("LMT configuration is missing.");
            (await Jobs().CountDocumentsAsync(FilterDefinition<LogTraceBackupJob>.Empty)).Should().Be(0);
        }

        [Fact]
        public async Task NothingPending_CreatesNoJob_AndSaysSo()
        {
            await AllDoneExceptAsync();
            var before = await Jobs().CountDocumentsAsync(FilterDefinition<LogTraceBackupJob>.Empty);

            await Service().StartBackupAsync();

            (await Jobs().CountDocumentsAsync(FilterDefinition<LogTraceBackupJob>.Empty)).Should().Be(before);
            _logger.Entries.Should().Contain(e => e.Level == LogLevel.Information && e.Message.Contains("no pending backup days"));
        }

        [Fact]
        public async Task MiscellaneousTenantAndIgnoredServices_StayExcluded()
        {
            await AllDoneExceptAsync(D3);
            await SeedTracesAsync(Constants.MiscellaneousCollectionName, D3, 6);
            await SeedLogsAsync(BlocksService, Constants.MiscellaneousCollectionName, D3, 5);
            await SeedLogsAsync(Constants.IgnoredServices[0], "T1", D3, 4);
            await SeedLogsAsync(BlocksService, "T1", D3, 3);

            await Service().StartBackupAsync();

            (await SourceTracesAsync(Constants.MiscellaneousCollectionName)).Should().Be(6);
            (await SourceLogsAsync(BlocksService, Constants.MiscellaneousCollectionName)).Should().Be(5);
            (await SourceLogsAsync(Constants.IgnoredServices[0], "T1")).Should().Be(4);
            _uploads.Keys.Should().NotContain(k => k.Contains(Constants.MiscellaneousCollectionName));
            RowsIn(LogBlob("T1", D3)).Should().Be(3);
        }
    }
}
