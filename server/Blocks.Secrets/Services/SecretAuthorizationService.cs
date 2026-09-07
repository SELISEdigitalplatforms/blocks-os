using Blocks.Genesis;

namespace Blocks.Secrets;

/// <summary>
/// Decides who may read a secret's value.
/// </summary>
/// <remarks>
/// This is the object-level check and is entirely separate from <c>ProtectedEndPoint</c>.
/// The endpoint attribute answers "may this principal call this API at all"; this answers
/// "may this principal touch this particular secret". Both must pass, and the domain never
/// assumes the transport already checked.
/// </remarks>
public sealed class SecretAuthorizationService : ISecretAuthorizationService
{
    private readonly ITenants _tenants;

    public SecretAuthorizationService(ITenants tenants)
    {
        _tenants = tenants;
    }

    public SecretCallerContext ResolveContext()
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

        var organizationId = string.IsNullOrWhiteSpace(context.OrganizationId) ? "default" : context.OrganizationId;

        return new SecretCallerContext
        {
            TenantId = context.TenantId,
            OrganizationId = organizationId,
            UserId = context.UserId ?? string.Empty,
            Roles = context.Roles?.ToArray() ?? [],
            IsRoot = IsRootCaller(context),
            Impersonated = context.Impersonated,
            ImpersonationSessionId = context.ImpersonationSessionId,
            OriginalTenantId = context.OriginalTenantId,
            RequestUri = context.RequestUri
        };
    }

    public string? CheckValueRead(SecretCallerContext caller, Secret secret)
    {
        ArgumentNullException.ThrowIfNull(caller);
        ArgumentNullException.ThrowIfNull(secret);

        // Status gates first, and they bind root too. A locked secret is locked for everyone;
        // root override is about bypassing the access list, not about ignoring lifecycle.
        switch (secret.Status)
        {
            case SecretStatuses.Locked:
                return SecretAuditReasons.StatusLocked;
            case SecretStatuses.Deleted:
                return SecretAuditReasons.StatusDeleted;
        }

        if (caller.IsRoot)
        {
            return null;
        }

        // Service and Both secrets are platform credentials with no per-user notion of
        // ownership. A valid tenant context plus Active status is the whole check.
        if (!SecretTypes.HasAccessList(secret.Type))
        {
            return null;
        }

        var access = secret.Access;

        if (access is null || access.IsEmpty)
        {
            // An empty access list means nobody, not everybody. The creator keeps access so a
            // secret cannot be orphaned the moment it is made.
            return string.Equals(secret.CreatedBy, caller.UserId, StringComparison.Ordinal) && !string.IsNullOrEmpty(caller.UserId)
                ? null
                : SecretAuditReasons.NotInAccessList;
        }

        if (!string.IsNullOrEmpty(caller.UserId) && access.UserIds.Contains(caller.UserId, StringComparer.Ordinal))
        {
            return null;
        }

        if (access.Roles.Count > 0 && caller.Roles.Any(role => access.Roles.Contains(role, StringComparer.Ordinal)))
        {
            return null;
        }

        return SecretAuditReasons.NotInAccessList;
    }

    public void EnsureValueRead(SecretCallerContext caller, Secret secret)
    {
        var reason = CheckValueRead(caller, secret);

        switch (reason)
        {
            case null:
                return;

            case SecretAuditReasons.StatusLocked:
                throw new SecretStateException(SecretStatuses.Locked, "read value", reason);

            case SecretAuditReasons.StatusDeleted:
                throw new SecretStateException(SecretStatuses.Deleted, "read value", reason);

            default:
                throw new SecretAccessDeniedException(reason);
        }
    }

    /// <summary>
    /// Root is the platform's existing signal: a tenant flagged <c>IsRootTenant</c>. When the
    /// caller is impersonating, the acting tenant is the original one — the same resolution
    /// Genesis's ProtectedEndpointAccessHandler uses for permissions.
    /// </summary>
    private bool IsRootCaller(BlocksContext context)
    {
        if (IsRootTenant(context.TenantId))
        {
            return true;
        }

        return context.Impersonated
               && !string.IsNullOrWhiteSpace(context.OriginalTenantId)
               && IsRootTenant(context.OriginalTenantId);
    }

    private bool IsRootTenant(string tenantId)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            return false;
        }

        try
        {
            return _tenants.GetTenantByID(tenantId)?.IsRootTenant == true;
        }
        catch (Exception)
        {
            // A tenant-cache failure must never be read as "yes, root". Fail closed.
            return false;
        }
    }
}
