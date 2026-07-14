using Blocks.Genesis;

namespace DomainService.People
{
    public class InviteRequest
    {
       public Dictionary<string, List<EnviromentDetails>> Invitations { get; set; } = [];
       public required string GroupId { get; set; }
    }

    public class EnviromentDetails
    {
        public string TenantId { get; set; }
        public List<string> Roles { get; set; } = [];
    }
   

    public class InviteResponse : BaseResponse
    {
        public string? ItemId { get; set; }

        /// <summary>What actually happened per email, keyed by the normalized address. See <see cref="InvitationOutcomes"/>.</summary>
        public Dictionary<string, string> Results { get; set; } = [];
    }

    public static class InvitationOutcomes
    {
        /// <summary>Rows created and an invitation mail sent; awaiting confirmation.</summary>
        public const string Invited = "invited";

        /// <summary>Account did not exist; creation requested from IAM, which will trigger the invitation mail.</summary>
        public const string UserCreationRequested = "user_creation_requested";

        /// <summary>Account exists but was never activated; an activation key was requested from IAM, which will trigger the invitation mail.</summary>
        public const string InvitationRequested = "invitation_requested";

        /// <summary>Access was granted but the invitation mail could not be sent.</summary>
        public const string InvitationNotSent = "invitation_not_sent";

        /// <summary>Already accepted an invitation to this project, so the new environments were granted without a mail.</summary>
        public const string AccessGranted = "access_granted";

        /// <summary>Nothing to do: already has a row for every requested environment.</summary>
        public const string AlreadyHasAccess = "already_has_access";

        /// <summary>You cannot invite yourself.</summary>
        public const string SkippedSelf = "skipped_self";

        /// <summary>No environments were supplied for this address.</summary>
        public const string SkippedNoEnvironments = "skipped_no_environments";
    }
}
