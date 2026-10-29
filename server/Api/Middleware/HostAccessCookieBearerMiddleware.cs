using Microsoft.AspNetCore.Http;

namespace BlocksOs.Api.Middleware;

/// <summary>
/// IAM's OIDC callback sets an httpOnly access-token cookie named after the
/// redirect host (e.g. <c>dev-os-612.blocksdevelopers.com</c> on PR previews,
/// <c>dev-os.blocksdevelopers.com</c> on the shared dev host). JwtBearer auth
/// in Blocks.Genesis reads the <c>Authorization</c> header (and a fixed cookie
/// key that does not track preview hosts), so API calls from the SPA — which
/// only send <c>credentials: include</c> — arrive unauthenticated on previews.
/// Promote the host-named cookie into <c>Authorization: Bearer …</c> when the
/// header is absent so preview and main hosts both authenticate.
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

    /// <summary>Promote host-named IAM access cookie to Authorization when missing.</summary>
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

        if (context.Request.Cookies.TryGetValue(host, out var token)
            && !string.IsNullOrWhiteSpace(token))
        {
            context.Request.Headers.Authorization = $"Bearer {token}";
        }
    }
}
