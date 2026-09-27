using Configuration.DomainService.Mail.Entities;
using Configuration.DomainService.Mail.RequestModel;
using Configuration.DomainService.Mail.ResponseModel;
using Configuration.DomainService.Shared.Enums;

namespace Configuration.DomainService.Mail.Providers
{
    /// <summary>
    /// The pre-existing username/password providers, unchanged.
    /// </summary>
    /// <remarks>
    /// Deliberately inert: it normalizes nothing, validates nothing of its own, and owns no
    /// credential. Amazon SES and Zoho keep their form fields, their FluentValidation rules,
    /// their password-in-the-document persistence and their <c>EnableSSL</c> behaviour, and the
    /// registry is the only thing that changed for them. The value of the definition is that the
    /// orchestrator can treat every provider the same way.
    /// </remarks>
    public abstract class PasswordMailConfigurationProvider : IMailConfigurationProvider
    {
        private const string MaskedSecretValue = "********";

        public abstract MailServiceProvider Provider { get; }

        public abstract MailDirections SupportedDirections { get; }

        public virtual MailInboundMode InboundMode =>
            SupportedDirections.HasFlag(MailDirections.Inbound) ? MailInboundMode.Poll : MailInboundMode.None;

        public virtual void Normalize(MailConfiguration request)
        {
            // Host, port, EnableSSL, username and password are all caller-supplied for these
            // providers, and SecurityMode stays Legacy so EnableSSL remains authoritative.
        }

        public IDictionary<string, string> Validate(MailConfiguration request, MailServerConfiguration? existing) =>
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
            CancellationToken cancellationToken = default) =>
            Task.FromResult(MailCredentialResult.None);

        public Task<MailCredentialResult> DuplicateCredentialAsync(
            MailServerConfiguration source,
            DuplicateMailConfigurationRequest request,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(MailCredentialResult.None);

        public Task DeleteCredentialAsync(string? credentialReference, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;

        public Task RestoreCredentialAsync(string? credentialReference, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;

        public void ProjectResponse(MailServerConfiguration entity, MailConfigurationResponse response)
        {
            // The existing mask, byte for byte: the UI has always shown a fixed-width mask here
            // and the edit form has always posted a blank password to mean "unchanged".
            response.AccountPassword = MaskedSecretValue;
        }
    }

    public sealed class AmazonSesMailConfigurationProvider : PasswordMailConfigurationProvider
    {
        public override MailServiceProvider Provider => MailServiceProvider.AmazonSes;

        /// <summary>Outbound only, matching the existing client behaviour.</summary>
        public override MailDirections SupportedDirections => MailDirections.Outbound;
    }

    public sealed class ZohoMailConfigurationProvider : PasswordMailConfigurationProvider
    {
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
