using Blocks.Genesis;
using MongoDB.Driver;

namespace Blocks.Secrets;

/// <summary>
/// Resolves the <c>SecretStore</c> database for the calling tenant.
/// </summary>
/// <remarks>
/// <para>
/// The store is one <c>SecretStore</c> database per Mongo connection, not one for the platform
/// and not one per tenant. Which connection is decided by the tenant's own
/// <c>DbConnectionString</c>, recorded in the root registry when the environment was
/// provisioned — so a tenant's secrets sit on the same cluster as the data they unlock. A
/// database of its own, rather than collections inside the tenant database, so the secret store
/// can still be backed up, replicated and access-controlled separately from application data.
/// </para>
/// <para>
/// Two tenants on the same connection therefore share one <c>SecretStore</c>, which makes the
/// <c>TenantId</c> filter on every query load-bearing rather than defence-in-depth: it is the
/// only thing separating them. Both repositories go through <see cref="Secrets"/> and
/// <see cref="AuditLogs"/> so no caller can reach the database without one.
/// </para>
/// <para>
/// The connection is read from the tenant on every access rather than captured, so a placement
/// change takes effect as soon as Genesis refreshes the tenant — the same rule every other
/// tenant-owned store follows. There is deliberately no fallback to the main connection: a
/// tenant that cannot be resolved must fail, because silently reading main would return an
/// empty result set for a tenant whose secrets exist elsewhere, and a write would put a
/// credential on a cluster nobody expects it on.
/// </para>
/// </remarks>
public sealed class SecretStoreContext
{
    private readonly IDbContextProvider _dbContextProvider;
    private readonly ITenants _tenants;

    public SecretStoreContext(IDbContextProvider dbContextProvider, ITenants tenants)
    {
        _dbContextProvider = dbContextProvider;
        _tenants = tenants;
    }

    public IMongoCollection<Secret> Secrets => Database.GetCollection<Secret>(SecretCollections.Secrets);

    public IMongoCollection<SecretAuditLog> AuditLogs => Database.GetCollection<SecretAuditLog>(SecretCollections.AuditLogs);

    /// <summary>The <c>SecretStore</c> database on the calling tenant's connection.</summary>
    public IMongoDatabase Database => GetDatabase(ResolveTenantId());

    /// <summary>
    /// The <c>SecretStore</c> database on a named tenant's connection.
    /// </summary>
    /// <remarks>
    /// For work that carries its target tenant explicitly rather than in an ambient context —
    /// a worker draining a queue, say. Callers on the request path use <see cref="Database"/>.
    /// </remarks>
    public IMongoDatabase GetDatabase(string tenantId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(tenantId);

        var tenant = _tenants.GetTenantByID(tenantId)
            ?? throw new SecretAccessDeniedException(SecretAuditReasons.InvalidContext,
                "The tenant on this request is not in the tenant registry.");

        if (tenant.IsDisabled)
        {
            throw new SecretAccessDeniedException(SecretAuditReasons.InvalidContext,
                "The tenant on this request is disabled.");
        }

        if (string.IsNullOrWhiteSpace(tenant.DbConnectionString))
        {
            // A registry record with no connection is a provisioning fault, not a caller error,
            // so it surfaces as a server failure rather than a 403. The message names neither
            // the connection nor the tenant's placement.
            throw new InvalidOperationException(
                $"Tenant '{tenant.TenantId}' has no database connection recorded in the tenant registry, " +
                "so its secret store cannot be resolved.");
        }

        return _dbContextProvider.GetDatabase(tenant.DbConnectionString, SecretCollections.DatabaseName);
    }

    /// <summary>
    /// The tenant whose store this operation belongs to.
    /// </summary>
    /// <remarks>
    /// Deliberately the same source and the same failures as
    /// <see cref="SecretAuthorizationService.ResolveContext"/>: routing and authorization must
    /// agree on who the caller is, or a request could be authorized against one tenant and read
    /// from another's cluster.
    /// </remarks>
    private static string ResolveTenantId()
    {
        var context = BlocksContext.GetContext()
            ?? throw new SecretAccessDeniedException(SecretAuditReasons.NoContext,
                "No Blocks context is available. Secret operations require an authenticated context; " +
                "background work must wrap the call in BlocksContext.ExecuteInContext.");

        if (!context.IsAuthenticated || string.IsNullOrWhiteSpace(context.TenantId))
        {
            throw new SecretAccessDeniedException(SecretAuditReasons.InvalidContext,
                "The Blocks context is not authenticated or carries no tenant.");
        }

        return context.TenantId;
    }
}
