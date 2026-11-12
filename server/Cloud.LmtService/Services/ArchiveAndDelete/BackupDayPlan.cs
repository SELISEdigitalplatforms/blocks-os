using Cloud.LmtService.Models.LogTraceBackup;
using Cloud.LmtService.Utilities;

namespace Cloud.LmtService.Services.ArchiveAndDelete
{
    /// <summary>A day the nightly backup still has to archive, as [Start, End) at UTC midnight.</summary>
    public sealed record PendingBackupDay(DateTime Start, DateTime End, int FailedAttempts);

    /// <summary>
    /// Works out which days a backup run still owes, from the jobs already recorded for them.
    /// <para>
    /// A run used to cover exactly one day, so a run that crashed lost its day for good. Every day
    /// from the TTL horizon up to the end of the hot-retention window is now owed until one of its
    /// jobs ends Completed, CompletedWithErrors or Skipped; Failed and Abandoned jobs count as
    /// attempts against it.
    /// </para>
    /// </summary>
    public static class BackupDayPlan
    {
        private static readonly HashSet<string> DoneStatuses = new(StringComparer.Ordinal)
        {
            LogTraceBackupJobStatus.Completed,
            LogTraceBackupJobStatus.CompletedWithErrors,
            LogTraceBackupJobStatus.Skipped
        };

        private static readonly HashSet<string> FailedStatuses = new(StringComparer.Ordinal)
        {
            LogTraceBackupJobStatus.Failed,
            LogTraceBackupJobStatus.Abandoned
        };

        /// <summary>The first and last day (inclusive) a run may back up on <paramref name="today"/>.</summary>
        public static (DateTime FirstDay, DateTime LastDay) Window(DateTime today, int hotDataRetentionPeriodInDays)
        {
            var day = AsUtcDay(today);
            return (day.AddDays(-Constants.BackupCatchUpHorizonDays),
                    day.AddDays(-hotDataRetentionPeriodInDays - 1));
        }

        /// <summary>Every day in the window that is not done yet, oldest first.</summary>
        public static List<PendingBackupDay> PendingDays(
            DateTime today, int hotDataRetentionPeriodInDays, IEnumerable<LogTraceBackupJob> jobs)
        {
            var (firstDay, lastDay) = Window(today, hotDataRetentionPeriodInDays);
            var jobsByDay = jobs.ToLookup(job => AsUtcDay(job.DataDateFrom));

            var pending = new List<PendingBackupDay>();
            for (var day = firstDay; day <= lastDay; day = day.AddDays(1))
            {
                var dayJobs = jobsByDay[day].ToList();
                if (dayJobs.Exists(job => DoneStatuses.Contains(job.Status)))
                    continue;

                pending.Add(new PendingBackupDay(day, day.AddDays(1),
                    dayJobs.Count(job => FailedStatuses.Contains(job.Status))));
            }

            return pending;
        }

        /// <summary>The UTC day a timestamp falls on. MongoDB returns UTC; Unspecified is taken as UTC.</summary>
        private static DateTime AsUtcDay(DateTime value)
        {
            var utc = value.Kind == DateTimeKind.Local ? value.ToUniversalTime() : value;
            return DateTime.SpecifyKind(utc.Date, DateTimeKind.Utc);
        }
    }
}
