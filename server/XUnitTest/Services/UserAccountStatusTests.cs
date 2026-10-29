using System;
using Blocks.Genesis.Entities.Iam;
using DomainService.People;
using FluentAssertions;

namespace XUnitTest.Services
{
    public class UserAccountStatusTests
    {
        [Theory]
        // Signed in and in good standing.
        [InlineData(true, true, UserLifecycleStatus.Active, false)]
        // Invited, never activated (how IAM creates invitees): not deactivated, the invite flow must work.
        [InlineData(false, false, UserLifecycleStatus.Active, false)]
        [InlineData(false, false, UserLifecycleStatus.PendingVerification, false)]
        // Turned off after having been verified, with a status that never moved.
        [InlineData(false, true, UserLifecycleStatus.Active, true)]
        // A stored terminal status wins over the flag.
        [InlineData(true, true, UserLifecycleStatus.Disabled, true)]
        [InlineData(true, true, UserLifecycleStatus.Suspended, true)]
        [InlineData(false, false, UserLifecycleStatus.Disabled, true)]
        public void IsDeactivated_FollowsTheIamRule(bool active, bool isVerified, UserLifecycleStatus status, bool expected)
        {
            var user = new User { Active = active, IsVerified = isVerified, Status = status };

            UserAccountStatus.IsDeactivated(user).Should().Be(expected);
        }

        [Fact]
        public void IsDeactivated_DeactivatedAtSet_IsDeactivatedEvenIfFlagsLookActive()
        {
            var user = new User { Active = true, IsVerified = true, DeactivatedAtUtc = DateTime.UtcNow };

            UserAccountStatus.IsDeactivated(user).Should().BeTrue();
        }

        [Fact]
        public void IsDeactivated_MissingUser_IsNotDeactivated()
        {
            UserAccountStatus.IsDeactivated(null).Should().BeFalse();
        }

        [Fact]
        public void InactiveMessage_NamesTheUserWhenKnown()
        {
            UserAccountStatus.InactiveMessage("a@x.com").Should().StartWith("User a@x.com is inactive");
            UserAccountStatus.InactiveMessage(null).Should().StartWith("User is inactive");
            UserAccountStatus.InactiveMessage(" ").Should().StartWith("User is inactive");
        }
    }
}
