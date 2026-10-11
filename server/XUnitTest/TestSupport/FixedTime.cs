namespace XUnitTest.TestSupport;

/// <summary>A clock that says what the test tells it to. Proration and periods depend on "now".</summary>
internal sealed class FixedTime : TimeProvider
{
    private DateTimeOffset _now;

    public FixedTime(DateTime utcNow) => _now = new DateTimeOffset(DateTime.SpecifyKind(utcNow, DateTimeKind.Utc));

    public override DateTimeOffset GetUtcNow() => _now;

    public void Advance(TimeSpan by) => _now = _now.Add(by);
}
