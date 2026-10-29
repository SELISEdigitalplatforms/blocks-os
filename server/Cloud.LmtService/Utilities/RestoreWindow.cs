using System;

namespace Cloud.LmtService.Utilities
{
    /// <summary>
    /// The range of dates a restore tier can actually serve, derived from the same config values
    /// the client uses to bound its date picker: hot retention decides when a day leaves Mongo for
    /// cold blob storage, and the cold-to-archive lifecycle decides when that blob is moved to the
    /// Archive tier and stops being directly readable. <see cref="MaxSpanDays"/> carries the third
    /// value — how many days one request may cover — which used to be hard-coded at seven in two
    /// unrelated places.
    /// </summary>
    public readonly record struct RestoreWindow(DateTime Earliest, DateTime Latest, int MaxSpanDays)
    {
        /// <summary>
        /// Span limit applied when the configuration document has no MaxRestoreRangeInDays. Mongo
        /// deserializes the missing field to 0, and deployed documents predate it, so an unset
        /// value has to mean "what it meant before the field existed" rather than "nothing allowed".
        /// </summary>
        public const int DefaultMaxSpanDays = 7;

        public bool Contains(DateTime date) => date.Date >= Earliest.Date && date.Date <= Latest.Date;

        /// <summary>
        /// True when the inclusive range is wider than the tier allows. Compares whole days: the
        /// client sends an end-of-day timestamp, which must not count as one day more.
        /// </summary>
        public bool SpanExceedsLimit(DateTime start, DateTime end) =>
            (end.Date - start.Date).TotalDays + 1 > MaxSpanDays;

        public static RestoreWindow ForCold(int hotRetentionDays, int coldToArchiveDays, int maxRestoreRangeDays, DateTime utcNow)
        {
            var today = utcNow.Date;

            // A day's blob is only written on the following backup run, so the newest restorable
            // day is one further back than hot retention alone suggests.
            var coldSelectionDays = hotRetentionDays + 1;

            // The window is exactly as wide as the lifecycle keeps a blob in the cold tier, so a
            // configured span larger than that could never be satisfied — offering it would let
            // the picker promise days the tier does not hold.
            var windowWidthDays = coldToArchiveDays + 1;

            return new RestoreWindow(
                Earliest: today.AddDays(-(coldSelectionDays + coldToArchiveDays)),
                Latest: today.AddDays(-coldSelectionDays),
                MaxSpanDays: Math.Min(windowWidthDays, ResolveMaxSpan(maxRestoreRangeDays)));
        }

        public static RestoreWindow ForArchive(int hotRetentionDays, int coldToArchiveDays, int maxRestoreRangeDays, DateTime utcNow)
        {
            var today = utcNow.Date;
            var coldSelectionDays = hotRetentionDays + 1;

            // Archive picks up one day past where cold leaves off; there is no lower bound, since
            // blobs stay in the Archive tier until they are deleted. That makes the configured
            // span the only thing bounding how much one request may ask for.
            return new RestoreWindow(
                Earliest: DateTime.MinValue,
                Latest: today.AddDays(-(coldSelectionDays + coldToArchiveDays + 1)),
                MaxSpanDays: ResolveMaxSpan(maxRestoreRangeDays));
        }

        public string Describe() =>
            Earliest == DateTime.MinValue
                ? $"on or before {Latest:yyyy-MM-dd}"
                : $"between {Earliest:yyyy-MM-dd} and {Latest:yyyy-MM-dd}";

        private static int ResolveMaxSpan(int configuredDays) =>
            configuredDays > 0 ? configuredDays : DefaultMaxSpanDays;
    }
}
