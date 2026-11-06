using Blocks.Genesis.Entities.Os;
using Configuration.DomainService.Notification.Services;
using Configuration.DomainService.Shared.Utilities;
using FluentValidation;

namespace Configuration.DomainService.Notification.Validators
{
    /// <summary>Shape and size of the receivers of a notification. Which roles and permissions the editor may pick is checked by the save rules.</summary>
    public class NotificationAudienceValidator : AbstractValidator<NotificationAudience>
    {
        public NotificationAudienceValidator()
        {
            RuleFor(a => a.Level).IsInEnum().WithMessage(Constants.NotificationAudienceInvalid);
            RuleFor(a => a.Match).IsInEnum().WithMessage(Constants.NotificationAudienceInvalid);

            RuleFor(a => a.UserIds).Must(l => FitsCount(l, NotificationLimits.UserIds)).WithMessage(Constants.NotificationAudienceListTooLong);
            RuleFor(a => a.Roles).Must(l => FitsCount(l, NotificationLimits.Roles)).WithMessage(Constants.NotificationAudienceListTooLong);
            RuleFor(a => a.Permissions).Must(l => FitsCount(l, NotificationLimits.Permissions)).WithMessage(Constants.NotificationAudienceListTooLong);

            RuleFor(a => a.UserIds).Must(FitsLength).WithMessage(Constants.NotificationAudienceItemTooLong);
            RuleFor(a => a.Roles).Must(FitsLength).WithMessage(Constants.NotificationAudienceItemTooLong);
            RuleFor(a => a.Permissions).Must(FitsLength).WithMessage(Constants.NotificationAudienceItemTooLong);

            RuleFor(a => a.Filters).Must(f => f is null || f.Count <= NotificationLimits.Filters)
                .WithMessage(Constants.NotificationAudienceListTooLong);
            RuleFor(a => a.Filters).Must(f => f is null || f.All(x => x is not null && !string.IsNullOrWhiteSpace(x.Context)))
                .WithMessage(Constants.NotificationFilterContextRequired);
            RuleFor(a => a.Filters).Must(f => f is null || f.All(x => x is null || FitsLength([x.Context, x.ActionName, x.Value])))
                .WithMessage(Constants.NotificationAudienceItemTooLong);
        }

        private static bool FitsCount(List<string>? items, int max) => items is null || items.Count <= max;

        private static bool FitsLength(IEnumerable<string?>? items) =>
            items is null || items.All(i => i is null || i.Length <= NotificationLimits.ItemLength);
    }
}
