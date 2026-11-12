using Cloud.LmtService.Repositories.Logs;
using Cloud.LmtService.Repositories.Trace;
using Cloud.LmtService.Utilities;
using Microsoft.Extensions.Logging;

namespace Cloud.LmtService.Services.ArchiveAndDelete
{
    /// <summary>
    /// Clears partial archive copies that crashed runs left behind, before a run archives anything.
    /// <para>
    /// Archive writes append, so re-archiving a day on top of a partial copy would duplicate rows in
    /// its Parquet file. The source is deleted only after its whole window has been archived, so
    /// whenever a source window still holds data its archive copy may be incomplete and is thrown
    /// away; the day's own archiving then copies the intact source again. Where the source window
    /// is empty, the archive copy is the only one left and is kept for the upload phase.
    /// </para>
    /// <para>
    /// Only collections of days the run is about to archive are judged. A day that is already done
    /// is never archived again, so its copy is always kept for upload: a source that failed to be
    /// deleted after a complete archive also looks "intact", and dropping that copy would mean the
    /// day's records never reach blob storage.
    /// </para>
    /// </summary>
    internal sealed class BackupLeftoverReconciler
    {
        private readonly ILogger _logger;
        private readonly ITraceRepository _traceRepository;
        private readonly ILogRepository _logRepository;

        public BackupLeftoverReconciler(ILogger logger, ITraceRepository traceRepository, ILogRepository logRepository)
        {
            _logger = logger;
            _traceRepository = traceRepository;
            _logRepository = logRepository;
        }

        /// <param name="days">UTC midnights of the one-day windows that may be reconciled.</param>
        public async Task ReconcileAsync(IReadOnlySet<DateTime> days)
        {
            await ReconcileAllAsync(days, "trace", _traceRepository.GetArchiveCollectionsAsync, ReconcileTraceArchiveAsync);
            await ReconcileAllAsync(days, "log", _logRepository.GetArchiveCollectionsAsync, ReconcileLogArchiveAsync);
        }

        private async Task ReconcileAllAsync(
            IReadOnlySet<DateTime> days,
            string kind,
            Func<Task<List<string>>> listCollectionsAsync,
            Func<string, string, DateTime, DateTime, Task> reconcileAsync)
        {
            List<string> collections;
            try
            {
                collections = await listCollectionsAsync();
            }
            catch (Exception ex)
            {
                // Nothing has been changed, so the run can go on; the upload phase lists them again.
                _logger.LogError(ex, "ReconcileAsync - Could not list {Kind} archive collections; none were reconciled", kind);
                return;
            }

            using var semaphore = new SemaphoreSlim(Constants.BackupMaxConcurrency);
            await Task.WhenAll(collections.Select(async collectionName =>
            {
                // A name without a window is not a backup collection; the upload phase skips it too.
                // Any other window than one day this run archives is left for the upload phase.
                if (!ArchiveCollectionNaming.TryParseWindow(collectionName, out var tenantId, out var start, out var end)
                    || end != start.AddDays(1) || !days.Contains(start))
                    return;

                await semaphore.WaitAsync();
                try
                {
                    await reconcileAsync(collectionName, tenantId, start, end);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "ReconcileAsync - Could not reconcile {Kind} archive collection {CollectionName}; left unchanged",
                        kind, collectionName);
                }
                finally
                {
                    semaphore.Release();
                }
            }));
        }

        private async Task ReconcileTraceArchiveAsync(string collectionName, string tenantId, DateTime start, DateTime end)
        {
            if (!await _traceRepository.HasTracesInWindowAsync(tenantId, start, end))
                return;

            _logger.LogWarning("ReconcileAsync - Dropping partial trace archive {CollectionName}: its source window still holds traces",
                collectionName);
            await _traceRepository.DeleteArchiveCollectionAsync(collectionName);
        }

        /// <summary>
        /// A tenant's log archive collection is shared by every service, so each service's rows are
        /// judged against that service's own source. All checks run before any delete, so a failed
        /// check leaves the collection exactly as it was.
        /// </summary>
        private async Task ReconcileLogArchiveAsync(string collectionName, string tenantId, DateTime start, DateTime end)
        {
            var partialServices = new List<string>();

            foreach (var serviceName in await _logRepository.GetArchivedServiceNamesAsync(collectionName))
            {
                // Rows without a service cannot be matched to a source, so they are kept as the only copy.
                if (string.IsNullOrWhiteSpace(serviceName))
                    continue;

                if (await _logRepository.HasServiceLogsInWindowAsync(serviceName, tenantId, start, end))
                    partialServices.Add(serviceName);
            }

            foreach (var serviceName in partialServices)
            {
                _logger.LogWarning("ReconcileAsync - Removing partial {ServiceName} rows from log archive {CollectionName}: its source window still holds logs",
                    serviceName, collectionName);
                await _logRepository.DeleteArchivedLogsByServiceAsync(collectionName, serviceName);
            }
        }
    }
}
