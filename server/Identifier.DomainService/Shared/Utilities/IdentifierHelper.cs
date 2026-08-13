using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Controllers;
using System.Text;

namespace DomainService.Shared
{
    public static class IdentifierHelper
    {
        public static bool BeAValidUrl(string url)
        {
            return Uri.TryCreate(url, UriKind.Absolute, out Uri? uriResult) &&
                   (uriResult.Scheme == Uri.UriSchemeHttp || uriResult.Scheme == Uri.UriSchemeHttps);
        }

        public static string ExtractMainDomain(string domain)
        {
            if (string.IsNullOrWhiteSpace(domain))
                return string.Empty;

            domain = domain.Replace("http://", string.Empty)
                 .Replace("https://", string.Empty);

            var parts = domain.Split('.');
            if (parts.Length < 2)
                return domain;

            return string.Join('.', parts.TakeLast(2));
        }

        // The blocksapi vhost for an application always sits directly under that
        // application's cookie domain ("<cname-label>.<cookie-domain>") — the
        // record the UI asks the customer to create, and the same shape used when
        // a binding is torn down. Working it out from the site host alone by
        // dropping the leftmost label assumes every site host carries a
        // subdomain: on an apex host that label *is* the registrable name, so
        // "example.shop" collapses to "shop" and the derived API host belongs to
        // someone else entirely.
        //
        // Both arguments must already be normalized (lowercase, no scheme, no
        // trailing slash).
        public static string ResolveCookieDomain(string siteHost, string storedCookieDomain)
        {
            if (string.IsNullOrWhiteSpace(siteHost))
                return string.Empty;

            // What the customer registered for the application is authoritative,
            // but only while it actually covers this host — a stale or mistyped
            // entry must not aim the derived host at an unrelated domain.
            if (!string.IsNullOrWhiteSpace(storedCookieDomain) && CoversHost(siteHost, storedCookieDomain))
                return storedCookieDomain;

            var separator = siteHost.IndexOf('.', StringComparison.Ordinal);
            if (separator < 0)
                return siteHost;

            // Nothing on record to read it from: the parent of the site host is
            // the cookie domain, unless the host is already registrable
            // ("example.com", "example.co.uk"), in which case it is its own.
            var parent = siteHost[(separator + 1)..];
            return IsPublicSuffix(parent) ? siteHost : parent;
        }

        private static bool CoversHost(string siteHost, string cookieDomain) =>
            siteHost == cookieDomain || siteHost.EndsWith($".{cookieDomain}", StringComparison.Ordinal);

        // Enough of the public suffix list to keep the common multi-label TLDs
        // ("co.uk", "com.bd") from being read as registrable domains. A suffix
        // missing from this set only degrades to the old parent-label guess for
        // that TLD — applications with a cookie domain on record never reach it.
        private static readonly HashSet<string> SecondLevelSuffixLabels = new(StringComparer.Ordinal)
        {
            "ac", "biz", "co", "com", "edu", "gob", "gov", "info", "mil", "ne", "net", "or", "org", "res", "sch"
        };

        private static bool IsPublicSuffix(string domain)
        {
            var labels = domain.Split('.');

            return labels.Length switch
            {
                1 => true,
                // ccTLDs are the only registries that hand out second-level
                // suffixes, and every one of them is two letters.
                2 => labels[1].Length == 2 && SecondLevelSuffixLabels.Contains(labels[0]),
                _ => false
            };
        }

        public static string EnvironmentMapper(string env) =>
        env switch
        {
            "dev" => "d",
            "test" => "t",
            "stg" => "s",
            "iat" => "i",
            "uat" => "u",
            "prod-shadow" => "h",
            "pre-prod" => "r",
            "prod" => "p",
            _ => "n"
        };

        public static (string? Controller, string? Action) GetControllerAction(HttpContext httpContext)
        {
            var endpoint = httpContext.GetEndpoint();
            if (endpoint == null)
                return (null, null);

            var descriptor = endpoint.Metadata
                .GetMetadata<ControllerActionDescriptor>();

            return (
                descriptor?.ControllerName?.ToLowerInvariant(),
                descriptor?.ActionName?.ToLowerInvariant()
            );
        }

        public static bool IsSupportedEnvironment(string env)
        {
            var supportedEnvironments = new HashSet<string>
            {
                "dev", "test", "stg", "iat", "uat", "prod-shadow", "pre-prod", "prod"
            };
            return supportedEnvironments.Contains(env);
        }
        public static bool IsRabbitMq(string connectionString)
        {
            if (Uri.TryCreate(connectionString, UriKind.Absolute, out var uri))
            {
                return uri.Scheme.Equals("amqp", StringComparison.OrdinalIgnoreCase) ||
                       uri.Scheme.Equals("amqps", StringComparison.OrdinalIgnoreCase);
            }

            return false;
        }
    }
}