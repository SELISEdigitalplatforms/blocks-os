using Configuration.DomainService.Notification.RequestModel;
using Configuration.DomainService.Shared.Services;
using FluentValidation;

namespace Configuration.DomainService.Notification.Validators
{
    public class NotificationConfigurationValidator : AbstractValidator<SaveNotificationConfigurationRequest>
    {
        private readonly IConfigurationRepository _configurationRepository;

        public NotificationConfigurationValidator(IConfigurationRepository configurationRepository)
        {
            _configurationRepository = configurationRepository;

            RuleFor(x => x.Name)
                .NotEmpty().WithMessage("Name is required.")
                .MaximumLength(100).WithMessage("Name must not exceed 100 characters.")
                .MustAsync(IsUniqueNameAsync)
                .When(x => !x.IsUpdateRequest)
                .WithMessage("Name must be unique");

            RuleFor(x => x.ChannelToNotify)
                .IsInEnum().WithMessage("Invalid channel type.");

            RuleFor(x => x.NotificationType)
                .IsInEnum().WithMessage("Invalid notification type.");

            RuleFor(x => x.NotifyMethod)
                .NotEmpty().WithMessage("NotifyMethod is required.")
                .MaximumLength(50).WithMessage("NotifyMethod must not exceed 50 characters.");

            RuleFor(x => x.EnablePersistence)
                .NotNull().WithMessage("EnablePersistence must be specified.");

            // Built-in fields: checked only when sent, so a request without them validates as before.
            RuleFor(x => x.Importance!.Value)
                .IsInEnum().WithMessage("Invalid importance.")
                .OverridePropertyName("Importance")
                .When(x => x.Importance.HasValue);

            RuleFor(x => x.Kind!.Value)
                .IsInEnum().WithMessage("Invalid kind.")
                .OverridePropertyName("Kind")
                .When(x => x.Kind.HasValue);

            RuleFor(x => x.Description)
                .MaximumLength(1000).WithMessage("Description must not exceed 1000 characters.");

            RuleFor(x => x.SourceService)
                .MaximumLength(100).WithMessage("SourceService must not exceed 100 characters.");

            RuleFor(x => x.ConsumerAppRecommendation)
                .MaximumLength(2000).WithMessage("ConsumerAppRecommendation must not exceed 2000 characters.");

            RuleFor(x => x.ConsumerAppNote)
                .MaximumLength(2000).WithMessage("ConsumerAppNote must not exceed 2000 characters.");
        }

        private async Task<bool> IsUniqueNameAsync(string name, CancellationToken cancellationToken)
        {
            var configuration = await _configurationRepository.GetNotificationConfigurationByNameAsync(name);
            return configuration == null;
        }
    }
}

