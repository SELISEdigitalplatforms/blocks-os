using System;
using System.Collections.Generic;
using System.Linq;
using Cloud.LmtService.Models.LogTraceBackup;
using Cloud.LmtService.Services.ArchiveAndDelete;
using FluentAssertions;

namespace XUnitTest.Services
{
    /// <summary>
    /// Which days a backup run still owes. "Today" is 2026-11-12 with 30 days of hot retention,
    /// so the window runs from 2026-08-14 (the 90-day TTL horizon) to 2026-10-12.
    /// </summary>
    public class BackupDayPlanTests
    {
        private static readonly DateTime Today = new(2026, 11, 12, 1, 0, 0, DateTimeKind.Utc);
        private const int Retention = 30;
        private static readonly DateTime FirstDay = Day(2026, 8, 14);
        private static readonly DateTime LastDay = Day(2026, 10, 12);

        private static DateTime Day(int year, int month, int day) => new(year, month, day, 0, 0, 0, DateTimeKind.Utc);

        private static LogTraceBackupJob Job(DateTime day, string status) => new() { DataDateFrom = day, Status = status };

        /// <summary>Every day of the window done, except the ones given.</summary>
        private static List<LogTraceBackupJob> AllDoneExcept(params DateTime[] pending)
        {
            var jobs = new List<LogTraceBackupJob>();
            for (var day = FirstDay; day <= LastDay; day = day.AddDays(1))
            {
                if (!pending.Contains(day))
                    jobs.Add(Job(day, LogTraceBackupJobStatus.Completed));
            }

            return jobs;
        }

        [Fact]
        public void Window_RunsFromTheTtlHorizonToTheDayBeforeTheHotRetentionEnds()
        {
            var (first, last) = BackupDayPlan.Window(Today, Retention);

            first.Should().Be(FirstDay);
            last.Should().Be(LastDay);
            first.Kind.Should().Be(DateTimeKind.Utc);
        }

        [Fact]
        public void PendingDays_WithNoHistory_OwesEveryDayOfTheWindowOldestFirst()
        {
            var pending = BackupDayPlan.PendingDays(Today, Retention, []);

            pending.Should().HaveCount(60);
            pending.First().Start.Should().Be(FirstDay);
            pending.Last().Start.Should().Be(LastDay);
            pending.Select(d => d.Start).Should().BeInAscendingOrder();
            pending.Should().OnlyContain(d => d.End == d.Start.AddDays(1) && d.FailedAttempts == 0);
        }

        [Theory]
        [InlineData(LogTraceBackupJobStatus.Completed)]
        [InlineData(LogTraceBackupJobStatus.CompletedWithErrors)]
        [InlineData(LogTraceBackupJobStatus.Skipped)]
        public void PendingDays_ADayWithAFinishedJobIsDone(string status)
        {
            var day = Day(2026, 10, 11);
            var jobs = AllDoneExcept(day, LastDay);
            jobs.Add(Job(day, LogTraceBackupJobStatus.Abandoned));
            jobs.Add(Job(day, status));

            BackupDayPlan.PendingDays(Today, Retention, jobs)
                .Select(d => d.Start).Should().Equal(LastDay);
        }

        [Fact]
        public void PendingDays_CountsFailedAndAbandonedJobsAsAttempts()
        {
            var day = Day(2026, 10, 5);
            var jobs = AllDoneExcept(day);
            jobs.Add(Job(day, LogTraceBackupJobStatus.Abandoned));
            jobs.Add(Job(day, LogTraceBackupJobStatus.Failed));
            jobs.Add(Job(day, LogTraceBackupJobStatus.Abandoned));
            jobs.Add(Job(day, LogTraceBackupJobStatus.Running));

            var pending = BackupDayPlan.PendingDays(Today, Retention, jobs).Should().ContainSingle().Subject;

            pending.Start.Should().Be(day);
            pending.FailedAttempts.Should().Be(3, "a Running job is not an attempt yet");
        }

        [Fact]
        public void PendingDays_NeverOwesADayOlderThanTheTtlHorizon()
        {
            var pending = BackupDayPlan.PendingDays(Today, Retention, [Job(FirstDay.AddDays(-1), LogTraceBackupJobStatus.Abandoned)]);

            pending.Should().NotContain(d => d.Start < FirstDay);
        }

        [Fact]
        public void PendingDays_WhenRetentionReachesTheHorizon_OwesNothing()
        {
            BackupDayPlan.PendingDays(Today, 90, []).Should().BeEmpty();
        }

        [Fact]
        public void PendingDays_MatchesJobsByTheirUtcDay()
        {
            // A job written by the previous code carries the window start as a UTC midnight; the
            // driver may hand it back as Unspecified or Local, which must still land on that day.
            var jobs = AllDoneExcept(LastDay);
            jobs.Add(Job(DateTime.SpecifyKind(LastDay, DateTimeKind.Unspecified), LogTraceBackupJobStatus.Completed));

            BackupDayPlan.PendingDays(Today, Retention, jobs).Should().BeEmpty();

            var localJobs = AllDoneExcept(LastDay);
            localJobs.Add(Job(LastDay.ToLocalTime(), LogTraceBackupJobStatus.Completed));

            BackupDayPlan.PendingDays(Today, Retention, localJobs).Should().BeEmpty();
        }
    }
}
