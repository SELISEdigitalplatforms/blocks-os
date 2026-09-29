using Configuration.DomainService.Integration.RequestModel;
using FluentValidation;

namespace Configuration.DomainService.Integration.Validators
{
    public class SaveIntegrationSetupRequestValidator : AbstractValidator<SaveIntegrationSetupRequest>
    {
        public SaveIntegrationSetupRequestValidator()
        {
            RuleFor(r => r.TemplateKey).NotEmpty().WithMessage("TemplateKey must not be empty.");
            RuleFor(r => r.RoleId).NotEmpty().WithMessage("RoleId must not be empty.");
            RuleFor(r => r.RoleSlug).NotEmpty().WithMessage("RoleSlug must not be empty.");
            RuleFor(r => r.ClientCredentialId).NotEmpty().WithMessage("ClientCredentialId must not be empty.");
        }
    }
}
