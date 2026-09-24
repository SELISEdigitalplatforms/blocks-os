namespace BlocksOs.Api.Middleware;

/// <summary>
/// Paths that must not be served by the SPA <c>index.html</c> fallback.
/// Returning 200 for VCS/backup probes makes OWASP ZAP report "Hidden File Found".
/// </summary>
public static class SpaFallbackGuard
{
    private static readonly string[] Probes =
    [
        "/.git", "/.svn", "/.hg", "/.bzr", "/.env", "/.DS_Store",
        "/BitKeeper", "/CVS", "/_darcs", "/.fossil-settings",
        "/web.config", "/appsettings.json", "/appsettings.Development.json"
    ];

    public static bool IsHiddenOrVcsProbe(string? pathValue)
    {
        var value = pathValue ?? "";
        if (value.Length == 0 || value == "/")
        {
            return false;
        }

        foreach (var probe in Probes)
        {
            if (value.Equals(probe, StringComparison.OrdinalIgnoreCase)
                || value.StartsWith(probe + "/", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        var fileName = Path.GetFileName(value);
        return fileName.StartsWith('.') || fileName.EndsWith("~", StringComparison.Ordinal);
    }
}
