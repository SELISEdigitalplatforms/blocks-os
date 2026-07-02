using DomainService.Shared;
using FluentValidation;

namespace DomainService.Projects
{
    public class UpdateProjectRequestValidator : AbstractValidator<UpdateProjectRequest>
    {
        public UpdateProjectRequestValidator()
        {
            RuleFor(x => x.Action)
                .IsInEnum().WithMessage("Invalid action. Must be Add, Edit, or Delete.");

            RuleFor(x => x.Application)
                .NotNull().WithMessage("Application is required.")
                .When(x => x.Action == ApplicationAction.Add || x.Action == ApplicationAction.Edit);

            RuleFor(x => x.Application.Domain)
                .NotEmpty().WithMessage("Domain is required.")
                .Must(IdentifierHelper.BeAValidUrl).WithMessage("Domain is not in a valid format.")
                .When(x => (x.Action == ApplicationAction.Add || x.Action == ApplicationAction.Edit) && x.Application != null);

            RuleFor(x => x.ApplicationDomain)
                .NotEmpty().WithMessage("ApplicationDomain is required for Edit or Delete actions.")
                .When(x => x.Action == ApplicationAction.Edit || x.Action == ApplicationAction.Delete);
        }
    }
}
