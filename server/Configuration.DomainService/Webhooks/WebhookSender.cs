using System.Diagnostics;
using System.Net.Http.Headers;
using System.Net.Sockets;
using System.Text;

namespace Configuration.DomainService.Webhooks;

/// <summary>What to POST: the receiver URL, the event id, the exact body and the secret to sign it with.</summary>
public sealed record WebhookSendRequest(string Url, string EventId, string Body, string Secret);

/// <summary>
/// The outcome of one POST. <see cref="HttpStatus"/> is set when an answer came back; otherwise
/// <see cref="ErrorCode"/> says why not. Never holds the response body or headers.
/// </summary>
public sealed record WebhookSendResult(int? HttpStatus, long DurationMs, string? ErrorCode, TimeSpan? RetryAfter);

/// <summary>Signs and POSTs one webhook event.</summary>
public interface IWebhookSender
{
    Task<WebhookSendResult> SendAsync(WebhookSendRequest request, CancellationToken cancellationToken);
}

/// <summary>
/// Dedicated client for calls to receivers outside Blocks: https only, no redirects, no proxy, 10 s limit, reads at
/// most 4 KB of the answer, connects only to an address <see cref="IWebhookAddressGuard"/> checked, and sends no
/// trace or baggage headers (see <see cref="WebhookHttpHandler"/>).
/// </summary>
public sealed class WebhookHttpSender : IWebhookSender, IDisposable
{
    public const int MaxResponseBytes = 4 * 1024;
    public static readonly TimeSpan RequestTimeout = TimeSpan.FromSeconds(10);
    private const string JsonMediaType = "application/json";

    private readonly HttpClient _client;
    private readonly TimeProvider _timeProvider;
    private readonly TimeSpan _timeout;

    public WebhookHttpSender(HttpMessageHandler handler, TimeProvider timeProvider)
        : this(handler, timeProvider, RequestTimeout)
    {
    }

    internal WebhookHttpSender(HttpMessageHandler handler, TimeProvider timeProvider, TimeSpan timeout)
    {
        _client = new HttpClient(handler, disposeHandler: true) { Timeout = Timeout.InfiniteTimeSpan };
        _timeProvider = timeProvider;
        _timeout = timeout;
    }

    public Task<WebhookSendResult> SendAsync(WebhookSendRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        var uri = WebhookAddressGuard.ParseUrl(request.Url);
        if (uri is null)
        {
            return Task.FromResult(new WebhookSendResult(null, 0, WebhookAttemptErrors.UrlNotAllowed, null));
        }

        return SendCoreAsync(uri, request, cancellationToken);
    }

    public void Dispose() => _client.Dispose();

    private async Task<WebhookSendResult> SendCoreAsync(Uri uri, WebhookSendRequest request, CancellationToken cancellationToken)
    {
        using var message = BuildMessage(uri, request, _timeProvider.GetUtcNow().ToUnixTimeSeconds());
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(_timeout);
        var started = _timeProvider.GetTimestamp();

        try
        {
            using var response = await _client.SendAsync(message, HttpCompletionOption.ResponseHeadersRead, timeout.Token);
            await ReadCappedAsync(response, timeout.Token);
            return new WebhookSendResult((int)response.StatusCode, ElapsedMs(started), null, RetryAfterOf(response));
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return new WebhookSendResult(null, ElapsedMs(started), WebhookAttemptErrors.Timeout, null);
        }
        catch (HttpRequestException ex)
        {
            return new WebhookSendResult(null, ElapsedMs(started), ErrorCodeOf(ex), null);
        }
    }

    internal static HttpRequestMessage BuildMessage(Uri uri, WebhookSendRequest request, long timestamp)
    {
        var message = new HttpRequestMessage(HttpMethod.Post, uri)
        {
            Content = new ByteArrayContent(Encoding.UTF8.GetBytes(request.Body))
        };
        message.Content.Headers.ContentType = new MediaTypeHeaderValue(JsonMediaType);
        message.Headers.TryAddWithoutValidation(WebhookSignature.IdHeader, request.EventId);
        message.Headers.TryAddWithoutValidation(WebhookSignature.TimestampHeader, timestamp.ToString(System.Globalization.CultureInfo.InvariantCulture));
        message.Headers.TryAddWithoutValidation(
            WebhookSignature.SignatureHeader,
            WebhookSignature.Sign(request.Secret, request.EventId, timestamp, request.Body));
        return message;
    }

    // Reads at most MaxResponseBytes and drops the rest: a huge or endless answer cannot hold the worker.
    private static async Task ReadCappedAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        var buffer = new byte[1024];
        var total = 0;
        while (total < MaxResponseBytes)
        {
            var read = await stream.ReadAsync(buffer.AsMemory(0, Math.Min(buffer.Length, MaxResponseBytes - total)), cancellationToken);
            if (read == 0)
            {
                return;
            }

            total += read;
        }
    }

    private TimeSpan? RetryAfterOf(HttpResponseMessage response)
    {
        var retryAfter = response.Headers.RetryAfter;
        if (retryAfter?.Delta is { } delta)
        {
            return delta;
        }

        return retryAfter?.Date is { } date ? date - _timeProvider.GetUtcNow() : null;
    }

    private static string ErrorCodeOf(HttpRequestException exception)
    {
        if (exception.InnerException is WebhookAddressRejectedException)
        {
            return WebhookAttemptErrors.UrlNotAllowed;
        }

        return exception.InnerException is SocketException { SocketErrorCode: SocketError.HostNotFound or SocketError.NoData }
            ? WebhookAttemptErrors.DnsError
            : WebhookAttemptErrors.NetworkError;
    }

    private long ElapsedMs(long started) => (long)_timeProvider.GetElapsedTime(started).TotalMilliseconds;
}

/// <summary>Our own error codes on an attempt. Never an exception message.</summary>
public static class WebhookAttemptErrors
{
    public const string Timeout = "timeout";
    public const string NetworkError = "network_error";
    public const string DnsError = "dns_error";
    public const string UrlNotAllowed = "url_not_allowed";
    public const string Redirect = "redirect";
    public const string HttpError = "http_error";
    public const string SecretMissing = "secret_missing";
    public const string SecretInvalid = "secret_invalid";
    public const string RetryNotQueued = "retry_not_queued";
    public const string InternalError = "internal_error";
}

/// <summary>The handler behind <see cref="WebhookHttpSender"/>.</summary>
public static class WebhookHttpHandler
{
    public static SocketsHttpHandler Create(IWebhookAddressGuard guard)
    {
        ArgumentNullException.ThrowIfNull(guard);
        return new SocketsHttpHandler
        {
            AllowAutoRedirect = false,
            UseProxy = false,
            UseCookies = false,
            AutomaticDecompression = System.Net.DecompressionMethods.None,
            ConnectTimeout = WebhookHttpSender.RequestTimeout,
            PooledConnectionLifetime = TimeSpan.FromMinutes(2),
            // User decision 2026-11-04: outside receivers never see our trace (no traceparent, tracestate, baggage).
            ActivityHeadersPropagator = DistributedContextPropagator.CreateNoOutputPropagator(),
            ConnectCallback = (context, cancellationToken) => ConnectAsync(guard, context, cancellationToken)
        };
    }

    // Resolves and checks the host here, then connects to exactly that address, so a DNS answer that changes
    // between the check and the connect cannot point the call at an internal address.
    private static async ValueTask<Stream> ConnectAsync(IWebhookAddressGuard guard, SocketsHttpConnectionContext context, CancellationToken cancellationToken)
    {
        var address = await guard.ResolveAllowedAsync(context.DnsEndPoint.Host, cancellationToken);
        var socket = new Socket(address.AddressFamily, SocketType.Stream, ProtocolType.Tcp) { NoDelay = true };
        try
        {
            await socket.ConnectAsync(new System.Net.IPEndPoint(address, context.DnsEndPoint.Port), cancellationToken);
            return new NetworkStream(socket, ownsSocket: true);
        }
        catch
        {
            socket.Dispose();
            throw;
        }
    }
}
