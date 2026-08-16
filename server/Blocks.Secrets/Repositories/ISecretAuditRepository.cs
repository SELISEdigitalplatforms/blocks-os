namespace Blocks.Secrets;

public interface ISecretAuditRepository
{
    Task InsertAsync(SecretAuditLog log, CancellationToken cancellationToken = default);

    Task<(IReadOnlyList<SecretAuditLog> Items, long TotalCount)> FindAsync(
        string tenantId,
        SecretAuditFilter filter,
        CancellationToken cancellationToken = default);
}
