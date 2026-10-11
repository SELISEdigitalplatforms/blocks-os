using Microsoft.AspNetCore.Http;

namespace BlocksOs.Api.Controllers;

/// <summary>Gets the caller address after trusted forwarded-header processing has run.</summary>
public static class IntegrationClientIp
{
    public static string Resolve(HttpContext context) =>
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
}
