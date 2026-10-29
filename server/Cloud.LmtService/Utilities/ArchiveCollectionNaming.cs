using System;

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
    }
}
