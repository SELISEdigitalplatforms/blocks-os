using System;

namespace XUnitTest.TestSupport
{
    /// <summary>A clock that stands still until a test moves it, for code that reads TimeProvider.</summary>
    public sealed class ManualTimeProvider : TimeProvider
    {
        private readonly object _gate = new();
        private DateTimeOffset _utcNow;

        public ManualTimeProvider(DateTimeOffset utcNow) => _utcNow = utcNow;

        public override DateTimeOffset GetUtcNow()
        {
            lock (_gate) return _utcNow;
        }

        public void Advance(TimeSpan by)
        {
            lock (_gate) _utcNow += by;
        }
    }
}
