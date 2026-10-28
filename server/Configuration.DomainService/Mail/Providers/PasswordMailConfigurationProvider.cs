using Blocks.Secrets;
using Configuration.DomainService.Mail.RequestModel;
using Configuration.DomainService.Mail.ResponseModel;
using Blocks.Genesis.Entities.Os;
using Microsoft.Extensions.Logging;

namespace Configuration.DomainService.Mail.Providers
{
    /// <summary>
    /// The username/password providers.
    /// </summary>
    /// <remarks>
    /// Amazon SES and Zoho keep their form fields, their FluentValidation rules and their
    /// <c>EnableSSL</c> behaviour. The password itself is a linked secret
    /// (<see cref="LinkedPasswordCredential"/>): a save stores it in Blocks Secrets and leaves only
    /// <c>AccountPasswordReference</c> on the document. A record saved before that keeps its
    /// password in the document until its next save, and every save carries the password.
    /// </remarks>
    public abstract class PasswordMailConfigurationProvider : IMailConfigurationProvider
    {
        private const string MaskedSecretValue = "********";

        private readonly LinkedPasswordCredential _password;

        protected PasswordMailConfigurationProvider(ISecretService secretService, ILogger logger)
        {
            _password = new LinkedPasswordCredential(secretService, logger);
        }

        public abstract MailServiceProvider Provider { get; }

        public abstract MailDirections SupportedDirections { get; }

        public virtual MailInboundMode InboundMode =>
            SupportedDirections.HasFlag(MailDirections.Inbound) ? MailInboundMode.Poll : MailInboundMode.None;

        public virtual void Normalize(MailConfiguration request)
        {
            ArgumentNullException.ThrowIfNull(request);

            // Host, port, EnableSSL, username and password are all caller-supplied for these
            // providers, and SecurityMode stays Legacy so EnableSSL remains authoritative.
            // Password is the only mode they have. Forcing it is what makes the shared validator
            // require the password, so a request claiming another mode cannot save an empty secret.
            request.AuthenticationType = MailAuthenticationType.Password;
        }

        public IDictionary<string, string> Validate(
            MailConfiguration request,
            MailServerConfiguration? existing,
            string? existingCredentialStatus) =>
            new Dictionary<string, string>();

        public IDictionary<string, string> ValidateDuplicate(
            MailServerConfiguration source,
            DuplicateMailConfigurationRequest request) =>
            new Dictionary<string, string>();

        /// <summary>
        /// True, which is the existing behaviour: a copy has always carried the source's default
        /// flag. Left alone rather than corrected, because changing it would alter which
        /// configuration a tenant's templates resolve to.
        /// </summary>
        public bool DuplicateInheritsDefault => true;

        public Task<MailCredentialResult> SaveCredentialAsync(
            MailConfiguration request,
            MailServerConfiguration? existing,
            string? existingCredentialStatus,
            CancellationToken cancellationToken = default)
        {
            ArgumentNullException.ThrowIfNull(request);

            return _password.SaveAsync(
                request.ConfigurationId,
                request.ConfigurationName,
                request.AccountPassword,
                existing,
                existingCredentialStatus,
                cancellationToken);
        }

        public Task<MailCredentialResult> DuplicateCredentialAsync(
            MailServerConfiguration source,
            MailServerConfiguration copy,
            DuplicateMailConfigurationRequest request,
            CancellationToken cancellationToken = default) =>
            _password.DuplicateAsync(source, copy, cancellationToken);

        public string? CredentialReferenceOf(MailServerConfiguration entity)
        {
            ArgumentNullException.ThrowIfNull(entity);

            return entity.AccountPasswordReference;
        }

        public void ApplyCredential(MailServerConfiguration entity, string? credentialReference) =>
            LinkedPasswordCredential.Apply(entity, credentialReference);

        public Task<bool> DeleteCredentialAsync(string? credentialReference, CancellationToken cancellationToken = default) =>
            _password.RetireAsync(credentialReference, cancellationToken);

        public Task RestoreCredentialAsync(string? credentialReference, CancellationToken cancellationToken = default) =>
            _password.RestoreAsync(credentialReference, cancellationToken);

        /// <summary>Null for a record that still holds its password in the document.</summary>
        public Task<string?> ResolveCredentialStatusAsync(MailServerConfiguration entity, CancellationToken cancellationToken = default) =>
            _password.ResolveStatusAsync(entity, cancellationToken);

        public void ProjectResponse(MailServerConfiguration entity, MailConfigurationResponse response, string? credentialStatus)
        {
            // The existing mask, byte for byte: the UI has always shown a fixed-width mask here
            // and the edit form has always posted the password again on every save.
            response.AccountPassword = MaskedSecretValue;
        }
    }

    public sealed class AmazonSesMailConfigurationProvider : PasswordMailConfigurationProvider
    {
        public AmazonSesMailConfigurationProvider(ISecretService secretService, ILogger<AmazonSesMailConfigurationProvider> logger)
            : base(secretService, logger)
        {
        }

        public override MailServiceProvider Provider => MailServiceProvider.AmazonSes;

        /// <summary>Outbound only, matching the existing client behaviour.</summary>
        public override MailDirections SupportedDirections => MailDirections.Outbound;
    }

    public sealed class ZohoMailConfigurationProvider : PasswordMailConfigurationProvider
    {
        public ZohoMailConfigurationProvider(ISecretService secretService, ILogger<ZohoMailConfigurationProvider> logger)
            : base(secretService, logger)
        {
        }

        public override MailServiceProvider Provider => MailServiceProvider.Zoho;

        public override MailDirections SupportedDirections => MailDirections.Both;
    }

    /// <summary>
    /// Gmail / Google Workspace over SMTP (outbound) and IMAP (inbound) with the account address
    /// and an App Password.
    /// </summary>
    /// <remarks>
    /// Google rejects the account's normal password for SMTP and IMAP, so the password here is an
    /// App Password, which needs 2-Step Verification on the account. Transport is fixed per
    /// direction, the same way Office 365's is.
    /// </remarks>
    public sealed class GmailMailConfigurationProvider : PasswordMailConfigurationProvider
    {
        public const string SmtpHost = "smtp.gmail.com";
        public const int SmtpPort = 587;
        public const string ImapHost = "imap.gmail.com";
        public const int ImapPort = 993;

        public GmailMailConfigurationProvider(ISecretService secretService, ILogger<GmailMailConfigurationProvider> logger)
            : base(secretService, logger)
        {
        }

        public override MailServiceProvider Provider => MailServiceProvider.Gmail;

        public override MailDirections SupportedDirections => MailDirections.Both;

        public override void Normalize(MailConfiguration request)
        {
            if (request.IsInbound)
            {
                request.Host = ImapHost;
                request.Port = ImapPort;
                request.SecurityMode = MailSecurityMode.SslOnConnect;
                request.EnableSSL = true;
            }
            else
            {
                request.Host = SmtpHost;
                request.Port = SmtpPort;
                request.SecurityMode = MailSecurityMode.StartTls;
                request.EnableSSL = false;
            }

            request.AuthenticationType = MailAuthenticationType.Password;
            request.SenderUserName = request.SenderUserName?.Trim();

            // Google displays App Passwords in groups of four ("abcd efgh ijkl mnop") and people
            // paste them that way; the spaces are not part of the credential.
            request.AccountPassword = request.AccountPassword?.Replace(" ", string.Empty);
        }
    }
}
