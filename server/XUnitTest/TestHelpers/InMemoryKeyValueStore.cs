using Blocks.Genesis;

namespace XUnitTest.TestHelpers
{
    /// <summary>
    /// A dictionary-backed <see cref="IKeyValueStore"/> for the single-value calls (Get / GetByPrefix /
    /// Set / Delete / Exists). Keys are trimmed like Genesis does. Multi-value calls are not used by the
    /// code under test and throw. No database is involved.
    /// </summary>
    public sealed class InMemoryKeyValueStore : IKeyValueStore
    {
        public Dictionary<string, object> Rows { get; } = new();
        public bool FailOnSet { get; set; }
        public int SetCalls { get; private set; }

        public Task<T?> GetAsync<T>(string key, bool impersonated = true, CancellationToken cancellationToken = default) =>
            Task.FromResult(Rows.TryGetValue(key.Trim(), out var v) ? (T?)v : default);

        public Task<IReadOnlyList<T>> GetByPrefixAsync<T>(string prefix, bool impersonated = true, CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<T>>(Rows.Where(r => r.Key.StartsWith(prefix.Trim(), StringComparison.Ordinal)).Select(r => (T)r.Value).ToList());

        public Task SetAsync<T>(string key, T value, bool impersonated = true, CancellationToken cancellationToken = default)
        {
            SetCalls++;
            if (FailOnSet) throw new InvalidOperationException("kv down");
            Rows[key.Trim()] = value!;
            return Task.CompletedTask;
        }

        public Task<bool> DeleteAsync(string key, bool impersonated = true, CancellationToken cancellationToken = default) =>
            Task.FromResult(Rows.Remove(key.Trim()));

        public Task<bool> ExistsAsync(string key, bool impersonated = true, CancellationToken cancellationToken = default) =>
            Task.FromResult(Rows.ContainsKey(key.Trim()));

        public Task<string> AddAsync<T>(string key, T value, IEnumerable<string>? tags = null, bool impersonated = true, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<IReadOnlyList<KeyValueItem<T>>> GetAllAsync<T>(string key, IEnumerable<string>? tags = null, bool impersonated = true, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<IReadOnlyList<KeyValueItem<T>>> GetAllByPrefixAsync<T>(string prefix, IEnumerable<string>? tags = null, bool impersonated = true, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<KeyValueItem<T>?> GetByIdAsync<T>(string itemId, bool impersonated = true, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<bool> UpdateByIdAsync<T>(string itemId, T value, bool impersonated = true, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<bool> DeleteByIdAsync(string itemId, bool impersonated = true, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<long> DeleteAllAsync(string key, bool impersonated = true, CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }
}
