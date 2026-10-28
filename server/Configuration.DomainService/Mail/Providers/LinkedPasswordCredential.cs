using Blocks.Genesis.Entities.Os;
using Blocks.Secrets;
using Configuration.DomainService.Shared.Secrets;
using Microsoft.Extensions.Logging;

namespace Configuration.DomainService.Mail.Providers
{
    /// <summary>
    /// The mailbox password of a password-mode configuration, kept in Blocks Secrets and linked
    /// through <see cref="MailServerConfiguration.AccountPasswordReference"/>.
    /// </summary>
    /// <remarks>
    /// Shared by Amazon SES, Zoho, Gmail and Office 365 in password mode, so the four cannot drift
    /// apart. Composed inside those definitions rather than registered: it needs nothing beyond the
    /// scoped <c>ISecretService</c> they already receive.
    /// <para>
    /// Reference rule, shared with the readers in blocks-logic and blocks-monitor: a non-empty
    /// reference is authoritative and the document's <c>AccountPassword</c> is not used; an empty
    /// reference means the document still holds the password (a record saved before this existed).
    /// </para>
    /// <para>
    /// Neither the password nor the reference is ever logged. A secret-store exception message can
    /// carry the secret id, so failures are logged by exception type only.
    /// </para>
    /// </remarks>
    public sealed class LinkedPasswordCredential
    {
        /// <summary>
        /// Every mail password secret carries this name. Names are not unique; the configuration's
        /// reference is what links it to a value.
        /// </summary>
        public const string SecretName = "mail-password";

        /// <summary>The request field password errors are reported against.</summary>
        public const string PasswordField = "AccountPassword";

        public const string SourceUnavailableMessage =
            "The source configuration's password is unavailable. Edit the source and enter its password again.";

        private const string ConfigurationKind = "mail";

        private readonly ISecretService _secretService;
        private readonly ILogger _logger;

        public LinkedPasswordCredential(ISecretService secretService, ILogger logger)
        {
            ArgumentNullException.ThrowIfNull(secretService);
            ArgumentNullException.ThrowIfNull(logger);

            _secretService = secretService;
            _logger = logger;
        }

        /// <summary>
        /// Stores <paramref name="password"/> for the configuration being saved: one
        /// <c>SetAsync</c> or one <c>RotateAsync</c>, never both.
        /// </summary>
        /// <param name="existingStatus">
        /// What <see cref="ResolveStatusAsync"/> said about the stored reference. Archived or
        /// missing gets a new secret and the old one is left alone; active, locked and unavailable
        /// rotate in place. A locked secret stays locked after the rotation.
        /// </param>
        public async Task<MailCredentialResult> SaveAsync(
            string? configurationId,
            string? configurationName,
            string? password,
            MailServerConfiguration? existing,
            string? existingStatus,
            CancellationToken cancellationToken = default)
        {
            // The shared validator requires the password in password mode, and every password
            // definition forces that mode. An empty value here is a caller bug, and storing it
            // would save a configuration that can never authenticate.
            if (string.IsNullOrEmpty(password))
            {
                throw new InvalidOperationException("A password-mode configuration must be saved with a password.");
            }

            var reference = existing?.AccountPasswordReference;

            // Empty: a create, or a record that still holds its password in the document, which
            // moves to Blocks Secrets on this save.
            if (string.IsNullOrEmpty(reference) || LinkedSecretStatus.IsBroken(existingStatus))
            {
                var created = await CreateAsync(configurationId, configurationName, password, cancellationToken).ConfigureAwait(false);
                return new MailCredentialResult { Reference = created, Created = true };
            }

            // In place, so mail already queued in blocks-logic with this reference keeps working.
            await _secretService.RotateAsync(
                reference,
                new RotateSecretRequest { Value = password },
                cancellationToken).ConfigureAwait(false);

            return new MailCredentialResult { Reference = reference, Created = false };
        }

        /// <summary>
        /// Gives <paramref name="copy"/> its own secret holding the source's password, so deleting
        /// either configuration never breaks the other.
        /// </summary>
        /// <remarks>
        /// One value read when the source is referenced, none for a source that still holds its
        /// password; then one <c>SetAsync</c>. An empty source password creates nothing. A source
        /// secret that is gone or not readable (archived, locked) is a field error, so no copy is
        /// written; a vault outage propagates as <see cref="SecretVaultException"/>.
        /// </remarks>
        public async Task<MailCredentialResult> DuplicateAsync(
            MailServerConfiguration source,
            MailServerConfiguration copy,
            CancellationToken cancellationToken = default)
        {
            ArgumentNullException.ThrowIfNull(source);
            ArgumentNullException.ThrowIfNull(copy);

            string? password;
            if (string.IsNullOrEmpty(source.AccountPasswordReference))
            {
                password = source.AccountPassword;
            }
            else
            {
                try
                {
                    password = await _secretService
                        .GetValueAsync(source.AccountPasswordReference, cancellationToken)
                        .ConfigureAwait(false);
                }
                catch (Exception exception) when (exception is SecretNotFoundException or SecretStateException)
                {
                    _logger.LogWarning(
                        "The password of mail configuration {ConfigurationId} could not be read for a duplicate ({FailureType}).",
                        source.ItemId,
                        exception.GetType().Name);

                    return MailCredentialResult.Rejected(PasswordField, SourceUnavailableMessage);
                }
            }

            if (string.IsNullOrEmpty(password))
            {
                return MailCredentialResult.None;
            }

            var created = await CreateAsync(copy.ItemId, copy.Name, password, cancellationToken).ConfigureAwait(false);
            return new MailCredentialResult { Reference = created, Created = true };
        }

        /// <inheritdoc cref="IMailConfigurationProvider.DeleteCredentialAsync"/>
        public async Task<bool> RetireAsync(string? reference, CancellationToken cancellationToken = default) =>
            !string.IsNullOrEmpty(reference)
            && await LinkedSecretRetirement.RetireAsync(_secretService, reference, cancellationToken).ConfigureAwait(false);

        /// <inheritdoc cref="IMailConfigurationProvider.RestoreCredentialAsync"/>
        public async Task RestoreAsync(string? reference, CancellationToken cancellationToken = default)
        {
            if (!string.IsNullOrEmpty(reference))
            {
                await _secretService.RestoreAsync(reference, cancellationToken).ConfigureAwait(false);
            }
        }

        /// <summary>
        /// The status of the linked password secret, or null when the record still holds its
        /// password in the document. One metadata read at most; never throws for a store failure.
        /// </summary>
        public async Task<string?> ResolveStatusAsync(MailServerConfiguration entity, CancellationToken cancellationToken = default)
        {
            ArgumentNullException.ThrowIfNull(entity);

            if (string.IsNullOrEmpty(entity.AccountPasswordReference))
            {
                return null;
            }

            return await LinkedSecretStatus
                .ResolveAsync(_secretService, entity.AccountPasswordReference, _logger, ConfigurationKind, entity.ItemId, cancellationToken)
                .ConfigureAwait(false);
        }

        /// <summary>
        /// Points <paramref name="entity"/> at <paramref name="reference"/> and blanks the document
        /// password, which is never written again once the configuration is saved by this build.
        /// </summary>
        public static void Apply(MailServerConfiguration entity, string? reference)
        {
            ArgumentNullException.ThrowIfNull(entity);

            entity.AccountPassword = string.Empty;
            entity.AccountPasswordReference = reference;
        }

        private Task<string> CreateAsync(
            string? configurationId,
            string? configurationName,
            string password,
            CancellationToken cancellationToken) =>
            _secretService.SetAsync(
                new SetSecretRequest
                {
                    Name = SecretName,
                    Type = SecretTypes.Service,
                    Value = password,
                    Description = DescribeFor(configurationId, configurationName)
                },
                cancellationToken);

        /// <summary>
        /// Names the owning configuration and nothing else: a secret description is readable by
        /// anyone who can list secrets, so the host and username stay out of it.
        /// </summary>
        private static string DescribeFor(string? configurationId, string? configurationName) =>
            string.Concat("Mailbox password for mail configuration ", configurationName, " (", configurationId, ").");
    }
}
