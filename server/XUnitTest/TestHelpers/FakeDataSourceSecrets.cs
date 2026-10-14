using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Blocks.Secrets;
using Moq;
using StackExchange.Redis;

namespace XUnitTest.TestHelpers
{
    /// <summary>
    /// In-memory <see cref="ISecretService"/> for the os SPEC2 data-gateway tests. Records every call in
    /// <see cref="Calls"/> (shared with the fake repository/redis when a test passes one log), keeps the requests
    /// it got, and throws like the real service: GetValue of a locked/deleted secret = SecretStateException, of an
    /// unknown id or a missing vault value = SecretNotFoundException.
    /// </summary>
    internal sealed class FakeSecretService : ISecretService
    {
        private int _next;

        public FakeSecretService(List<string>? calls = null) => Calls = calls ?? new List<string>();

        public List<string> Calls { get; }
        public ConcurrentDictionary<string, (string Status, string? Value)> Secrets { get; } = new();
        public List<SetSecretRequest> SetRequests { get; } = new();

        /// <summary>Thrown by GetValueAsync when set (e.g. SecretVaultException = vault down).</summary>
        public Exception? GetValueThrows { get; set; }
        public Exception? SetThrows { get; set; }
        public Exception? RotateThrows { get; set; }

        public string Add(string value, string status = SecretStatuses.Active, string? id = null)
        {
            id ??= Guid.NewGuid().ToString("N");
            Secrets[id] = (status, value);
            return id;
        }

        private void Log(string call) { lock (Calls) Calls.Add(call); }

        public Task<string> SetAsync(SetSecretRequest request, CancellationToken cancellationToken = default)
        {
            Log("secret.Set");
            if (SetThrows != null) throw SetThrows;
            lock (SetRequests) SetRequests.Add(request);
            var id = "s" + Interlocked.Increment(ref _next).ToString("D31");
            Secrets[id] = (SecretStatuses.Active, request.Value);
            return Task.FromResult(id);
        }

        public Task<SecretResult?> GetAsync(string secretId, CancellationToken cancellationToken = default)
        {
            Log("secret.Get");
            return Task.FromResult(Secrets.TryGetValue(secretId, out var s)
                ? new SecretResult { SecretId = secretId, Status = s.Status, Type = SecretTypes.Service }
                : null);
        }

        public Task<string> GetValueAsync(string secretId, CancellationToken cancellationToken = default)
        {
            Log("secret.GetValue");
            if (GetValueThrows != null) throw GetValueThrows;
            if (!Secrets.TryGetValue(secretId, out var s)) throw new SecretNotFoundException(secretId);
            if (s.Status == SecretStatuses.Locked) throw new SecretStateException(SecretStatuses.Locked, "read value");
            if (s.Status == SecretStatuses.Deleted) throw new SecretStateException(SecretStatuses.Deleted, "read value");
            if (s.Value == null) throw new SecretNotFoundException(secretId, "VALUE_MISSING");
            return Task.FromResult(s.Value);
        }

        public Task RotateAsync(string secretId, RotateSecretRequest request, CancellationToken cancellationToken = default)
        {
            Log("secret.Rotate");
            if (RotateThrows != null) throw RotateThrows;
            var s = Secrets[secretId];
            Secrets[secretId] = (s.Status, request.Value);
            return Task.CompletedTask;
        }

        public Task DeleteAsync(string secretId, CancellationToken cancellationToken = default)
        {
            Log("secret.Delete");
            return Task.CompletedTask;
        }

        public Task<IReadOnlyDictionary<string, string>> SetManyAsync(IReadOnlyCollection<SetSecretRequest> requests, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<SecretListResult> FindAsync(SecretFilter filter, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<IReadOnlyList<SecretTagEntry>> GetTagsAsync(CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<IReadOnlyDictionary<string, string>> GetValuesAsync(IReadOnlyCollection<string> secretIds, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task UpdateAsync(string secretId, UpdateSecretRequest request, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task LockAsync(string secretId, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task UnlockAsync(string secretId, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task RestoreAsync(string secretId, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task PurgeAsync(string secretId, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task UpdateAccessAsync(string secretId, SecretAccess access, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<SecretAuditListResult> GetAuditLogsAsync(SecretAuditFilter filter, CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }

    /// <summary>
    /// Fake Redis behind <see cref="ICacheClient.CacheDatabase"/>: a transaction applies its queued HSET/HDEL to
    /// <see cref="Hashes"/> only when executed and committed. Records "redis.*" calls; KeyDelete is recorded so a
    /// test can assert it is never used.
    /// </summary>
    internal sealed class FakeRedis
    {
        public FakeRedis(List<string>? calls = null) => Calls = calls ?? new List<string>();

        public List<string> Calls { get; }
        public ConcurrentDictionary<string, Dictionary<string, string>> Hashes { get; } = new();
        public bool CommitResult { get; set; } = true;
        public Exception? ExecuteThrows { get; set; }
        public int Transactions { get; private set; }

        private void Log(string call) { lock (Calls) Calls.Add(call); }

        public ICacheClient Client()
        {
            var db = new Mock<IDatabase>(MockBehavior.Strict);
            db.Setup(d => d.CreateTransaction(It.IsAny<object>())).Returns(() => NewTransaction());
            db.Setup(d => d.KeyDeleteAsync(It.IsAny<RedisKey>(), It.IsAny<CommandFlags>()))
              .Callback(() => Log("redis.KeyDelete")).ReturnsAsync(true);
            var cache = new Mock<ICacheClient>();
            cache.Setup(c => c.CacheDatabase()).Returns(db.Object);
            return cache.Object;
        }

        private ITransaction NewTransaction()
        {
            Transactions++;
            var pending = new List<Action>();
            var tx = new Mock<ITransaction>(MockBehavior.Strict);
            tx.Setup(t => t.HashSetAsync(It.IsAny<RedisKey>(), It.IsAny<HashEntry[]>(), It.IsAny<CommandFlags>()))
              .Callback<RedisKey, HashEntry[], CommandFlags>((k, entries, _) =>
              {
                  Log("redis.HSET");
                  pending.Add(() =>
                  {
                      var hash = Hashes.GetOrAdd(k.ToString(), _ => new Dictionary<string, string>());
                      foreach (var e in entries) hash[e.Name.ToString()] = e.Value.ToString();
                  });
              })
              .Returns(Task.CompletedTask);
            tx.Setup(t => t.HashDeleteAsync(It.IsAny<RedisKey>(), It.IsAny<RedisValue>(), It.IsAny<CommandFlags>()))
              .Callback<RedisKey, RedisValue, CommandFlags>((k, field, _) =>
              {
                  Log("redis.HDEL:" + field);
                  pending.Add(() =>
                  {
                      if (Hashes.TryGetValue(k.ToString(), out var hash)) hash.Remove(field.ToString());
                  });
              })
              .ReturnsAsync(true);
            tx.Setup(t => t.ExecuteAsync(It.IsAny<CommandFlags>()))
              .Returns(() =>
              {
                  Log("redis.EXEC");
                  if (ExecuteThrows != null) throw ExecuteThrows;
                  if (CommitResult) pending.ForEach(a => a());
                  return Task.FromResult(CommitResult);
              });
            return tx.Object;
        }

        public bool HasAnyValueField() => Hashes.Values.Any(h => h.ContainsKey("DbConnectionString"));
    }
}
