using Blocks.Genesis;
using StackExchange.Redis;

namespace Configuration.DomainService.Integration.Services;

/// <summary>
/// Fixed-window counters for the anonymous "Connect with Blocks" endpoints, backed by the shared
/// Redis cache. Modelled on IAM's TokenExchangeAuthorizationService redemption counter: the first
/// increment in a window sets the expiry, so the window advances only when calls actually stop.
/// Throws Genesis's <see cref="BlocksRateLimitException"/>, which the API layer maps to HTTP 429.
/// </summary>
public interface IIntegrationRateLimiter
{
    /// <summary>Throws <see cref="BlocksRateLimitException"/> when the caller's IP is over the limit for the endpoint.</summary>
    Task EnforceAsync(string endpoint, string ip, CancellationToken cancellationToken = default);
}

public sealed class IntegrationRateLimiter : IIntegrationRateLimiter
{
    // CreateRequest: 20 per 10 minutes per IP. Exchange: 10 per minute per IP.
    private static readonly Dictionary<string, (int Limit, TimeSpan Window)> Policies = new()
    {
        ["CreateRequest"] = (20, TimeSpan.FromMinutes(10)),
        ["Exchange"] = (10, TimeSpan.FromMinutes(1)),
    };

    private readonly ICacheClient _cacheClient;

    public IntegrationRateLimiter(ICacheClient cacheClient) => _cacheClient = cacheClient;

    public async Task EnforceAsync(string endpoint, string ip, CancellationToken cancellationToken = default)
    {
        if (!Policies.TryGetValue(endpoint, out var policy)) return;
        var key = $"blocks-os:integration:rate:{endpoint}:{ip}";

        try
        {
            var database = _cacheClient.CacheDatabase();
            var count = await database.StringIncrementAsync(key);
            // Redis applies this condition atomically: every increment repairs an expiry only
            // when the key has none, so a transient failure cannot leave a caller blocked forever.
            await database.KeyExpireAsync(key, policy.Window, ExpireWhen.HasNoExpiry);
            if (count > policy.Limit)
                throw new BlocksRateLimitException("Too many requests. Try again later.");
        }
        catch (BlocksRateLimitException)
        {
            throw;
        }
        catch (Exception)
        {
            // A broken counter must not take the connect flow down; the validation and PKCE
            // checks still stand.
        }
    }
}
