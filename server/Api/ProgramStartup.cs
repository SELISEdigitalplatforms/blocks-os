using System.Net;
using BlocksOs.Api.Security;
using Microsoft.AspNetCore.HttpOverrides;

namespace BlocksOs.Api;

/// <summary>
/// Startup steps called from <c>Program.cs</c>, kept out of the top-level statements so the
/// host's registration and pipeline order stays readable there. Each method does exactly what
/// the inline code it replaced did, at the same point in the startup sequence.
/// </summary>
internal static class ProgramStartup
{
    /// <summary>Key of the per-request style nonce in <see cref="HttpContext.Items"/>.</summary>
    internal const string StyleNonceItemKey = "csp-style-nonce";

    /// <summary>
    /// Trusts forwarded headers only from the configured ingress proxies/networks. Without
    /// configuration nothing is registered, which keeps ASP.NET's default trusted-proxy behaviour.
    /// </summary>
    internal static void AddKnownForwardedHeaders(this IServiceCollection services, IConfiguration configuration)
    {
        var knownForwardedProxies = configuration.GetSection("ForwardedHeaders:KnownProxies").Get<string[]>() ?? [];
        var knownForwardedNetworks = configuration.GetSection("ForwardedHeaders:KnownNetworks").Get<string[]>() ?? [];
        if (knownForwardedProxies.Length > 0 || knownForwardedNetworks.Length > 0)
        {
            services.Configure<ForwardedHeadersOptions>(options =>
                ConfigureKnownForwarders(options, knownForwardedProxies, knownForwardedNetworks));
        }
    }

    private static void ConfigureKnownForwarders(ForwardedHeadersOptions options, string[] knownForwardedProxies, string[] knownForwardedNetworks)
    {
        options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
        options.KnownIPNetworks.Clear();
        options.KnownProxies.Clear();
        foreach (var value in knownForwardedProxies)
        {
            if (IPAddress.TryParse(value, out var proxy)) options.KnownProxies.Add(proxy);
            else Console.Error.WriteLine($"Invalid ForwardedHeaders:KnownProxies value '{value}' was ignored.");
        }
        foreach (var value in knownForwardedNetworks)
        {
            if (System.Net.IPNetwork.TryParse(value, out var network)) options.KnownIPNetworks.Add(network);
            else Console.Error.WriteLine($"Invalid ForwardedHeaders:KnownNetworks value '{value}' was ignored.");
        }
    }

    /// <summary>
    /// Browser-facing security headers for the SPA and static assets, and the per-request style
    /// nonce the SPA shell is rendered with.
    /// </summary>
    internal static void UseSecurityHeaders(this WebApplication app, string contentSecurityPolicy, StyleNonce styleNonces)
    {
        app.Use(async (context, next) =>
        {
            // The response's style nonce, stable per browser (see StyleNonce); the SPA shell is
            // rendered with the same value as the header.
            var styleNonce = styleNonces.ForRequest(context);
            context.Items[StyleNonceItemKey] = styleNonce;

            context.Response.OnStarting(() =>
            {
                ApplySecurityHeaders(context, contentSecurityPolicy, styleNonce);
                return Task.CompletedTask;
            });

            await next();
        });
    }

    private static void ApplySecurityHeaders(HttpContext context, string contentSecurityPolicy, string styleNonce)
    {
        var headers = context.Response.Headers;
        headers["X-Content-Type-Options"] = "nosniff";
        headers["X-Frame-Options"] = "DENY";
        headers["Referrer-Policy"] = "no-referrer";
        headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
        headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
        // Runtime config is an external /runtime-config.js (no inline script), so script-src
        // stays strict. The hosts come from configuration -- see ContentSecurityPolicy.
        headers["Content-Security-Policy"] = ContentSecurityPolicy.WithStyleNonce(contentSecurityPolicy, styleNonce);

        var path = context.Request.Path.Value ?? "";
        if (path == "/" || path.EndsWith(".html", StringComparison.OrdinalIgnoreCase) ||
            path.EndsWith("runtime-config.js", StringComparison.OrdinalIgnoreCase) ||
            !Path.HasExtension(path))
        {
            // HTML / SPA routes / runtime config: do not cache so previews pick up header/config changes.
            headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0";
            headers["Pragma"] = "no-cache";
        }
        else if (path.StartsWith("/assets/", StringComparison.OrdinalIgnoreCase))
        {
            // Content-hashed Vite assets are immutable.
            headers["Cache-Control"] = "public, max-age=31536000, immutable";
        }
    }

    /// <summary>
    /// A GET or HEAD for "/" or "/index.html", which the static file middleware would otherwise
    /// serve verbatim with the nonce placeholder still in it.
    /// </summary>
    internal static bool IsSpaShellRequest(HttpRequest request)
    {
        var path = request.Path.Value;
        return (HttpMethods.IsGet(request.Method) || HttpMethods.IsHead(request.Method)) &&
            (path is "/" or "" || string.Equals(path, "/index.html", StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>
    /// Replaces the frontend runtime placeholders in the published SPA files with configured values.
    /// </summary>
    internal static void ApplyFrontendRuntimeSettings(IConfiguration configuration, string webRootPath)
    {
        // ACTIVE path: read frontend runtime values from the "FrontendRuntime" section. These
        // are supplied at deploy time from the Mongo "Secrets" document (SecretKey
        // "blocks-secret-os") via AddMongoDbConfiguration, using keys prefixed
        // "FrontendRuntime:BLOCKS_*". Standard .NET config layering still applies, so env vars
        // named "FrontendRuntime__BLOCKS_*" override individual keys.
        var section = configuration.GetSection("FrontendRuntime");

        // The Mongo configuration source is added after the environment-variable source, so it
        // wins standard layering and a "FrontendRuntime__BLOCKS_*" env var would otherwise be
        // ignored. Read the env var first so the documented per-key override actually applies.
        // Scoped to these tokens on purpose: it must not reshuffle global config precedence.
        string? Resolve(string key) =>
            Environment.GetEnvironmentVariable($"FrontendRuntime__{key}") is { Length: > 0 } fromEnv
                ? fromEnv
                : section[key];

        var replacements = new Dictionary<string, string?>
        {
            ["__BLOCKS_API_BASE_URL__"] = Resolve("BLOCKS_API_BASE_URL"),
            ["__BLOCKS_X_BLOCKS_KEY__"] = Resolve("BLOCKS_X_BLOCKS_KEY"),
            ["__BLOCKS_GOOGLE_SITE_KEY__"] = Resolve("BLOCKS_GOOGLE_SITE_KEY"),
            ["__BLOCKS_CONSTRUCT_URL__"] = Resolve("BLOCKS_CONSTRUCT_URL"),
            ["__BLOCKS_GITHUB_SSO_CLIENT_ID__"] = Resolve("BLOCKS_GITHUB_SSO_CLIENT_ID"),
            ["__BLOCKS_APP_URL__"] = Resolve("BLOCKS_APP_URL"),
            ["__BLOCKS_IDP_BASE_URL__"] = Resolve("BLOCKS_IDP_BASE_URL"),
            ["__BLOCKS_OS_URL__"] = Resolve("BLOCKS_OS_URL"),
            ["__BLOCKS_OIDC_CLIENT_ID__"] = Resolve("BLOCKS_OIDC_CLIENT_ID"),
            ["__BLOCKS_BASE_DOMAIN__"] = Resolve("BLOCKS_BASE_DOMAIN"),
            ["__BLOCKS_IAM_BASE_URL__"] = Resolve("BLOCKS_IAM_BASE_URL"),
            ["__BLOCKS_IAM_CALLBACK_URL__"] = Resolve("BLOCKS_IAM_CALLBACK_URL"),
            ["__BLOCKS_LOCALIZATION_BASE_URL__"] = Resolve("BLOCKS_LOCALIZATION_BASE_URL"),
            ["__BLOCKS_LOCALIZATION_CALLBACK_URL__"] = Resolve("BLOCKS_LOCALIZATION_CALLBACK_URL"),
            ["__BLOCKS_AGENTS_BASE_URL__"] = Resolve("BLOCKS_AGENTS_BASE_URL"),
            ["__BLOCKS_AGENTS_CALLBACK_URL__"] = Resolve("BLOCKS_AGENTS_CALLBACK_URL"),
            ["__BLOCKS_DATA_BASE_URL__"] = Resolve("BLOCKS_DATA_BASE_URL"),
            ["__BLOCKS_DATA_CALLBACK_URL__"] = Resolve("BLOCKS_DATA_CALLBACK_URL"),
            ["__BLOCKS_OS_BASE_URL__"] = Resolve("BLOCKS_OS_BASE_URL"),
            ["__BLOCKS_OS_CALLBACK_URL__"] = Resolve("BLOCKS_OS_CALLBACK_URL"),
            ["__BLOCKS_UTILITIES_BASE_URL__"] = Resolve("BLOCKS_UTILITIES_BASE_URL"),
            ["__BLOCKS_UTILITIES_CALLBACK_URL__"] = Resolve("BLOCKS_UTILITIES_CALLBACK_URL"),
            ["__BLOCKS_LOGIC_BASE_URL__"] = Resolve("BLOCKS_LOGIC_BASE_URL"),
            ["__BLOCKS_LOGIC_CALLBACK_URL__"] = Resolve("BLOCKS_LOGIC_CALLBACK_URL"),
            ["__BLOCKS_MONITOR_BASE_URL__"] = Resolve("BLOCKS_MONITOR_BASE_URL"),
            ["__BLOCKS_MONITOR_CALLBACK_URL__"] = Resolve("BLOCKS_MONITOR_CALLBACK_URL"),
            ["__BLOCKS_RELEASE_BASE_URL__"] = Resolve("BLOCKS_RELEASE_BASE_URL"),
            ["__BLOCKS_RELEASE_CALLBACK_URL__"] = Resolve("BLOCKS_RELEASE_CALLBACK_URL"),
            ["__BLOCKS_STUDIO_BASE_URL__"] = Resolve("BLOCKS_STUDIO_BASE_URL"),
            ["__BLOCKS_STUDIO_CALLBACK_URL__"] = Resolve("BLOCKS_STUDIO_CALLBACK_URL"),
            ["__BLOCKS_IAM_CLIENT_ID__"] = Resolve("BLOCKS_IAM_CLIENT_ID"),
            ["__BLOCKS_DATA_CLIENT_ID__"] = Resolve("BLOCKS_DATA_CLIENT_ID"),
            ["__BLOCKS_LOCALIZATION_CLIENT_ID__"] = Resolve("BLOCKS_LOCALIZATION_CLIENT_ID"),
            ["__BLOCKS_AGENTS_CLIENT_ID__"] = Resolve("BLOCKS_AGENTS_CLIENT_ID"),
            ["__BLOCKS_OS_CLIENT_ID__"] = Resolve("BLOCKS_OS_CLIENT_ID"),
            ["__BLOCKS_UTILITIES_CLIENT_ID__"] = Resolve("BLOCKS_UTILITIES_CLIENT_ID"),
            ["__BLOCKS_LOGIC_CLIENT_ID__"] = Resolve("BLOCKS_LOGIC_CLIENT_ID"),
            ["__BLOCKS_MONITOR_CLIENT_ID__"] = Resolve("BLOCKS_MONITOR_CLIENT_ID"),
            ["__BLOCKS_RELEASE_CLIENT_ID__"] = Resolve("BLOCKS_RELEASE_CLIENT_ID"),
            ["__BLOCKS_STUDIO_CLIENT_ID__"] = Resolve("BLOCKS_STUDIO_CLIENT_ID"),
            ["__BLOCKS_CNAME_BASE_URL__"] = Resolve("BLOCKS_CNAME_BASE_URL"),
            ["__BLOCKS_ALLOWED_SERVICES__"] = Resolve("BLOCKS_ALLOWED_SERVICES"),
            ["__BLOCKS_ROLLBAR_CLIENT_TOKEN__"] = Resolve("BLOCKS_ROLLBAR_CLIENT_TOKEN"),
            ["__BLOCKS_ROLLBAR_ENV__"] = Resolve("BLOCKS_ROLLBAR_ENV"),
        };

        var files = Directory.EnumerateFiles(webRootPath, "*", SearchOption.AllDirectories)
            .Where(path =>
            {
                var ext = Path.GetExtension(path);
                return ext.Equals(".html", StringComparison.OrdinalIgnoreCase)
                    || ext.Equals(".js", StringComparison.OrdinalIgnoreCase)
                    || ext.Equals(".css", StringComparison.OrdinalIgnoreCase)
                    || ext.Equals(".json", StringComparison.OrdinalIgnoreCase);
            });

        foreach (var filePath in files)
        {
            var content = File.ReadAllText(filePath);
            var updated = content;

            foreach (var (token, value) in replacements)
            {
                if (!string.IsNullOrWhiteSpace(value))
                {
                    updated = updated.Replace(token, value, StringComparison.Ordinal);
                }
            }

            if (!ReferenceEquals(content, updated) && !content.Equals(updated, StringComparison.Ordinal))
            {
                File.WriteAllText(filePath, updated);
            }
        }
    }
}
