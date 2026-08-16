namespace Blocks.Secrets;

public interface ISecretAuditService
{
    /// <summary>
    /// Records an audited operation.
    /// </summary>
    /// <remarks>
    /// Never throws. An audit write failing must not turn a successful operation into a failed
    /// one, nor mask the original exception on a failure path.
    /// </remarks>
    Task RecordAsync(
        SecretCallerContext caller,
        string action,
        Secret? secret = null,
        string outcome = SecretAuditOutcomes.Success,
        string? reason = null,
        int? affectedCount = null,
        string? secretId = null,
        CancellationToken cancellationToken = default);
}
