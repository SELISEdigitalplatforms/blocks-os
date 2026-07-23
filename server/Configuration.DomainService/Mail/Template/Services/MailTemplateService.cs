using Blocks.Genesis;
using Configuration.DomainService.Mail.Entities;
using FluentValidation;

namespace Configuration.DomainService.Mail.Template.Services
{
    public class MailTemplateService : IMailTemplateService
    {
        private readonly IValidator<SaveMailTemplateRequest> _validator;
        private readonly IMailTemplateRepository _templateRepository;

        public MailTemplateService(
            IValidator<SaveMailTemplateRequest> validator,
            IMailTemplateRepository templateRepository)
        {
            _validator = validator;
            _templateRepository = templateRepository;
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

            var repoTemplate = await MapIntoRepoTemplateAsync(template);
            if (repoTemplate == null)
            {
                return new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                    {
                        { "Template", "Template with the same Name and Language already exists" }
                    }
                };
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
            return await _templateRepository.GetByIdAsync(request.ItemId);
        }

        public async Task<BaseMutationResponse> CloneTemplateAsync(CloneMailTemplateRequest request)
        {
            var repoTemplate = await _templateRepository.GetByIdAsync(request.ItemId);
            if (repoTemplate == null)
            {
                return new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string> { { "Template", "Template not found" } }
                };
            }

            var clone = new EmailTemplate
            {
                ItemId = Guid.NewGuid().ToString(),
                CreatedDate = DateTime.UtcNow,
                LastUpdatedDate = DateTime.UtcNow,
                CreatedBy = BlocksContext.GetContext()?.UserId ?? "no_user",
                LastUpdatedBy = BlocksContext.GetContext()?.UserId ?? "no_user",
                GeneratedBy = BlocksContext.GetContext()?.UserId ?? "no_user",
                Name = !string.IsNullOrWhiteSpace(request.Name) ? request.Name : repoTemplate.Name + "_clone",
                MailConfigurationId = !string.IsNullOrWhiteSpace(request.MailConfigurationId)
                    ? request.MailConfigurationId
                    : repoTemplate.MailConfigurationId,
                ImageId = repoTemplate.ImageId,
                ImageUrl = repoTemplate.ImageUrl,
                JsonContent = repoTemplate.JsonContent,
                TemplateBody = repoTemplate.TemplateBody,
                Language = !string.IsNullOrWhiteSpace(request.Language) ? request.Language : repoTemplate.Language,
                TemplateSubject = !string.IsNullOrWhiteSpace(request.TemplateSubject)
                    ? request.TemplateSubject
                    : repoTemplate.TemplateSubject
            };

            await _templateRepository.SaveAsync(clone);

            return new BaseMutationResponse { IsSuccess = true, ItemId = clone.ItemId };
        }

        public async Task<BaseMutationResponse> DeleteAsync(DeleteMailTemplateRequest request)
        {
            var template = await _templateRepository.GetByIdAsync(request.ItemId);
            if (template == null)
            {
                return new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string> { { "ItemId", "ItemId not found" } }
                };
            }

            await _templateRepository.DeleteAsync(request.ItemId);

            return new BaseMutationResponse { IsSuccess = true };
        }

        private async Task<EmailTemplate?> MapIntoRepoTemplateAsync(SaveMailTemplateRequest template)
        {
            EmailTemplate? existingTemplateWithNameLanguage = null;
            if (!string.IsNullOrWhiteSpace(template.Name) && !string.IsNullOrWhiteSpace(template.Language))
            {
                existingTemplateWithNameLanguage =
                    await _templateRepository.GetByNameAndLanguageAsync(template.Name, template.Language);
            }

            if (string.IsNullOrWhiteSpace(template.ItemId))
            {
                if (existingTemplateWithNameLanguage != null)
                {
                    return null;
                }

                return CreateNewEmailTemplate(template);
            }

            if (existingTemplateWithNameLanguage != null &&
                existingTemplateWithNameLanguage.ItemId != template.ItemId)
            {
                return null;
            }

            var repoTemplate = await _templateRepository.GetByIdAsync(template.ItemId)
                ?? new EmailTemplate
                {
                    ItemId = template.ItemId,
                    CreatedDate = DateTime.UtcNow,
                    CreatedBy = BlocksContext.GetContext()?.UserId ?? "no_user"
                };

            UpdateExistingTemplate(repoTemplate, template);
            repoTemplate.LastUpdatedDate = DateTime.UtcNow;
            repoTemplate.LastUpdatedBy = BlocksContext.GetContext()?.UserId ?? "no_user";

            return repoTemplate;
        }

        private static EmailTemplate CreateNewEmailTemplate(SaveMailTemplateRequest template)
        {
            var userId = BlocksContext.GetContext()?.UserId ?? "no_user";
            return new EmailTemplate
            {
                ItemId = Guid.NewGuid().ToString(),
                CreatedDate = DateTime.UtcNow,
                LastUpdatedDate = DateTime.UtcNow,
                CreatedBy = userId,
                LastUpdatedBy = userId,
                GeneratedBy = userId,
                Name = template.Name,
                MailConfigurationId = template.MailConfigurationId,
                ImageId = template.ImageId,
                ImageUrl = template.ImageUrl,
                JsonContent = template.JsonContent,
                Language = template.Language,
                TemplateBody = template.TemplateBody,
                TemplateSubject = template.TemplateSubject
            };
        }

        private static void UpdateExistingTemplate(EmailTemplate repoTemplate, SaveMailTemplateRequest template)
        {
            repoTemplate.Name = template.Name ?? repoTemplate.Name;
            repoTemplate.MailConfigurationId = template.MailConfigurationId ?? repoTemplate.MailConfigurationId;
            repoTemplate.ImageId = template.ImageId ?? repoTemplate.ImageId;
            repoTemplate.ImageUrl = template.ImageUrl ?? repoTemplate.ImageUrl;
            repoTemplate.JsonContent = template.JsonContent ?? repoTemplate.JsonContent;
            repoTemplate.Language = template.Language ?? repoTemplate.Language;
            repoTemplate.TemplateBody = template.TemplateBody ?? repoTemplate.TemplateBody;
            repoTemplate.TemplateSubject = template.TemplateSubject ?? repoTemplate.TemplateSubject;
        }
    }
}




