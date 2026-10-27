using Blocks.Genesis.Entities.Os;
using FluentValidation;

namespace Configuration.DomainService.Notification.Validators
{
    /// <summary>Limits and shape of a notification audience. Permissions hold Permission.Resource values (what tokens carry), not names.</summary>
    public class NotificationAudienceValidator : AbstractValidator<NotificationAudience>
    {
        public const int MaxUserIds = 500;
        public const int MaxOtherIds = 50;
        public const int MaxFilters = 20;
        public const int MaxItemLength = 200;

        public NotificationAudienceValidator()
        {
            RuleFor(x => x.Match).IsInEnum().WithMessage("Invalid match.");

            RuleFor(x => x.UserIds).Must(l => l is not null).WithMessage("UserIds is required.");
            RuleFor(x => x.OrganizationIds).Must(l => l is not null).WithMessage("OrganizationIds is required.");
            RuleFor(x => x.Roles).Must(l => l is not null).WithMessage("Roles is required.");
            RuleFor(x => x.Permissions).Must(l => l is not null).WithMessage("Permissions is required.");
            RuleFor(x => x.Filters).Must(l => l is not null).WithMessage("Filters is required.");

            RuleFor(x => x.UserIds).Must(l => l.Count <= MaxUserIds).When(x => x.UserIds is not null)
                .WithMessage($"UserIds must not exceed {MaxUserIds} items.");
            RuleFor(x => x.OrganizationIds).Must(l => l.Count <= MaxOtherIds).When(x => x.OrganizationIds is not null)
                .WithMessage($"OrganizationIds must not exceed {MaxOtherIds} items.");
            RuleFor(x => x.Roles).Must(l => l.Count <= MaxOtherIds).When(x => x.Roles is not null)
                .WithMessage($"Roles must not exceed {MaxOtherIds} items.");
            RuleFor(x => x.Permissions).Must(l => l.Count <= MaxOtherIds).When(x => x.Permissions is not null)
                .WithMessage($"Permissions must not exceed {MaxOtherIds} items.");
            RuleFor(x => x.Filters).Must(l => l.Count <= MaxFilters).When(x => x.Filters is not null)
                .WithMessage($"Filters must not exceed {MaxFilters} items.");

            RuleForEach(x => x.UserIds).Must(IsValidItem).When(x => x.UserIds is not null)
                .WithMessage("UserIds items must be 1 to 200 characters.");
            RuleForEach(x => x.OrganizationIds).Must(IsValidItem).When(x => x.OrganizationIds is not null)
                .WithMessage("OrganizationIds items must be 1 to 200 characters.");
            RuleForEach(x => x.Roles).Must(IsValidItem).When(x => x.Roles is not null)
                .WithMessage("Roles items must be 1 to 200 characters.");
            RuleForEach(x => x.Permissions).Must(IsValidItem).When(x => x.Permissions is not null)
                .WithMessage("Permissions items must be 1 to 200 characters.");

            RuleForEach(x => x.Filters).Must(IsValidFilter).When(x => x.Filters is not null)
                .WithMessage("Each filter needs a Context, and every filter field must be at most 200 characters.");

            RuleFor(x => x).Must(a => !(a.EveryoneInTenant && a.HasRules()))
                .When(HasAllLists)
                .WithName("EveryoneInTenant")
                .WithMessage("EveryoneInTenant cannot be combined with rules.");
        }

        private static bool HasAllLists(NotificationAudience a) =>
            a.UserIds is not null && a.OrganizationIds is not null && a.Roles is not null && a.Permissions is not null && a.Filters is not null;

        private static bool IsValidItem(string? item) =>
            !string.IsNullOrWhiteSpace(item) && item.Length <= MaxItemLength;

        private static bool IsValidFilter(Blocks.Genesis.Entities.Logic.SubscriptionFilter? filter) =>
            filter is not null
            && !string.IsNullOrWhiteSpace(filter.Context)
            && filter.Context.Length <= MaxItemLength
            && (filter.ActionName?.Length ?? 0) <= MaxItemLength
            && (filter.Value?.Length ?? 0) <= MaxItemLength;
    }
}
