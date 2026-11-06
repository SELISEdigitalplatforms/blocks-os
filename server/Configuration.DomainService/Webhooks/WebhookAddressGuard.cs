using System.Net;

namespace Configuration.DomainService.Webhooks;

/// <summary>Resolves a host name. An interface so tests can answer without DNS.</summary>
public interface IWebhookDnsResolver
{
    Task<IPAddress[]> ResolveAsync(string host, CancellationToken cancellationToken);
}

/// <inheritdoc cref="IWebhookDnsResolver"/>
public sealed class SystemDnsResolver : IWebhookDnsResolver
{
    public Task<IPAddress[]> ResolveAsync(string host, CancellationToken cancellationToken) =>
        Dns.GetHostAddressesAsync(host, cancellationToken);
}

/// <summary>A webhook host resolved to an address that is not public. Never retried.</summary>
public sealed class WebhookAddressRejectedException : Exception
{
    public WebhookAddressRejectedException()
        : base("The webhook host does not resolve to public addresses only.")
    {
    }

    public WebhookAddressRejectedException(string message)
        : base(message)
    {
    }

    public WebhookAddressRejectedException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}

/// <summary>The URL and address rules a webhook must pass at save and again at every send.</summary>
public interface IWebhookAddressGuard
{
    /// <summary>True when the URL is an absolute https URL without user info whose host resolves to public IPs only.</summary>
    Task<bool> IsUrlAllowedAsync(string? url, CancellationToken cancellationToken);

    /// <summary>
    /// The address to connect to: the host's first address when every address it resolves to is public.
    /// </summary>
    /// <exception cref="WebhookAddressRejectedException">Some address is not public, or there is none.</exception>
    Task<IPAddress> ResolveAllowedAsync(string host, CancellationToken cancellationToken);
}

/// <inheritdoc cref="IWebhookAddressGuard"/>
public sealed class WebhookAddressGuard : IWebhookAddressGuard
{
    public const int MaxUrlLength = 2048;

    private readonly IWebhookDnsResolver _resolver;

    public WebhookAddressGuard(IWebhookDnsResolver resolver)
    {
        _resolver = resolver;
    }

    /// <summary>The parsed URL when its shape is allowed (https, absolute, host, no user info); otherwise null.</summary>
    public static Uri? ParseUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url) || url.Length > MaxUrlLength ||
            !Uri.TryCreate(url.Trim(), UriKind.Absolute, out var uri))
        {
            return null;
        }

        var allowed = uri.Scheme == Uri.UriSchemeHttps && !string.IsNullOrEmpty(uri.Host) && string.IsNullOrEmpty(uri.UserInfo);
        return allowed ? uri : null;
    }

    public async Task<bool> IsUrlAllowedAsync(string? url, CancellationToken cancellationToken)
    {
        var uri = ParseUrl(url);
        if (uri is null)
        {
            return false;
        }

        try
        {
            await ResolveAllowedAsync(uri.IdnHost, cancellationToken);
            return true;
        }
        catch (Exception ex) when (ex is WebhookAddressRejectedException or System.Net.Sockets.SocketException or ArgumentException)
        {
            return false;
        }
    }

    public async Task<IPAddress> ResolveAllowedAsync(string host, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(host);
        var addresses = IPAddress.TryParse(host.Trim('[', ']'), out var literal)
            ? [literal]
            : await _resolver.ResolveAsync(host, cancellationToken);

        if (addresses.Length == 0 || !addresses.All(WebhookAddressPolicy.IsPublic))
        {
            throw new WebhookAddressRejectedException();
        }

        return addresses[0];
    }
}
