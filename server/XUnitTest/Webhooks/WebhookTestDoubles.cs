using System;
using System.Collections.Generic;
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using Configuration.DomainService.Webhooks;

namespace XUnitTest.Webhooks
{
    /// <summary>A clock fixed at <see cref="Now"/>; elapsed time still comes from the system.</summary>
    internal sealed class FixedTimeProvider : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = new(2026, 11, 4, 9, 20, 0, TimeSpan.Zero);

        public override DateTimeOffset GetUtcNow() => Now;
    }

    /// <summary>Answers DNS from a table; an unknown host fails like a real lookup.</summary>
    internal sealed class TableDnsResolver : IWebhookDnsResolver
    {
        public Dictionary<string, IPAddress[]> Hosts { get; } = new(StringComparer.OrdinalIgnoreCase)
        {
            ["hooks.example.com"] = [IPAddress.Parse("93.184.216.34")]
        };

        public Task<IPAddress[]> ResolveAsync(string host, CancellationToken cancellationToken) =>
            Hosts.TryGetValue(host, out var addresses)
                ? Task.FromResult(addresses)
                : Task.FromException<IPAddress[]>(new System.Net.Sockets.SocketException((int)System.Net.Sockets.SocketError.HostNotFound));
    }

    /// <summary>Secrets kept in memory; records what was created and retired.</summary>
    internal sealed class InMemoryWebhookSecretStore : IWebhookSecretStore
    {
        public Dictionary<string, string> Values { get; } = new();
        public List<string> Retired { get; } = new();
        public List<string> Calls { get; } = new();
        public bool FailOnCreate { get; set; }

        public Task<string> CreateAsync(string webhookId, string value, CancellationToken cancellationToken)
        {
            Calls.Add("secret.create");
            if (FailOnCreate)
            {
                throw new InvalidOperationException("vault down");
            }

            var id = "sec-" + (Values.Count + 1);
            Values[id] = value;
            return Task.FromResult(id);
        }

        public Task RetireQuietlyAsync(string secretId)
        {
            Calls.Add("secret.retire");
            Retired.Add(secretId);
            return Task.CompletedTask;
        }

        public Task<string?> GetValueAsync(string secretId, CancellationToken cancellationToken) =>
            Task.FromResult(Values.TryGetValue(secretId, out var value) && !Retired.Contains(secretId) ? value : null);
    }
}
