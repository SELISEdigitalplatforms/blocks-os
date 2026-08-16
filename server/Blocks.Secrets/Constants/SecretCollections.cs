namespace Blocks.Secrets;

/// <summary>
/// The secret store: a dedicated database holding metadata and audit for every tenant.
/// </summary>
/// <remarks>
/// A database of its own rather than per-tenant collections, so the secret store can be
/// backed up, replicated and access-controlled separately from application data. Tenant
/// isolation is enforced by the mandatory <c>TenantId</c> filter on every query in
/// <see cref="SecretRepository"/> and <see cref="SecretAuditRepository"/>.
/// </remarks>
public static class SecretCollections
{
    public const string DatabaseName = "SecretStore";

    /// <summary>Secret metadata. Never holds a value.</summary>
    public const string Secrets = "Secrets";

    public const string AuditLogs = "SecretAuditLogs";
}
