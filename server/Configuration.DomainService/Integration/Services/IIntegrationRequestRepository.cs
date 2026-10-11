using Configuration.DomainService.Integration.Entities;

namespace Configuration.DomainService.Integration.Services;

public interface IIntegrationRequestRepository
{
    Task InsertAsync(IntegrationRequest request, CancellationToken cancellationToken = default);
    Task<IntegrationRequest?> GetByIdAsync(string requestId, CancellationToken cancellationToken = default);
    /// <summary>
    /// Atomically claims a pending, unexpired request for a user. Returns null when the request is
    /// missing, expired, no longer pending, or already claimed by someone else.
    /// </summary>
    Task<IntegrationRequest?> TryClaimAsync(string requestId, string userId, CancellationToken cancellationToken = default);
    /// <summary>
    /// Atomically moves a request claimed by this user out of pending to the given status.
    /// Returns the updated request, or null when it is missing, expired or not theirs to change.
    /// </summary>
    Task<IntegrationRequest?> TryTransitionFromPendingAsync(string requestId, string userId, string status, CancellationToken cancellationToken = default);

    /// <summary>Atomically reserves a claimed pending request for setup work.</summary>
    Task<IntegrationRequest?> TryStartApprovalAsync(string requestId, string userId, CancellationToken cancellationToken = default);

    /// <summary>Returns a failed setup reservation to pending without overriding a cancellation.</summary>
    Task ResetApprovalToPendingAsync(string requestId, CancellationToken cancellationToken = default);

    /// <summary>Completes setup only when this request is still reserved for approval.</summary>
    Task<bool> TryCompleteApprovalAsync(IntegrationRequest request, CancellationToken cancellationToken = default);

    /// <summary>Reissues an approved request's one-time code without running setup again.</summary>
    Task<IntegrationRequest?> RotateApprovedCodeAsync(string requestId, string userId, string templateKey, string codeHash, CancellationToken cancellationToken = default);

    /// <summary>
    /// Replaces the request document. Callers must have verified ownership first: this is the
    /// pending-to-approved transition, whose fields (code hash, cipher, connection) all come
    /// from the server, not the browser.
    /// </summary>
    Task ReplaceAsync(IntegrationRequest request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Consumes an approved code exactly once. Matches by code hash, approved status and
    /// unexpired, verifies the caller supplied the same redirect URI, marks the request
    /// exchanged and removes the stored secret cipher in one atomic update. Returns null when
    /// no approved, unexpired request carries that hash.
    /// </summary>
    Task<IntegrationRequest?> TryExchangeByCodeHashAsync(string codeHash, string redirectUri, string codeChallenge, CancellationToken cancellationToken = default);

    /// <summary>Burns a matched code: keeps the record for audit but refuses any later exchange.</summary>
    Task<IntegrationRequest?> MarkFailedByCodeHashAsync(string codeHash, CancellationToken cancellationToken = default);

    Task EnsureIndexesAsync(CancellationToken cancellationToken = default);
}
