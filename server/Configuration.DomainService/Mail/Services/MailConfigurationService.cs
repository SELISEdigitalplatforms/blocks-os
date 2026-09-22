using Blocks.Genesis;
using Blocks.Secrets;
using Configuration.DomainService.Mail.Entities;
using Configuration.DomainService.Mail.Providers;
using Configuration.DomainService.Mail.RequestModel;
using Configuration.DomainService.Mail.ResponseModel;
using Configuration.DomainService.Shared.Services;
using FluentValidation;
using Microsoft.Extensions.Logging;

namespace Configuration.DomainService.Mail.Services
{
    /// <inheritdoc />
    public class MailConfigurationService : IMailConfigurationService
    {
        private const string MaskedSecretValue = "********";
        private const string ConfigurationNotFound = "Configuration not found";

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
                    return MailConfigurationMutationResult.Invalid("ConfigurationId", ConfigurationNotFound);
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

            var errors = definition.Validate(configuration, existing);

            var sharedResult = await _validator.ValidateAsync(configuration, cancellationToken).ConfigureAwait(false);
            foreach (var failure in sharedResult.Errors)
            {
                // Provider rules win a collision: they are the specific statement about this
                // request, and the generic message would be the more confusing of the two.
                if (!errors.ContainsKey(failure.PropertyName))
                {
                    errors[failure.PropertyName] = failure.ErrorMessage;
                }
            }

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
            try
            {
                credential = await definition
                    .SaveCredentialAsync(configuration, existing, cancellationToken)
                    .ConfigureAwait(false);
            }
            catch (SecretVaultException exception)
            {
                // Only the vault being unreachable becomes an availability answer. An
                // authorization or state failure is a different problem with a different fix, and
                // is left to the global filter to classify as 403/409/404.
                _logger.LogError(
                    exception,
                    "Saving mail configuration end -- Secret store unavailable for configuration {ConfigurationId}",
                    configuration.ConfigurationId);

                return MailConfigurationMutationResult.SecretStoreUnavailable();
            }

            var entity = MapToEntity(configuration, existing, credential.Reference);

            try
            {
                await _configurationRepository.SaveMailConfigurationAsync(entity).ConfigureAwait(false);
            }
            catch
            {
                await CompensateAsync(definition, credential, entity.ItemId, "save").ConfigureAwait(false);
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
                .GetMailConfigurationByNameAsync(request.ConfigurationName)
                .ConfigureAwait(false);

            return configuration is null ? null : Project(configuration);
        }

        public async Task<List<MailConfigurationResponse>> GetAllAsync(CancellationToken cancellationToken = default)
        {
            var configurations = await _configurationRepository.GetAllMailConfigurationsAsync().ConfigureAwait(false);

            return configurations.Select(Project).ToList();
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
                return MailConfigurationMutationResult.Invalid("ConfigurationId", ConfigurationNotFound);
            }

            var hasDefinition = _providers.TryGet(config.Provider, out var definition);

            // The credential goes first. If it cannot be retired the configuration stays in
            // place, still pointing at it, rather than being deleted and stranding a live secret
            // that nothing references any more.
            if (hasDefinition)
            {
                try
                {
                    await definition.DeleteCredentialAsync(config.ClientSecretReference, cancellationToken).ConfigureAwait(false);
                }
                catch (SecretVaultException exception)
                {
                    _logger.LogError(
                        exception,
                        "Deleting mail configuration end -- Secret store unavailable for configuration {ConfigurationId}",
                        config.ItemId);

                    return MailConfigurationMutationResult.SecretStoreUnavailable();
                }
            }

            try
            {
                await _configurationRepository.DeleteMailConfigurationAsync(request.ConfigurationId).ConfigureAwait(false);
            }
            catch
            {
                await RestoreAfterFailedDeleteAsync(hasDefinition ? definition : null, config, cancellationToken).ConfigureAwait(false);
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
                return MailConfigurationMutationResult.Invalid("ConfigurationId", ConfigurationNotFound);
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

            MailCredentialResult credential;
            try
            {
                credential = await definition.DuplicateCredentialAsync(config, request, cancellationToken).ConfigureAwait(false);
            }
            catch (SecretVaultException exception)
            {
                _logger.LogError(
                    exception,
                    "Duplicating mail configuration end -- Secret store unavailable for configuration {ConfigurationId}",
                    config.ItemId);

                return MailConfigurationMutationResult.SecretStoreUnavailable();
            }

            var newConfig = CopyForDuplicate(config, definition, credential.Reference);

            try
            {
                await _configurationRepository.SaveMailConfigurationAsync(newConfig).ConfigureAwait(false);
            }
            catch
            {
                await CompensateAsync(definition, credential, newConfig.ItemId, "duplicate").ConfigureAwait(false);
                throw;
            }

            _logger.LogInformation("Duplicating mail configuration end -- Success");
            return MailConfigurationMutationResult.Success(newConfig.ItemId);
        }

        /// <summary>
        /// Copies the request's non-secret fields onto the stored document.
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
            entity.AccountPassword = configuration.AccountPassword ?? string.Empty;
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

            // Only ever a reference, and only one the provider just handed back. The plaintext on
            // the request is not assigned anywhere in this method.
            entity.ClientSecretReference = credentialReference;

            return entity;
        }

        private static MailServerConfiguration CopyForDuplicate(
            MailServerConfiguration source,
            IMailConfigurationProvider definition,
            string? credentialReference) => new()
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
                AccountPassword = source.AccountPassword,
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
                MailboxAddress = source.MailboxAddress,
                ClientSecretReference = credentialReference
            };

        /// <summary>
        /// Builds the browser-facing view of a stored record.
        /// </summary>
        private MailConfigurationResponse Project(MailServerConfiguration entity)
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
                definition.ProjectResponse(entity, response);
            }

            return response;
        }

        /// <summary>
        /// Retires a credential this operation created but could not finish using.
        /// </summary>
        /// <remarks>
        /// Only a created credential is compensated. Undoing a rotation would need the previous
        /// plaintext, which the caller no longer holds and this service never keeps — so a failed
        /// write after a rotation leaves the new value in place and the configuration unchanged,
        /// which is recoverable by retrying the edit.
        /// </remarks>
        private async Task CompensateAsync(
            IMailConfigurationProvider definition,
            MailCredentialResult credential,
            string configurationId,
            string operation)
        {
            if (!credential.Created || string.IsNullOrEmpty(credential.Reference))
            {
                return;
            }

            try
            {
                await definition.DeleteCredentialAsync(credential.Reference, CancellationToken.None).ConfigureAwait(false);
            }
            catch (Exception exception)
            {
                // Secret-free on purpose: the configuration id and the operation are enough for an
                // operator to find both sides, and the reference must not reach a log that is
                // shipped off-box.
                _logger.LogError(
                    exception,
                    "Mail configuration {Operation} failed and its new secret could not be retired. Reconcile configuration {ConfigurationId}.",
                    operation,
                    configurationId);
            }
        }

        /// <summary>
        /// Puts a retired credential back when the configuration delete that followed it failed.
        /// </summary>
        private async Task RestoreAfterFailedDeleteAsync(
            IMailConfigurationProvider? definition,
            MailServerConfiguration config,
            CancellationToken cancellationToken)
        {
            if (definition is null || string.IsNullOrEmpty(config.ClientSecretReference))
            {
                return;
            }

            try
            {
                await definition.RestoreCredentialAsync(config.ClientSecretReference, cancellationToken).ConfigureAwait(false);
            }
            catch (Exception exception)
            {
                // The configuration is deliberately left in place for operator repair: it still
                // points at a secret that is now soft-deleted, which is visible and fixable,
                // where deleting it would leave nothing to reconcile against.
                _logger.LogError(
                    exception,
                    "Mail configuration delete failed and its secret could not be restored. Reconcile configuration {ConfigurationId}.",
                    config.ItemId);
            }
        }
    }
}
