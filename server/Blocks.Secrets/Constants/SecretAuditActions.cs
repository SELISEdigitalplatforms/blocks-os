namespace Blocks.Secrets;

/// <summary>
/// Audited operations. Kept as a closed set so the audit log stays queryable.
/// </summary>
public static class SecretAuditActions
{
    public const string Set = "Set";
    public const string SetMany = "SetMany";
    public const string GetValue = "GetValue";
    public const string GetValues = "GetValues";
    public const string Update = "Update";
    public const string Rotate = "Rotate";
    public const string Lock = "Lock";
    public const string Unlock = "Unlock";
    public const string Delete = "Delete";
    public const string Restore = "Restore";
    public const string UpdateAccess = "UpdateAccess";
    public const string AccessDenied = "AccessDenied";

    /// <summary>
    /// A value was written to the vault but its metadata could not be persisted and the
    /// compensating delete also failed. Records the unreferenced vault key for reconciliation.
    /// </summary>
    public const string VaultOrphan = "VaultOrphan";
}

/// <summary>
/// Outcome of an audited operation.
/// </summary>
public static class SecretAuditOutcomes
{
    public const string Success = "Success";
    public const string Denied = "Denied";
    public const string Failed = "Failed";

    /// <summary>The operation took effect but a follow-up step did not; needs reconciliation.</summary>
    public const string PartialFailure = "PartialFailure";
}

/// <summary>
/// Machine-readable reason codes. Never contains a secret value.
/// </summary>
public static class SecretAuditReasons
{
    public const string NoContext = "NO_CONTEXT";
    public const string InvalidContext = "INVALID_CONTEXT";
    public const string NotInAccessList = "NOT_IN_ACCESS_LIST";
    public const string StatusLocked = "STATUS_LOCKED";
    public const string StatusDeleted = "STATUS_DELETED";
    public const string ValueMissing = "VALUE_MISSING";
    public const string VaultFailure = "VAULT_FAILURE";
    public const string MetadataWriteFailed = "METADATA_WRITE_FAILED";
    public const string CleanupFailed = "CLEANUP_FAILED";
    public const string AccessNotApplicable = "ACCESS_NOT_APPLICABLE";
}
