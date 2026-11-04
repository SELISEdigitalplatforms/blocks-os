namespace Blocks.Secrets;

/// <summary>
/// The secret store: a dedicated database holding metadata and audit for the tenants placed on
/// one Mongo connection.
/// </summary>
/// <remarks>
/// A database of its own rather than per-tenant collections, so the secret store can be
/// backed up, replicated and access-controlled separately from application data — and one of
/// them per connection rather than one for the platform, so a tenant's secrets sit on the
/// cluster its own data is on. <see cref="SecretStoreContext"/> picks the connection. Tenant
/// isolation within a store is enforced by the mandatory <c>TenantId</c> filter on every query
/// in <see cref="SecretRepository"/> and <see cref="SecretAuditRepository"/>.
/// </remarks>
public static class SecretCollections
{
    public const string DatabaseName = "SecretStore";

    /// <summary>Secret metadata. Never holds a value.</summary>
    public const string Secrets = "Secrets";

    public const string AuditLogs = "SecretAuditLogs";
}
