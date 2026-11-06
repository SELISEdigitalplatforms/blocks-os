using Blocks.Genesis.Entities.Logic;
using MongoDB.Bson.Serialization.Attributes;

namespace Configuration.DomainService.Notification.Push
{
    /// <summary>
    /// The tenant's KV <c>firebase-config</c> record. Same field names as genesis <see cref="FirebasePushConfiguration"/>
    /// (ProjectId, Enabled, SecretName) so genesis and blocks-logic read it; the other fields are added by blocks-os.
    /// Never a Firebase value: the key and the web config live in Blocks Secrets, this record only points at them.
    /// </summary>
    [BsonIgnoreExtraElements]
    public sealed class PushSettingsRecord
    {
        public const string WebConfigSecretName = "firebase-web-config";

        public string ProjectId { get; set; } = string.Empty;

        public bool Enabled { get; set; }

        public string SecretName { get; set; } = FirebasePushConfiguration.DefaultSecretName;

        public string? SecretId { get; set; }

        public DateTime? KeyUploadedAt { get; set; }

        public string? KeyUploadedBy { get; set; }

        /// <summary>A record written before platforms existed reads as Android and iOS on, Web off.</summary>
        public PushPlatformSwitches Platforms { get; set; } = new();

        public string WebSecretName { get; set; } = WebConfigSecretName;

        public string? WebSecretId { get; set; }

        public DateTime? WebConfigUploadedAt { get; set; }

        public string? WebConfigUploadedBy { get; set; }

        /// <summary>Records saved by blocks-logic before secret ids existed have only the upload date.</summary>
        public bool HasKey => !string.IsNullOrEmpty(SecretId) || KeyUploadedAt is not null;

        public bool HasWebConfig => !string.IsNullOrEmpty(WebSecretId);
    }

    /// <summary>Per-platform "send to" switches. No BsonIgnoreIfDefault: a stored false must stay false.</summary>
    [BsonIgnoreExtraElements]
    public sealed class PushPlatformSwitches
    {
        public bool Android { get; set; } = true;

        public bool Ios { get; set; } = true;

        public bool Web { get; set; }
    }
}
