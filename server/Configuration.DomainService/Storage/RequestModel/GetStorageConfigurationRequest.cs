using Blocks.Genesis;
using Blocks.Genesis.Entities.Data;

namespace Configuration.DomainService.Storage.RequestModel
{
    public class GetStorageConfigurationRequest
    {
        public string ConfigurationName { get; set; }
    }

    /// <summary>
    /// API shape of a storage configuration, exactly as the os API returned it before the entity
    /// moved to Genesis: <c>UploadCompletionRequiredFor</c> stays a list of strings in JSON.
    /// </summary>
    public class StorageConfigurationResponse : BaseEntity
    {
        public string Name { get; set; }
        public string ConnectionString { get; set; }
        public string SecretKey { get; set; }
        public string AccessKey { get; set; }
        public string StorageStrategy { get; set; }
        public string CloudStorageRegionEndPoint { get; set; }
        public string Host { get; set; }
        public string Port { get; set; }
        public string UserName { get; set; }
        public string Password { get; set; }
        public string RemoteBasePath { get; set; }
        public string SftpSecretKey { get; set; }
        public int? UploadUrlExpirySeconds { get; set; }
        public int? DownloadUrlExpirySeconds { get; set; }
        public long? MaxFileSizeInBytes { get; set; }
        public List<string>? UploadCompletionRequiredFor { get; set; }

        public static StorageConfigurationResponse? From(StorageConfiguration? source)
        {
            if (source is null)
            {
                return null;
            }

            return new StorageConfigurationResponse
            {
                ItemId = source.ItemId,
                CreatedDate = source.CreatedDate,
                LastUpdatedDate = source.LastUpdatedDate,
                CreatedBy = source.CreatedBy,
                Language = source.Language,
                LastUpdatedBy = source.LastUpdatedBy,
                OrganizationId = source.OrganizationId,
                Tags = source.Tags,
                Name = source.Name,
                ConnectionString = source.ConnectionString,
                SecretKey = source.SecretKey,
                AccessKey = source.AccessKey,
                StorageStrategy = source.StorageStrategy,
                CloudStorageRegionEndPoint = source.CloudStorageRegionEndPoint,
                Host = source.Host,
                Port = source.Port,
                UserName = source.UserName,
                Password = source.Password,
                RemoteBasePath = source.RemoteBasePath,
                SftpSecretKey = source.SftpSecretKey,
                UploadUrlExpirySeconds = source.UploadUrlExpirySeconds,
                DownloadUrlExpirySeconds = source.DownloadUrlExpirySeconds,
                MaxFileSizeInBytes = source.MaxFileSizeInBytes,
                UploadCompletionRequiredFor = source.UploadCompletionRequiredFor?.Select(x => x.ToString()).ToList(),
            };
        }
    }
}
