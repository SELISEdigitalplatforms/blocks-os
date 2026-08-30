using Azure.Storage.Blobs.Models;
using Cloud.LmtService.Models.ArchiveAndDelete;

namespace Cloud.LmtService.Services.ArchiveAndDelete;

public interface IBlobStorage
{
    Task<string> SaveAsync(UploadLogToStorageRequest request);
    Task<Stream> OpenReadAsync(string fileName, CancellationToken ct = default);
    Task<IReadOnlyList<string>> ListAsync(CancellationToken ct = default);
    Task<bool> ExistsAsync(string blobPath, CancellationToken ct = default);
    Task<Azure.Storage.Blobs.Models.BlobProperties> GetPropertiesAsync(string blobPath, CancellationToken ct = default);
    Task RequestRehydrationAsync(string fileName,AccessTier? targetTier = null,CancellationToken ct = default);
}
