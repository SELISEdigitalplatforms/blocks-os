using AngleSharp.Dom;
using AngleSharp.Html.Parser;
using System.Text.RegularExpressions;

namespace Configuration.DomainService.Mail.Template
{
    /// <summary>
    /// What a mail template's HTML may hold. Templates go out from the system's own address, so a
    /// script, a form or a link to a foreign site would make a convincing phishing mail. The HTML is
    /// checked, not rewritten: a refused save names the first problem and the editor fixes it.
    /// </summary>
    public static partial class MailTemplateHtmlPolicy
    {
        private static readonly HashSet<string> ForbiddenElements = new(StringComparer.OrdinalIgnoreCase)
        {
            "script", "iframe", "frame", "frameset", "object", "embed", "applet", "portal", "base",
            "form", "input", "button", "textarea", "select", "svg", "math"
        };

        private static readonly HashSet<string> UrlAttributes = new(StringComparer.OrdinalIgnoreCase)
        {
            "href", "src", "action", "formaction", "background", "poster", "cite", "data", "xlink:href"
        };

        private static readonly HtmlParser Parser = new();

        /// <summary>
        /// The problems in <paramref name="html"/>, first found first; empty when it is safe to send.
        /// A link (<c>a</c>/<c>area</c> href) must point to one of <paramref name="allowedLinkHosts"/>, or
        /// take its address from a <c>{{placeholder}}</c> the sending service fills in.
        /// </summary>
        public static IReadOnlyList<string> FindProblems(string? html, IReadOnlySet<string> allowedLinkHosts)
        {
            ArgumentNullException.ThrowIfNull(allowedLinkHosts);

            var problems = new List<string>();
            if (string.IsNullOrWhiteSpace(html))
            {
                return problems;
            }

            var document = Parser.ParseDocument(html);
            foreach (var element in document.All)
            {
                CheckElement(element, allowedLinkHosts, problems);
            }

            return problems;
        }

        /// <summary>The hosts of the given application domains ("https://App.example.com/" → "app.example.com").</summary>
        public static IReadOnlySet<string> HostsOf(IEnumerable<string?>? domains) =>
            (domains ?? [])
                .Select(HostOf)
                .Where(host => host.Length > 0)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

        private static void CheckElement(IElement element, IReadOnlySet<string> allowedLinkHosts, List<string> problems)
        {
            var name = element.LocalName;
            if (ForbiddenElements.Contains(name))
            {
                problems.Add($"<{name}> is not allowed in a mail template.");
                return;
            }

            if (name == "meta" && string.Equals(element.GetAttribute("http-equiv"), "refresh", StringComparison.OrdinalIgnoreCase))
            {
                problems.Add("<meta http-equiv=\"refresh\"> is not allowed in a mail template.");
            }

            if (name == "style")
            {
                CheckCss(element.TextContent, problems);
            }

            var isLink = name is "a" or "area";
            foreach (var attribute in element.Attributes)
            {
                CheckAttribute(attribute, name, isLink, allowedLinkHosts, problems);
            }
        }

        private static void CheckAttribute(IAttr attribute, string elementName, bool isLink, IReadOnlySet<string> allowedLinkHosts, List<string> problems)
        {
            var attributeName = attribute.Name;
            if (attributeName.StartsWith("on", StringComparison.OrdinalIgnoreCase) || attributeName.Equals("srcdoc", StringComparison.OrdinalIgnoreCase))
            {
                problems.Add($"The attribute {attributeName} is not allowed in a mail template.");
            }
            else if (attributeName.Equals("style", StringComparison.OrdinalIgnoreCase))
            {
                CheckCss(attribute.Value, problems);
            }
            else if (attributeName.Equals("srcset", StringComparison.OrdinalIgnoreCase))
            {
                foreach (var candidate in attribute.Value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                {
                    CheckUrl(candidate.Split(' ')[0], linkHosts: null, allowImageData: false, problems);
                }
            }
            else if (UrlAttributes.Contains(attributeName))
            {
                var linkHosts = isLink && attributeName.Equals("href", StringComparison.OrdinalIgnoreCase) ? allowedLinkHosts : null;
                CheckUrl(attribute.Value, linkHosts, allowImageData: elementName == "img", problems);
            }
        }

        private static void CheckCss(string css, List<string> problems)
        {
            if (css.Contains("expression(", StringComparison.OrdinalIgnoreCase)
                || css.Contains("javascript:", StringComparison.OrdinalIgnoreCase)
                || css.Contains("behavior:", StringComparison.OrdinalIgnoreCase))
            {
                problems.Add("Script in a style is not allowed in a mail template.");
            }

            foreach (Match match in CssUrl().Matches(css))
            {
                CheckUrl(match.Groups["url"].Value, linkHosts: null, allowImageData: true, problems);
            }

            foreach (Match match in CssImport().Matches(css))
            {
                CheckUrl(match.Groups["url"].Value, linkHosts: null, allowImageData: false, problems);
            }
        }

        /// <param name="linkHosts">For a link: the hosts it may point to. Null for an image, font or style address.</param>
        private static void CheckUrl(string value, IReadOnlySet<string>? linkHosts, bool allowImageData, List<string> problems)
        {
            var url = value.Trim();

            // Empty, an in-page anchor, mail and phone links, and an address the sender fills in.
            if (url.Length == 0 || url.StartsWith('#') || url.StartsWith("{{", StringComparison.Ordinal)
                || url.StartsWith("mailto:", StringComparison.OrdinalIgnoreCase)
                || url.StartsWith("tel:", StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            if (allowImageData && ImageDataUrl().IsMatch(url))
            {
                return;
            }

            var https = HttpsUrl().Match(url);
            if (!https.Success)
            {
                problems.Add($"\"{Shorten(url)}\" is not allowed: addresses in a mail template must start with https://.");
                return;
            }

            if (linkHosts is null)
            {
                return;
            }

            var host = HostOf(url);
            if (host.Contains("{{", StringComparison.Ordinal) || linkHosts.Contains(host))
            {
                return;
            }

            problems.Add($"A link to {host} is not allowed: links in a mail template may point only to this project's own domains.");
        }

        /// <summary>
        /// The host of a domain or URL: no scheme, user info, port or path, lower case. "https://a.com@b.com"
        /// is b.com, the host a browser would open.
        /// </summary>
        private static string HostOf(string? value)
        {
            var host = (value ?? string.Empty).Trim();
            var scheme = host.IndexOf("://", StringComparison.Ordinal);
            if (scheme >= 0)
            {
                host = host[(scheme + 3)..];
            }

            var end = host.IndexOfAny(['/', '?', '#', '\\']);
            if (end >= 0)
            {
                host = host[..end];
            }

            host = host[(host.LastIndexOf('@') + 1)..];

            var port = host.LastIndexOf(':');
            if (port >= 0)
            {
                host = host[..port];
            }

            return host.TrimEnd('.').ToLowerInvariant();
        }

        private static string Shorten(string url) => url.Length <= 60 ? url : url[..60] + "…";

        [GeneratedRegex(@"^https://[^/?#\s]+", RegexOptions.IgnoreCase)]
        private static partial Regex HttpsUrl();

        [GeneratedRegex(@"^data:image/(png|jpe?g|gif|webp);", RegexOptions.IgnoreCase)]
        private static partial Regex ImageDataUrl();

        [GeneratedRegex(@"url\(\s*(['""]?)(?<url>[^'"")]*)\1\s*\)", RegexOptions.IgnoreCase)]
        private static partial Regex CssUrl();

        [GeneratedRegex(@"@import\s+(['""])(?<url>[^'""]*)\1", RegexOptions.IgnoreCase)]
        private static partial Regex CssImport();
    }
}
