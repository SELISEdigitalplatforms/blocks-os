using Configuration.DomainService.Integration.RequestModel;
using FluentValidation;

namespace Configuration.DomainService.Integration.Validators;

public sealed class RunIntegrationSetupRequestValidator : AbstractValidator<RunIntegrationSetupRequest>
{
    public RunIntegrationSetupRequestValidator()
    {
        RuleFor(r => r.TemplateKey).NotEmpty().WithMessage("TemplateKey must not be empty.");
        RuleFor(r => r.ConnectionName).Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("ConnectionName must not be empty.")
            .Must(name => name.Trim().Length is >= 1 and <= 60).WithMessage("ConnectionName must be between 1 and 60 characters.");
    }
}
