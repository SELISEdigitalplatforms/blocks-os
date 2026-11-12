using Microsoft.AspNetCore.Http;

namespace BlocksOs.Api.Middleware;

/// <summary>
/// IAM's OIDC callback sets an httpOnly access-token cookie named after the
/// redirect host (e.g. <c>dev-os-612.blocksdevelopers.com</c> on PR previews,
/// <c>dev-os.blocksdevelopers.com</c> on the shared dev host). Blocks.Genesis
/// reads the <c>Authorization</c> header first and otherwise the cookie named
/// after the <c>Origin</c> (or <c>Referer</c>) host. A same-origin GET from the
/// SPA carries no <c>Origin</c>, and under the console's
/// <c>Referrer-Policy: no-referrer</c> no <c>Referer</c> either, so Genesis would
/// find no cookie and answer 401. Promote the host-named cookie into
/// <c>Authorization: Bearer …</c> for those requests.
/// <para>
/// Only same-origin requests are promoted. A request from another Blocks app
/// (for example Studio calling <c>/api/Release/GetReposList</c>) always carries
/// its own <c>Origin</c>; promoting this host's cookie there would answer with
/// whichever project the console tab is impersonating instead of the caller's.
/// Those requests are left to Genesis, which picks the caller's cookie.
/// </para>
/// </summary>
public sealed class HostAccessCookieBearerMiddleware(RequestDelegate next)
{
    /// <summary>Invokes the middleware.</summary>
    public Task InvokeAsync(HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        PromoteHostAccessCookie(context);
        return next(context);
    }

    /// <summary>
    /// Promote the host-named IAM access cookie to Authorization when the header is
    /// missing and the request is same-origin (no <c>Origin</c>, or one naming this host).
    /// </summary>
    public static void PromoteHostAccessCookie(HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        if (context.Request.Headers.ContainsKey("Authorization"))
        {
            return;
        }

        var host = context.Request.Host.Host;
        if (string.IsNullOrEmpty(host))
        {
            return;
        }

        if (IsCrossOrigin(context.Request, host))
        {
            return;
        }

        if (context.Request.Cookies.TryGetValue(host, out var token)
            && !string.IsNullOrWhiteSpace(token))
        {
            context.Request.Headers.Authorization = $"Bearer {token}";
        }
    }

    /// <summary>
    /// True when the request names an <c>Origin</c> other than this host. An opaque or
    /// unparseable <c>Origin</c> (such as <c>null</c>) counts as cross-origin. Ports are
    /// ignored, as they are in Genesis's cookie naming.
    /// </summary>
    private static bool IsCrossOrigin(HttpRequest request, string host)
    {
        var origin = request.Headers.Origin.ToString();
        if (string.IsNullOrEmpty(origin))
        {
            return false;
        }

        return !Uri.TryCreate(origin, UriKind.Absolute, out var originUri)
            || !string.Equals(originUri.Host, host, StringComparison.OrdinalIgnoreCase);
    }
}
