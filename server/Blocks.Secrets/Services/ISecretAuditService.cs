using System.Diagnostics.CodeAnalysis;

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
    [SuppressMessage("Major Code Smell", "S107:Methods should not have too many parameters",
        Justification = "Optional, named audit fields used at ~30 call sites; a parameter object would churn every caller and test without changing behaviour.")]
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
