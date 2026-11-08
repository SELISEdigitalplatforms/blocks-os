using Configuration.DomainService.Mail.Template.Services;
using Configuration.DomainService.Organizations;
using FluentValidation;

namespace Configuration.DomainService.Mail.Template.Validators
{
    public class MailTemplateValidator : AbstractValidator<SaveMailTemplateRequest>
    {
        private readonly IMailTemplateRepository _templateRepository;

        public MailTemplateValidator(IMailTemplateRepository templateRepository, IMailTemplateHtmlChecker htmlChecker)
        {
            _templateRepository = templateRepository;

            RuleFor(template => template)
                .MustAsync(HaveUniqueNameAndLanguageAsync)
                .WithMessage("Template with the same Name and Language already exists");

            RuleFor(template => template.TemplateBody)
                .Custom((body, context) =>
                {
                    var problem = htmlChecker.FindProblem(body);
                    if (problem != null)
                    {
                        context.AddFailure(nameof(SaveMailTemplateRequest.TemplateBody), problem);
                    }
                });
        }

        // Checked here for a create only: an edit's organization is the stored one, which the service reads,
        // and an edit can't change the name or language anyway.
        private async Task<bool> HaveUniqueNameAndLanguageAsync(SaveMailTemplateRequest template, CancellationToken cancellationToken)
        {
            if (!string.IsNullOrWhiteSpace(template.ItemId)
                || string.IsNullOrWhiteSpace(template.Name)
                || string.IsNullOrWhiteSpace(template.Language))
            {
                return true;
            }

            var existingTemplate = await _templateRepository.GetByNameAndLanguageAsync(
                template.Name, template.Language, OrganizationIds.Normalize(template.OrganizationId));
            return existingTemplate == null;
        }
    }
}




