using Blocks.Genesis;
using FluentValidation;
using Blocks.Genesis.Entities.Os;
using Configuration.DomainService.Organizations;
using Configuration.DomainService.Shared.Services;

namespace Configuration.DomainService.Mail.Template.Services
{
    public class MailTemplateService : IMailTemplateService
    {
        private readonly IValidator<SaveMailTemplateRequest> _validator;
        private readonly IMailTemplateRepository _templateRepository;
        private readonly IMailTemplateHtmlChecker _htmlChecker;
        private readonly IOrganizationReader _organizationReader;
        private readonly IConfigurationRepository _configurationRepository;

        public MailTemplateService(
            IValidator<SaveMailTemplateRequest> validator,
            IMailTemplateRepository templateRepository,
            IMailTemplateHtmlChecker htmlChecker,
            IOrganizationReader organizationReader,
            IConfigurationRepository configurationRepository)
        {
            _validator = validator;
            _templateRepository = templateRepository;
            _htmlChecker = htmlChecker;
            _organizationReader = organizationReader;
            _configurationRepository = configurationRepository;
        }

        public async Task<BaseMutationResponse> SaveTemplateAsync(SaveMailTemplateRequest template)
        {
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
            return await _templateRepository.GetsAsync(request);
        }

        public async Task<EmailTemplate?> GetAsync(GetMailTemplateRequest request)
        {
            return await _templateRepository.GetForViewAsync(request.ItemId);
        }

        public async Task<BaseMutationResponse> CloneTemplateAsync(CloneMailTemplateRequest request)
        {
            var repoTemplate = await _templateRepository.GetByIdAsync(request.ItemId);
            if (repoTemplate == null)
            {
                return Failure("Template", "Template not found");
            }

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

        public async Task<BaseMutationResponse> DeleteAsync(DeleteMailTemplateRequest request)
        {
            var template = await _templateRepository.GetByIdAsync(request.ItemId);
            if (template == null)
            {
                return Failure("ItemId", "ItemId not found");
            }

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
