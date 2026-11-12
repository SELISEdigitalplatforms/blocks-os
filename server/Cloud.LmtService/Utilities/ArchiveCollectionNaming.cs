using System;
using System.Globalization;

namespace Cloud.LmtService.Utilities
{
    /// <summary>
    /// The one place that knows how an archive collection is named:
    /// <c>{tenantId}_{yyyyMMdd}_{yyyyMMdd}</c>.
    /// <para>
    /// The repositories build the name when they write, the backup parses it back when it uploads,
    /// and the failure paths build it again to clean up a partial archive - so the format lives
    /// here rather than being spelled out at each of those call sites.
    /// </para>
    /// </summary>
    public static class ArchiveCollectionNaming
    {
        private const string DateFormat = "yyyyMMdd";

        public static string Build(string tenantId, DateTime startDate, DateTime endDate) =>
            $"{tenantId}_{startDate.ToString(DateFormat)}_{endDate.ToString(DateFormat)}";

        /// <summary>
        /// Splits a collection name back into its parts. The two dates are always the trailing
        /// segments, so a tenant id that itself contains an underscore still resolves in full
        /// instead of being truncated at the first separator.
        /// </summary>
        public static bool TryParse(
            string collectionName, out string tenantId, out string startDateText, out string endDateText)
        {
            tenantId = startDateText = endDateText = string.Empty;

            if (string.IsNullOrWhiteSpace(collectionName)) return false;

            var parts = collectionName.Split('_');
            if (parts.Length < 3) return false;

            endDateText = parts[^1];
            startDateText = parts[^2];
            tenantId = string.Join('_', parts[..^2]);

            return !string.IsNullOrWhiteSpace(tenantId);
        }

        /// <summary>
        /// Like <see cref="TryParse(string, out string, out string, out string)"/>, but also reads
        /// the window the collection was archived for, as UTC midnights. Fails for a name whose
        /// trailing segments are not dates, so such a collection is never mistaken for a backup.
        /// </summary>
        public static bool TryParseWindow(
            string collectionName, out string tenantId, out DateTime startDate, out DateTime endDate)
        {
            startDate = endDate = default;

            return TryParse(collectionName, out tenantId, out var startDateText, out var endDateText)
                && TryParseDate(startDateText, out startDate)
                && TryParseDate(endDateText, out endDate);
        }

        private static bool TryParseDate(string text, out DateTime date) =>
            DateTime.TryParseExact(text, DateFormat, CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out date);
    }
}
