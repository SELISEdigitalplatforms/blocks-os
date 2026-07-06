using Blocks.Genesis;
using MongoDB.Bson.Serialization.Attributes;

namespace DomainService.People
{
    [BsonIgnoreExtraElements]
    public class User : BaseEntity
    {
        public string? Salutation { get; set; }
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string? Email { get; set; }
        public string? UserName { get; set; }
        public string? PhoneNumber { get; set; }
        public Dictionary<string, List<string>> Roles { get; set; } = new();
        public Dictionary<string, List<string>> Permissions { get; set; } = new();
        public bool Active { get; set; }
        public bool IsVerified { get; set; }
        public string? ProfileImageUrl { get; set; }
        public string? ProfileImageId { get; set; }
        public string? Platform { get; set; }
        public UserCreationType UserCreationType { get; set; } = UserCreationType.None;
        public UserPassType UserPassType { get; set; } = UserPassType.None;
        public string? Password { get; set; }
        public DateTime PasswordSetTime { get; set; }
        public DateTime? PasswordChangedAtUtc { get; set; }
        public DateTime? LastCredentialRotationAtUtc { get; set; }
        public int FailedLoginCount { get; set; }
        public DateTime? LastFailedLoginUtc { get; set; }
        public int FailedMfaCount { get; set; }
        public DateTime? LastFailedMfaUtc { get; set; }
        public DateTime? LockoutUntilUtc { get; set; }
        public int LockoutCount { get; set; } // Tracks how many times account has been locked (for exponential backoff)
        public DateTime? LastLockoutUtc { get; set; } // When the last lockout was applied
        public string SecurityStamp { get; set; } = Guid.NewGuid().ToString("N");
        public int TokenVersion { get; set; } = 1;
        public UserMfaType UserMfaType { get; set; } = UserMfaType.None;
        public bool MfaEnabled { get; set; }
        public DateTime FirstLoggedInTime { get; set; }
        public DateTime LastLoggedInTime { get; set; }
        public string? LastUsedOrganizationId { get; set; }
        public string LastLoggedInDeviceInfo { get; set; } = string.Empty;
        public int LogInCount { get; set; }
        public List<UserLogInType> AllowedLogInType { get; set; } = new List<UserLogInType>();
        public string? MailPurpose { get; set; }
        public bool IsMfaVerified { get; set; }
        public DateTime? EmailVerifiedAtUtc { get; set; }
        public DateTime? PhoneVerifiedAtUtc { get; set; }
        public DateTime? TermsAcceptedAtUtc { get; set; }
        public DateTime? PrivacyAcceptedAtUtc { get; set; }
        public string? StatusReason { get; set; }
        public DateTime? DeactivatedAtUtc { get; set; }
        public string? DeactivatedBy { get; set; }
        public string? ExternalUserId { get; set; }
        public List<string> OrganizationIds { get; set; } = [];
        public Dictionary<string, object> Attributes { get; set; } = new Dictionary<string, object>(); 
        public UserVerifiedType VerifiedType { get; set; } = UserVerifiedType.None;
    }

    public enum UserVerifiedType
    {
        None,
        Email,
        Sms, 
        WhatsApp
    }

    public enum UserVarifiedType
    {
        None,
        Email,
        Sms,
        WhatsApp
    }

    public enum UserCreationType
    {
        None,
        Portal,
        Api,
        Service,
        Social,
        ThirdParty,
    }

    public enum UserPassType
    {
        None,
        Password,
        Pin
    }

    public enum UserMfaType
    {
        None,
        TOTP,
        Email,
        Sms,
        WhatsApp,
    }

    public enum UserLogInType
    {
        None,
        Password,
        SSO,
        AuthrizationCode
    }
}