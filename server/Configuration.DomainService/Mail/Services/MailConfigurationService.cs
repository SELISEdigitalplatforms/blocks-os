using Blocks.Genesis;
using Blocks.Secrets;
using Configuration.DomainService.Mail.Providers;
using Configuration.DomainService.Mail.RequestModel;
using Configuration.DomainService.Mail.ResponseModel;
using Configuration.DomainService.Shared.Secrets;
using Configuration.DomainService.Shared.Services;
using FluentValidation;
using Microsoft.Extensions.Logging;
using Blocks.Genesis.Entities.Os;

namespace Configuration.DomainService.Mail.Services
{
    /// <inheritdoc />
    public class MailConfigurationService : IMailConfigurationService
    {
        private const string MaskedSecretValue = "********";
        private const string ConfigurationNotFound = "Configuration not found";
        private const string ConfigurationIdField = "ConfigurationId";

        private readonly IConfigurationRepository _configurationRepository;
        private readonly IMailConfigurationProviderRegistry _providers;
        private readonly IValidator<MailConfiguration> _validator;
        private readonly ILogger<MailConfigurationService> _logger;

        public MailConfigurationService(
            IConfigurationRepository configurationRepository,
            IMailConfigurationProviderRegistry providers,
            IValidator<MailConfiguration> validator,
            ILogger<MailConfigurationService> logger)
        {
            _configurationRepository = configurationRepository;
            _providers = providers;
            _validator = validator;
            _logger = logger;
        }

        public async Task<MailConfigurationMutationResult> SaveAsync(
            MailConfiguration configuration,
            CancellationToken cancellationToken = default)
        {
            ArgumentNullException.ThrowIfNull(configuration);

            _logger.LogInformation("Saving mail configuration start");

            // The caller's own id decides create versus edit. It is read before anything is
            // allocated, so a create cannot be turned into an edit of a record the caller never
            // named, and an edit of a missing record cannot quietly become a create.
            var isCreate = string.IsNullOrWhiteSpace(configuration.ConfigurationId);

            MailServerConfiguration? existing = null;
            if (!isCreate)
            {
                existing = await _configurationRepository
                    .GetMailConfigurationByIdAsync(configuration.ConfigurationId)
                    .ConfigureAwait(false);

                if (existing is null)
                {
                    _logger.LogInformation("Saving mail configuration end -- Configuration not found");
                    return MailConfigurationMutationResult.Invalid(ConfigurationIdField, ConfigurationNotFound);
                }

                // The default record is platform-provisioned and its credentials are never sent to
                // the browser, so a full edit could only blank them. The sender name is the one
                // field a project may change; everything else on the request is ignored.
                if (existing.IsDefault)
                {
                    return await SaveDefaultSenderNameAsync(existing, configuration.SenderName).ConfigureAwait(false);
                }
            }

            if (!_providers.TryResolve(configuration.Provider, configuration.IsInbound, out var definition, out var providerError))
            {
                _logger.LogInformation("Saving mail configuration end -- Unsupported provider or direction");
                return MailConfigurationMutationResult.Invalid(providerError.Key, providerError.Value);
            }

            // Checked before any credential work. Switching a stored record's provider or
            // direction would leave its old credential owned by nobody, and would silently turn a
            // password configuration into an OAuth one or the reverse.
            if (existing is not null
                && (existing.Provider != configuration.Provider || existing.IsInbound != configuration.IsInbound))
            {
                _logger.LogInformation("Saving mail configuration end -- Provider or direction change rejected");
                return MailConfigurationMutationResult.Invalid(
                    "Provider",
                    "The provider and direction of an existing configuration cannot be changed.");
            }

            configuration.ConfigurationName = configuration.ConfigurationName?.Trim();
            definition.Normalize(configuration);

            // Read once and handed to both validation and the credential step, so they cannot
            // disagree about whether the stored secret is usable.
            var existingCredentialStatus = existing is null
                ? null
                : await definition.ResolveCredentialStatusAsync(existing, cancellationToken).ConfigureAwait(false);

            var errors = definition.Validate(configuration, existing, existingCredentialStatus);

            await AddSharedValidationErrorsAsync(configuration, errors, cancellationToken).ConfigureAwait(false);

            if (errors.Count > 0)
            {
                _logger.LogInformation("Saving mail configuration end -- Validation Error");
                return MailConfigurationMutationResult.Invalid(errors);
            }

            // One id, allocated here and persisted as-is, so the id the caller gets back is the
            // id of the document. It is set on the request before the credential step because a
            // provider names the owning configuration in its secret's description.
            if (isCreate)
            {
                configuration.ConfigurationId = Guid.NewGuid().ToString();
            }

            MailCredentialResult credential;
            string? vaultFailureType = null;
            try
            {
                credential = await definition
                    .SaveCredentialAsync(configuration, existing, existingCredentialStatus, cancellationToken)
                    .ConfigureAwait(false);
            }
            catch (SecretVaultException exception)
            {
                // Only the vault being unreachable becomes an availability answer. An
                // authorization or state failure is a different problem with a different fix, and
                // is left to the global filter to classify as 403/409/404.
                // The type only: a secret-store exception, or the vault error inside it, can name
                // the secret, and a reference must never reach a log.
                vaultFailureType = exception.GetType().Name;
                credential = MailCredentialResult.None;
            }

            if (vaultFailureType is not null)
            {
                _logger.LogError(
                    "Saving mail configuration end -- Secret store unavailable ({FailureType}) for configuration {ConfigurationId}",
                    vaultFailureType,
                    LogSafe.Value(configuration.ConfigurationId));

                return MailConfigurationMutationResult.SecretStoreUnavailable();
            }

            var entity = MapToEntity(configuration, existing, definition, credential.Reference);

            try
            {
                await _configurationRepository.SaveMailConfigurationAsync(entity).ConfigureAwait(false);
            }
            catch
            {
                await CompensateUnsavedAsync(definition, credential, entity.ItemId, "save").ConfigureAwait(false);
                throw;
            }

            _logger.LogInformation("Saving mail configuration end -- Success");
            return MailConfigurationMutationResult.Success(entity.ItemId);
        }

        public async Task<MailConfigurationResponse?> GetAsync(
            GetMailConfigurationRequest request,
            CancellationToken cancellationToken = default)
        {
            var configuration = await _configurationRepository
                .GetMailConfigurationByNameForViewAsync(request.ConfigurationName)
                .ConfigureAwait(false);

            return configuration is null ? null : await ProjectAsync(configuration, cancellationToken).ConfigureAwait(false);
        }

        public async Task<List<MailConfigurationResponse>> GetAllAsync(CancellationToken cancellationToken = default)
        {
            var configurations = await _configurationRepository.GetAllMailConfigurationsAsync().ConfigureAwait(false);

            // Sequential on purpose: the provider resolves status through the scoped
            // ISecretService, which is not documented as safe for concurrent use.
            var responses = new List<MailConfigurationResponse>(configurations.Count);
            foreach (var configuration in configurations)
            {
                responses.Add(await ProjectAsync(configuration, cancellationToken).ConfigureAwait(false));
            }

            return responses;
        }

        public async Task<MailConfigurationMutationResult> DeleteAsync(
            DeleteMailConfigurationRequest request,
            CancellationToken cancellationToken = default)
        {
            _logger.LogInformation("Deleting mail configuration start");

            var config = await _configurationRepository
                .GetMailConfigurationByIdAsync(request.ConfigurationId)
                .ConfigureAwait(false);

            if (config is null)
            {
                _logger.LogInformation("Deleting mail configuration end -- Configuration not found");
                return MailConfigurationMutationResult.Invalid(ConfigurationIdField, ConfigurationNotFound);
            }

            var hasDefinition = _providers.TryGet(config.Provider, out var definition);

            // The credential goes first. If it cannot be retired the configuration stays in
            // place, still pointing at it, rather than being deleted and stranding a live secret
            // that nothing references any more. A credential that is already archived or purged
            // is tolerated, and remembered as not retired by this call.
            var retiredHere = false;
            string? vaultFailureType = null;
            if (hasDefinition)
            {
                try
                {
                    retiredHere = await definition
                        .DeleteCredentialAsync(definition.CredentialReferenceOf(config), cancellationToken)
                        .ConfigureAwait(false);
                }
                catch (SecretVaultException exception)
                {
                    vaultFailureType = exception.GetType().Name;
                }
            }

            if (vaultFailureType is not null)
            {
                _logger.LogError(
                    "Deleting mail configuration end -- Secret store unavailable ({FailureType}) for configuration {ConfigurationId}",
                    vaultFailureType,
                    LogSafe.Value(config.ItemId));

                return MailConfigurationMutationResult.SecretStoreUnavailable();
            }

            try
            {
                await _configurationRepository.DeleteMailConfigurationAsync(request.ConfigurationId).ConfigureAwait(false);
            }
            catch
            {
                // Only a secret this call archived is put back. One that was already archived
                // before the delete stays archived: restoring it would revive a secret someone
                // deliberately took out of service.
                if (retiredHere)
                {
                    await RestoreAfterFailedDeleteAsync(definition, config, cancellationToken).ConfigureAwait(false);
                }
                throw;
            }

            _logger.LogInformation("Deleting mail configuration end -- Success");
            return MailConfigurationMutationResult.Success(request.ConfigurationId);
        }

        public async Task<MailConfigurationMutationResult> DuplicateAsync(
            DuplicateMailConfigurationRequest request,
            CancellationToken cancellationToken = default)
        {
            _logger.LogInformation("Duplicating mail configuration start");

            var config = await _configurationRepository
                .GetMailConfigurationByIdAsync(request.ConfigurationId)
                .ConfigureAwait(false);

            if (config is null)
            {
                _logger.LogInformation("Duplicating mail configuration end -- Configuration not found");
                return MailConfigurationMutationResult.Invalid(ConfigurationIdField, ConfigurationNotFound);
            }

            if (!_providers.TryGet(config.Provider, out var definition))
            {
                _logger.LogInformation("Duplicating mail configuration end -- Unsupported provider");
                return MailConfigurationMutationResult.Invalid("Provider", "Unsupported mail service provider.");
            }

            var errors = definition.ValidateDuplicate(config, request);
            if (errors.Count > 0)
            {
                _logger.LogInformation("Duplicating mail configuration end -- Validation Error");
                return MailConfigurationMutationResult.Invalid(errors);
            }

            // Built before the credential step so the copy's own id and name are what its new
            // secret's description records.
            var newConfig = CopyForDuplicate(config, definition);

            MailCredentialResult credential;
            string? vaultFailureType = null;
            try
            {
                credential = await definition.DuplicateCredentialAsync(config, newConfig, request, cancellationToken).ConfigureAwait(false);
            }
            catch (SecretVaultException exception)
            {
                vaultFailureType = exception.GetType().Name;
                credential = MailCredentialResult.None;
            }

            if (vaultFailureType is not null)
            {
                _logger.LogError(
                    "Duplicating mail configuration end -- Secret store unavailable ({FailureType}) for configuration {ConfigurationId}",
                    vaultFailureType,
                    LogSafe.Value(config.ItemId));

                return MailConfigurationMutationResult.SecretStoreUnavailable();
            }

            if (credential.Error is { } credentialError)
            {
                _logger.LogInformation("Duplicating mail configuration end -- Source credential unavailable");
                return MailConfigurationMutationResult.Invalid(credentialError.Key, credentialError.Value);
            }

            definition.ApplyCredential(newConfig, credential.Reference);

            try
            {
                await _configurationRepository.SaveMailConfigurationAsync(newConfig).ConfigureAwait(false);
            }
            catch
            {
                await CompensateUnsavedAsync(definition, credential, newConfig.ItemId, "duplicate").ConfigureAwait(false);
                throw;
            }

            _logger.LogInformation("Duplicating mail configuration end -- Success");
            return MailConfigurationMutationResult.Success(newConfig.ItemId);
        }

        /// <summary>
        /// Updates the sender name of the default configuration and nothing else.
        /// </summary>
        private async Task AddSharedValidationErrorsAsync(
            MailConfiguration configuration,
            IDictionary<string, string> errors,
            CancellationToken cancellationToken)
        {
            var sharedResult = await _validator.ValidateAsync(configuration, cancellationToken).ConfigureAwait(false);

            // Provider rules win a collision: they are the specific statement about this
            // request, and the generic message would be the more confusing of the two.
            foreach (var failure in sharedResult.Errors.Where(failure => !errors.ContainsKey(failure.PropertyName)))
            {
                errors[failure.PropertyName] = failure.ErrorMessage;
            }
        }

        private async Task<MailConfigurationMutationResult> SaveDefaultSenderNameAsync(
            MailServerConfiguration existing,
            string? senderName)
        {
            if (existing.IsInbound)
            {
                _logger.LogInformation("Saving mail configuration end -- Default inbound configuration is read-only");
                return MailConfigurationMutationResult.Invalid(
                    ConfigurationIdField,
                    "The default configuration cannot be changed.");
            }

            senderName = senderName?.Trim();
            if (string.IsNullOrEmpty(senderName) || senderName.Length < 3 || senderName.Length > 100)
            {
                _logger.LogInformation("Saving mail configuration end -- Validation Error");
                return MailConfigurationMutationResult.Invalid(
                    nameof(MailConfiguration.SenderName),
                    "Sender name must be between 3 and 100 characters.");
            }

            // A targeted update rather than a replace: the entity ignores unmapped elements on read,
            // so writing it back whole would drop anything provisioning stored that it does not map.
            await _configurationRepository
                .UpdateMailSenderNameAsync(
                    existing.ItemId,
                    senderName,
                    DateTime.UtcNow,
                    BlocksContext.GetContext()?.UserId ?? "")
                .ConfigureAwait(false);

            _logger.LogInformation("Saving mail configuration end -- Success");
            return MailConfigurationMutationResult.Success(existing.ItemId);
        }

        /// <summary>
        /// Copies the request's non-secret fields onto the stored document, then lets the provider
        /// store the credential reference in the field it owns.
        /// </summary>
        /// <remarks>
        /// Provider-agnostic: the flat fields stay the persistence contract for every provider,
        /// and a provider's own fields ride along because they exist on both shapes. That is what
        /// keeps pre-existing Amazon SES and Zoho documents round-tripping untouched — nothing is
        /// moved, renamed, or written through a discriminator.
        /// </remarks>
        private static MailServerConfiguration MapToEntity(
            MailConfiguration configuration,
            MailServerConfiguration? existing,
            IMailConfigurationProvider definition,
            string? credentialReference)
        {
            var entity = existing ?? new MailServerConfiguration
            {
                ItemId = configuration.ConfigurationId,
                CreatedDate = DateTime.UtcNow
            };

            entity.LastUpdatedDate = DateTime.UtcNow;
            entity.Host = configuration.Host;
            entity.Port = configuration.Port;
            entity.Name = configuration.ConfigurationName;
            entity.SenderName = configuration.SenderName;
            entity.SenderUserName = configuration.SenderUserName ?? string.Empty;
            entity.SenderAddress = configuration.SenderAddress;

            // Never the request's plaintext: a password lives only in Blocks Secrets, and a record
            // saved before that loses its document copy here, on the save that links its secret.
            entity.AccountPassword = string.Empty;
            entity.EnableSSL = configuration.EnableSSL;
            entity.CreatedBy = BlocksContext.GetContext()?.UserId ?? "";
            entity.LastUpdatedBy = BlocksContext.GetContext()?.UserId ?? "";
            entity.IsInbound = configuration.IsInbound;
            entity.Provider = configuration.Provider;
            entity.IsEnableSnsConfiguration = configuration.IsEnableSnsConfiguration;
            entity.AuthenticationType = configuration.AuthenticationType;
            entity.SecurityMode = configuration.SecurityMode;
            entity.TenantId = configuration.TenantId;
            entity.ClientId = configuration.ClientId;
            entity.MailboxAddress = configuration.MailboxAddress;

            // Only ever a reference, and only one the provider just handed back, in the field of
            // the provider's own mode. The plaintext on the request is not assigned anywhere here.
            definition.ApplyCredential(entity, credentialReference);

            return entity;
        }

        /// <summary>
        /// The copy's non-secret fields. It carries no password and no reference until the
        /// provider applies the copy's own credential.
        /// </summary>
        private static MailServerConfiguration CopyForDuplicate(
            MailServerConfiguration source,
            IMailConfigurationProvider definition) => new()
            {
                ItemId = Guid.NewGuid().ToString(),
                CreatedDate = DateTime.UtcNow,
                LastUpdatedDate = DateTime.UtcNow,
                CreatedBy = BlocksContext.GetContext()?.UserId,
                LastUpdatedBy = BlocksContext.GetContext()?.UserId,
                Tags = source.Tags,
                Name = source.Name + " - Copy",
                Host = source.Host,
                Port = source.Port,
                EnableSSL = source.EnableSSL,
                SenderName = source.SenderName,
                SenderAddress = source.SenderAddress,
                SenderUserName = source.SenderUserName,
                AccountPassword = string.Empty,
                UseDefaultCredentials = source.UseDefaultCredentials,
                SmtpClient = source.SmtpClient,
                IsDefault = source.IsDefault && definition.DuplicateInheritsDefault,
                Provider = source.Provider,
                IsInbound = source.IsInbound,
                IsEnableSnsConfiguration = source.IsEnableSnsConfiguration,
                AuthenticationType = source.AuthenticationType,
                SecurityMode = source.SecurityMode,
                TenantId = source.TenantId,
                ClientId = source.ClientId,
                MailboxAddress = source.MailboxAddress
            };

        /// <summary>
        /// Builds the browser-facing view of a stored record, including the linked secret's
        /// status where the provider shows one.
        /// </summary>
        /// <remarks>
        /// The status costs one metadata read, so it is resolved only when the provider says the
        /// response shows it (Office 365 OAuth). Password records show a fixed mask and make no
        /// secret-store call at all.
        /// </remarks>
        private async Task<MailConfigurationResponse> ProjectAsync(MailServerConfiguration entity, CancellationToken cancellationToken)
        {
            var response = new MailConfigurationResponse
            {
                ItemId = entity.ItemId,
                CreatedDate = entity.CreatedDate,
                LastUpdatedDate = entity.LastUpdatedDate,
                CreatedBy = entity.CreatedBy,
                LastUpdatedBy = entity.LastUpdatedBy,
                Tags = entity.Tags,
                Name = entity.Name,
                Host = entity.Host,
                Port = entity.Port,
                EnableSSL = entity.EnableSSL,
                SenderName = entity.SenderName,
                SenderAddress = entity.SenderAddress,
                SenderUserName = entity.SenderUserName,
                UseDefaultCredentials = entity.UseDefaultCredentials,
                SmtpClient = entity.SmtpClient,
                IsDefault = entity.IsDefault,
                IsInbound = entity.IsInbound,
                Provider = entity.Provider,
                IsEnableSnsConfiguration = entity.IsEnableSnsConfiguration,
                AuthenticationType = entity.AuthenticationType,
                SecurityMode = entity.SecurityMode,

                // The existing mask is the default so an unregistered provider cannot accidentally
                // return a real password; a definition then decides what its own fields look like.
                AccountPassword = MaskedSecretValue
            };

            if (_providers.TryGet(entity.Provider, out var definition))
            {
                var credentialStatus = definition.ProjectsCredentialStatus(entity)
                    ? await definition.ResolveCredentialStatusAsync(entity, cancellationToken).ConfigureAwait(false)
                    : null;
                definition.ProjectResponse(entity, response, credentialStatus);
            }

            return response;
        }

        /// <summary>
        /// Retires a credential this operation created when the write that would reference it
        /// failed. Every failure here is logged and swallowed so the write failure is what propagates.
        /// </summary>
        /// <remarks>
        /// Only a created credential is compensated. Undoing a rotation would need the previous
        /// plaintext, which the caller no longer holds and this service never keeps — so a failed
        /// write after a rotation leaves the new value in place and the configuration unchanged,
        /// which is recoverable by retrying the edit.
        /// <para>
        /// A write can fail after the server applied it (a lost acknowledgement), and retiring the
        /// secret then would leave the stored document pointing at an archived secret. So the
        /// document is read back first, as service registration does, and the secret is kept when
        /// the stored document already references it or the read-back itself fails: an orphaned
        /// secret is recoverable, a configuration that can no longer authenticate is not.
        /// </para>
        /// </remarks>
        private async Task CompensateUnsavedAsync(
            IMailConfigurationProvider definition,
            MailCredentialResult credential,
            string configurationId,
            string operation)
        {
            if (!credential.Created || string.IsNullOrEmpty(credential.Reference))
            {
                return;
            }

            var loggedConfigurationId = LogSafe.Value(configurationId);
            bool storedReferencesSecret;
            string? readBackFailureType = null;
            try
            {
                var stored = await _configurationRepository.GetMailConfigurationByIdAsync(configurationId).ConfigureAwait(false);
                storedReferencesSecret = stored is not null
                    && string.Equals(definition.CredentialReferenceOf(stored), credential.Reference, StringComparison.Ordinal);
            }
            catch (Exception exception)
            {
                // Only the type name leaves the catch: the exception message can carry the reference.
                storedReferencesSecret = false;
                readBackFailureType = exception.GetType().Name;
            }

            if (readBackFailureType is not null)
            {
                _logger.LogWarning(
                    "Mail configuration {Operation} failed and the configuration could not be read back ({FailureType}); its new secret is kept. Reconcile configuration {ConfigurationId}.",
                    operation,
                    readBackFailureType,
                    loggedConfigurationId);
                return;
            }

            if (storedReferencesSecret)
            {
                _logger.LogWarning(
                    "Mail configuration {Operation} reported a failure but the configuration was written; its new secret is kept. Configuration {ConfigurationId}.",
                    operation,
                    loggedConfigurationId);
                return;
            }

            string? retireFailureType = null;
            try
            {
                await definition.DeleteCredentialAsync(credential.Reference, CancellationToken.None).ConfigureAwait(false);
            }
            catch (Exception exception)
            {
                retireFailureType = exception.GetType().Name;
            }

            if (retireFailureType is not null)
            {
                // Secret-free on purpose: the configuration id and the operation are enough for an
                // operator to find both sides, and the reference must not reach a log that is
                // shipped off-box. Hence the exception type only: a not-found message carries the id.
                _logger.LogError(
                    "Mail configuration {Operation} failed and its new secret could not be retired ({FailureType}). Reconcile configuration {ConfigurationId}.",
                    operation,
                    retireFailureType,
                    loggedConfigurationId);
            }
        }

        /// <summary>
        /// Puts a retired credential back when the configuration delete that followed it failed.
        /// </summary>
        private async Task RestoreAfterFailedDeleteAsync(
            IMailConfigurationProvider definition,
            MailServerConfiguration config,
            CancellationToken cancellationToken)
        {
            var reference = definition.CredentialReferenceOf(config);
            if (string.IsNullOrEmpty(reference))
            {
                return;
            }

            string? failureType = null;
            try
            {
                await definition.RestoreCredentialAsync(reference, cancellationToken).ConfigureAwait(false);
            }
            catch (Exception exception)
            {
                failureType = exception.GetType().Name;
            }

            if (failureType is not null)
            {
                // The configuration is deliberately left in place for operator repair: it still
                // points at a secret that is now soft-deleted, which is visible and fixable,
                // where deleting it would leave nothing to reconcile against.
                _logger.LogError(
                    "Mail configuration delete failed and its secret could not be restored ({FailureType}). Reconcile configuration {ConfigurationId}.",
                    failureType,
                    LogSafe.Value(config.ItemId));
            }
        }
    }
}
