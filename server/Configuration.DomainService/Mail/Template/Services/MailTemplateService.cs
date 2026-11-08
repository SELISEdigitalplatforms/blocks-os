using Blocks.Genesis;
using FluentValidation;
using Blocks.Genesis.Entities.Os;
using Configuration.DomainService.Organizations;
using Configuration.DomainService.Shared.Services;
using Configuration.DomainService.Shared.Utilities;
using Microsoft.Extensions.Logging;

namespace Configuration.DomainService.Mail.Template.Services
{
    public class MailTemplateService : IMailTemplateService
    {
        private readonly IValidator<SaveMailTemplateRequest> _validator;
        private readonly IMailTemplateRepository _templateRepository;
        private readonly IMailTemplateHtmlChecker _htmlChecker;
        private readonly IOrganizationReader _organizationReader;
        private readonly IConfigurationRepository _configurationRepository;
        private readonly IMessageClient _messageClient;
        private readonly ILogger<MailTemplateService> _logger;

        public MailTemplateService(
            IValidator<SaveMailTemplateRequest> validator,
            IMailTemplateRepository templateRepository,
            IMailTemplateHtmlChecker htmlChecker,
            IOrganizationReader organizationReader,
            IConfigurationRepository configurationRepository,
            IMessageClient messageClient,
            ILogger<MailTemplateService> logger)
        {
            _messageClient = messageClient;
            _logger = logger;
            _validator = validator;
            _templateRepository = templateRepository;
            _htmlChecker = htmlChecker;
            _organizationReader = organizationReader;
            _configurationRepository = configurationRepository;
        }

        public async Task<BaseMutationResponse> SaveTemplateAsync(SaveMailTemplateRequest template)
        {
            ArgumentNullException.ThrowIfNull(template);
            // Before validation, whose Name + Language check reads the request's organization: a confined caller's
            // template is its own organization's, and naming another one is refused.
            template.OrganizationId = CallerOrganization.Scope(template.OrganizationId);

            var validationResult = await _validator.ValidateAsync(template);

            if (!validationResult.IsValid)
            {
                return new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = validationResult.Errors.ToDictionary(e => e.PropertyName, e => e.ErrorMessage)
                };
            }

            var stored = string.IsNullOrWhiteSpace(template.ItemId)
                ? null
                : await _templateRepository.GetByIdAsync(template.ItemId);
            if (stored != null)
            {
                CallerOrganization.EnsureMayAccess(stored.OrganizationId);
            }

            // An unknown id is saved as a new template with that id, as before organizations.
            var mapped = stored == null
                ? await MapNewTemplateAsync(template)
                : MapEditedTemplate(stored, template);
            if (mapped.Error != null)
            {
                return mapped.Error;
            }

            var repoTemplate = mapped.Template!;

            // Checked on the merged template, so a body-only update keeps a stored subject.
            if (IsSubjectMissing(repoTemplate))
            {
                return SubjectRequiredResponse();
            }

            if (template.MailConfigurationId != null)
            {
                var configurationError = await FindConfigurationErrorAsync(template.MailConfigurationId, repoTemplate.OrganizationId);
                if (configurationError != null)
                {
                    return configurationError;
                }
            }

            await _templateRepository.SaveAsync(repoTemplate);

            return new BaseMutationResponse { IsSuccess = true, ItemId = repoTemplate.ItemId };
        }

        public async Task<GetAllMailTemplatesResponse> GetAllTemplatesAsync(GetAllMailTemplatesRequest request)
        {
            ArgumentNullException.ThrowIfNull(request);
            // A confined caller lists its own organization's templates; no organization named means that one too.
            request.OrganizationId = CallerOrganization.Scope(request.OrganizationId);
            return await _templateRepository.GetsAsync(request);
        }

        public async Task<EmailTemplate?> GetAsync(GetMailTemplateRequest request)
        {
            var template = await _templateRepository.GetForViewAsync(request.ItemId);
            if (template != null)
            {
                CallerOrganization.EnsureMayAccess(template.OrganizationId);
            }

            return template;
        }

        public async Task<BaseMutationResponse> CloneTemplateAsync(CloneMailTemplateRequest request)
        {
            var repoTemplate = await _templateRepository.GetByIdAsync(request.ItemId);
            if (repoTemplate == null)
            {
                return Failure("Template", "Template not found");
            }

            // The clone stays in the source's organization, so the source must be the caller's to read.
            CallerOrganization.EnsureMayAccess(repoTemplate.OrganizationId);

            // A clone is the same template in another language: same name, same organization.
            if (!string.IsNullOrWhiteSpace(request.Name) && request.Name != repoTemplate.Name)
            {
                return Failure(nameof(CloneMailTemplateRequest.Name), "A clone keeps the template's name");
            }

            if (string.IsNullOrWhiteSpace(request.Language))
            {
                return Failure(nameof(CloneMailTemplateRequest.Language), "Language is required");
            }

            // A clone is a new template, so its body meets the same rules as a saved one; an old
            // template saved before the rules existed cannot be copied as it is.
            var bodyProblem = _htmlChecker.FindProblem(repoTemplate.TemplateBody);
            if (bodyProblem != null)
            {
                return Failure(nameof(EmailTemplate.TemplateBody), bodyProblem);
            }

            var organizationId = OrganizationIds.Normalize(repoTemplate.OrganizationId);
            if (!string.IsNullOrWhiteSpace(repoTemplate.Name)
                && await _templateRepository.GetByNameAndLanguageAsync(repoTemplate.Name, request.Language, organizationId) != null)
            {
                return Failure(nameof(CloneMailTemplateRequest.Language), "This template already exists in that language");
            }

            var userId = BlocksContext.GetContext()?.UserId ?? "no_user";
            var clone = new EmailTemplate
            {
                ItemId = Guid.NewGuid().ToString(),
                CreatedDate = DateTime.UtcNow,
                LastUpdatedDate = DateTime.UtcNow,
                CreatedBy = userId,
                LastUpdatedBy = userId,
                GeneratedBy = userId,
                Name = repoTemplate.Name,
                OrganizationId = organizationId,
                MailConfigurationId = !string.IsNullOrWhiteSpace(request.MailConfigurationId)
                    ? request.MailConfigurationId
                    : repoTemplate.MailConfigurationId,
                ImageId = repoTemplate.ImageId,
                ImageUrl = repoTemplate.ImageUrl,
                JsonContent = repoTemplate.JsonContent,
                TemplateBody = repoTemplate.TemplateBody,
                Language = request.Language,
                TemplateSubject = !string.IsNullOrWhiteSpace(request.TemplateSubject)
                    ? request.TemplateSubject
                    : repoTemplate.TemplateSubject,
                // The organization made this one itself, even when the source was a copy from Default.
                CreatedFromDefault = false
            };

            if (IsSubjectMissing(clone))
            {
                return SubjectRequiredResponse();
            }

            if (!string.IsNullOrWhiteSpace(request.MailConfigurationId))
            {
                var configurationError = await FindConfigurationErrorAsync(request.MailConfigurationId, organizationId);
                if (configurationError != null)
                {
                    return configurationError;
                }
            }

            await _templateRepository.SaveAsync(clone);

            return new BaseMutationResponse { IsSuccess = true, ItemId = clone.ItemId };
        }

        /// <summary>Organizations per delete-across request when not all (SPEC34 §6.1).</summary>
        public const int MaxDeleteOrganizations = 1000;

        public async Task<BaseMutationResponse> DeleteAcrossOrganizationsAsync(DeleteTemplateAcrossOrganizationsRequest request)
        {
            ArgumentNullException.ThrowIfNull(request);
            // It deletes the Default template and copies in other organizations: never for a confined caller.
            CallerOrganization.EnsureUnconfined();

            var template = string.IsNullOrWhiteSpace(request.TemplateId) ? null : await _templateRepository.GetByIdAsync(request.TemplateId);
            if (template is null)
                return Failure(nameof(request.TemplateId), "Template not found");
            // C1: an organization's own template is deleted on its own (DeleteTemplate, SPEC31).
            if (OrganizationIds.Normalize(template.OrganizationId) != OrganizationIds.Default)
                return Failure(nameof(request.TemplateId), "Only Default organization templates can be deleted across organizations");

            var organizationIds = request.AllOrganizations ? [] : OrganizationsOnly(request.OrganizationIds);
            if (!request.AllOrganizations && organizationIds.Count == 0)
                return Failure(nameof(request.OrganizationIds), "Select at least one organization");
            if (organizationIds.Count > MaxDeleteOrganizations)
                return Failure(nameof(request.OrganizationIds), "No more than 1000 organizations per request");

            var context = BlocksContext.GetContext();
            if (string.IsNullOrWhiteSpace(context?.TenantId))
            {
                // A job without a project tenant would have nowhere to delete from: nothing is deleted at all.
                _logger.LogError("Email template delete across organizations refused: no project tenant. TemplateId={TemplateId}", template.ItemId);
                return Failure("Copies", "Deleting organization copies couldn't start. Try again.");
            }

            // H2: the Default template goes now, through the same path as DeleteTemplate; the copies follow in the Worker.
            await _templateRepository.DeleteAsync(template.ItemId);

            var command = new EmailTemplateDeleteCommand
            {
                JobId = Guid.NewGuid().ToString(),
                TenantId = context.TenantId,
                OriginalTenantId = string.IsNullOrWhiteSpace(context.OriginalTenantId) ? null : context.OriginalTenantId,
                RequestedByUserId = context.UserId ?? string.Empty,
                Name = template.Name ?? string.Empty,
                Language = template.Language ?? string.Empty,
                AllOrganizations = request.AllOrganizations,
                OrganizationIds = organizationIds,
            };

            try
            {
                await _messageClient.SendToConsumerAsync(new ConsumerMessage<EmailTemplateDeleteCommand>
                {
                    ConsumerName = Constants.EmailTemplateQueue,
                    Payload = command,
                });
            }
#pragma warning disable CA1031 // C5: any send failure is the same answer; the Default template is already deleted.
            catch (Exception ex)
#pragma warning restore CA1031
            {
                _logger.LogError(ex, "Email template delete across organizations not queued after the Default delete. JobId={JobId} TemplateId={TemplateId} ErrorType={ErrorType}",
                    command.JobId, template.ItemId, ex.GetType().Name);
                return Failure("Copies", "The Default template was deleted, but deleting organization copies couldn't start. Try again from an organization's template.");
            }

            return new BaseMutationResponse { IsSuccess = true, ItemId = command.JobId };
        }

        // Distinct organization ids, trimmed; blanks and the Default organization are left out.
        private static List<string> OrganizationsOnly(IEnumerable<string>? organizationIds) =>
            (organizationIds ?? [])
                .Select(id => id?.Trim() ?? string.Empty)
                .Where(id => id.Length > 0 && OrganizationIds.Normalize(id) != OrganizationIds.Default)
                .Distinct(StringComparer.Ordinal)
                .ToList();

        public async Task<BaseMutationResponse> DeleteAsync(DeleteMailTemplateRequest request)
        {
            var template = await _templateRepository.GetByIdAsync(request.ItemId);
            if (template == null)
            {
                return Failure("ItemId", "ItemId not found");
            }

            CallerOrganization.EnsureMayAccess(template.OrganizationId);

            await _templateRepository.DeleteAsync(request.ItemId);

            return new BaseMutationResponse { IsSuccess = true };
        }

        // Logic cannot send a mail whose template has no subject, so none is stored without one.
        private static bool IsSubjectMissing(EmailTemplate template) =>
            string.IsNullOrWhiteSpace(template.TemplateSubject);

        private static BaseMutationResponse SubjectRequiredResponse() =>
            Failure(nameof(EmailTemplate.TemplateSubject), "Subject is required.");

        private static BaseMutationResponse Failure(string field, string message) =>
            new()
            {
                IsSuccess = false,
                Errors = new Dictionary<string, string> { { field, message } }
            };

        private sealed record Mapped(EmailTemplate? Template, BaseMutationResponse? Error);

        private async Task<Mapped> MapNewTemplateAsync(SaveMailTemplateRequest template)
        {
            var organizationId = OrganizationIds.Normalize(template.OrganizationId);
            if (!await _organizationReader.ExistsEnabledAsync(organizationId))
            {
                return new Mapped(null, Failure(nameof(SaveMailTemplateRequest.OrganizationId), "Organization not found"));
            }

            // One template per Name + Language in each organization; another organization's doesn't count.
            if (!string.IsNullOrWhiteSpace(template.Name) && !string.IsNullOrWhiteSpace(template.Language)
                && await _templateRepository.GetByNameAndLanguageAsync(template.Name, template.Language, organizationId) != null)
            {
                return new Mapped(null, Failure("Template", "Template with the same Name and Language already exists"));
            }

            var userId = BlocksContext.GetContext()?.UserId ?? "no_user";
            return new Mapped(new EmailTemplate
            {
                ItemId = string.IsNullOrWhiteSpace(template.ItemId) ? Guid.NewGuid().ToString() : template.ItemId,
                CreatedDate = DateTime.UtcNow,
                LastUpdatedDate = DateTime.UtcNow,
                CreatedBy = userId,
                LastUpdatedBy = userId,
                GeneratedBy = userId,
                Name = template.Name,
                OrganizationId = organizationId,
                MailConfigurationId = BlankAsEmpty(template.MailConfigurationId),
                ImageId = template.ImageId,
                ImageUrl = template.ImageUrl,
                JsonContent = template.JsonContent,
                Language = template.Language,
                TemplateBody = template.TemplateBody,
                TemplateSubject = template.TemplateSubject
            }, null);
        }

        // A blank configuration id means "Organization default" and is stored as empty, never as whitespace.
        private static string? BlankAsEmpty(string? mailConfigurationId) =>
            mailConfigurationId != null && string.IsNullOrWhiteSpace(mailConfigurationId) ? string.Empty : mailConfigurationId;

        /// <summary>
        /// Merges an edit into the stored template. Name, Language and organization are fixed after creation:
        /// a field the request leaves out keeps its stored value (New Template's step 2 sends only the body),
        /// and a different value is refused. CreatedFromDefault is never changed here.
        /// </summary>
        private static Mapped MapEditedTemplate(EmailTemplate stored, SaveMailTemplateRequest template)
        {
            var storedOrganizationId = OrganizationIds.Normalize(stored.OrganizationId);
            if (template.Name != null && template.Name != stored.Name)
            {
                return new Mapped(null, Failure(nameof(SaveMailTemplateRequest.Name), "A template's name can't be changed"));
            }

            if (template.Language != null && template.Language != stored.Language)
            {
                return new Mapped(null, Failure(nameof(SaveMailTemplateRequest.Language), "A template's language can't be changed"));
            }

            // Compared normalized, as a create reads it: "" or blank sent for a Default template is the same organization.
            if (template.OrganizationId != null && OrganizationIds.Normalize(template.OrganizationId) != storedOrganizationId)
            {
                return new Mapped(null, Failure(nameof(SaveMailTemplateRequest.OrganizationId), "A template's organization can't be changed"));
            }

            stored.OrganizationId = storedOrganizationId;
            stored.MailConfigurationId = BlankAsEmpty(template.MailConfigurationId) ?? stored.MailConfigurationId;
            stored.ImageId = template.ImageId ?? stored.ImageId;
            stored.ImageUrl = template.ImageUrl ?? stored.ImageUrl;
            stored.JsonContent = template.JsonContent ?? stored.JsonContent;
            stored.TemplateBody = template.TemplateBody ?? stored.TemplateBody;
            stored.TemplateSubject = template.TemplateSubject ?? stored.TemplateSubject;
            stored.LastUpdatedDate = DateTime.UtcNow;
            stored.LastUpdatedBy = BlocksContext.GetContext()?.UserId ?? "no_user";
            return new Mapped(stored, null);
        }

        /// <summary>The most templates one AssignTemplates request may name.</summary>
        public const int MaxAssignTemplateIds = 500;

        /// <summary>
        /// Points templates of the configuration's organization at the configuration (SPEC32 §6): explicit ids, or
        /// with AllMatching every template matching the list's search and language (the ids are then ignored).
        /// Ids are de-duplicated and blank ones dropped before the limit is applied; an id that no longer exists
        /// is skipped, while an id of another organization's template refuses the whole request.
        /// </summary>
        public async Task<AssignTemplatesResponse> AssignTemplatesAsync(AssignTemplatesRequest request)
        {
            var configuration = string.IsNullOrWhiteSpace(request.ConfigurationId)
                ? null
                : await _configurationRepository.GetMailConfigurationByIdAsync(request.ConfigurationId);
            if (configuration == null)
            {
                return AssignFailure(nameof(AssignTemplatesRequest.ConfigurationId), "Configuration not found");
            }

            // The templates changed are the configuration's organization's, so that must be the caller's.
            CallerOrganization.EnsureMayAccess(configuration.OrganizationId);

            if (configuration.IsInbound)
            {
                return AssignFailure(nameof(AssignTemplatesRequest.ConfigurationId), "An inbound configuration can't send mail");
            }

            var organizationId = OrganizationIds.Normalize(configuration.OrganizationId);
            IReadOnlyCollection<string>? templateIds = null;
            if (!request.AllMatching)
            {
                var ids = (request.TemplateIds ?? new List<string>())
                    .Where(id => !string.IsNullOrWhiteSpace(id))
                    .Distinct(StringComparer.Ordinal)
                    .ToList();
                if (ids.Count == 0)
                {
                    return AssignFailure(nameof(AssignTemplatesRequest.TemplateIds), "Select at least one template");
                }

                if (ids.Count > MaxAssignTemplateIds)
                {
                    return AssignFailure(nameof(AssignTemplatesRequest.TemplateIds), "No more than 500 templates per request");
                }

                if (await _templateRepository.CountOutsideOrganizationAsync(ids, organizationId) > 0)
                {
                    return AssignFailure(nameof(AssignTemplatesRequest.TemplateIds), "Some templates aren't in this configuration's organization");
                }

                templateIds = ids;
            }

            var updatedCount = await _templateRepository.AssignConfigurationAsync(
                configuration.ItemId,
                organizationId,
                templateIds,
                request.AllMatching ? request.SearchKey : null,
                request.AllMatching ? request.Language : null);

            return new AssignTemplatesResponse { IsSuccess = true, UpdatedCount = updatedCount };
        }

        private static AssignTemplatesResponse AssignFailure(string field, string message) =>
            new()
            {
                IsSuccess = false,
                Errors = new Dictionary<string, string> { { field, message } }
            };

        /// <summary>
        /// Empty means "Organization default" and is always allowed. Otherwise the configuration must be an
        /// outbound one of the template's organization or of the Default organization, which every
        /// organization shares.
        /// </summary>
        private async Task<BaseMutationResponse?> FindConfigurationErrorAsync(string mailConfigurationId, string templateOrganizationId)
        {
            if (string.IsNullOrWhiteSpace(mailConfigurationId))
            {
                return null;
            }

            var configuration = await _configurationRepository.GetMailConfigurationByIdAsync(mailConfigurationId);
            var configurationOrganizationId = configuration == null ? null : OrganizationIds.Normalize(configuration.OrganizationId);
            if (configurationOrganizationId == null
                || (configurationOrganizationId != OrganizationIds.Normalize(templateOrganizationId)
                    && configurationOrganizationId != OrganizationIds.Default))
            {
                return Failure(nameof(SaveMailTemplateRequest.MailConfigurationId), "Configuration not found");
            }

            if (configuration!.IsInbound)
            {
                return Failure(nameof(SaveMailTemplateRequest.MailConfigurationId), "An inbound configuration can't send mail");
            }

            return null;
        }
    }
}
