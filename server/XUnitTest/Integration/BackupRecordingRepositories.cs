using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Threading;
using System.Threading.Tasks;
using Cloud.LmtService.Models.ArchiveAndDelete;
using Cloud.LmtService.Models.Logs;
using Cloud.LmtService.Models.Trace;
using Cloud.LmtService.Repositories.Logs;
using Cloud.LmtService.Repositories.Trace;

namespace XUnitTest.Integration
{
    /// <summary>
    /// What the backup asked of the real repositories: the batch size of every read, how many units
    /// of each phase were reading at once, and whether two phases were ever active together.
    /// </summary>
    public sealed class BackupCallRecorder
    {
        public const string TraceArchiving = "trace-archiving";
        public const string BlocksLogArchiving = "blocks-log-archiving";
        public const string ManagedLogArchiving = "managed-log-archiving";
        public const string LogUpload = "log-upload";
        public const string TraceUpload = "trace-upload";
        public const string Reconciliation = "reconciliation";

        private readonly object _gate = new();
        private readonly Dictionary<string, int> _inFlight = new();
        private readonly Dictionary<string, int> _maxInFlight = new();
        private readonly List<string> _overlaps = [];

        public ConcurrentQueue<int> BatchSizes { get; } = new();

        /// <summary>Tenant whose trace archive writes fail.</summary>
        public string? FailTraceArchiveForTenant { get; set; }

        /// <summary>Archive collection whose reconciliation read fails.</summary>
        public string? FailReconciliationOf { get; set; }

        /// <summary>Runs as each day's trace phase starts, before its tenants are listed.</summary>
        public Func<Task>? OnDayStart { get; set; }

        public IReadOnlyList<string> Overlaps
        {
            get { lock (_gate) return _overlaps.ToList(); }
        }

        public int MaxInFlight(string phase)
        {
            lock (_gate) return _maxInFlight.GetValueOrDefault(phase);
        }

        /// <summary>Notes a call of the phase; another phase still reading at that moment is an overlap.</summary>
        public void Touch(string phase)
        {
            lock (_gate) NoteOverlaps(phase);
        }

        /// <summary>Counts the stream as one unit of the phase from its first read until it is disposed.</summary>
        public async IAsyncEnumerable<List<T>> Track<T>(string phase, int batchSize, IAsyncEnumerable<List<T>> source,
            [EnumeratorCancellation] CancellationToken ct = default)
        {
            BatchSizes.Enqueue(batchSize);
            Enter(phase);
            try
            {
                await foreach (var batch in source.WithCancellation(ct))
                {
                    yield return batch;
                }
            }
            finally
            {
                lock (_gate) _inFlight[phase]--;
            }
        }

        private void Enter(string phase)
        {
            lock (_gate)
            {
                NoteOverlaps(phase);
                var now = _inFlight.GetValueOrDefault(phase) + 1;
                _inFlight[phase] = now;
                _maxInFlight[phase] = Math.Max(_maxInFlight.GetValueOrDefault(phase), now);
            }
        }

        private void NoteOverlaps(string phase)
        {
            foreach (var (other, count) in _inFlight)
            {
                if (other != phase && count > 0)
                    _overlaps.Add($"{phase} while {other} was reading");
            }
        }
    }

    /// <summary>The real trace repository, with every backup read recorded.</summary>
    public sealed class RecordingTraceRepository(ITraceRepository inner, BackupCallRecorder recorder) : ITraceRepository
    {
        public Task<IQueryable<SingleTraceProjection>> GetTraces(GetTraceRequest query) => inner.GetTraces(query);
        public Task<(IQueryable<TraceProjection>, long)> GetTraces(GetTracesRequest query) => inner.GetTraces(query);
        public Task<object> GetOperationalAnalytics(DateTime startTime, DateTime endTime, string serviceName, string? operationSearch = null) =>
            inner.GetOperationalAnalytics(startTime, endTime, serviceName, operationSearch);
        public Task<object> GetServiceAnalytics(DateTime startTime, DateTime endTime, string? serviceName = null) =>
            inner.GetServiceAnalytics(startTime, endTime, serviceName);

        public async Task<List<string>> GetDistinctTracesCollectionNamesAsync(DateTime startDate, DateTime endDate)
        {
            recorder.Touch(BackupCallRecorder.TraceArchiving);
            if (recorder.OnDayStart != null)
                await recorder.OnDayStart();

            return await inner.GetDistinctTracesCollectionNamesAsync(startDate, endDate);
        }

        public IAsyncEnumerable<List<StoredTrace>> StreamTracesByCollectionAsync(string collectionName, TenantLogsRequest query, int batchSize, CancellationToken ct = default) =>
            recorder.Track(BackupCallRecorder.TraceArchiving, batchSize, inner.StreamTracesByCollectionAsync(collectionName, query, batchSize, ct), ct);

        public Task<long> DeleteTracesByCollectionAsync(TenantLogsRequest query, CancellationToken ct = default)
        {
            recorder.Touch(BackupCallRecorder.TraceArchiving);
            return inner.DeleteTracesByCollectionAsync(query, ct);
        }

        public Task ArchiveTracesAsync(List<StoredTrace> traces, TenantLogsRequest query)
        {
            if (query.ProjectKey == recorder.FailTraceArchiveForTenant)
                return Task.FromException(new InvalidOperationException("archive write failed"));

            return inner.ArchiveTracesAsync(traces, query);
        }

        public Task<bool> HasTracesInWindowAsync(string tenantId, DateTime startDate, DateTime endDate, CancellationToken ct = default)
        {
            recorder.Touch(BackupCallRecorder.Reconciliation);
            if (recorder.FailReconciliationOf?.StartsWith(tenantId + "_", StringComparison.Ordinal) == true)
                return Task.FromException<bool>(new TimeoutException("count failed"));

            return inner.HasTracesInWindowAsync(tenantId, startDate, endDate, ct);
        }

        public Task<List<string>> GetArchiveCollectionsAsync() => inner.GetArchiveCollectionsAsync();

        public IAsyncEnumerable<List<StoredTrace>> StreamTracesFromArchiveCollectionAsync(string collectionName, int batchSize, CancellationToken ct = default) =>
            recorder.Track(BackupCallRecorder.TraceUpload, batchSize, inner.StreamTracesFromArchiveCollectionAsync(collectionName, batchSize, ct), ct);

        public Task DeleteArchiveCollectionAsync(string collectionName) => inner.DeleteArchiveCollectionAsync(collectionName);
        public Task DeleteMiscellaneousTracesCollectionAsync(string collectionName) => inner.DeleteMiscellaneousTracesCollectionAsync(collectionName);
    }

    /// <summary>The real log repository, with every backup read recorded.</summary>
    public sealed class RecordingLogRepository(ILogRepository inner, BackupCallRecorder recorder) : ILogRepository
    {
        public Task<IQueryable<LogProjection>> GetLogs(LiveLogRequest query) => inner.GetLogs(query);
        public Task<(IQueryable<LogProjection>, long)> GetLogs(GetLogsRequest query) => inner.GetLogs(query);
        public Task<(IQueryable<LogProjection>, long)> GetLogs(LogsByDateRequest request) => inner.GetLogs(request);

        public Task<List<string>> GetDistinctBlocksServiceNamesAsync(DateTime startDate, DateTime endDate)
        {
            recorder.Touch(BackupCallRecorder.BlocksLogArchiving);
            return inner.GetDistinctBlocksServiceNamesAsync(startDate, endDate);
        }

        public Task<List<string>> GetDistinctManagedServiceNamesAsync(DateTime startDate, DateTime endDate)
        {
            recorder.Touch(BackupCallRecorder.ManagedLogArchiving);
            return inner.GetDistinctManagedServiceNamesAsync(startDate, endDate);
        }

        public Task<Dictionary<string, List<StoredLog>>> GetLogsByServiceAndTenantBatchAsync(string serviceName, List<string> tenantIds, TenantLogsRequest query) =>
            inner.GetLogsByServiceAndTenantBatchAsync(serviceName, tenantIds, query);

        public IAsyncEnumerable<List<StoredLog>> StreamBlocksServiceLogsAsync(string serviceName, TenantLogsRequest query, int batchSize, CancellationToken ct = default) =>
            recorder.Track(BackupCallRecorder.BlocksLogArchiving, batchSize, inner.StreamBlocksServiceLogsAsync(serviceName, query, batchSize, ct), ct);

        public IAsyncEnumerable<List<StoredLog>> StreamManagedServiceLogsAsync(string serviceName, TenantLogsRequest query, int batchSize, CancellationToken ct = default) =>
            recorder.Track(BackupCallRecorder.ManagedLogArchiving, batchSize, inner.StreamManagedServiceLogsAsync(serviceName, query, batchSize, ct), ct);

        public Task<long> DeleteLogsByServiceAndTenantAsync(string serviceName, TenantLogsRequest query, CancellationToken ct = default) =>
            inner.DeleteLogsByServiceAndTenantAsync(serviceName, query, ct);

        public Task ArchiveLogsAsync(List<StoredLog> logs, TenantLogsRequest query) => inner.ArchiveLogsAsync(logs, query);
        public Task<List<string>> GetArchiveCollectionsAsync() => inner.GetArchiveCollectionsAsync();

        public IAsyncEnumerable<List<StoredLog>> StreamLogsFromArchiveCollectionAsync(string collectionName, int batchSize, CancellationToken ct = default) =>
            recorder.Track(BackupCallRecorder.LogUpload, batchSize, inner.StreamLogsFromArchiveCollectionAsync(collectionName, batchSize, ct), ct);

        public Task DeleteArchivedLogsByServiceAsync(string collectionName, string serviceName) =>
            inner.DeleteArchivedLogsByServiceAsync(collectionName, serviceName);

        public Task<List<string>> GetArchivedServiceNamesAsync(string collectionName, CancellationToken ct = default)
        {
            recorder.Touch(BackupCallRecorder.Reconciliation);
            if (collectionName == recorder.FailReconciliationOf)
                return Task.FromException<List<string>>(new TimeoutException("distinct failed"));

            return inner.GetArchivedServiceNamesAsync(collectionName, ct);
        }

        public Task<bool> HasServiceLogsInWindowAsync(string serviceName, string tenantId, DateTime startDate, DateTime endDate, CancellationToken ct = default)
        {
            recorder.Touch(BackupCallRecorder.Reconciliation);
            return inner.HasServiceLogsInWindowAsync(serviceName, tenantId, startDate, endDate, ct);
        }

        public Task DeleteArchiveCollectionAsync(string collectionName) => inner.DeleteArchiveCollectionAsync(collectionName);
        public Task DeleteMiscellaneousLogsCollectionAsync(string collectionName) => inner.DeleteMiscellaneousLogsCollectionAsync(collectionName);

        public Task SaveFailedArchiveLogsAsync(string serviceName, List<StoredLog> logs, string failureReason, DateTime processStartDate, DateTime processEndDate) =>
            inner.SaveFailedArchiveLogsAsync(serviceName, logs, failureReason, processStartDate, processEndDate);
    }
}
