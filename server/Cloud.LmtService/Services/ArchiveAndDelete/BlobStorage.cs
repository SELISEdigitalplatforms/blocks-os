using Azure;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Blocks.Genesis;
using Cloud.LmtService.Models.ArchiveAndDelete;
using Cloud.LmtService.Models.ColdRestore;
using Cloud.LmtService.Repositories.Shared;
using Microsoft.Extensions.Logging;

namespace Cloud.LmtService.Services.ArchiveAndDelete;

public sealed class BlobStorage : IBlobStorage
{
  private readonly string _connectionString;
  private readonly ILmtArchiveRestoreConfigurationRepository _configurationRepository;
  private readonly ILogger<BlobStorage> _logger;
  private BlobContainerClient? _container;
  private readonly SemaphoreSlim _initLock = new(1, 1);

  public BlobStorage ( IBlocksSecret blocksSecret, ILmtArchiveRestoreConfigurationRepository configurationRepository, ILogger<BlobStorage> logger )
  {
    _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    _configurationRepository = configurationRepository ?? throw new ArgumentNullException(nameof(configurationRepository));

    if (string.IsNullOrWhiteSpace(blocksSecret.LmtBlobStorageConnectionString))
    {
     _logger.LogError(
         "BlobStorage - LmtBlobStorageConnectionString secret is missing or empty. " +
         "Configure the 'LmtBlobStorageConnectionString' secret in the vault for this environment; blob archive/restore operations cannot proceed without it.");
     throw new InvalidOperationException("LmtBlobStorageConnectionString secret is missing or empty. Configure it in the vault for this environment.");
    }

   _connectionString = blocksSecret.LmtBlobStorageConnectionString;
  }

 private async Task<BlobContainerClient> GetContainerAsync(CancellationToken ct = default)
    {
        if (_container is not null) return _container;

        await _initLock.WaitAsync(ct);
        try
        {
            if (_container is not null) return _container;

            var config = await _configurationRepository.GetLmtArchiveRestoreConfigurationsAsync(ct);
            var container = new BlobContainerClient(_connectionString, config.Container);
            await container.CreateIfNotExistsAsync(cancellationToken: ct);
            _container = container;
            return _container;
        }
        finally
        {
            _initLock.Release();
        }
    }

    public async Task<string> SaveAsync(UploadLogToStorageRequest request)
    {
        if (request is null) throw new ArgumentNullException(nameof(request));
        if (string.IsNullOrWhiteSpace(request.FileName)) throw new ArgumentException("FileName is required", nameof(request));
        var container = await GetContainerAsync(request.ct);
        var blobName = request.FileName;
        var blob = container.GetBlobClient(blobName);

        request.Content.Position = 0;
        await blob.UploadAsync(request.Content, overwrite: true, cancellationToken: request.ct);

        await blob.SetAccessTierAsync(AccessTier.Cold, cancellationToken: request.ct);

        return blob.Uri.ToString();
    }

    public async Task<Stream> OpenReadAsync(string fileName, CancellationToken ct = default)
    {
        var container = await GetContainerAsync(ct);
        var blob = container.GetBlobClient(fileName);
        var dl = await blob.DownloadStreamingAsync(cancellationToken: ct);
        var memoryStream = new MemoryStream();
        await dl.Value.Content.CopyToAsync(memoryStream, ct);
        memoryStream.Position = 0;

        return memoryStream;
    }

    public async Task<IReadOnlyList<string>> ListAsync(CancellationToken ct = default)
    {
        var container = await GetContainerAsync(ct);
        var names = new List<string>();
        await foreach (var b in container.GetBlobsAsync(cancellationToken: ct))
        {
            names.Add(b.Name);
        }

        return names
            .Where(name => name.EndsWith(".parquet", StringComparison.OrdinalIgnoreCase))
            .ToList();
    }
    public async Task<BlobTierState> GetTierStateAsync(string blobPath, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(blobPath))
            return BlobTierState.Missing;

        var container = await GetContainerAsync(ct);
        var blob = container.GetBlobClient(blobPath);

        try
        {
            var properties = await blob.GetPropertiesAsync(cancellationToken: ct);
            return new BlobTierState(true, properties.Value.AccessTier == AccessTier.Archive.ToString());
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
            return BlobTierState.Missing;
        }
    }

    public async Task RequestRehydrationAsync(
        string fileName,
        AccessTier? targetTier = null,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(fileName))
            throw new ArgumentException("File name is required.", nameof(fileName));

        var container = await GetContainerAsync(ct);
        var blob = container.GetBlobClient(fileName);

        var exists = await blob.ExistsAsync(ct);
        if (!exists.Value)
        {
            throw new FileNotFoundException($"Blob not found for rehydration request: {fileName}");
        }
        var tier = targetTier ?? AccessTier.Cool;
        await blob.SetAccessTierAsync(tier, cancellationToken: ct);
    }
}
