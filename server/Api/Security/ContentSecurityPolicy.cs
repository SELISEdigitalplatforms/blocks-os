using Microsoft.Extensions.Configuration;

namespace BlocksOs.Api.Security;

/// <summary>
/// Builds the SPA's Content-Security-Policy from configuration.
/// <para>
/// The origins are derived from the same <c>FrontendRuntime</c> section that fills the
/// SPA's runtime config, so the policy describes whatever environment the host is
/// actually running in. They used to be a hardcoded list of <c>dev-*</c> hosts, which
/// meant the policy was correct on dev and would have blocked the SPA from reaching its
/// own IAM and API everywhere else.
/// </para>
/// </summary>
public static class ContentSecurityPolicy
{
    /// <summary>
    /// <c>FrontendRuntime</c> keys holding an origin the SPA makes requests to. Anything
    /// not derivable from these (a CDN, a third-party service) goes in
    /// <c>Csp:ExtraConnectSrc</c> / <c>Csp:ExtraImgSrc</c> rather than back into code.
    /// </summary>
    internal static readonly string[] ConnectOriginKeys =
    [
        "BLOCKS_API_BASE_URL",
        "BLOCKS_IAM_BASE_URL",
        "BLOCKS_IDP_BASE_URL",
        "BLOCKS_CONSTRUCT_URL",
        "BLOCKS_LOCALIZATION_BASE_URL",
        "BLOCKS_AGENTS_BASE_URL",
        "BLOCKS_DATA_BASE_URL",
        "BLOCKS_UTILITIES_BASE_URL",
        "BLOCKS_LOGIC_BASE_URL",
        "BLOCKS_MONITOR_BASE_URL",
        "BLOCKS_RELEASE_BASE_URL",
        "BLOCKS_STUDIO_BASE_URL",
        "BLOCKS_OS_BASE_URL",
        "BLOCKS_OS_URL",
        "BLOCKS_APP_URL",
    ];

    /// <summary>Where a login POST may be sent: the identity host and the SPA's own host.</summary>
    internal static readonly string[] FormActionOriginKeys =
    [
        "BLOCKS_IAM_BASE_URL",
        "BLOCKS_IDP_BASE_URL",
        "BLOCKS_OS_BASE_URL",
        "BLOCKS_OS_URL",
    ];

    public static string Build(IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        var runtime = configuration.GetSection("FrontendRuntime");
        var csp = configuration.GetSection("Csp");

        return BuildPolicy(
            connectSrc: Origins(runtime, ConnectOriginKeys).Concat(Split(csp["ExtraConnectSrc"])),
            imgSrc: Split(csp["ExtraImgSrc"]),
            formAction: Origins(runtime, FormActionOriginKeys).Concat(Split(csp["ExtraFormAction"])));
    }

    /// <summary>
    /// The policy itself, separated from configuration so it can be asserted directly.
    /// Public rather than internal because the test project has no InternalsVisibleTo.
    /// </summary>
    public static string BuildPolicy(
        IEnumerable<string?> connectSrc,
        IEnumerable<string?> imgSrc,
        IEnumerable<string?> formAction)
    {
        var connect = Normalize(connectSrc);
        var img = Normalize(imgSrc);
        var form = Normalize(formAction);

        return string.Join(
            " ",
            "default-src 'self';",
            "script-src 'self';",

            // Inline styles, both <style> elements and style attributes.
            //
            // The narrower option was tried first and measured: keep style-src-elem 'self'
            // and relax only style-src-attr. It does not work here. Loading the built bundle
            // under that policy in Chromium still reported three style-src-elem violations --
            // Radix/vaul/sonner/cmdk inject <style> elements at runtime for scroll-lock and
            // positioning -- and the login page still rendered at 2809px tall instead of 900px
            // because the layout could not apply. Relaxing both cleared every violation.
            //
            // Neither form can carry a nonce (a style attribute has nowhere to put one, and
            // the elements are injected by library code that is not given one), and the values
            // are unbounded, so hashes are not an option either. script-src stays strict, which
            // is the directive that actually matters for injection.
            "style-src 'self' 'unsafe-inline';",

            $"img-src 'self' data: blob:{Suffix(img)};",
            "font-src 'self' data:;",
            $"connect-src 'self'{Suffix(connect)};",
            "frame-ancestors 'none';",
            "base-uri 'self';",
            $"form-action 'self'{Suffix(form)}");
    }

    /// <summary>Reduce configured values to distinct, sorted origins.</summary>
    private static List<string> Normalize(IEnumerable<string?> values) =>
        values
            .Select(ToOrigin)
            .Where(origin => origin is not null)
            .Select(origin => origin!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(origin => origin, StringComparer.OrdinalIgnoreCase)
            .ToList();

    private static IEnumerable<string?> Origins(IConfiguration section, IEnumerable<string> keys) =>
        keys.Select(key => section[key]);

    /// <summary>
    /// A CSP source is an origin, so any path, query or trailing slash is dropped. A value
    /// that is not an absolute http(s) URL is ignored rather than emitted verbatim, so a
    /// malformed secret cannot inject a directive.
    /// </summary>
    public static string? ToOrigin(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;

        if (!Uri.TryCreate(value.Trim(), UriKind.Absolute, out var uri)) return null;

        if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps) return null;

        return uri.GetLeftPart(UriPartial.Authority);
    }

    /// <summary>Space- or comma-separated list, for origins no runtime key describes.</summary>
    public static IEnumerable<string?> Split(string? value) =>
        string.IsNullOrWhiteSpace(value)
            ? []
            : value.Split([' ', ',', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    private static string Suffix(List<string> origins) =>
        origins.Count == 0 ? string.Empty : " " + string.Join(" ", origins);
}
