namespace Os.DataAccess.Notifications;

/// <summary>
/// Built-in notification names that were dropped (their sends are gone). A project never receives them, and the
/// propagator removes any built-in copy of them from the tenants. Same list as the dropped-names seed file.
/// </summary>
public static class RetiredNotificationNames
{
    private static readonly HashSet<string> Names = new(StringComparer.Ordinal)
    {
        "data-schema-version-live",
        "data-source-secret-migration-failed",
        "lmt-restore-status",
        "logic-mailbox-sync-failing",
        "os-certificate-changed",
        "os-email-usage-near-limit",
        "os-lmt-restore-progress",
        "os-mail-server-failing",
        "os-project-disabled-or-deleted",
        "os-secret-changed",
        "release-build-monitoring-timed-out",
        "release-data-gateway-instance-finished",
        "release-github-access-failed",
        "release-repo-secret-changed"
    };

    public static IReadOnlyCollection<string> All => Names;

    public static bool Contains(string? name) => name is not null && Names.Contains(name.Trim());
}
