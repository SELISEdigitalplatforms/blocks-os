using System;
using Cloud.LmtService.Utilities;
using FluentAssertions;

namespace XUnitTest.Services
{
    /// <summary>
    /// Which dates each tier can serve. These bounds mirror the picker limits the client computes
    /// from GetHotDataBlobUploadInDays, so a request the UI would not allow is also refused by the
    /// API — previously a hand-rolled call could ask cold restore for archived dates and only fail
    /// hours later with a raw Azure tier error.
    /// </summary>
    public class RestoreWindowTests
    {
        private static readonly DateTime Today = new(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc);

        // hot = 30 → cold selection starts 31 days back; +90 archive lifecycle → 121 days back.
        private const int HotRetentionDays = 30;
        private const int ColdToArchiveDays = 90;
        private const int ConfiguredMaxRange = 7;

        [Fact]
        public void ForCold_SpansFromTheArchiveBoundaryToTheHotBoundary()
        {
            var window = RestoreWindow.ForCold(HotRetentionDays, ColdToArchiveDays, ConfiguredMaxRange, Today);

            window.Earliest.Should().Be(Today.AddDays(-121));
            window.Latest.Should().Be(Today.AddDays(-31));
        }

        [Fact]
        public void ForArchive_StartsOneDayBeyondTheColdWindow()
        {
            var window = RestoreWindow.ForArchive(HotRetentionDays, ColdToArchiveDays, ConfiguredMaxRange, Today);

            window.Latest.Should().Be(Today.AddDays(-122));
            window.Earliest.Should().Be(DateTime.MinValue);
        }

        [Theory]
        [InlineData(-31)]
        [InlineData(-75)]
        [InlineData(-121)]
        public void Contains_AcceptsDatesInsideTheColdWindow(int dayOffset)
        {
            var window = RestoreWindow.ForCold(HotRetentionDays, ColdToArchiveDays, ConfiguredMaxRange, Today);

            window.Contains(Today.AddDays(dayOffset)).Should().BeTrue();
        }

        [Theory]
        [InlineData(-5)]    // still in hot storage
        [InlineData(-30)]   // one day short of the cold boundary
        [InlineData(-122)]  // already moved to the archive tier
        public void Contains_RejectsDatesOutsideTheColdWindow(int dayOffset)
        {
            var window = RestoreWindow.ForCold(HotRetentionDays, ColdToArchiveDays, ConfiguredMaxRange, Today);

            window.Contains(Today.AddDays(dayOffset)).Should().BeFalse();
        }

        [Fact]
        public void Contains_IgnoresTheTimeComponent()
        {
            var window = RestoreWindow.ForCold(HotRetentionDays, ColdToArchiveDays, ConfiguredMaxRange, Today);

            window.Contains(Today.AddDays(-31).AddHours(23)).Should().BeTrue();
        }
        // ── Selectable span ──────────────────────────────────────────────────
        // The picker used to advertise a flat "Max 7 Days" regardless of config. Under the dev
        // config (ColdToArchiveLifeCycleInDays = 3) the cold window is only four days wide, so
        // seven was a promise the tier could never keep.

        [Fact]
        public void ForCold_UsesTheConfiguredSpanWhenTheWindowIsWiderThanIt()
        {
            // 91-day window, configured cap of 7 → the cap is the binding limit.
            var window = RestoreWindow.ForCold(HotRetentionDays, ColdToArchiveDays, ConfiguredMaxRange, Today);

            window.MaxSpanDays.Should().Be(7);
        }

        [Fact]
        public void ForCold_NarrowsTheSpanToTheWindowWidthWhenTheWindowIsSmaller()
        {
            // The dev config: hot = 1, cold-to-archive = 3 → cold covers exactly 4 days,
            // so no request can legitimately span the configured 7.
            var window = RestoreWindow.ForCold(hotRetentionDays: 1, coldToArchiveDays: 3, maxRestoreRangeDays: 7, utcNow: Today);

            window.MaxSpanDays.Should().Be(4);
            (window.Latest - window.Earliest).TotalDays.Should().Be(3, "four inclusive days");
        }

        [Fact]
        public void ForArchive_UsesTheConfiguredSpan()
        {
            // Archive has no lower bound, so the configured cap is the only thing limiting a span.
            var window = RestoreWindow.ForArchive(hotRetentionDays: 1, coldToArchiveDays: 3, maxRestoreRangeDays: 7, utcNow: Today);

            window.MaxSpanDays.Should().Be(7);
        }

        [Theory]
        [InlineData(0, false)]  // single day
        [InlineData(3, false)]  // four inclusive days, exactly the limit
        [InlineData(4, true)]   // five days, one too many
        public void SpanExceedsLimit_CountsDaysInclusively(int extraDays, bool expected)
        {
            var window = RestoreWindow.ForCold(hotRetentionDays: 1, coldToArchiveDays: 3, maxRestoreRangeDays: 7, utcNow: Today);
            var start = window.Earliest;

            window.SpanExceedsLimit(start, start.AddDays(extraDays)).Should().Be(expected);
        }

        [Fact]
        public void SpanExceedsLimit_IgnoresTheTimeComponent()
        {
            // The client sends an end-of-day timestamp; that must not count as an extra day.
            var window = RestoreWindow.ForCold(hotRetentionDays: 1, coldToArchiveDays: 3, maxRestoreRangeDays: 7, utcNow: Today);
            var start = window.Earliest;

            window.SpanExceedsLimit(start, start.AddDays(3).AddHours(23).AddMinutes(59)).Should().BeFalse();
        }
    }
}
