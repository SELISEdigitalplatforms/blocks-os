namespace DomainService.Dtos
{
    public class CacheProjectPeopleInvitation
    {
        public string ProjectPeopleIds { get; set; }
        public string UserActivationKey { get; set; }

        // The invited person and the project the invitation was issued for. Confirmation re-resolves the
        // pending rows from these, so a link stays correct even if rows are added after it was sent.
        // Null on codes cached before this field existed; those fall back to ProjectPeopleIds alone.
        public string? UserId { get; set; }
        public string? TenantGroupId { get; set; }

        // The project (IAM tenant) the invitation mail was built for. Returned on confirmation so the
        // frontend can send the invitee to IAM's OIDC activation page for that tenant. Null on codes
        // cached before this field existed; those fall back to the OS-hosted activation page.
        public string? TenantId { get; set; }
    }
}
