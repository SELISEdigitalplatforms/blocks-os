namespace Configuration.DomainService.Notification.Push
{
    /// <summary>
    /// The rules of a push settings save, without any I/O: checks the request against the stored record and builds the
    /// next record plus the secret values to write. Error texts never hold any part of a Firebase value.
    /// </summary>
    public sealed class PushSettingsSavePlan
    {
        public const string KeyField = "serviceAccountJson";
        public const string EnabledField = "enabled";
        public const string PlatformsField = "platforms";
        public const string WebConfigField = "webConfig";

        public const string KeyNeededToEnable = "Upload a service account key before turning push on.";
        public const string KeyNeededForPlatform = "Upload a service account key before turning a platform on.";
        public const string WebConfigNeeded = "Add the web config before turning Web on.";
        public const string KeyNeededForWebConfig = "Set up the service account key first.";

        private PushSettingsSavePlan(PushSettingsRecord record)
        {
            Record = record;
        }

        /// <summary>Field → message. Not empty = refuse the save, nothing is written.</summary>
        public Dictionary<string, string> Errors { get; } = [];

        /// <summary>The record to store. Secret ids are filled in by the caller after the secrets are written.</summary>
        public PushSettingsRecord Record { get; }

        /// <summary>The new key JSON to store, or null to keep the stored key.</summary>
        public string? KeyJson { get; private set; }

        /// <summary>The new web config secret value, or null to keep the stored one.</summary>
        public string? WebSecretJson { get; private set; }

        /// <summary>The web config secret dropped because the key moved to another project; retired after the save.</summary>
        public string? DroppedWebSecretId { get; private set; }

        public static PushSettingsSavePlan Build(PushSettingsRecord? stored, SavePushSettingsRequest request, DateTime now, string uploader)
        {
            ArgumentNullException.ThrowIfNull(request);
            var old = stored ?? new PushSettingsRecord();
            var plan = new PushSettingsSavePlan(CopyOf(old));

            ServiceAccountKey? key = null;
            if (!string.IsNullOrWhiteSpace(request.ServiceAccountJson))
            {
                key = ServiceAccountKey.TryParse(request.ServiceAccountJson, out var keyError);
                if (key is null)
                {
                    plan.Errors[KeyField] = keyError!;
                    return plan;
                }

                plan.KeyJson = request.ServiceAccountJson;
                plan.Record.ProjectId = key.ProjectId;
                plan.Record.KeyUploadedAt = now;
                plan.Record.KeyUploadedBy = uploader;
            }

            var hasKey = key is not null || old.HasKey;
            plan.ApplyWebConfig(old, request.WebConfig, key, hasKey, now, uploader);
            plan.ApplySwitches(old, request, isFirstKey: key is not null && !old.HasKey, hasKey);
            return plan;
        }

        private void ApplyWebConfig(PushSettingsRecord old, PushWebConfigRequest? webConfig, ServiceAccountKey? key, bool hasKey, DateTime now, string uploader)
        {
            if (webConfig is not null)
            {
                if (!hasKey)
                {
                    Errors[WebConfigField] = KeyNeededForWebConfig;
                    return;
                }

                var web = PushWebConfig.TryCreate(webConfig, Record.ProjectId, out var webError);
                if (web is null)
                {
                    Errors[WebConfigField] = webError!;
                    return;
                }

                WebSecretJson = web.ToSecretJson();
                Record.WebConfigUploadedAt = now;
                Record.WebConfigUploadedBy = uploader;
                return;
            }

            var keyMovedProject = key is not null && old.HasKey && !string.Equals(old.ProjectId, key.ProjectId, StringComparison.Ordinal);
            if (keyMovedProject && old.HasWebConfig)
            {
                // The stored web config belongs to the old project: browsers would register with the wrong sender.
                DroppedWebSecretId = old.WebSecretId;
                Record.WebSecretId = null;
                Record.WebConfigUploadedAt = null;
                Record.WebConfigUploadedBy = null;
            }
        }

        private void ApplySwitches(PushSettingsRecord old, SavePushSettingsRequest request, bool isFirstKey, bool hasKey)
        {
            var current = old.Platforms ?? new PushPlatformSwitches();
            var wanted = request.Platforms is null
                ? new PushPlatformSwitches { Android = current.Android, Ios = current.Ios, Web = current.Web }
                : new PushPlatformSwitches { Android = request.Platforms.Android, Ios = request.Platforms.Ios, Web = request.Platforms.Web };

            // First setup: a valid key turns push on, the admin does not need a second step.
            Record.Enabled = isFirstKey || request.Enabled;
            if (Record.Enabled && !hasKey)
            {
                Errors[EnabledField] = KeyNeededToEnable;
            }

            if (!hasKey && TurnsOn(current, wanted))
            {
                Errors[PlatformsField] = KeyNeededForPlatform;
            }
            else if (DroppedWebSecretId is not null)
            {
                wanted.Web = false;
            }
            else if (wanted.Web && WebSecretJson is null && !old.HasWebConfig)
            {
                Errors[PlatformsField] = WebConfigNeeded;
            }

            Record.Platforms = wanted;
        }

        private static bool TurnsOn(PushPlatformSwitches current, PushPlatformSwitches wanted) =>
            (wanted.Android && !current.Android) || (wanted.Ios && !current.Ios) || (wanted.Web && !current.Web);

        private static PushSettingsRecord CopyOf(PushSettingsRecord old) => new()
        {
            ProjectId = old.ProjectId,
            Enabled = old.Enabled,
            SecretName = string.IsNullOrWhiteSpace(old.SecretName) ? new PushSettingsRecord().SecretName : old.SecretName,
            SecretId = old.SecretId,
            KeyUploadedAt = old.KeyUploadedAt,
            KeyUploadedBy = old.KeyUploadedBy,
            WebSecretName = string.IsNullOrWhiteSpace(old.WebSecretName) ? PushSettingsRecord.WebConfigSecretName : old.WebSecretName,
            WebSecretId = old.WebSecretId,
            WebConfigUploadedAt = old.WebConfigUploadedAt,
            WebConfigUploadedBy = old.WebConfigUploadedBy,
        };
    }
}
