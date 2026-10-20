using System.Text.Json;
using FluentValidation;

namespace DomainService.Preference
{
    public class SaveUserPreferenceRequestValidator : AbstractValidator<SaveUserPreferenceRequest>
    {
        public SaveUserPreferenceRequestValidator()
        {
            RuleFor(x => x.Key)
                .Cascade(CascadeMode.Stop)
                .NotEmpty().WithMessage("Key is required.")
                .Must(UserPreferenceKeys.All.Contains).WithMessage("Key is not a known preference.");

            RuleFor(x => x.Value)
                .Cascade(CascadeMode.Stop)
                .NotEmpty().WithMessage("Value is required.")
                .MaximumLength(UserPreferenceKeys.MaxValueLength)
                .WithMessage($"Value cannot exceed {UserPreferenceKeys.MaxValueLength} characters.")
                .Must(BeJson).WithMessage("Value must be a JSON document.");
        }

        private static bool BeJson(string value)
        {
            try
            {
                using var _ = JsonDocument.Parse(value);
                return true;
            }
            catch (JsonException)
            {
                return false;
            }
        }
    }
}
