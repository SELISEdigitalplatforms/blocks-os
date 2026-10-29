using Configuration.DomainService.Notification.Push;
using Configuration.DomainService.Notification.RequestModel;
using Configuration.DomainService.Notification.Services;
using Configuration.DomainService.Shared.Utilities;
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

            AddDeliveryRules();
        }

        /// <summary>Receivers, channels and push message: shape and limits only. Rules that need the stored row are in the save rules.</summary>
        private void AddDeliveryRules()
        {
            RuleFor(x => x.Scope!.Value)
                .IsInEnum().WithMessage(Constants.NotificationSendToInvalid)
                .OverridePropertyName(nameof(SaveNotificationConfigurationRequest.Scope))
                .When(x => x.Scope.HasValue);

            RuleFor(x => x.Audience!).SetValidator(new NotificationAudienceValidator()).When(x => x.Audience is not null);
            RuleFor(x => x.DefaultAudience!).SetValidator(new NotificationAudienceValidator()).When(x => x.DefaultAudience is not null);

            RuleFor(x => x.RateLimitPerMinute!.Value)
                .InclusiveBetween(0, NotificationLimits.RateLimitMax).WithMessage(Constants.NotificationRateLimitOutOfRange)
                .OverridePropertyName(nameof(SaveNotificationConfigurationRequest.RateLimitPerMinute))
                .When(x => x.RateLimitPerMinute.HasValue);

            RuleFor(x => x.LiveEnabled)
                .Must(live => live != false).WithMessage(Constants.NotificationChannelRequired)
                .When(x => x.PushEnabled == false);

            RuleFor(x => x.PushTemplate!.TitleKey)
                .MaximumLength(NotificationLimits.ItemLength).WithMessage(Constants.NotificationAudienceItemTooLong)
                .OverridePropertyName(nameof(SaveNotificationConfigurationRequest.PushTemplate))
                .When(x => x.PushTemplate is not null);

            RuleFor(x => x.PushTemplate!.BodyKey)
                .MaximumLength(NotificationLimits.ItemLength).WithMessage(Constants.NotificationAudienceItemTooLong)
                .OverridePropertyName(nameof(SaveNotificationConfigurationRequest.PushTemplate))
                .When(x => x.PushTemplate is not null);

            RuleFor(x => x.PushTemplate!.Link)
                .MaximumLength(NotificationLimits.ItemLength).WithMessage(Constants.NotificationAudienceItemTooLong)
                .OverridePropertyName(nameof(SaveNotificationConfigurationRequest.PushTemplate))
                .When(x => x.PushTemplate is not null);

            RuleFor(x => x.PushTemplate!)
                .Must(t => !string.IsNullOrWhiteSpace(t.TitleKey) && !string.IsNullOrWhiteSpace(t.BodyKey))
                .WithMessage(Constants.NotificationPushKeysRequired)
                .OverridePropertyName(nameof(SaveNotificationConfigurationRequest.PushTemplate))
                .When(x => x.PushEnabled == true && x.PushTemplate is not null);

            AddPushOptionRules();
        }

        /// <summary>Push platforms and per-platform options (shared contract §2).</summary>
        private void AddPushOptionRules()
        {
            RuleFor(x => x.PushPlatforms!)
                .Must(p => p.All(v => PushOptionRules.Platforms.Contains(v, StringComparer.Ordinal)))
                .WithMessage(Constants.NotificationPushPlatformInvalid)
                .When(x => x.PushPlatforms is not null);

            RuleFor(x => x.PushPlatforms!)
                .Must(p => p.Count > 0)
                .WithMessage(Constants.NotificationPushPlatformRequired)
                .When(x => x.PushEnabled == true && x.PushPlatforms is not null);

            RuleFor(x => x.PushOptions!).SetValidator(new NotificationPushOptionsValidator()).When(x => x.PushOptions is not null);
        }

        private async Task<bool> IsUniqueNameAsync(string name, CancellationToken cancellationToken)
        {
            var configuration = await _configurationRepository.GetNotificationConfigurationByNameAsync(name);
            return configuration == null;
        }
    }
}

