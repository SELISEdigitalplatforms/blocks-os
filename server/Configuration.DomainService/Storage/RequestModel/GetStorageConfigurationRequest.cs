using Blocks.Genesis;
using DomainService.Configuration;

namespace Configuration.DomainService.Storage.RequestModel
{
    public class GetStorageConfigurationRequest
    {
        public string ConfigurationName { get; set; }
    }

    /// <summary>
    /// API shape of a storage configuration: its settings and, per secret, only a status (<c>none</c>, <c>active</c>,
    /// <c>locked</c>, <c>archived</c>, <c>missing</c>, <c>unavailable</c>). Never a secret value or a masked value.
    /// <c>UploadCompletionRequiredFor</c> stays a list of strings in JSON.
    /// </summary>
    public class StorageConfigurationResponse : BaseEntity
    {
        public string Name { get; set; } = string.Empty;
        public string? StorageStrategy { get; set; }
        public string? CloudStorageRegionEndPoint { get; set; }
        public string? Host { get; set; }
        public string? Port { get; set; }
        public string? UserName { get; set; }
        public string? RemoteBasePath { get; set; }
        public int? UploadUrlExpirySeconds { get; set; }
        public int? DownloadUrlExpirySeconds { get; set; }
        public long? MaxFileSizeInBytes { get; set; }
        public List<string>? UploadCompletionRequiredFor { get; set; }

        public string ConnectionStringStatus { get; set; } = StorageSecretStatus.None;
        public string SecretKeyStatus { get; set; } = StorageSecretStatus.None;
        public string AccessKeyStatus { get; set; } = StorageSecretStatus.None;
        public string PasswordStatus { get; set; } = StorageSecretStatus.None;
        public string SftpSecretKeyStatus { get; set; } = StorageSecretStatus.None;

        public static StorageConfigurationResponse From(StorageSettings settings, IReadOnlyDictionary<string, string> secretStatus)
        {
            ArgumentNullException.ThrowIfNull(settings);
            ArgumentNullException.ThrowIfNull(secretStatus);

            string Status(StorageSecretField field) =>
                secretStatus.TryGetValue(field.Name, out var status) ? status : StorageSecretStatus.None;

            return new StorageConfigurationResponse
            {
                ItemId = settings.ItemId ?? string.Empty,
                CreatedDate = settings.CreatedDate,
                LastUpdatedDate = settings.LastUpdatedDate,
                CreatedBy = settings.CreatedBy,
                LastUpdatedBy = settings.LastUpdatedBy,
                OrganizationId = settings.OrganizationId ?? string.Empty,
                Name = settings.Name,
                StorageStrategy = settings.StorageStrategy,
                CloudStorageRegionEndPoint = settings.CloudStorageRegionEndPoint,
                Host = settings.Host,
                Port = settings.Port,
                UserName = settings.UserName,
                RemoteBasePath = settings.RemoteBasePath,
                UploadUrlExpirySeconds = settings.UploadUrlExpirySeconds,
                DownloadUrlExpirySeconds = settings.DownloadUrlExpirySeconds,
                MaxFileSizeInBytes = settings.MaxFileSizeInBytes,
                UploadCompletionRequiredFor = settings.UploadCompletionRequiredFor?.ToList(),
                ConnectionStringStatus = Status(StorageSecretFields.ConnectionString),
                SecretKeyStatus = Status(StorageSecretFields.SecretKey),
                AccessKeyStatus = Status(StorageSecretFields.AccessKey),
                PasswordStatus = Status(StorageSecretFields.Password),
                SftpSecretKeyStatus = Status(StorageSecretFields.SftpSecretKey),
            };
        }
    }
}
