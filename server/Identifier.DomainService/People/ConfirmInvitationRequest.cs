using Blocks.Genesis;

namespace DomainService.People
{
    public class ConfirmInvitationRequest
    {
        public string Code { get; set; }
    }

    public class ConfirmInvitationResponse : BaseMutationResponse
    {
        public string ActivationKey { get; set; }

        /// <summary>The project (IAM tenant) the invitation was for, so the invitee can be sent to that
        /// tenant's IAM OIDC activation page. Empty for invitations cached before this field existed.</summary>
        public string TenantId { get; set; }
    }
}
