using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Blocks.Genesis.Entities.Logic;
using Blocks.Genesis.Entities.Os;
using Configuration.DomainService.Notification.RequestModel;
using Configuration.DomainService.Notification.Validators;
using Configuration.DomainService.Shared.Services;
using Configuration.DomainService.Shared.Utilities;
using FluentAssertions;
using Moq;

namespace XUnitTest.Validators
{
    /// <summary>Limits and shape of the receivers, channels and push message of a notification configuration.</summary>
    public class NotificationDeliveryValidatorTests
    {
        private readonly Mock<IConfigurationRepository> _repo = new();

        private NotificationConfigurationValidator Validator() => new(_repo.Object);

        private static SaveNotificationConfigurationRequest Valid() => new()
        {
            Name = "notif",
            NotifyMethod = "notif",
            EnablePersistence = true,
            IsUpdateRequest = true,
            Scope = NotificationScope.Both,
            LiveEnabled = true,
            PushEnabled = true,
            RateLimitPerMinute = 120,
            PushTemplate = new NotificationPushTemplate { TitleKey = "T", BodyKey = "B", Link = "/orders/{{id}}" },
            Audience = new NotificationAudience
            {
                Level = NotificationAudienceLevel.Selected,
                Match = NotificationAudienceMatch.All,
                UserIds = ["u-1"],
                Roles = ["admin"],
                Permissions = ["blocks-iam::iam::users"],
                Filters = [new SubscriptionFilter { Context = "orders", ActionName = "open", Value = "1" }],
                AlsoNamedUsers = true
            }
        };

        private static string Long(int length = 201) => new('x', length);

        private async Task<IReadOnlyList<(string Field, string Key)>> ErrorsAsync(SaveNotificationConfigurationRequest request) =>
            (await Validator().ValidateAsync(request)).Errors.Select(e => (e.PropertyName, e.ErrorMessage)).ToList();

        [Fact]
        public async Task A_complete_request_at_every_limit_is_valid()
        {
            var request = Valid();
            request.Audience!.UserIds = Enumerable.Range(0, 500).Select(i => "u" + i).ToList();
            request.Audience.Roles = Enumerable.Range(0, 50).Select(i => "r" + i).ToList();
            request.Audience.Permissions = Enumerable.Range(0, 50).Select(i => "p" + i).ToList();
            request.Audience.Filters = Enumerable.Range(0, 20).Select(i => new SubscriptionFilter { Context = "c" + i }).ToList();
            request.RateLimitPerMinute = 600;

            (await ErrorsAsync(request)).Should().BeEmpty();
        }

        [Fact]
        public async Task A_request_without_any_of_the_new_fields_is_valid_as_before()
        {
            var request = new SaveNotificationConfigurationRequest { Name = "n", NotifyMethod = "n", IsUpdateRequest = true };

            (await ErrorsAsync(request)).Should().BeEmpty();
        }

        [Theory]
        [InlineData("UserIds", 501)]
        [InlineData("Roles", 51)]
        [InlineData("Permissions", 51)]
        [InlineData("Filters", 21)]
        public async Task A_list_over_its_limit_is_refused(string list, int count)
        {
            var request = Valid();
            var items = Enumerable.Range(0, count).Select(i => "v" + i).ToList();
            switch (list)
            {
                case "UserIds": request.Audience!.UserIds = items; break;
                case "Roles": request.Audience!.Roles = items; break;
                case "Permissions": request.Audience!.Permissions = items; break;
                default: request.Audience!.Filters = items.Select(i => new SubscriptionFilter { Context = i }).ToList(); break;
            }

            (await ErrorsAsync(request)).Should().Contain(e => e.Key == Constants.NotificationAudienceListTooLong);
        }

        [Fact]
        public async Task An_item_longer_than_200_characters_is_refused()
        {
            var request = Valid();
            request.Audience!.Roles = [Long()];

            (await ErrorsAsync(request)).Should().Contain(e => e.Key == Constants.NotificationAudienceItemTooLong);
        }

        [Fact]
        public async Task A_subscription_filter_needs_a_context()
        {
            var request = Valid();
            request.Audience!.Filters = [new SubscriptionFilter { Context = " ", ActionName = "open" }];

            (await ErrorsAsync(request)).Should().Contain(e => e.Key == Constants.NotificationFilterContextRequired);
        }

        [Fact]
        public async Task A_filter_field_over_200_characters_is_refused()
        {
            var request = Valid();
            request.Audience!.Filters = [new SubscriptionFilter { Context = "c", Value = Long() }];

            (await ErrorsAsync(request)).Should().Contain(e => e.Key == Constants.NotificationAudienceItemTooLong);
        }

        [Fact]
        public async Task A_null_list_from_the_client_does_not_crash_the_validator()
        {
            var request = Valid();
            request.Audience!.Roles = null!;
            request.Audience.Filters = null!;

            (await ErrorsAsync(request)).Should().BeEmpty();
        }

        [Theory]
        [InlineData("Level")]
        [InlineData("Match")]
        [InlineData("Scope")]
        public async Task An_unknown_enum_value_is_refused(string field)
        {
            var request = Valid();
            switch (field)
            {
                case "Level": request.Audience!.Level = (NotificationAudienceLevel)9; break;
                case "Match": request.Audience!.Match = (NotificationAudienceMatch)9; break;
                default: request.Scope = (NotificationScope)9; break;
            }

            (await ErrorsAsync(request)).Should().NotBeEmpty();
        }

        [Theory]
        [InlineData(-1)]
        [InlineData(601)]
        public async Task A_rate_limit_outside_0_to_600_is_refused(int rate)
        {
            var request = Valid();
            request.RateLimitPerMinute = rate;

            (await ErrorsAsync(request)).Should().Contain(e => e.Key == Constants.NotificationRateLimitOutOfRange);
        }

        [Fact]
        public async Task At_least_one_of_in_app_and_push_must_stay_on()
        {
            var request = Valid();
            request.LiveEnabled = false;
            request.PushEnabled = false;

            (await ErrorsAsync(request)).Should().Contain(e => e.Key == Constants.NotificationChannelRequired);
        }

        [Fact]
        public async Task Push_on_with_an_empty_key_is_refused()
        {
            var request = Valid();
            request.PushTemplate!.BodyKey = " ";

            (await ErrorsAsync(request)).Should().Contain(e => e.Key == Constants.NotificationPushKeysRequired);
        }

        [Fact]
        public async Task Push_off_keeps_a_half_filled_message_so_turning_it_on_again_needs_no_re_pick()
        {
            var request = Valid();
            request.PushEnabled = false;
            request.PushTemplate!.BodyKey = "";

            (await ErrorsAsync(request)).Should().BeEmpty();
        }

        [Fact]
        public async Task A_push_key_or_link_over_200_characters_is_refused()
        {
            var request = Valid();
            request.PushTemplate!.Link = Long();

            (await ErrorsAsync(request)).Should().Contain(e => e.Key == Constants.NotificationAudienceItemTooLong);
        }

        [Fact]
        public async Task The_default_audience_is_checked_like_the_audience()
        {
            var request = Valid();
            request.DefaultAudience = new NotificationAudience { Roles = Enumerable.Range(0, 51).Select(i => "r" + i).ToList() };

            (await ErrorsAsync(request)).Should().Contain(e => e.Key == Constants.NotificationAudienceListTooLong);
        }
    }
}
