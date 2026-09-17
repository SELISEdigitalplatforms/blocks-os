using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Threading;
using System.Threading.Tasks;
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
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace XUnitTest.Services
{
    /// <summary>
    /// Orchestration rules for the nightly backup. The archive step and the delete step used to be
    /// interleaved per page while the delete covered the entire window, so everything past the
    /// first page was destroyed unarchived. These tests pin the ordering and the scoping.
    /// </summary>
    public class ArchiveServiceBackupTests
    {
        private readonly Mock<ILogRepository> _logRepository = new();
        private readonly Mock<ITraceRepository> _traceRepository = new();
        private readonly Mock<IArchiveRepository> _archiveRepository = new();
        private readonly Mock<ILogTraceBackupRepository> _backupRepository = new();
        private readonly Mock<IBlobStorage> _blobStorage = new();
        private readonly Mock<ILmtArchiveRestoreConfigurationRepository> _configRepository = new();

        /// <summary>Every repository call the service makes, in the order it made them.</summary>
        private readonly List<string> _calls = [];

        public ArchiveServiceBackupTests()
        {
            _configRepository.Setup(r => r.GetLmtArchiveRestoreConfigurationsAsync())
                .ReturnsAsync(new LmtArchiveRestoreConfigurations { HotDataRetentionPeriodInDays = 30 });

            _backupRepository.Setup(r => r.CreateJobAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>()))
                .ReturnsAsync("run-1")
                .Callback(() => _calls.Add("CreateJob"));
            _backupRepository.Setup(r => r.HasActiveRunAsync()).ReturnsAsync(false);
            _backupRepository.Setup(r => r.GetStaleRunningJobIdsAsync(It.IsAny<TimeSpan>()))
                .ReturnsAsync([]);

            // Nothing to enumerate unless a test says otherwise.
            _traceRepository.Setup(r => r.GetDistinctTracesCollectionNamesAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>()))
                .ReturnsAsync([]);
            _traceRepository.Setup(r => r.GetArchiveCollectionsAsync()).ReturnsAsync([]);
            _logRepository.Setup(r => r.GetDistinctBlocksServiceNamesAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>()))
                .ReturnsAsync([]);
            _logRepository.Setup(r => r.GetDistinctManagedServiceNamesAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>()))
                .ReturnsAsync([]);
            _logRepository.Setup(r => r.GetArchiveCollectionsAsync()).ReturnsAsync([]);
        }

        private ArchiveService Service() => new(
            NullLogger<ArchiveService>.Instance,
            _logRepository.Object,
            _traceRepository.Object,
            _archiveRepository.Object,
            _backupRepository.Object,
            _blobStorage.Object,
            _configRepository.Object);

        private static async IAsyncEnumerable<List<T>> Batches<T>(params List<T>[] batches)
        {
            foreach (var batch in batches)
            {
                yield return batch;
            }

            await Task.CompletedTask;
        }

        private static async IAsyncEnumerable<List<T>> Throwing<T>(Exception exception)
        {
            await Task.CompletedTask;
            throw exception;
#pragma warning disable CS0162 // Required to make the iterator's element type inferable.
            yield break;
#pragma warning restore CS0162
        }

        private static List<StoredTrace> Traces(int count) =>
            [.. Enumerable.Range(0, count).Select(i => new StoredTrace { TraceId = $"t{i}" })];

        private static StoredLog Log(string tenantId, string message) =>
            new() { TenantId = tenantId, Message = message, TraceId = "trace-1" };

        // ── Traces ───────────────────────────────────────────────────────────────

        [Fact]
        public async Task StartBackup_ArchivesEveryTraceBatchBeforeDeletingTheWindow()
        {
            _traceRepository.Setup(r => r.GetDistinctTracesCollectionNamesAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>()))
                .ReturnsAsync(["tenant-a"]);
            _traceRepository.Setup(r => r.StreamTracesByCollectionAsync("tenant-a", It.IsAny<TenantLogsRequest>(),
                    It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .Returns(Batches(Traces(10), Traces(10), Traces(5)));
            _traceRepository.Setup(r => r.ArchiveTracesAsync(It.IsAny<List<StoredTrace>>(), It.IsAny<TenantLogsRequest>()))
                .Callback<List<StoredTrace>, TenantLogsRequest>((t, _) => _calls.Add($"Archive:{t.Count}"))
                .Returns(Task.CompletedTask);
            _traceRepository.Setup(r => r.DeleteTracesByCollectionAsync(It.IsAny<TenantLogsRequest>(), It.IsAny<CancellationToken>()))
                .Callback(() => _calls.Add("Delete"))
                .ReturnsAsync(25);

            await Service().StartBackupAsync();

            _calls.Where(c => c.StartsWith("Archive") || c == "Delete")
                .Should().Equal("Archive:10", "Archive:10", "Archive:5", "Delete");
            _backupRepository.Verify(r => r.MarkTraceArchivedAsync("run-1", "tenant-a", 25), Times.Once);
        }

        [Fact]
        public async Task StartBackup_WhenArchivingATraceBatchFails_NeverDeletesTheWindow()
        {
            _traceRepository.Setup(r => r.GetDistinctTracesCollectionNamesAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>()))
                .ReturnsAsync(["tenant-a"]);
            _traceRepository.Setup(r => r.StreamTracesByCollectionAsync("tenant-a", It.IsAny<TenantLogsRequest>(),
                    It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .Returns(Batches(Traces(10), Traces(10)));

            var archived = 0;
            _traceRepository.Setup(r => r.ArchiveTracesAsync(It.IsAny<List<StoredTrace>>(), It.IsAny<TenantLogsRequest>()))
                .Returns(() => ++archived == 2
                    ? Task.FromException(new InvalidOperationException("archive write failed"))
                    : Task.CompletedTask);

            await Service().StartBackupAsync();

            _traceRepository.Verify(r => r.DeleteTracesByCollectionAsync(It.IsAny<TenantLogsRequest>(),
                It.IsAny<CancellationToken>()), Times.Never);
            _backupRepository.Verify(r => r.MarkTraceArchiveFailedAsync("run-1", "tenant-a", It.IsAny<string>()), Times.Once);
        }

        [Fact]
        public async Task StartBackup_WhenTraceWindowIsEmpty_DoesNotIssueADelete()
        {
            _traceRepository.Setup(r => r.GetDistinctTracesCollectionNamesAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>()))
                .ReturnsAsync(["tenant-a"]);
            _traceRepository.Setup(r => r.StreamTracesByCollectionAsync("tenant-a", It.IsAny<TenantLogsRequest>(),
                    It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .Returns(Batches<StoredTrace>());

            await Service().StartBackupAsync();

            _traceRepository.Verify(r => r.DeleteTracesByCollectionAsync(It.IsAny<TenantLogsRequest>(),
                It.IsAny<CancellationToken>()), Times.Never);
            _backupRepository.Verify(r => r.MarkTraceArchivedAsync("run-1", "tenant-a", 0), Times.Once);
        }

        // ── Blocks service logs ──────────────────────────────────────────────────

        [Fact]
        public async Task StartBackup_DeletesBlocksServiceLogsOncePerTenantAfterArchivingThemAll()
        {
            _logRepository.Setup(r => r.GetDistinctBlocksServiceNamesAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>()))
                .ReturnsAsync(["svc-1"]);
            _logRepository.Setup(r => r.StreamBlocksServiceLogsAsync("svc-1", It.IsAny<TenantLogsRequest>(),
                    It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .Returns(Batches(
                    [Log("tenant-a", "a1"), Log("tenant-b", "b1")],
                    [Log("tenant-a", "a2")]));
            _logRepository.Setup(r => r.ArchiveLogsAsync(It.IsAny<List<StoredLog>>(), It.IsAny<TenantLogsRequest>()))
                .Callback<List<StoredLog>, TenantLogsRequest>((l, q) => _calls.Add($"Archive:{q.ProjectKey}:{l.Count}"))
                .Returns(Task.CompletedTask);
            _logRepository.Setup(r => r.DeleteLogsByServiceAndTenantAsync("svc-1", It.IsAny<TenantLogsRequest>(),
                    It.IsAny<CancellationToken>()))
                .Callback<string, TenantLogsRequest, CancellationToken>((_, q, _) => _calls.Add($"Delete:{q.ProjectKey}"))
                .ReturnsAsync(1);

            await Service().StartBackupAsync();

            var relevant = _calls.Where(c => c.StartsWith("Archive") || c.StartsWith("Delete")).ToList();

            // Every archive must precede every delete, and each tenant is deleted exactly once.
            relevant.Should().HaveCount(5);
            relevant.Take(3).Should().OnlyContain(c => c.StartsWith("Archive"));
            relevant.Skip(3).Should().BeEquivalentTo(["Delete:tenant-a", "Delete:tenant-b"]);
            _backupRepository.Verify(r => r.MarkLogArchivedAsync("run-1", "tenant-a", "svc-1", 2), Times.Once);
            _backupRepository.Verify(r => r.MarkLogArchivedAsync("run-1", "tenant-b", "svc-1", 1), Times.Once);
        }

        [Fact]
        public async Task StartBackup_WhenOneTenantsLogArchiveFails_StillArchivesAndDeletesTheOthers()
        {
            _logRepository.Setup(r => r.GetDistinctBlocksServiceNamesAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>()))
                .ReturnsAsync(["svc-1"]);
            _logRepository.Setup(r => r.StreamBlocksServiceLogsAsync("svc-1", It.IsAny<TenantLogsRequest>(),
                    It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .Returns(Batches([Log("bad-tenant", "x"), Log("good-tenant", "y")]));
            _logRepository.Setup(r => r.ArchiveLogsAsync(It.IsAny<List<StoredLog>>(), It.IsAny<TenantLogsRequest>()))
                .Returns<List<StoredLog>, TenantLogsRequest>((_, q) => q.ProjectKey == "bad-tenant"
                    ? Task.FromException(new InvalidOperationException("nope"))
                    : Task.CompletedTask);
            _logRepository.Setup(r => r.DeleteLogsByServiceAndTenantAsync("svc-1", It.IsAny<TenantLogsRequest>(),
                    It.IsAny<CancellationToken>()))
                .Callback<string, TenantLogsRequest, CancellationToken>((_, q, _) => _calls.Add($"Delete:{q.ProjectKey}"))
                .ReturnsAsync(1);

            await Service().StartBackupAsync();

            _calls.Should().Contain("Delete:good-tenant");
            _calls.Should().NotContain("Delete:bad-tenant", "a tenant whose archive failed must keep its source logs");
            _backupRepository.Verify(r => r.MarkLogArchiveFailedAsync("run-1", "bad-tenant", "svc-1", It.IsAny<string>()), Times.Once);
        }

        [Fact]
        public async Task StartBackup_SkipsBlocksServiceLogsThatCarryNoTenant()
        {
            _logRepository.Setup(r => r.GetDistinctBlocksServiceNamesAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>()))
                .ReturnsAsync(["svc-1"]);
            _logRepository.Setup(r => r.StreamBlocksServiceLogsAsync("svc-1", It.IsAny<TenantLogsRequest>(),
                    It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .Returns(Batches([Log(string.Empty, "orphan"), Log(null!, "orphan2")]));

            await Service().StartBackupAsync();

            _logRepository.Verify(r => r.ArchiveLogsAsync(It.IsAny<List<StoredLog>>(), It.IsAny<TenantLogsRequest>()), Times.Never);
            _logRepository.Verify(r => r.DeleteLogsByServiceAndTenantAsync(It.IsAny<string>(), It.IsAny<TenantLogsRequest>(),
                It.IsAny<CancellationToken>()), Times.Never);
        }

        // ── Managed service logs ─────────────────────────────────────────────────

        [Fact]
        public async Task StartBackup_ArchivesManagedServiceLogsUnderEachOwningTenant()
        {
            _logRepository.Setup(r => r.GetDistinctManagedServiceNamesAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>()))
                .ReturnsAsync(["managed-1"]);
            _logRepository.Setup(r => r.StreamManagedServiceLogsAsync("managed-1", It.IsAny<TenantLogsRequest>(),
                    It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .Returns(Batches([Log("tenant-a", "a1"), Log("tenant-b", "b1"), Log("tenant-b", "b2")]));
            _logRepository.Setup(r => r.ArchiveLogsAsync(It.IsAny<List<StoredLog>>(), It.IsAny<TenantLogsRequest>()))
                .Callback<List<StoredLog>, TenantLogsRequest>((l, q) => _calls.Add($"Archive:{q.ProjectKey}:{l.Count}"))
                .Returns(Task.CompletedTask);
            _logRepository.Setup(r => r.DeleteLogsByServiceAndTenantAsync("managed-1", It.IsAny<TenantLogsRequest>(),
                    It.IsAny<CancellationToken>()))
                .Callback<string, TenantLogsRequest, CancellationToken>((_, q, _) => _calls.Add($"Delete:{q.ProjectKey}"))
                .ReturnsAsync(1);

            await Service().StartBackupAsync();

            // Tenant B's logs must not be filed under tenant A just because A came first.
            _calls.Should().Contain("Archive:tenant-a:1").And.Contain("Archive:tenant-b:2");
            _calls.Should().Contain("Delete:tenant-a").And.Contain("Delete:tenant-b");
            _backupRepository.Verify(r => r.MarkServiceLogArchivedAsync("run-1", "managed-1", 3), Times.Once);
        }

        [Fact]
        public async Task StartBackup_WhenManagedServiceHasNoLogs_RecordsZeroAndDeletesNothing()
        {
            _logRepository.Setup(r => r.GetDistinctManagedServiceNamesAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>()))
                .ReturnsAsync(["managed-1"]);
            _logRepository.Setup(r => r.StreamManagedServiceLogsAsync("managed-1", It.IsAny<TenantLogsRequest>(),
                    It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .Returns(Batches<StoredLog>());

            await Service().StartBackupAsync();

            _backupRepository.Verify(r => r.MarkServiceLogArchivedAsync("run-1", "managed-1", 0), Times.Once);
            _logRepository.Verify(r => r.DeleteLogsByServiceAndTenantAsync(It.IsAny<string>(), It.IsAny<TenantLogsRequest>(),
                It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task StartBackup_RecordsTheManagedServiceProgressRowWithItsFirstTraceId()
        {
            _logRepository.Setup(r => r.GetDistinctManagedServiceNamesAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>()))
                .ReturnsAsync(["managed-1"]);
            _logRepository.Setup(r => r.StreamManagedServiceLogsAsync("managed-1", It.IsAny<TenantLogsRequest>(),
                    It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .Returns(Batches([Log("tenant-a", "a1")]));

            await Service().StartBackupAsync();

            _backupRepository.Verify(r => r.CreateServiceLogFileProgressAsync("run-1", "managed-1", "trace-1"), Times.Once);
        }

        [Fact]
        public async Task StartBackup_WhenManagedServiceReadFails_StillRecordsAProgressRow()
        {
            _logRepository.Setup(r => r.GetDistinctManagedServiceNamesAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>()))
                .ReturnsAsync(["managed-1"]);
            _logRepository.Setup(r => r.StreamManagedServiceLogsAsync("managed-1", It.IsAny<TenantLogsRequest>(),
                    It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .Returns(Throwing<StoredLog>(new TimeoutException("read timed out")));

            await Service().StartBackupAsync();

            _backupRepository.Verify(r => r.CreateServiceLogFileProgressAsync("run-1", "managed-1", null), Times.Once);
            _backupRepository.Verify(r => r.MarkServiceLogArchiveFailedAsync("run-1", "managed-1", null,
                It.IsAny<string>()), Times.Once);
        }

        // ── Blob upload ──────────────────────────────────────────────────────────

        [Fact]
        public async Task StartBackup_WhenArchiveCollectionCannotBeRead_KeepsItAndMarksTheUploadFailed()
        {
            _traceRepository.Setup(r => r.GetArchiveCollectionsAsync())
                .ReturnsAsync(["tenant-a_20260101_20260102"]);
            _traceRepository.Setup(r => r.StreamTracesFromArchiveCollectionAsync(It.IsAny<string>(), It.IsAny<int>(),
                    It.IsAny<CancellationToken>()))
                .Returns(Throwing<StoredTrace>(new TimeoutException("read timed out")));

            await Service().StartBackupAsync();

            _traceRepository.Verify(r => r.DeleteArchiveCollectionAsync(It.IsAny<string>()), Times.Never);
            _backupRepository.Verify(r => r.MarkTraceUploadFailedAsync("run-1", "tenant-a", It.IsAny<string>(),
                It.IsAny<string>()), Times.Once);
        }

        [Fact]
        public async Task StartBackup_WhenArchiveCollectionIsGenuinelyEmpty_DropsItAndCompletes()
        {
            _traceRepository.Setup(r => r.GetArchiveCollectionsAsync())
                .ReturnsAsync(["tenant-a_20260101_20260102"]);
            _traceRepository.Setup(r => r.StreamTracesFromArchiveCollectionAsync(It.IsAny<string>(), It.IsAny<int>(),
                    It.IsAny<CancellationToken>()))
                .Returns(Batches<StoredTrace>());

            await Service().StartBackupAsync();

            _traceRepository.Verify(r => r.DeleteArchiveCollectionAsync("tenant-a_20260101_20260102"), Times.Once);
            _backupRepository.Verify(r => r.MarkTraceCompletedAsync("run-1", "tenant-a"), Times.Once);
        }

        [Fact]
        public async Task StartBackup_WhenProgressBookkeepingThrows_StillUploadsTheRemainingCollections()
        {
            _traceRepository.Setup(r => r.GetArchiveCollectionsAsync())
                .ReturnsAsync(["tenant-a_20260101_20260102", "tenant-b_20260101_20260102"]);
            _traceRepository.Setup(r => r.StreamTracesFromArchiveCollectionAsync(It.IsAny<string>(), It.IsAny<int>(),
                    It.IsAny<CancellationToken>()))
                .Returns(Batches<StoredTrace>());
            _backupRepository.Setup(r => r.TraceProgressExistsAsync("run-1", "tenant-a"))
                .ThrowsAsync(new TimeoutException("progress store unavailable"));

            await Service().StartBackupAsync();

            _traceRepository.Verify(r => r.DeleteArchiveCollectionAsync("tenant-b_20260101_20260102"), Times.Once);
        }

        [Fact]
        public async Task StartBackup_ResolvesTheTenantFromTheRightEndOfTheCollectionName()
        {
            // The two dates are the trailing segments, so an underscore inside the tenant id must
            // not truncate it - otherwise the parquet lands in the wrong tenant's blob folder.
            _traceRepository.Setup(r => r.GetArchiveCollectionsAsync())
                .ReturnsAsync(["ten_ant_20260101_20260102"]);
            _traceRepository.Setup(r => r.StreamTracesFromArchiveCollectionAsync(It.IsAny<string>(), It.IsAny<int>(),
                    It.IsAny<CancellationToken>()))
                .Returns(Batches<StoredTrace>());

            await Service().StartBackupAsync();

            _backupRepository.Verify(r => r.MarkTraceCompletedAsync("run-1", "ten_ant"), Times.Once);
        }

        [Fact]
        public async Task StartBackup_SkipsArchiveCollectionsWhoseNameCarriesNoWindow()
        {
            _traceRepository.Setup(r => r.GetArchiveCollectionsAsync()).ReturnsAsync(["not-a-backup"]);

            await Service().StartBackupAsync();

            _traceRepository.Verify(r => r.DeleteArchiveCollectionAsync(It.IsAny<string>()), Times.Never);
            _traceRepository.Verify(r => r.StreamTracesFromArchiveCollectionAsync(It.IsAny<string>(), It.IsAny<int>(),
                It.IsAny<CancellationToken>()), Times.Never);
        }

        // ── Concurrency ──────────────────────────────────────────────────────────

        [Fact]
        public async Task StartBackup_WhenAnotherRunIsAlreadyActive_DoesNotStartASecondOne()
        {
            _backupRepository.Setup(r => r.HasActiveRunAsync()).ReturnsAsync(true);

            await Service().StartBackupAsync();

            _backupRepository.Verify(r => r.CreateJobAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>()), Times.Never);
            _traceRepository.Verify(r => r.GetDistinctTracesCollectionNamesAsync(It.IsAny<DateTime>(),
                It.IsAny<DateTime>()), Times.Never);
        }

        [Fact]
        public async Task StartBackup_AbandonsStaleRunsBeforeCheckingWhetherOneIsActive()
        {
            _backupRepository.Setup(r => r.GetStaleRunningJobIdsAsync(It.IsAny<TimeSpan>()))
                .ReturnsAsync(["stale-1", "stale-2"])
                .Callback(() => _calls.Add("Reap"));
            _backupRepository.Setup(r => r.HasActiveRunAsync())
                .ReturnsAsync(false)
                .Callback(() => _calls.Add("HasActiveRun"));

            await Service().StartBackupAsync();

            _backupRepository.Verify(r => r.MarkJobAbandonedAsync("stale-1"), Times.Once);
            _backupRepository.Verify(r => r.MarkJobAbandonedAsync("stale-2"), Times.Once);
            _calls.Should().ContainInOrder("Reap", "HasActiveRun", "CreateJob");
        }
    }
}
