namespace Cloud.LmtService.Repositories.Shared
{
    /// <summary>
    /// Resolves the address to notify from the identity the request context actually carries.
    /// </summary>
    /// <remarks>
    /// The deployed token populates the user id but neither the user name nor the email, so the
    /// address has to be read from the user record. This lives here rather than on
    /// <c>ILogTraceRestoreRepository</c> because that repository is pinned to the LogTraceRestore
    /// database, and users are not in it.
    /// </remarks>
    public interface IRestoreUserRepository
    {
        /// <summary>
        /// Returns the user's email, or null when the id is empty, no such user exists, or the
        /// record has no address. Never throws: a restore must not fail over its own notification.
        /// </summary>
        Task<string?> GetEmailByUserIdAsync(string? userId, CancellationToken ct = default);
    }
}
