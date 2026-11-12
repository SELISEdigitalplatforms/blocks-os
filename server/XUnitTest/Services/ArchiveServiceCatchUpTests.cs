using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
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
using Microsoft.Extensions.Logging;
using Moq;
using XUnitTest.TestSupport;

namespace XUnitTest.Services
{
    /// <summary>
    /// The nightly backup catches up every day it still owes, one day and one phase at a time, in
    /// bounded batches. "Today" is 2026-11-12 with 30 days of hot retention, so 2026-10-12 is the
    /// latest day a run may back up and 2026-08-14 the oldest.
    /// </summary>
    public class ArchiveServiceCatchUpTests
    {
        private static readonly DateTime FirstDay = new(2026, 8, 14, 0, 0, 0, DateTimeKind.Utc);
        private static readonly DateTime LastDay = new(2026, 10, 12, 0, 0, 0, DateTimeKind.Utc);

        private readonly Mock<ILogRepository> _logs = new();
        private readonly Mock<ITraceRepository> _traces = new();
        private readonly Mock<ILogTraceBackupRepository> _jobs = new();
        private readonly Mock<IBlobStorage> _blob = new();
        private readonly Mock<ILmtArchiveRestoreConfigurationRepository> _config = new();
        private readonly RecordingLogger<ArchiveService> _logger = new();
        private readonly ManualTimeProvider _clock = new(new DateTimeOffset(2026, 11, 12, 1, 0, 0, TimeSpan.Zero));

        /// <summary>The jobs already recorded, as the repository would return them.</summary>
        private readonly List<LogTraceBackupJob> _history = [];

        /// <summary>Job and phase calls in the order the service made them.</summary>
        private readonly ConcurrentQueue<string> _events = new();

        public ArchiveServiceCatchUpTests()
        {
            _config.Setup(r => r.GetLmtArchiveRestoreConfigurationsAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(new LmtArchiveRestoreConfigurations { HotDataRetentionPeriodInDays = 30 });

            _jobs.Setup(r => r.GetStaleRunningJobIdsAsync(It.IsAny<TimeSpan>())).ReturnsAsync([]);
            _jobs.Setup(r => r.HasActiveRunAsync()).ReturnsAsync(false);
            _jobs.Setup(r => r.GetJobsForDaysAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>()))
                .ReturnsAsync(() => _history.ToList());
            _jobs.Setup(r => r.CreateJobAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>()))
                .ReturnsAsync((DateTime from, DateTime _) => RunIdOf(from))
                .Callback((DateTime from, DateTime _) => _events.Enqueue($"Create:{RunIdOf(from)}"));
            _jobs.Setup(r => r.CompleteJobAsync(It.IsAny<string>()))
                .Callback((string runId) => _events.Enqueue($"Complete:{runId}"))
                .Returns(Task.CompletedTask);
            _jobs.Setup(r => r.CreateSkippedJobAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<string>()))
                .Callback((DateTime from, DateTime _, string _) => _events.Enqueue($"Skip:{RunIdOf(from)}"))
                .Returns(Task.CompletedTask);

            _traces.Setup(r => r.GetDistinctTracesCollectionNamesAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>()))
                .Callback(() => _events.Enqueue("Phase:traces"))
                .ReturnsAsync([]);
            _logs.Setup(r => r.GetDistinctBlocksServiceNamesAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>()))
                .Callback(() => _events.Enqueue("Phase:blocks-logs"))
                .ReturnsAsync([]);
            _logs.Setup(r => r.GetDistinctManagedServiceNamesAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>()))
                .Callback(() => _events.Enqueue("Phase:managed-logs"))
                .ReturnsAsync([]);
            _logs.Setup(r => r.GetArchiveCollectionsAsync()).ReturnsAsync([]);
            _traces.Setup(r => r.GetArchiveCollectionsAsync()).ReturnsAsync([]);
            _logs.Setup(r => r.GetArchivedServiceNamesAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync([]);
        }

        private ArchiveService Service() => new(
            _logger, _logs.Object, _traces.Object, _jobs.Object, _blob.Object, _config.Object, _clock);

        private static DateTime Day(int month, int day) => new(2026, month, day, 0, 0, 0, DateTimeKind.Utc);

        private static string RunIdOf(DateTime day) => $"run-{day:MMdd}";

        /// <summary>Marks every day of the window backed up except the ones given.</summary>
        private void AllDoneExcept(params DateTime[] pending)
        {
            for (var day = FirstDay; day <= LastDay; day = day.AddDays(1))
            {
                if (!pending.Contains(day))
                    _history.Add(new LogTraceBackupJob { DataDateFrom = day, Status = LogTraceBackupJobStatus.Completed });
            }
        }

        private void AddJobs(DateTime day, string status, int count)
        {
            for (var i = 0; i < count; i++)
                _history.Add(new LogTraceBackupJob { DataDateFrom = day, Status = status });
        }

        private static async IAsyncEnumerable<List<T>> Batches<T>(params List<T>[] batches)
        {
            foreach (var batch in batches)
            {
                await Task.Yield();
                yield return batch;
            }
        }

        private List<string> Events(string prefix) => _events.Where(e => e.StartsWith(prefix, StringComparison.Ordinal)).ToList();

        // ── Which days, in which order ───────────────────────────────────────────

        [Fact]
        public async Task StartBackup_ProcessesEveryPendingDayOldestFirst_OneJobPerDay()
        {
            AllDoneExcept(Day(10, 10), Day(10, 11), Day(10, 12));
            AddJobs(Day(10, 10), LogTraceBackupJobStatus.Abandoned, 1);
            AddJobs(Day(10, 11), LogTraceBackupJobStatus.Abandoned, 1);
            AddJobs(Day(10, 12), LogTraceBackupJobStatus.Abandoned, 1);

            await Service().StartBackupAsync();

            Events("Create").Should().Equal("Create:run-1010", "Create:run-1011", "Create:run-1012");
            _jobs.Verify(r => r.CreateJobAsync(Day(10, 10), Day(10, 11)), Times.Once);
            _jobs.Verify(r => r.CreateJobAsync(Day(10, 11), Day(10, 12)), Times.Once);
            _jobs.Verify(r => r.CreateJobAsync(Day(10, 12), Day(10, 13)), Times.Once);
            Events("Complete").Should().Equal("Complete:run-1010", "Complete:run-1011", "Complete:run-1012");
        }

        [Fact]
        public async Task StartBackup_ReadsTheHistoryOfTheWholeCatchUpWindow()
        {
            await Service().StartBackupAsync();

            _jobs.Verify(r => r.GetJobsForDaysAsync(FirstDay, LastDay), Times.Once);
            _jobs.Verify(r => r.CreateJobAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>()), Times.Exactly(60));
            _jobs.Verify(r => r.CreateJobAsync(It.Is<DateTime>(d => d < FirstDay || d > LastDay), It.IsAny<DateTime>()), Times.Never);
        }

        [Fact]
        public async Task StartBackup_WhenNoDayIsPending_CreatesNoJobAndSaysSo()
        {
            AllDoneExcept();

            await Service().StartBackupAsync();

            _jobs.Verify(r => r.CreateJobAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>()), Times.Never);
            _jobs.Verify(r => r.CreateSkippedJobAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<string>()), Times.Never);
            _logger.Entries.Should().Contain(e => e.Level == LogLevel.Information && e.Message.Contains("no pending backup days"));
        }

        [Fact]
        public async Task StartBackup_WhenConfigurationIsMissing_FailsBeforeAnyJobOrCleanup()
        {
            _config.Setup(r => r.GetLmtArchiveRestoreConfigurationsAsync(It.IsAny<CancellationToken>()))
                .ThrowsAsync(new InvalidOperationException("LMT configuration is missing."));

            var act = () => Service().StartBackupAsync();

            await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("LMT configuration is missing.");
            _jobs.Verify(r => r.CreateJobAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>()), Times.Never);
            _traces.Verify(r => r.GetArchiveCollectionsAsync(), Times.Never);
            _logs.Verify(r => r.GetArchiveCollectionsAsync(), Times.Never);
        }

        [Fact]
        public async Task StartBackup_WhenARunIsActive_LogsTheSkipAndCreatesNoJob()
        {
            _jobs.Setup(r => r.HasActiveRunAsync()).ReturnsAsync(true);

            await Service().StartBackupAsync();

            _jobs.Verify(r => r.CreateJobAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>()), Times.Never);
            _logger.Entries.Should().Contain(e => e.Message.Contains("A backup run is already active; skipping this trigger."));
        }

        // ── Failed attempts and skipping ─────────────────────────────────────────

        [Fact]
        public async Task StartBackup_SkipsADayWithThreeFailedAttempts_AndGoesOnWithTheNext()
        {
            AllDoneExcept(Day(10, 5), Day(10, 6));
            AddJobs(Day(10, 5), LogTraceBackupJobStatus.Abandoned, 2);
            AddJobs(Day(10, 5), LogTraceBackupJobStatus.Failed, 1);

            await Service().StartBackupAsync();

            _jobs.Verify(r => r.CreateSkippedJobAsync(Day(10, 5), Day(10, 6), "Skipped after 3 failed attempts"), Times.Once);
            _jobs.Verify(r => r.CreateJobAsync(Day(10, 5), It.IsAny<DateTime>()), Times.Never);
            _jobs.Verify(r => r.CreateJobAsync(Day(10, 6), Day(10, 7)), Times.Once);
            _events.Should().ContainInOrder("Skip:run-1005", "Create:run-1006");
        }

        [Fact]
        public async Task StartBackup_RetriesADayWithFewerThanThreeFailedAttempts()
        {
            AllDoneExcept(Day(10, 5));
            AddJobs(Day(10, 5), LogTraceBackupJobStatus.Abandoned, 2);

            await Service().StartBackupAsync();

            _jobs.Verify(r => r.CreateJobAsync(Day(10, 5), Day(10, 6)), Times.Once);
            _jobs.Verify(r => r.CreateSkippedJobAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task StartBackup_AStaleRunIsAbandonedFirst_SoItsDayIsRetriedInTheSameRun()
        {
            // The stale job is marked Abandoned before the history is read, so its day counts one
            // failed attempt and is processed again.
            AllDoneExcept(Day(10, 12));
            _jobs.Setup(r => r.GetStaleRunningJobIdsAsync(Constants.BackupStaleRunThreshold)).ReturnsAsync(["stale"]);
            _jobs.Setup(r => r.MarkJobAbandonedAsync("stale"))
                .Callback(() =>
                {
                    _events.Enqueue("Abandon");
                    AddJobs(Day(10, 12), LogTraceBackupJobStatus.Abandoned, 1);
                })
                .Returns(Task.CompletedTask);

            await Service().StartBackupAsync();

            _events.Should().ContainInOrder("Abandon", "Create:run-1012");
        }

        // ── Run lock handover and time budget ────────────────────────────────────

        [Fact]
        public async Task StartBackup_CreatesTheNextDaysJobBeforeCompletingThePreviousOne()
        {
            AllDoneExcept(Day(10, 11), Day(10, 12));

            await Service().StartBackupAsync();

            _events.Where(e => e.StartsWith("Create", StringComparison.Ordinal) || e.StartsWith("Complete", StringComparison.Ordinal))
                .Should().Equal("Create:run-1011", "Create:run-1012", "Complete:run-1011", "Complete:run-1012");
        }

        [Fact]
        public async Task StartBackup_StartsNoDayThatWouldRunPastTheTimeBudget()
        {
            // Each day takes 70 minutes: after two days 140 + 70 > 180, so the third must wait.
            AllDoneExcept(Day(10, 10), Day(10, 11), Day(10, 12));
            _traces.Setup(r => r.GetDistinctTracesCollectionNamesAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>()))
                .Callback(() => _clock.Advance(TimeSpan.FromMinutes(70)))
                .ReturnsAsync([]);

            await Service().StartBackupAsync();

            Events("Create").Should().Equal("Create:run-1010", "Create:run-1011");
            _jobs.Verify(r => r.CreateSkippedJobAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<string>()), Times.Never);
            Events("Complete").Should().Equal("Complete:run-1010", "Complete:run-1011");
        }

        [Fact]
        public async Task StartBackup_WhenTheTimeBudgetIsNotReached_KeepsGoing()
        {
            // 60 minutes a day: after two days 120 + 60 = 180 is not past the budget.
            AllDoneExcept(Day(10, 10), Day(10, 11), Day(10, 12));
            _traces.Setup(r => r.GetDistinctTracesCollectionNamesAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>()))
                .Callback(() => _clock.Advance(TimeSpan.FromMinutes(60)))
                .ReturnsAsync([]);

            await Service().StartBackupAsync();

            Events("Create").Should().HaveCount(3);
        }

        [Fact]
        public async Task StartBackup_WhenADayFails_FailsThatDaysJobAndStopsTheRun()
        {
            AllDoneExcept(Day(10, 11), Day(10, 12));
            _traces.Setup(r => r.GetDistinctTracesCollectionNamesAsync(Day(10, 12), Day(10, 13)))
                .ThrowsAsync(new TimeoutException("listCollections failed"));

            var act = () => Service().StartBackupAsync();

            await act.Should().ThrowAsync<TimeoutException>();
            _jobs.Verify(r => r.FailJobAsync("run-1012", It.IsAny<string>()), Times.Once);
            _jobs.Verify(r => r.CompleteJobAsync("run-1011"), Times.Once);
            _jobs.Verify(r => r.CompleteJobAsync("run-1012"), Times.Never);
        }

        [Fact]
        public async Task StartBackup_WhenTheNextJobCannotBeCreated_StillCompletesThePreviousDay()
        {
            AllDoneExcept(Day(10, 11), Day(10, 12));
            _jobs.Setup(r => r.CreateJobAsync(Day(10, 12), It.IsAny<DateTime>()))
                .ThrowsAsync(new TimeoutException("insert failed"));

            var act = () => Service().StartBackupAsync();

            await act.Should().ThrowAsync<TimeoutException>();
            _jobs.Verify(r => r.CompleteJobAsync("run-1011"), Times.Once);
        }

        // ── Phases, batches and concurrency ──────────────────────────────────────

        [Fact]
        public async Task StartBackup_RunsTheFivePhasesOfADayOneAfterAnother()
        {
            AllDoneExcept(Day(10, 12));
            _traces.Setup(r => r.GetDistinctTracesCollectionNamesAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>()))
                .Callback(() => _events.Enqueue("Phase:traces"))
                .ReturnsAsync(["tenant-a"]);
            _traces.Setup(r => r.StreamTracesByCollectionAsync("tenant-a", It.IsAny<TenantLogsRequest>(), It.IsAny<int>(),
                    It.IsAny<CancellationToken>()))
                .Returns(SlowTraceStream());
            _logs.Setup(r => r.GetArchiveCollectionsAsync())
                .Callback(() => _events.Enqueue("Phase:log-upload"))
                .ReturnsAsync([]);
            _traces.Setup(r => r.GetArchiveCollectionsAsync())
                .Callback(() => _events.Enqueue("Phase:trace-upload"))
                .ReturnsAsync([]);
            _events.Clear();

            await Service().StartBackupAsync();

            // Reconciliation lists both archive databases before the day's first phase.
            _events.SkipWhile(e => e != "Phase:traces")
                .Where(e => e.StartsWith("Phase", StringComparison.Ordinal) || e == "TraceStreamDone")
                .Should().Equal("Phase:traces", "TraceStreamDone", "Phase:blocks-logs", "Phase:managed-logs",
                    "Phase:log-upload", "Phase:trace-upload");
            _jobs.Verify(r => r.UpdateJobPhaseAsync("run-1012", BackupPhase.Archiving), Times.Exactly(3));
            _jobs.Verify(r => r.UpdateJobPhaseAsync("run-1012", BackupPhase.BlobUploading), Times.Exactly(2));
        }

        private async IAsyncEnumerable<List<StoredTrace>> SlowTraceStream()
        {
            await Task.Delay(50);
            yield return [new StoredTrace { TraceId = "t1" }];
            _events.Enqueue("TraceStreamDone");
        }

        [Fact]
        public async Task StartBackup_ReadsEverySourceAndArchiveCollectionInBatchesOfAtMostAThousand()
        {
            AllDoneExcept(Day(10, 12));
            _traces.Setup(r => r.GetDistinctTracesCollectionNamesAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>()))
                .ReturnsAsync(["tenant-a"]);
            _logs.Setup(r => r.GetDistinctBlocksServiceNamesAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>()))
                .ReturnsAsync(["blocks-svc"]);
            _logs.Setup(r => r.GetDistinctManagedServiceNamesAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>()))
                .ReturnsAsync(["SB-svc"]);
            _logs.Setup(r => r.GetArchiveCollectionsAsync()).ReturnsAsync(["tenant-a_20261012_20261013"]);
            _traces.Setup(r => r.GetArchiveCollectionsAsync()).ReturnsAsync(["tenant-a_20261012_20261013"]);
            _traces.Setup(r => r.StreamTracesByCollectionAsync(It.IsAny<string>(), It.IsAny<TenantLogsRequest>(), It.IsAny<int>(),
                It.IsAny<CancellationToken>())).Returns(Batches<StoredTrace>());
            _logs.Setup(r => r.StreamBlocksServiceLogsAsync(It.IsAny<string>(), It.IsAny<TenantLogsRequest>(), It.IsAny<int>(),
                It.IsAny<CancellationToken>())).Returns(Batches<StoredLog>());
            _logs.Setup(r => r.StreamManagedServiceLogsAsync(It.IsAny<string>(), It.IsAny<TenantLogsRequest>(), It.IsAny<int>(),
                It.IsAny<CancellationToken>())).Returns(Batches<StoredLog>());
            _logs.Setup(r => r.StreamLogsFromArchiveCollectionAsync(It.IsAny<string>(), It.IsAny<int>(),
                It.IsAny<CancellationToken>())).Returns(Batches<StoredLog>());
            _traces.Setup(r => r.StreamTracesFromArchiveCollectionAsync(It.IsAny<string>(), It.IsAny<int>(),
                It.IsAny<CancellationToken>())).Returns(Batches<StoredTrace>());

            await Service().StartBackupAsync();

            Constants.BackupBatchSize.Should().Be(1000);
            _traces.Verify(r => r.StreamTracesByCollectionAsync("tenant-a", It.IsAny<TenantLogsRequest>(), 1000, It.IsAny<CancellationToken>()), Times.Once);
            _logs.Verify(r => r.StreamBlocksServiceLogsAsync("blocks-svc", It.IsAny<TenantLogsRequest>(), 1000, It.IsAny<CancellationToken>()), Times.Once);
            _logs.Verify(r => r.StreamManagedServiceLogsAsync("SB-svc", It.IsAny<TenantLogsRequest>(), 1000, It.IsAny<CancellationToken>()), Times.Once);
            _logs.Verify(r => r.StreamLogsFromArchiveCollectionAsync("tenant-a_20261012_20261013", 1000, It.IsAny<CancellationToken>()), Times.Once);
            _traces.Verify(r => r.StreamTracesFromArchiveCollectionAsync("tenant-a_20261012_20261013", 1000, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task StartBackup_ArchivesAtMostFourTenantsAtOnce()
        {
            AllDoneExcept(Day(10, 12));
            var tenants = Enumerable.Range(0, 12).Select(i => $"tenant-{i}").ToList();
            _traces.Setup(r => r.GetDistinctTracesCollectionNamesAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>()))
                .ReturnsAsync(tenants);
            _traces.Setup(r => r.StreamTracesByCollectionAsync(It.IsAny<string>(), It.IsAny<TenantLogsRequest>(), It.IsAny<int>(),
                It.IsAny<CancellationToken>())).Returns(() => Batches(new List<StoredTrace> { new() { TraceId = "t" } }));

            var gauge = new ConcurrencyGauge();
            _traces.Setup(r => r.ArchiveTracesAsync(It.IsAny<List<StoredTrace>>(), It.IsAny<TenantLogsRequest>()))
                .Returns(() => gauge.RunAsync());

            await Service().StartBackupAsync();

            gauge.Calls.Should().Be(12);
            gauge.Max.Should().Be(Constants.BackupMaxConcurrency).And.Be(4);
        }

        [Fact]
        public async Task StartBackup_UploadsAtMostFourArchiveCollectionsAtOnce()
        {
            AllDoneExcept(Day(10, 12));
            var collections = Enumerable.Range(0, 10).Select(i => $"tenant-{i}_20261012_20261013").ToList();
            _logs.Setup(r => r.GetArchiveCollectionsAsync()).ReturnsAsync(collections);

            var gauge = new ConcurrencyGauge();
            _logs.Setup(r => r.StreamLogsFromArchiveCollectionAsync(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .Returns(() => GaugedEmptyStream(gauge));

            await Service().StartBackupAsync();

            gauge.Calls.Should().Be(10);
            gauge.Max.Should().Be(4);
        }

        private static async IAsyncEnumerable<List<StoredLog>> GaugedEmptyStream(ConcurrencyGauge gauge)
        {
            await gauge.RunAsync();
            yield break;
        }

        [Fact]
        public async Task StartBackup_SendsAHeartbeatAfterEveryUploadedBatch()
        {
            AllDoneExcept(Day(10, 12));
            _traces.Setup(r => r.GetArchiveCollectionsAsync()).ReturnsAsync(["tenant-a_20261012_20261013"]);
            _traces.Setup(r => r.StreamTracesFromArchiveCollectionAsync(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .Returns(Batches(
                    new List<StoredTrace> { new() { TraceId = "1" } },
                    new List<StoredTrace> { new() { TraceId = "2" } },
                    new List<StoredTrace> { new() { TraceId = "3" } }));
            _blob.Setup(b => b.SaveAsync(It.IsAny<UploadLogToStorageRequest>())).ReturnsAsync("https://blob.test/x");

            await Service().StartBackupAsync();

            // Three batches, plus one once the uploaded collection is dropped.
            _jobs.Verify(r => r.UpdateJobHeartbeatAsync("run-1012"), Times.Exactly(4));
            _blob.Verify(b => b.SaveAsync(It.Is<UploadLogToStorageRequest>(u =>
                u.FileName == "Tenants/tenant-a/traces/traces_tenant-a_20261012_20261013.parquet")), Times.Once);
        }

        [Fact]
        public async Task StartBackup_SendsAHeartbeatAfterEveryArchivedBatch()
        {
            AllDoneExcept(Day(10, 12));
            _traces.Setup(r => r.GetDistinctTracesCollectionNamesAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>()))
                .ReturnsAsync(["tenant-a"]);
            _traces.Setup(r => r.StreamTracesByCollectionAsync("tenant-a", It.IsAny<TenantLogsRequest>(), It.IsAny<int>(),
                    It.IsAny<CancellationToken>()))
                .Returns(Batches(
                    new List<StoredTrace> { new() { TraceId = "1" } },
                    new List<StoredTrace> { new() { TraceId = "2" } }));
            _logs.Setup(r => r.GetDistinctBlocksServiceNamesAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>()))
                .ReturnsAsync(["blocks-svc"]);
            _logs.Setup(r => r.StreamBlocksServiceLogsAsync("blocks-svc", It.IsAny<TenantLogsRequest>(), It.IsAny<int>(),
                    It.IsAny<CancellationToken>()))
                .Returns(Batches(
                    new List<StoredLog> { new() { TenantId = "tenant-a", Message = "1" } },
                    new List<StoredLog> { new() { TenantId = "tenant-a", Message = "2" } },
                    new List<StoredLog> { new() { TenantId = "tenant-a", Message = "3" } }));

            await Service().StartBackupAsync();

            // Two trace batches, three log batches, and one after the tenant's source logs are deleted.
            _jobs.Verify(r => r.UpdateJobHeartbeatAsync("run-1012"), Times.Exactly(6));
            _jobs.Verify(r => r.CreateJobAsync(Day(10, 12), Day(10, 13)), Times.Once, "creating the day's job is its first heartbeat");
        }

        // ── Leftover reconciliation ──────────────────────────────────────────────

        [Fact]
        public async Task StartBackup_DropsAPartialTraceArchiveWhoseSourceIsIntact_OnceTheRunHoldsTheLock_BeforeArchiving()
        {
            AllDoneExcept(Day(10, 12));
            _traces.Setup(r => r.GetArchiveCollectionsAsync()).ReturnsAsync(["t1_20261012_20261013"]);
            _traces.Setup(r => r.HasTracesInWindowAsync("t1", Day(10, 12), Day(10, 13), It.IsAny<CancellationToken>()))
                .Callback(() => _events.Enqueue("Check:t1"))
                .ReturnsAsync(true);
            _traces.Setup(r => r.DeleteArchiveCollectionAsync("t1_20261012_20261013"))
                .Callback(() => _events.Enqueue("Drop:t1"))
                .Returns(Task.CompletedTask);

            await Service().StartBackupAsync();

            // The day's Running job is the run lock; a second trigger must not reconcile under this run.
            _events.Should().ContainInOrder("Create:run-1012", "Check:t1", "Drop:t1", "Phase:traces");
        }

        [Fact]
        public async Task StartBackup_KeepsTheArchiveOfADayThatIsAlreadyDone_EvenIfItsSourceIsStillThere()
        {
            // The day completed but its source delete failed (it is swallowed), and its upload failed
            // too. The copy is complete and the day is never archived again, so it must be uploaded.
            AllDoneExcept(Day(10, 12));
            _traces.Setup(r => r.GetArchiveCollectionsAsync()).ReturnsAsync(["t1_20261005_20261006"]);
            _traces.Setup(r => r.HasTracesInWindowAsync(It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<DateTime>(),
                It.IsAny<CancellationToken>())).ReturnsAsync(true);
            _logs.Setup(r => r.GetArchiveCollectionsAsync()).ReturnsAsync(["t1_20261005_20261006"]);

            await Service().StartBackupAsync();

            _traces.Verify(r => r.HasTracesInWindowAsync(It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<DateTime>(),
                It.IsAny<CancellationToken>()), Times.Never);
            _logs.Verify(r => r.GetArchivedServiceNamesAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
            _traces.Verify(r => r.StreamTracesFromArchiveCollectionAsync("t1_20261005_20261006", It.IsAny<int>(),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task StartBackup_DoesNotReconcileTheDaysItIsAboutToSkip()
        {
            AllDoneExcept(Day(10, 5), Day(10, 12));
            AddJobs(Day(10, 5), LogTraceBackupJobStatus.Abandoned, 3);
            _traces.Setup(r => r.GetArchiveCollectionsAsync()).ReturnsAsync(["t1_20261005_20261006", "t1_20261012_20261013"]);

            await Service().StartBackupAsync();

            _traces.Verify(r => r.HasTracesInWindowAsync("t1", Day(10, 5), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()), Times.Never);
            _traces.Verify(r => r.HasTracesInWindowAsync("t1", Day(10, 12), Day(10, 13), It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task StartBackup_WhenNoDayStarts_ReconcilesNothing()
        {
            AllDoneExcept();
            _traces.Setup(r => r.GetArchiveCollectionsAsync()).ReturnsAsync(["t1_20261012_20261013"]);

            await Service().StartBackupAsync();

            _traces.Verify(r => r.GetArchiveCollectionsAsync(), Times.Never);
            _logs.Verify(r => r.GetArchiveCollectionsAsync(), Times.Never);
        }

        [Fact]
        public async Task StartBackup_KeepsATraceArchiveThatIsTheOnlyCopy_AndUploadsIt()
        {
            AllDoneExcept(Day(10, 12));
            _traces.Setup(r => r.GetArchiveCollectionsAsync()).ReturnsAsync(["t1_20261001_20261002"]);
            _traces.Setup(r => r.HasTracesInWindowAsync("t1", Day(10, 1), Day(10, 2), It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);
            _traces.Setup(r => r.StreamTracesFromArchiveCollectionAsync("t1_20261001_20261002", It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .Returns(Batches(new List<StoredTrace> { new() { TraceId = "1" } }));
            _traces.Setup(r => r.DeleteArchiveCollectionAsync(It.IsAny<string>()))
                .Callback(() => _events.Enqueue("Drop"))
                .Returns(Task.CompletedTask);
            _blob.Setup(b => b.SaveAsync(It.IsAny<UploadLogToStorageRequest>()))
                .Callback(() => _events.Enqueue("Upload"))
                .ReturnsAsync("https://blob.test/x");

            await Service().StartBackupAsync();

            _events.Where(e => e is "Drop" or "Upload").Should().Equal("Upload", "Drop");
            _traces.Verify(r => r.HasTracesInWindowAsync(It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<DateTime>(),
                It.IsAny<CancellationToken>()), Times.Never, "a day that is already done is not reconciled");
        }

        [Fact]
        public async Task StartBackup_RemovesOnlyTheLogRowsOfServicesWhoseSourceIsIntact()
        {
            AllDoneExcept(Day(10, 12));
            const string collection = "t1_20261012_20261013";
            _logs.Setup(r => r.GetArchiveCollectionsAsync()).ReturnsAsync([collection]);
            _logs.Setup(r => r.GetArchivedServiceNamesAsync(collection, It.IsAny<CancellationToken>()))
                .ReturnsAsync(["blocks-a", "blocks-b", ""]);
            _logs.Setup(r => r.HasServiceLogsInWindowAsync("blocks-a", "t1", Day(10, 12), Day(10, 13), It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);
            _logs.Setup(r => r.HasServiceLogsInWindowAsync("blocks-b", "t1", Day(10, 12), Day(10, 13), It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);

            await Service().StartBackupAsync();

            _logs.Verify(r => r.DeleteArchivedLogsByServiceAsync(collection, "blocks-a"), Times.Once);
            _logs.Verify(r => r.DeleteArchivedLogsByServiceAsync(collection, "blocks-b"), Times.Never);
            _logs.Verify(r => r.DeleteArchivedLogsByServiceAsync(collection, ""), Times.Never);
        }

        [Fact]
        public async Task StartBackup_WhenReconcilingOneCollectionFails_LeavesItAndCarriesOn()
        {
            AllDoneExcept(Day(10, 12));
            _logs.Setup(r => r.GetArchiveCollectionsAsync()).ReturnsAsync(["bad_20261012_20261013", "good_20261012_20261013"]);
            _logs.Setup(r => r.GetArchivedServiceNamesAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(["blocks-a", "blocks-b"]);
            // For "bad", the first service needs removing but the second check fails: nothing may go.
            _logs.Setup(r => r.HasServiceLogsInWindowAsync("blocks-a", It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<DateTime>(),
                It.IsAny<CancellationToken>())).ReturnsAsync(true);
            _logs.Setup(r => r.HasServiceLogsInWindowAsync("blocks-b", "bad", It.IsAny<DateTime>(), It.IsAny<DateTime>(),
                It.IsAny<CancellationToken>())).ThrowsAsync(new TimeoutException("count failed"));

            await Service().StartBackupAsync();

            _logs.Verify(r => r.DeleteArchivedLogsByServiceAsync("bad_20261012_20261013", It.IsAny<string>()), Times.Never);
            _logs.Verify(r => r.DeleteArchivedLogsByServiceAsync("good_20261012_20261013", "blocks-a"), Times.Once);
            _jobs.Verify(r => r.CreateJobAsync(Day(10, 12), Day(10, 13)), Times.Once);
            _logger.Entries.Should().Contain(e => e.Level == LogLevel.Error && e.Message.Contains("bad_20261012_20261013"));
        }

        [Fact]
        public async Task StartBackup_WhenArchiveCollectionsCannotBeListedForReconciliation_StillRunsTheDay()
        {
            AllDoneExcept(Day(10, 12));
            _traces.SetupSequence(r => r.GetArchiveCollectionsAsync())
                .ThrowsAsync(new TimeoutException("listCollections failed"))
                .ReturnsAsync([]);

            await Service().StartBackupAsync();

            _jobs.Verify(r => r.CreateJobAsync(Day(10, 12), Day(10, 13)), Times.Once);
            _jobs.Verify(r => r.CompleteJobAsync("run-1012"), Times.Once);
        }

        [Fact]
        public async Task StartBackup_LeavesCollectionsWithoutAWindowAlone()
        {
            AllDoneExcept(Day(10, 12));
            _traces.Setup(r => r.GetArchiveCollectionsAsync()).ReturnsAsync(["t1_notadate_20261013", "plain"]);

            await Service().StartBackupAsync();

            _traces.Verify(r => r.HasTracesInWindowAsync(It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<DateTime>(),
                It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task StartBackup_ReconcilesAtMostFourCollectionsAtOnce()
        {
            AllDoneExcept(Day(10, 12));
            var collections = Enumerable.Range(0, 10).Select(i => $"t{i}_20261012_20261013").ToList();
            _traces.Setup(r => r.GetArchiveCollectionsAsync()).ReturnsAsync(collections);

            var gauge = new ConcurrencyGauge();
            _traces.Setup(r => r.HasTracesInWindowAsync(It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<DateTime>(),
                It.IsAny<CancellationToken>())).Returns(async () =>
                {
                    await gauge.RunAsync();
                    return false;
                });

            await Service().StartBackupAsync();

            gauge.Calls.Should().Be(10);
            gauge.Max.Should().Be(4);
        }

        /// <summary>Counts calls in flight at once; each call holds its slot for a short while.</summary>
        private sealed class ConcurrencyGauge
        {
            private int _current;
            private int _max;
            private int _calls;

            public int Max => Volatile.Read(ref _max);
            public int Calls => Volatile.Read(ref _calls);

            public async Task RunAsync()
            {
                Interlocked.Increment(ref _calls);
                var now = Interlocked.Increment(ref _current);
                int seen;
                while (now > (seen = Volatile.Read(ref _max)) && Interlocked.CompareExchange(ref _max, now, seen) != seen)
                {
                    // Another call raised the maximum meanwhile; compare again.
                }

                await Task.Delay(30);
                Interlocked.Decrement(ref _current);
            }
        }
    }
}
