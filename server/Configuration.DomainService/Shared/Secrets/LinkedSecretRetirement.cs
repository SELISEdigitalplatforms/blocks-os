using Blocks.Secrets;

namespace Configuration.DomainService.Shared.Secrets
{
    /// <summary>
    /// Retires (soft-deletes) a configuration's linked secret, tolerating one that is already gone.
    /// </summary>
    /// <remarks>
    /// Anyone can archive or purge a secret from the Secrets screen. Before this existed, a
    /// configuration whose secret had been archived (409 on <c>DeleteAsync</c>) or purged (404)
    /// could never be deleted, because retiring the secret is the first step of every delete.
    /// </remarks>
    public static class LinkedSecretRetirement
    {
        /// <summary>
        /// Soft-deletes <paramref name="secretId"/>.
        /// </summary>
        /// <returns>
        /// True when this call archived the secret; false when it was already archived or no
        /// longer exists, in which case nothing was changed. Callers use this to decide whether a
        /// failed delete may restore the secret: one that was already archived must stay archived.
        /// </returns>
        /// <remarks>
        /// Every other failure — vault outage, access denied, anything unexpected — propagates, so
        /// the caller keeps the configuration exactly as it does today.
        /// </remarks>
        public static async Task<bool> RetireAsync(
            ISecretService secretService,
            string secretId,
            CancellationToken cancellationToken = default)
        {
            try
            {
                await secretService.DeleteAsync(secretId, cancellationToken).ConfigureAwait(false);
                return true;
            }
            catch (SecretStateException exception) when (exception.CurrentStatus == SecretStatuses.Deleted)
            {
                return false;
            }
            catch (SecretNotFoundException)
            {
                return false;
            }
        }
    }
}
