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

    /// <summary>
    /// Channels on which a user has successfully verified their identity.
    /// </summary>
    public enum UserVerifiedType
    {
        /// <summary>No verification has been completed yet.</summary>
        None = 0,

        /// <summary>User verified ownership of their email address via a verification link or code.</summary>
        Email = 1,

        /// <summary>User verified ownership of their phone number via an SMS code.</summary>
        Sms = 2,

        /// <summary>User verified ownership of their phone number via a WhatsApp message.</summary>
        WhatsApp = 3,
    }

    /// <summary>
    /// Misspelled legacy duplicate of <see cref="UserVerifiedType"/>. Kept for
    /// backwards compatibility with persisted Mongo documents; new code should
    /// use <see cref="UserVerifiedType"/>.
    /// </summary>
    public enum UserVarifiedType
    {
        /// <summary>No verification has been completed yet.</summary>
        None = 0,

        /// <summary>User verified ownership of their email address.</summary>
        Email = 1,

        /// <summary>User verified ownership of their phone number via SMS.</summary>
        Sms = 2,

        /// <summary>User verified ownership of their phone number via WhatsApp.</summary>
        WhatsApp = 3,
    }

    /// <summary>
    /// The channel or process that created the user account.
    /// </summary>
    public enum UserCreationType
    {
        /// <summary>Creation source is unspecified or unknown.</summary>
        None = 0,

        /// <summary>User signed up through the management portal UI.</summary>
        Portal = 1,

        /// <summary>User was created through a programmatic API call.</summary>
        Api = 2,

        /// <summary>User was created by a trusted background service or worker.</summary>
        Service = 3,

        /// <summary>User signed up via a social identity provider (Google, Microsoft, ...).</summary>
        Social = 4,

        /// <summary>User was provisioned by a third-party integration or sync job.</summary>
        ThirdParty = 5,
    }

    /// <summary>
    /// Type of long-lived credential the user authenticates with.
    /// </summary>
    public enum UserPassType
    {
        /// <summary>No credential set; the user cannot sign in with a password or PIN.</summary>
        None = 0,

        /// <summary>User authenticates with a password.</summary>
        Password = 1,

        /// <summary>User authenticates with a short numeric PIN.</summary>
        Pin = 2,
    }

    /// <summary>
    /// The multi-factor authentication method enabled for the user.
    /// </summary>
    public enum UserMfaType
    {
        /// <summary>No MFA method is configured.</summary>
        None = 0,

        /// <summary>Time-based one-time password (RFC 6238) from an authenticator app.</summary>
        TOTP = 1,

        /// <summary>One-time code delivered by email.</summary>
        Email = 2,

        /// <summary>One-time code delivered by SMS.</summary>
        Sms = 3,

        /// <summary>One-time code delivered by WhatsApp.</summary>
        WhatsApp = 4,
    }

    /// <summary>
    /// Authentication mechanisms that a user is allowed to use when signing in.
    /// </summary>
    public enum UserLogInType
    {
        /// <summary>No sign-in methods are allowed (account effectively disabled).</summary>
        None = 0,

        /// <summary>User signs in with a username/email and password.</summary>
        Password = 1,

        /// <summary>User signs in via a configured single sign-on provider.</summary>
        SSO = 2,

        /// <summary>User signs in with an OAuth 2.0 authorization code flow (OIDC).</summary>
        AuthrizationCode = 3,
    }
}