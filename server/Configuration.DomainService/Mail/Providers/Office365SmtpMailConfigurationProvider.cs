using Blocks.Secrets;
using Configuration.DomainService.Mail.Entities;
using Configuration.DomainService.Mail.RequestModel;
using Configuration.DomainService.Mail.ResponseModel;
using Configuration.DomainService.Shared.Enums;
using System.Net.Mail;

namespace Configuration.DomainService.Mail.Providers
{
    /// <summary>
    /// Exchange Online. Outbound over SMTP with either OAuth client credentials or a mailbox
    /// username/password; inbound over IMAP with OAuth client credentials only.
    /// </summary>
    /// <remarks>
    /// This definition captures and guards the configuration contract; it does not send or
    /// receive. Token acquisition, the <c>https://outlook.office365.com/.default</c> scope, SMTP
    /// STARTTLS and IMAP implicit TLS with SASL XOAUTH2 belong to blocks-logic, which reads
    /// <see cref="MailServerConfiguration.ClientSecretReference"/> and resolves the value at use
    /// time.
    /// <para>
    /// Inbound has no password mode because Exchange Online has retired basic authentication for
    /// IMAP: a username/password configuration would save and then never connect.
    /// </para>
    /// </remarks>
    public sealed class Office365SmtpMailConfigurationProvider : IMailConfigurationProvider
    {
        public const string SmtpHost = "smtp.office365.com";
        public const int SmtpPort = 587;
        public const string ImapHost = "outlook.office365.com";
        public const int ImapPort = 993;

        /// <summary>
        /// Every Office 365 secret carries this name. Secret names are not unique — the
        /// configuration record's reference is what links it to a value — so a readable constant
        /// is clearer than a generated one.
        /// </summary>
        private const string SecretName = "office365-smtp";

        private const string MaskedSecretValue = "********";

        private readonly ISecretService _secretService;

        public Office365SmtpMailConfigurationProvider(ISecretService secretService)
        {
            _secretService = secretService;
        }

        public MailServiceProvider Provider => MailServiceProvider.Office365Smtp;

        public MailDirections SupportedDirections => MailDirections.Both;

        public MailInboundMode InboundMode => MailInboundMode.Poll;

        public void Normalize(MailConfiguration request)
        {
            // Transport is a property of the integration, not a tenant choice, so submitted
            // values are overwritten rather than rejected. This runs before validation, which is
            // what stops the shared host/port rules ever seeing what the caller sent.
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

                // Port 587 is STARTTLS, so the legacy flag reads false. SecurityMode is
                // authoritative either way; this only decides what a consumer still routing on
                // EnableSSL would do, and true there would mean implicit TLS on 587 — a
                // connection that cannot succeed.
                request.EnableSSL = false;
            }

            request.AuthenticationType = ResolveAuthenticationType(request);

            if (request.AuthenticationType == MailAuthenticationType.Password)
            {
                // The OAuth fields are not part of the password contract and are not shown by
                // the form in that mode.
                request.TenantId = null;
                request.ClientId = null;
                request.ClientSecret = null;
                request.MailboxAddress = null;
                request.SenderUserName = request.SenderUserName?.Trim();
                return;
            }

            // Not part of the OAuth contract and not shown by the form, so a submitted value is
            // dropped rather than rejected.
            request.SenderUserName = string.Empty;

            // AccountPassword and IsEnableSnsConfiguration are deliberately *not* normalized.
            // Forcing them here would silently accept a request that asked for password
            // authentication or SNS, and the contract is to tell the caller their request cannot
            // be honoured — so Validate rejects both instead.

            request.TenantId = request.TenantId?.Trim();
            request.ClientId = request.ClientId?.Trim();
            request.MailboxAddress = request.MailboxAddress?.Trim();
        }

        public IDictionary<string, string> Validate(MailConfiguration request, MailServerConfiguration? existing)
        {
            var errors = new Dictionary<string, string>();

            // Switching mode on edit would strand the client secret (OAuth to password) or leave
            // a configuration that needs a secret it never had (the reverse).
            if (existing is not null && existing.AuthenticationType != request.AuthenticationType)
            {
                errors["AuthenticationType"] = "The authentication method of an existing Office 365 configuration cannot be changed.";
                return errors;
            }

            if (request.IsEnableSnsConfiguration)
            {
                errors["IsEnableSnsConfiguration"] = "SNS configuration is not supported for SMTP Office 365.";
            }

            if (request.AuthenticationType == MailAuthenticationType.Password)
            {
                // Username and password are the shared validator's rules; nothing else is
                // specific to this mode.
                return errors;
            }

            if (string.IsNullOrWhiteSpace(request.TenantId))
            {
                errors["TenantId"] = "Tenant ID is required for SMTP Office 365.";
            }

            if (string.IsNullOrWhiteSpace(request.ClientId))
            {
                errors["ClientId"] = "Client ID is required for SMTP Office 365.";
            }

            if (!IsValidEmail(request.MailboxAddress))
            {
                errors["MailboxAddress"] = "Mailbox address must be a valid email address.";
            }

            AddClientSecretError(request.ClientSecret, existing, errors);

            if (!string.IsNullOrEmpty(request.AccountPassword))
            {
                errors["AccountPassword"] = request.IsInbound
                    ? "Office 365 inbound does not accept password authentication. Use OAuth client credentials."
                    : "Password authentication is not supported for SMTP Office 365.";
            }

            // Guards the invariant Normalize establishes. It cannot fire through the orchestrator,
            // which always normalizes first, and is here so a definition exercised directly still
            // states the rule rather than silently accepting a password configuration.
            if (request.IsInbound && request.AuthenticationType != MailAuthenticationType.OAuthClientCredentials)
            {
                errors["AuthenticationType"] = "Office 365 inbound requires OAuth client credentials.";
            }

            return errors;
        }

        public IDictionary<string, string> ValidateDuplicate(
            MailServerConfiguration source,
            DuplicateMailConfigurationRequest request)
        {
            var errors = new Dictionary<string, string>();

            if (source.AuthenticationType == MailAuthenticationType.Password)
            {
                // A password configuration owns no secret, so a copy needs nothing new.
                return errors;
            }

            if (request.ClientSecret is { Length: > 0 } && request.ClientSecret.Trim().Length == 0)
            {
                errors["ClientSecret"] = "Client secret must not be blank.";
            }
            else if (string.IsNullOrEmpty(request.ClientSecret))
            {
                // A copy cannot inherit the source's reference, so there is nothing to fall back
                // to: the caller has to supply a value.
                errors["ClientSecret"] = "A new client secret is required to duplicate an SMTP Office 365 configuration.";
            }

            return errors;
        }

        /// <summary>
        /// False. A copy is a new configuration that nothing has been pointed at yet, and it has
        /// its own secret, so inheriting "default" would silently redirect a tenant's live mail
        /// through untested credentials.
        /// </summary>
        public bool DuplicateInheritsDefault => false;

        public async Task<MailCredentialResult> SaveCredentialAsync(
            MailConfiguration request,
            MailServerConfiguration? existing,
            CancellationToken cancellationToken = default)
        {
            if (request.AuthenticationType == MailAuthenticationType.Password)
            {
                // The password stays in the document, as it does for the other password providers.
                return MailCredentialResult.None;
            }

            var reference = existing?.ClientSecretReference;

            if (string.IsNullOrEmpty(request.ClientSecret))
            {
                // Validation has already established that a secret is on file.
                return new MailCredentialResult { Reference = reference, Created = false };
            }

            if (string.IsNullOrEmpty(reference))
            {
                var created = await _secretService.SetAsync(
                    new SetSecretRequest
                    {
                        Name = SecretName,
                        Type = SecretTypes.Service,
                        Value = request.ClientSecret,
                        Description = DescribeFor(request.ConfigurationId, request.ConfigurationName)
                    },
                    cancellationToken).ConfigureAwait(false);

                return new MailCredentialResult { Reference = created, Created = true };
            }

            // Rotate in place rather than create-and-repoint: the reference is what blocks-logic
            // resolves at send time, and changing it would break every message already holding
            // the old one.
            await _secretService.RotateAsync(
                reference,
                new RotateSecretRequest { Value = request.ClientSecret },
                cancellationToken).ConfigureAwait(false);

            return new MailCredentialResult { Reference = reference, Created = false };
        }

        public async Task<MailCredentialResult> DuplicateCredentialAsync(
            MailServerConfiguration source,
            DuplicateMailConfigurationRequest request,
            CancellationToken cancellationToken = default)
        {
            if (source.AuthenticationType == MailAuthenticationType.Password)
            {
                return MailCredentialResult.None;
            }

            var created = await _secretService.SetAsync(
                new SetSecretRequest
                {
                    Name = SecretName,
                    Type = SecretTypes.Service,
                    Value = request.ClientSecret!,
                    Description = DescribeFor(source.ItemId, source.Name + " - Copy")
                },
                cancellationToken).ConfigureAwait(false);

            return new MailCredentialResult { Reference = created, Created = true };
        }

        public async Task DeleteCredentialAsync(string? credentialReference, CancellationToken cancellationToken = default)
        {
            if (!string.IsNullOrEmpty(credentialReference))
            {
                await _secretService.DeleteAsync(credentialReference, cancellationToken).ConfigureAwait(false);
            }
        }

        public async Task RestoreCredentialAsync(string? credentialReference, CancellationToken cancellationToken = default)
        {
            if (!string.IsNullOrEmpty(credentialReference))
            {
                await _secretService.RestoreAsync(credentialReference, cancellationToken).ConfigureAwait(false);
            }
        }

        public void ProjectResponse(MailServerConfiguration entity, MailConfigurationResponse response)
        {
            if (entity.AuthenticationType == MailAuthenticationType.Password)
            {
                // The password providers' mask, for the same reason they use it.
                response.AccountPassword = MaskedSecretValue;
                return;
            }

            response.TenantId = entity.TenantId;
            response.ClientId = entity.ClientId;
            response.MailboxAddress = entity.MailboxAddress;
            response.IsClientSecretConfigured = !string.IsNullOrEmpty(entity.ClientSecretReference);

            // No mask. A password provider's fixed-width mask is harmless because a blank
            // submission means "unchanged" there too, but a mask in this field is something a
            // caller could post back as the literal secret.
            response.AccountPassword = null;
        }

        /// <summary>
        /// Which mode a request is in.
        /// </summary>
        /// <remarks>
        /// <see cref="MailAuthenticationType.Password"/> is also what a caller that omits the field
        /// sends, and every caller before password mode existed omitted it while submitting OAuth
        /// fields. So password mode needs the explicit value <i>and</i> no OAuth field; anything
        /// else is OAuth, which is what this provider always was. Inbound is always OAuth.
        /// </remarks>
        private static MailAuthenticationType ResolveAuthenticationType(MailConfiguration request)
        {
            var carriesOAuthFields =
                !string.IsNullOrWhiteSpace(request.TenantId)
                || !string.IsNullOrWhiteSpace(request.ClientId)
                || !string.IsNullOrEmpty(request.ClientSecret)
                || !string.IsNullOrWhiteSpace(request.MailboxAddress);

            return !request.IsInbound
                && request.AuthenticationType == MailAuthenticationType.Password
                && !carriesOAuthFields
                    ? MailAuthenticationType.Password
                    : MailAuthenticationType.OAuthClientCredentials;
        }

        /// <summary>
        /// Null and empty mean "keep the secret on file"; whitespace does not. A caller who types
        /// a space has supplied a value and meant to change it, and storing it would leave a
        /// configuration that authenticates with a blank credential.
        /// </summary>
        private static void AddClientSecretError(
            string? clientSecret,
            MailServerConfiguration? existing,
            IDictionary<string, string> errors)
        {
            var isWhitespaceOnly = clientSecret is { Length: > 0 } && clientSecret.Trim().Length == 0;

            if (isWhitespaceOnly)
            {
                errors["ClientSecret"] = "Client secret must not be blank.";
                return;
            }

            var hasSecretOnFile = !string.IsNullOrEmpty(existing?.ClientSecretReference);

            if (string.IsNullOrEmpty(clientSecret) && !hasSecretOnFile)
            {
                errors["ClientSecret"] = "Client secret is required for a new SMTP Office 365 configuration.";
            }
        }

        /// <summary>
        /// Identifies the owning configuration without naming the Entra tenant, the mailbox or
        /// the client id — a secret description is readable by anyone who can list secrets.
        /// </summary>
        private static string DescribeFor(string? configurationId, string? configurationName) =>
            string.Concat(
                "SMTP Office 365 client secret for mail configuration ",
                configurationName,
                " (",
                configurationId,
                ").");

        /// <summary>
        /// Decides the same way FluentValidation's <c>EmailAddress()</c> rule does, so the mailbox
        /// field and the sender field cannot disagree about the same address.
        /// </summary>
        private static bool IsValidEmail(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return false;
            }

            try
            {
                return new MailAddress(value).Address == value;
            }
            catch (FormatException)
            {
                return false;
            }
        }
    }
}
