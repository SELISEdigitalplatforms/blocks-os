using Configuration.DomainService.Notification.Push;
using Configuration.DomainService.Shared.Utilities;
using FluentValidation;

namespace Configuration.DomainService.Notification.Validators
{
    /// <summary>Limits of the per-notification push options (shared contract §2). Shape only, no stored data.</summary>
    public class NotificationPushOptionsValidator : AbstractValidator<NotificationPushOptions>
    {
        public NotificationPushOptionsValidator()
        {
            RuleFor(o => o.WebLink).Must(PushOptionRules.IsHttpsLink).WithMessage(Constants.NotificationPushLinkInvalid);
            RuleFor(o => o.Android!).SetValidator(new AndroidRules()).When(o => o.Android is not null);
            RuleFor(o => o.Ios!).SetValidator(new IosRules()).When(o => o.Ios is not null);
            RuleFor(o => o.Web!).SetValidator(new WebRules()).When(o => o.Web is not null);
        }

        private sealed class AndroidRules : AbstractValidator<AndroidPushOptions>
        {
            public AndroidRules()
            {
                RuleFor(a => a.Priority).Must(v => PushOptionRules.IsOneOf(v, PushOptionRules.Priorities)).WithMessage(Constants.NotificationPushOptionInvalid);
                RuleFor(a => a.ChannelId).Must(PushOptionRules.IsToken).WithMessage(Constants.NotificationPushOptionInvalid);
                RuleFor(a => a.Sound).Must(PushOptionRules.IsToken).WithMessage(Constants.NotificationPushOptionInvalid);
                RuleFor(a => a.CollapseKey).Must(PushOptionRules.IsToken).WithMessage(Constants.NotificationPushOptionInvalid);
                RuleFor(a => a.TtlSeconds).Must(PushOptionRules.IsTtl).WithMessage(Constants.NotificationPushExpiryOutOfRange);
                RuleFor(a => a.Color).Must(PushOptionRules.IsColor).WithMessage(Constants.NotificationPushColorInvalid);
            }
        }

        private sealed class IosRules : AbstractValidator<IosPushOptions>
        {
            public IosRules()
            {
                RuleFor(i => i.Sound).Must(PushOptionRules.IsToken).WithMessage(Constants.NotificationPushOptionInvalid);
                RuleFor(i => i.Badge).InclusiveBetween(0, PushOptionRules.BadgeMax).WithMessage(Constants.NotificationPushBadgeOutOfRange);
                RuleFor(i => i.Priority).Must(v => PushOptionRules.IsOneOf(v, PushOptionRules.Priorities)).WithMessage(Constants.NotificationPushOptionInvalid);
                RuleFor(i => i.InterruptionLevel).Must(v => PushOptionRules.IsOneOf(v, PushOptionRules.InterruptionLevels)).WithMessage(Constants.NotificationPushOptionInvalid);
                RuleFor(i => i.ThreadId).Must(PushOptionRules.IsToken).WithMessage(Constants.NotificationPushOptionInvalid);
                RuleFor(i => i.TtlSeconds).Must(PushOptionRules.IsTtl).WithMessage(Constants.NotificationPushExpiryOutOfRange);
            }
        }

        private sealed class WebRules : AbstractValidator<WebPushOptions>
        {
            public WebRules()
            {
                RuleFor(w => w.Icon).Must(PushOptionRules.IsHttpsLink).WithMessage(Constants.NotificationPushLinkInvalid);
                RuleFor(w => w.Urgency).Must(v => PushOptionRules.IsOneOf(v, PushOptionRules.Urgencies)).WithMessage(Constants.NotificationPushOptionInvalid);
                RuleFor(w => w.TtlSeconds).Must(PushOptionRules.IsTtl).WithMessage(Constants.NotificationPushExpiryOutOfRange);
            }
        }
    }
}
