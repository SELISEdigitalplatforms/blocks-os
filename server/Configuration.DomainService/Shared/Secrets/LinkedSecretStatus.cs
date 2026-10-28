using Blocks.Secrets;
using Microsoft.Extensions.Logging;

namespace Configuration.DomainService.Shared.Secrets
{
    /// <summary>
    /// The state of the secret a configuration points at, as reported to callers.
    /// </summary>
    /// <remarks>
    /// Computed at read time from secret <b>metadata</b> and never persisted. Mail configuration
    /// documents are also replaced whole by a second writer in blocks-logic, so a stored copy
    /// would be erased on its next write; and a stored copy would be stale the moment someone
    /// archived the secret from the Secrets screen anyway.
    /// <para>
    /// Plain lowercase strings rather than an enum so the wire values are fixed by this type and
    /// not by whatever enum converter the host happens to configure.
    /// </para>
    /// </remarks>
    public static class LinkedSecretStatus
    {
        /// <summary>No pointer is stored.</summary>
        public const string None = "none";

        public const string Active = "active";

        /// <summary>Temporarily unreadable. Shown to users exactly like <see cref="Active"/>.</summary>
        public const string Locked = "locked";

        /// <summary>The secret was soft-deleted (archived); its metadata still exists.</summary>
        public const string Archived = "archived";

        /// <summary>No secret with that id exists for this tenant — purged, or never existed.</summary>
        public const string Missing = "missing";

        /// <summary>The metadata read failed, so the state is unknown.</summary>
        public const string Unavailable = "unavailable";

        /// <summary>
        /// Whether the pointer is known to be dead. Only a broken pointer triggers repair on save;
        /// <see cref="Unavailable"/> is deliberately not broken, so a store outage never forces a
        /// user to re-enter a secret that may be perfectly healthy.
        /// </summary>
        public static bool IsBroken(string? status) =>
            status is Archived or Missing;

        /// <summary>Maps a metadata read onto a status. Null metadata means the secret does not exist.</summary>
        public static string FromMetadata(SecretResult? metadata) =>
            metadata is null
                ? Missing
                : metadata.Status switch
                {
                    SecretStatuses.Deleted => Archived,
                    SecretStatuses.Locked => Locked,
                    _ => Active
                };

        /// <summary>
        /// Resolves the status of <paramref name="secretId"/> with a single metadata read.
        /// </summary>
        /// <remarks>
        /// Uses <see cref="ISecretService.GetAsync"/> only — never a value read, so no value leaves
        /// the vault and no <c>GetValue</c> audit row is written. Never throws for a secret-store
        /// failure: a list or get must not fail because one linked secret could not be checked,
        /// so any exception becomes <see cref="Unavailable"/>. The warning names the configuration
        /// and the exception type only; the secret id is left out because for mail it is the
        /// reference that must never reach a log, and a secret-store exception can carry it.
        /// </remarks>
        public static async Task<string> ResolveAsync(
            ISecretService secretService,
            string? secretId,
            ILogger logger,
            string configurationKind,
            string? configurationId,
            CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrEmpty(secretId))
            {
                return None;
            }

            try
            {
                var metadata = await secretService.GetAsync(secretId, cancellationToken).ConfigureAwait(false);
                return FromMetadata(metadata);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception exception)
            {
                logger.LogWarning(
                    "Could not check the linked secret of {ConfigurationKind} configuration {ConfigurationId} ({FailureType}).",
                    configurationKind,
                    configurationId,
                    exception.GetType().Name);

                return Unavailable;
            }
        }
    }
}
