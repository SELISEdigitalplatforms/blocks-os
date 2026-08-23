using Configuration.DomainService.Captcha.RequestModel;
using FluentValidation;

namespace Configuration.DomainService.Captcha.Validators
{
    public class CaptchaConfigValidator : AbstractValidator<SaveCaptchaConfigRequest>
    {
        public CaptchaConfigValidator()
        {
            RuleFor(config => config.Provider)
                .Cascade(CascadeMode.Stop)
                .NotEmpty()
                .WithMessage("Provider must not be empty.");
        }
    }
}
