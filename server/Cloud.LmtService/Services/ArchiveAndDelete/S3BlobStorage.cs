using Amazon.S3;
using Amazon.S3.Model;
using Cloud.LmtService.Models.ArchiveAndDelete;
using Cloud.LmtService.Models.ColdRestore;
using Cloud.LmtService.Repositories.Shared;
using Microsoft.Extensions.Logging;
using System.Net;
using AccessTier = Azure.Storage.Blobs.Models.AccessTier;

namespace Cloud.LmtService.Services.ArchiveAndDelete;

/// <summary>
/// The telemetry cold archive on an S3 or S3-compatible bucket (I02-WP10). Same seam as
/// <see cref="BlobStorage"/>, chosen by LmtArchive:Storage:Provider (see <see cref="LmtArchiveStorageOptions"/>).
/// S3 has no access tiers in this version: nothing is moved on save, the tier state is always
/// "not archived", and a rehydration request does nothing. An operator who wants cold storage
/// sets a lifecycle rule on the bucket.
/// </summary>
public sealed class S3BlobStorage : IBlobStorage, IDisposable
{
    private readonly IAmazonS3 _client;
    private readonly ILmtArchiveRestoreConfigurationRepository _configurationRepository;
    private readonly ILogger<S3BlobStorage> _logger;
    private readonly SemaphoreSlim _initLock = new(1, 1);
    private string? _bucket;

    public S3BlobStorage(LmtS3ArchiveOptions options, ILmtArchiveRestoreConfigurationRepository configurationRepository, ILogger<S3BlobStorage> logger)
        : this(CreateClient(options), configurationRepository, logger)
    {
    }

    public S3BlobStorage(IAmazonS3 client, ILmtArchiveRestoreConfigurationRepository configurationRepository, ILogger<S3BlobStorage> logger)
    {
        _client = client ?? throw new ArgumentNullException(nameof(client));
        _configurationRepository = configurationRepository ?? throw new ArgumentNullException(nameof(configurationRepository));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    private static AmazonS3Client CreateClient(LmtS3ArchiveOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        var config = new AmazonS3Config { ForcePathStyle = options.ForcePathStyle };
        if (options.ServiceUrl is not null)
        {
            config.ServiceURL = options.ServiceUrl;
            config.AuthenticationRegion = options.Region;
        }
        else
        {
            config.RegionEndpoint = Amazon.RegionEndpoint.GetBySystemName(options.Region);
        }

        return new AmazonS3Client(options.AccessKey, options.SecretKey, config);
    }

    private async Task<string> GetBucketAsync(CancellationToken ct)
    {
        if (_bucket is not null) return _bucket;

        await _initLock.WaitAsync(ct);
        try
        {
            if (_bucket is not null) return _bucket;

            var config = await _configurationRepository.GetLmtArchiveRestoreConfigurationsAsync(ct);
            var bucket = config.Container;
            try
            {
                await _client.ListObjectsV2Async(new ListObjectsV2Request { BucketName = bucket, MaxKeys = 1 }, ct);
            }
            catch (AmazonS3Exception ex) when (ex.StatusCode == HttpStatusCode.NotFound || ex.ErrorCode == "NoSuchBucket")
            {
                _logger.LogInformation("S3BlobStorage - bucket {Bucket} does not exist, creating it.", bucket);
                try
                {
                    await _client.PutBucketAsync(new PutBucketRequest { BucketName = bucket }, ct);
                }
                catch (AmazonS3Exception created) when (created.ErrorCode is "BucketAlreadyOwnedByYou" or "BucketAlreadyExists")
                {
                    // Created by another instance between the probe and the create.
                }
            }

            _bucket = bucket;
            return bucket;
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
        var bucket = await GetBucketAsync(request.ct);

        var stream = request.Content;
        MemoryStream? buffered = null;
        try
        {
            if (!stream.CanSeek)
            {
                buffered = new MemoryStream();
                await stream.CopyToAsync(buffered, request.ct);
                stream = buffered;
            }

            stream.Position = 0;
            await _client.PutObjectAsync(new PutObjectRequest { BucketName = bucket, Key = request.FileName, InputStream = stream }, request.ct);
        }
        finally
        {
            buffered?.Dispose();
        }

        // No tier change: S3 has no tiers here (see the class remarks).
        return $"s3://{bucket}/{request.FileName}";
    }

    public async Task<Stream> OpenReadAsync(string fileName, CancellationToken ct = default)
    {
        var bucket = await GetBucketAsync(ct);
        using var response = await _client.GetObjectAsync(new GetObjectRequest { BucketName = bucket, Key = fileName }, ct);
        var memoryStream = new MemoryStream();
        await response.ResponseStream.CopyToAsync(memoryStream, ct);
        memoryStream.Position = 0;

        return memoryStream;
    }

    public async Task<IReadOnlyList<string>> ListAsync(CancellationToken ct = default)
    {
        var bucket = await GetBucketAsync(ct);
        var names = new List<string>();
        var request = new ListObjectsV2Request { BucketName = bucket };
        ListObjectsV2Response response;
        do
        {
            response = await _client.ListObjectsV2Async(request, ct);
            names.AddRange((response.S3Objects ?? []).Select(o => o.Key));
            request.ContinuationToken = response.NextContinuationToken;
        }
        while (response.IsTruncated == true && !string.IsNullOrEmpty(request.ContinuationToken));

        return names
            .Where(name => name.EndsWith(".parquet", StringComparison.OrdinalIgnoreCase))
            .ToList();
    }

    public async Task<BlobTierState> GetTierStateAsync(string blobPath, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(blobPath))
            return BlobTierState.Missing;

        var bucket = await GetBucketAsync(ct);
        try
        {
            await _client.GetObjectMetadataAsync(new GetObjectMetadataRequest { BucketName = bucket, Key = blobPath }, ct);
            return new BlobTierState(true, false);
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            return BlobTierState.Missing;
        }
    }

    public Task RequestRehydrationAsync(string fileName, AccessTier? targetTier = null, CancellationToken ct = default)
    {
        // Nothing is ever archived on S3 here, so there is nothing to bring back.
        _logger.LogDebug("S3BlobStorage - rehydration requested for {File}; S3 has no archive tier, nothing to do.", fileName);
        return Task.CompletedTask;
    }

    public void Dispose()
    {
        _client.Dispose();
        _initLock.Dispose();
    }
}
