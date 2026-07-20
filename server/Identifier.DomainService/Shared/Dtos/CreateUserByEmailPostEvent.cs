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

        /// <summary>
        /// Whether IAM completed the user creation. Null means the event predates this field (older IAM only
        /// posted back on success), so it is treated as a success for backward compatibility; an explicit
        /// <c>false</c> is a reported failure and must not be treated as a silent success.
        /// </summary>
        public bool? Success { get; set; }

        /// <summary>Why IAM rejected the invitation, when <see cref="Success"/> is <c>false</c> (e.g. a signup-policy violation).</summary>
        public string? FailureReason { get; set; }
    }
}