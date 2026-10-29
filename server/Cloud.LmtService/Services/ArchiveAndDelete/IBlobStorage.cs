using Azure.Storage.Blobs.Models;
using Cloud.LmtService.Models.ArchiveAndDelete;
using Cloud.LmtService.Models.ColdRestore;

namespace Cloud.LmtService.Services.ArchiveAndDelete;

public interface IBlobStorage
{
    Task<string> SaveAsync(UploadLogToStorageRequest request);
    Task<Stream> OpenReadAsync(string fileName, CancellationToken ct = default);
    Task<IReadOnlyList<string>> ListAsync(CancellationToken ct = default);

    /// <summary>
    /// Answers existence and archive tier in one request. Restore planning needs both, and asking
    /// separately cost two round trips per file per day while also letting the two answers disagree.
    /// Replaces the former ExistsAsync + GetPropertiesAsync pair, which callers always used together.
    /// </summary>
    Task<BlobTierState> GetTierStateAsync(string blobPath, CancellationToken ct = default);

    Task RequestRehydrationAsync(string fileName,AccessTier? targetTier = null,CancellationToken ct = default);
}
