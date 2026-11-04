using System.Diagnostics.CodeAnalysis;
using Blocks.Genesis.Entities.Iam;

namespace DomainService.People
{
    /// <summary>
    /// Reads the IAM account state blocks-os needs: is this person deactivated?
    /// Same rule IAM uses (<c>UserAccountStates.Resolve</c> and <c>AccountCodes.IsBlocked</c>).
    /// </summary>
    public static class UserAccountStatus
    {
        public const string InactiveErrorCode = "user_inactive";

        /// <summary>
        /// True when an administrator turned the account off (disabled, suspended or deactivated).
        /// False for a pending invitee: IAM creates invited accounts with <c>Active = false</c> and
        /// <c>IsVerified = false</c>, and the invite flow must keep working for them.
        /// A missing user is not deactivated; callers handle "not found" themselves.
        /// </summary>
        public static bool IsDeactivated([NotNullWhen(true)] User? user)
        {
            if (user is null) return false;

            if (user.Status is UserLifecycleStatus.Disabled or UserLifecycleStatus.Suspended) return true;

            if (user.DeactivatedAtUtc.HasValue) return true;

            if (user.Status == UserLifecycleStatus.PendingVerification) return false;

            // Inactive after having been verified: deactivated. Never verified: pending invitee.
            return !user.Active && user.IsVerified;
        }

        public static string InactiveMessage(string? email) =>
            string.IsNullOrWhiteSpace(email)
                ? "User is inactive. Environment access cannot be changed for an inactive user."
                : $"User {email} is inactive. Environment access cannot be changed for an inactive user.";
    }
}
