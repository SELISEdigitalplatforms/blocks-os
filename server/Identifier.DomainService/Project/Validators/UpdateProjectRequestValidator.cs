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

            // The cookie domain decides where auth cookies are scoped and which API
            // host the application is served from, so a project must not be able to
            // claim one it has no business under — project creation has always
            // enforced this, and the add/edit path has to agree.
            RuleFor(x => x.Application.CookieDomain)
                .NotEmpty().WithMessage("Cookie domain is required.")
                .Must((request, cookieDomain) => IdentifierHelper.IsCookieDomainValidFor(request.Application.Domain, cookieDomain))
                .WithMessage("Cookie domain must be the domain itself or one of its parent domains.")
                .When(x => (x.Action == ApplicationAction.Add || x.Action == ApplicationAction.Edit) && x.Application != null);

            RuleFor(x => x.ApplicationDomain)
                .NotEmpty().WithMessage("ApplicationDomain is required for Edit or Delete actions.")
                .When(x => x.Action == ApplicationAction.Edit || x.Action == ApplicationAction.Delete);
        }
    }
}
