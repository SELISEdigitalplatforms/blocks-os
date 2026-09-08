namespace Cloud.LmtService.Utilities
{
    /// <summary>
    /// Normalizes the DateTime values that go into log time-window filters to genuine
    /// UTC values. Mongo's default DateTimeSerializer calls ToUniversalTime() when it
    /// writes a DateTime, which treats a <see cref="DateTimeKind.Unspecified"/> value as
    /// server-local and silently shifts the requested window by the server's offset.
    /// Callers of this API always send UTC, so an unmarked value is stamped as UTC
    /// rather than converted.
    /// </summary>
    public static class LogTimeRange
    {
        /// <summary>
        /// Returns <paramref name="value"/> as a UTC <see cref="DateTime"/>:
        /// <see cref="DateTimeKind.Utc"/> is returned unchanged,
        /// <see cref="DateTimeKind.Local"/> is converted to the same instant in UTC, and
        /// <see cref="DateTimeKind.Unspecified"/> keeps its clock reading and is simply
        /// marked as UTC.
        /// </summary>
        public static DateTime AsUtc(DateTime value) => value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };

        /// <summary>
        /// Nullable overload of <see cref="AsUtc(DateTime)"/>; null in, null out.
        /// </summary>
        public static DateTime? AsUtc(DateTime? value) =>
            value.HasValue ? AsUtc(value.Value) : null;
    }
}
