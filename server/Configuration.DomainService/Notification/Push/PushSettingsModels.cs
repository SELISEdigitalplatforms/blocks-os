namespace Configuration.DomainService.Notification.Push
{
    /// <summary>Body of <c>POST /PushSettings/Save</c>. Firebase values are sent only when added or replaced.</summary>
    public sealed class SavePushSettingsRequest
    {
        public bool Enabled { get; set; }

        /// <summary>Null = keep the stored switches.</summary>
        public PushPlatformsModel? Platforms { get; set; }

        /// <summary>A new service-account key (JSON). Null or empty = keep the stored key.</summary>
        public string? ServiceAccountJson { get; set; }

        /// <summary>A new web config. Null = keep the stored one.</summary>
        public PushWebConfigRequest? WebConfig { get; set; }
    }

    public sealed class PushPlatformsModel
    {
        public bool Android { get; set; }

        public bool Ios { get; set; }

        public bool Web { get; set; }
    }

    /// <summary>The pasted or typed Firebase web config. <see cref="ProjectId"/> only checks it matches the key.</summary>
    public sealed class PushWebConfigRequest
    {
        public string? ApiKey { get; set; }

        public string? AppId { get; set; }

        public string? MessagingSenderId { get; set; }

        public string? VapidKey { get; set; }

        public string? ProjectId { get; set; }
    }

    /// <summary>Answer of <c>GET /PushSettings/Get</c>. Never a Firebase value: only whether one is stored, when and by whom.</summary>
    public sealed record PushSettingsView(
        string? ProjectId,
        bool Enabled,
        bool HasKey,
        DateTime? KeyUploadedAt,
        string? KeyUploadedBy,
        PushPlatformsModel Platforms,
        bool HasWebConfig,
        DateTime? WebConfigUploadedAt,
        string? WebConfigUploadedBy)
    {
        public static PushSettingsView From(PushSettingsRecord? record)
        {
            var stored = record ?? new PushSettingsRecord();
            var platforms = stored.Platforms ?? new PushPlatformSwitches();
            return new PushSettingsView(
                string.IsNullOrEmpty(stored.ProjectId) ? null : stored.ProjectId,
                stored.Enabled,
                stored.HasKey,
                stored.KeyUploadedAt,
                stored.KeyUploadedBy,
                new PushPlatformsModel { Android = platforms.Android, Ios = platforms.Ios, Web = platforms.Web },
                stored.HasWebConfig,
                stored.WebConfigUploadedAt,
                stored.WebConfigUploadedBy);
        }
    }
}
