using Cloud.LmtService.Utilities;
using FluentAssertions;

namespace XUnitTest.Utilities
{
    public class LogTimeRangeTests
    {
        [Fact]
        public void AsUtc_UtcValue_IsReturnedUnchanged()
        {
            var value = new DateTime(2026, 3, 14, 9, 30, 0, DateTimeKind.Utc);

            var result = LogTimeRange.AsUtc(value);

            result.Ticks.Should().Be(value.Ticks);
            result.Kind.Should().Be(DateTimeKind.Utc);
        }

        [Fact]
        public void AsUtc_UnspecifiedValue_KeepsClockReadingAndOnlyGainsUtcKind()
        {
            // Clients of this API send UTC. An unmarked value must therefore be read as
            // UTC -- the clock reading must not be shifted by the server's timezone.
            var value = new DateTime(2026, 3, 14, 9, 30, 0, DateTimeKind.Unspecified);

            var result = LogTimeRange.AsUtc(value);

            result.Ticks.Should().Be(value.Ticks);
            result.Kind.Should().Be(DateTimeKind.Utc);
        }

        [Fact]
        public void AsUtc_LocalValue_IsConvertedToTheSameInstantInUtc()
        {
            var value = new DateTime(2026, 3, 14, 9, 30, 0, DateTimeKind.Local);

            var result = LogTimeRange.AsUtc(value);

            // Passes in any machine timezone, including UTC (where the offset is zero).
            result.Ticks.Should().Be(value.ToUniversalTime().Ticks);
            result.Kind.Should().Be(DateTimeKind.Utc);
        }

        [Fact]
        public void AsUtc_LocalValue_RepresentsTheSameInstant()
        {
            var value = new DateTime(2026, 7, 1, 23, 45, 0, DateTimeKind.Local);

            var result = LogTimeRange.AsUtc(value);

            new DateTimeOffset(result).Should().Be(new DateTimeOffset(value));
        }

        [Fact]
        public void AsUtc_NullableUtcValue_IsReturnedUnchanged()
        {
            DateTime? value = new DateTime(2026, 3, 14, 9, 30, 0, DateTimeKind.Utc);

            var result = LogTimeRange.AsUtc(value);

            result.Should().NotBeNull();
            result!.Value.Ticks.Should().Be(value.Value.Ticks);
            result.Value.Kind.Should().Be(DateTimeKind.Utc);
        }

        [Fact]
        public void AsUtc_NullableUnspecifiedValue_KeepsClockReadingAndOnlyGainsUtcKind()
        {
            DateTime? value = new DateTime(2026, 3, 14, 9, 30, 0, DateTimeKind.Unspecified);

            var result = LogTimeRange.AsUtc(value);

            result.Should().NotBeNull();
            result!.Value.Ticks.Should().Be(value.Value.Ticks);
            result.Value.Kind.Should().Be(DateTimeKind.Utc);
        }

        [Fact]
        public void AsUtc_Null_ReturnsNull()
        {
            DateTime? value = null;

            var result = LogTimeRange.AsUtc(value);

            result.Should().BeNull();
        }
    }
}
