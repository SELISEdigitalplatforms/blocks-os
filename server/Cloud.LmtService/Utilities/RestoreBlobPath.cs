using System;

namespace Cloud.LmtService.Utilities
{
    /// <summary>
    /// Builds the blob names the backup pipeline writes, so restore and download agree on where a
    /// day's archive lives. Backup produces exactly one tenant-aggregated file per day per data
    /// type (see ArchiveService.ProcessSingleLogCollectionAsync), covering the window
    /// <c>(date, date + 1]</c>. Service name is a column inside the file, never part of the path —
    /// there is intentionally no per-service overload, because an earlier per-service path built
    /// names that no backup run ever produced and silently restored zero logs.
    /// </summary>
    public static class RestoreBlobPath
    {
        public static string ForLogs(string tenantId, DateTime date) =>
            Build(tenantId, date, Constants.BackupLogsDirectory, Constants.BackupLogsDirectory);

        public static string ForTraces(string tenantId, DateTime date) =>
            Build(tenantId, date, Constants.BackupTracesDirectory, Constants.BackupTracesDirectory);

        private static string Build(string tenantId, DateTime date, string directory, string filePrefix)
        {
            var startDate = date.Date;
            var endDate = startDate.AddDays(1);

            return $"{Constants.BackupSubdirectory}/{tenantId}/{directory}/" +
                   $"{filePrefix}_{tenantId}_{startDate:yyyyMMdd}_{endDate:yyyyMMdd}.parquet";
        }
    }
}
