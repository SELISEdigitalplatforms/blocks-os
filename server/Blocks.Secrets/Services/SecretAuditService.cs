using System.Diagnostics;
using Microsoft.Extensions.Logging;

namespace Blocks.Secrets;

public sealed class SecretAuditService : ISecretAuditService
{
    private readonly ISecretAuditRepository _repository;
    private readonly ILogger<SecretAuditService> _logger;

    public SecretAuditService(ISecretAuditRepository repository, ILogger<SecretAuditService> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    public async Task RecordAsync(
        SecretCallerContext caller,
        string action,
        Secret? secret = null,
        string outcome = SecretAuditOutcomes.Success,
        string? reason = null,
        int? affectedCount = null,
        string? secretId = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(caller);

        var log = new SecretAuditLog
        {
            ItemId = Guid.NewGuid().ToString("N"),
            CreatedDate = DateTime.UtcNow,
            LastUpdatedDate = DateTime.UtcNow,
            CreatedBy = caller.UserId,
            LastUpdatedBy = caller.UserId,
            OrganizationId = caller.OrganizationId,

            TenantId = caller.TenantId,
            SecretId = secretId ?? secret?.ItemId,
            SecretName = secret?.Name,
            Action = action,
            Outcome = outcome,
            Reason = reason,
            ActorUserId = caller.UserId,
            ActorRoles = caller.Roles.ToList(),
            IsRootOverride = caller.IsRoot,
            Impersonated = caller.Impersonated,
            ImpersonationSessionId = caller.ImpersonationSessionId,
            OriginalTenantId = caller.OriginalTenantId,
            RequestUri = caller.RequestUri,
            TraceId = Activity.Current?.TraceId.ToString(),
            AffectedCount = affectedCount
        };

        try
        {
            await _repository.InsertAsync(log, cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            // Swallowed on purpose. If this rethrew, an audit outage would take down every
            // secret operation, and on a denial path it would replace the security exception
            // the caller actually needs to see with a storage error.
            _logger.LogError(ex,
                "Failed to write secret audit record. Action={Action} Outcome={Outcome} SecretId={SecretId} Tenant={TenantId}",
                action, outcome, log.SecretId, caller.TenantId);
        }
    }
}
