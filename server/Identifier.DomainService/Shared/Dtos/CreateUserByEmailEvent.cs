namespace DomainService.Dtos
{
    public class CreateUserByEmailEvent
    {
        public string Email { get; set; }
        public string EventQueue { get; set; }
        public string EventType { get; set; }
        public string TenantId { get; set; }

        /// <summary>Send the invitation mail even if the person already has rows for these environments (a deliberate resend).</summary>
        public bool ForceInvitation { get; set; }
    }
}