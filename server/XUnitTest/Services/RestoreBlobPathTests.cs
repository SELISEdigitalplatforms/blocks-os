using System;
using Cloud.LmtService.Utilities;
using FluentAssertions;

namespace XUnitTest.Services
{
    /// <summary>
    /// Restore locates a day's archive by reconstructing the name the backup pipeline wrote, so
    /// these tests pin the exact strings ArchiveService produces. Backup writes one
    /// tenant-aggregated file per day per data type — services are a column inside the file, never
    /// part of the name — which is why there is no per-service overload to get wrong.
    /// </summary>
    public class RestoreBlobPathTests
    {
        [Fact]
        public void ForLogs_MatchesTheNameBackupWrites()
        {
            var path = RestoreBlobPath.ForLogs("tenant-a", new DateTime(2026, 3, 17, 0, 0, 0, DateTimeKind.Utc));

            path.Should().Be("Tenants/tenant-a/logs/logs_tenant-a_20260317_20260318.parquet");
        }

        [Fact]
        public void ForTraces_MatchesTheNameBackupWrites()
        {
            var path = RestoreBlobPath.ForTraces("tenant-a", new DateTime(2026, 3, 17, 0, 0, 0, DateTimeKind.Utc));

            path.Should().Be("Tenants/tenant-a/traces/traces_tenant-a_20260317_20260318.parquet");
        }

        [Fact]
        public void ForLogs_IgnoresTheTimeComponent()
        {
            var midnight = RestoreBlobPath.ForLogs("tenant-a", new DateTime(2026, 3, 17, 0, 0, 0, DateTimeKind.Utc));
            var lateEvening = RestoreBlobPath.ForLogs("tenant-a", new DateTime(2026, 3, 17, 23, 59, 59, DateTimeKind.Utc));

            lateEvening.Should().Be(midnight);
        }

        [Fact]
        public void ForLogs_RollsOverMonthAndYearBoundaries()
        {
            var path = RestoreBlobPath.ForLogs("tenant-a", new DateTime(2026, 12, 31, 0, 0, 0, DateTimeKind.Utc));

            path.Should().Be("Tenants/tenant-a/logs/logs_tenant-a_20261231_20270101.parquet");
        }
    }
}
