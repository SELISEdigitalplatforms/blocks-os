namespace DomainService.Dtos
{
    public class CreateUserByEmailPostEvent
    {
        public string Key { get; set; }
        public string UserId { get; set; }
        public string EventType { get; set; }
        public string TenantId { get; set; }
        public bool ForceInvitation { get; set; }

        /// <summary>When <see cref="Key"/> expires. Null when IAM issued no key because the account can already sign in.</summary>
        public DateTime? KeyExpiresAtUtc { get; set; }
    }
}