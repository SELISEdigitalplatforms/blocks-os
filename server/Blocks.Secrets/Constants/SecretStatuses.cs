namespace Blocks.Secrets;

/// <summary>
/// Lifecycle states of a secret. Only <see cref="Active"/> permits a value read.
/// </summary>
public static class SecretStatuses
{
    public const string Active = "active";

    /// <summary>Temporarily unreadable. Metadata stays visible and the value stays in the vault.</summary>
    public const string Locked = "locked";

    /// <summary>
    /// Soft-deleted. The vault value is deliberately retained so <c>RestoreAsync</c> can bring
    /// the secret back; Key Vault purge protection would otherwise make the name unusable for
    /// the whole retention window.
    /// </summary>
    public const string Deleted = "deleted";

    public static bool IsValid(string? status) =>
        status is Active or Locked or Deleted;
}
