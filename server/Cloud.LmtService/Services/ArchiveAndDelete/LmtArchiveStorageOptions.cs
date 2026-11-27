using Microsoft.Extensions.Configuration;

namespace Cloud.LmtService.Services.ArchiveAndDelete;

public enum LmtArchiveStorageProvider
{
    Azure,
    S3
}

/// <summary>
/// Reads which store the telemetry cold archive (Parquet files of logs and traces) lives in.
/// Nothing is read from the vault for the S3 option: the keys below come from configuration (in a
/// container, environment variables, where a colon is written as two underscores), and are never logged.
/// <list type="bullet">
/// <item><c>LmtArchive:Storage:Provider</c>: <c>Azure</c> (default, uses the LmtBlobStorageConnectionString secret) or <c>S3</c>.</item>
/// <item><c>LmtArchive:Storage:S3:ServiceUrl</c>: endpoint of an S3-compatible store, for example <c>http://s3:8333</c>. Empty means AWS.</item>
/// <item><c>LmtArchive:Storage:S3:Region</c>: signing region, default <c>us-east-1</c>.</item>
/// <item><c>LmtArchive:Storage:S3:AccessKey</c> and <c>LmtArchive:Storage:S3:SecretKey</c>: required.</item>
/// <item><c>LmtArchive:Storage:S3:ForcePathStyle</c>: default <c>true</c> when a ServiceUrl is set, otherwise <c>false</c>.</item>
/// </list>
/// The bucket is the Container of the archive configuration, as on Azure. S3 has no access tiers
/// here: for cold storage, set a lifecycle rule on the bucket.
/// </summary>
public static class LmtArchiveStorageOptions
{
    public const string ProviderKey = "LmtArchive:Storage:Provider";

    public static LmtArchiveStorageProvider ReadProvider(IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        var value = configuration[ProviderKey]?.Trim();
        if (string.IsNullOrEmpty(value) || value.Equals("Azure", StringComparison.OrdinalIgnoreCase))
            return LmtArchiveStorageProvider.Azure;
        if (value.Equals("S3", StringComparison.OrdinalIgnoreCase))
            return LmtArchiveStorageProvider.S3;

        throw new InvalidOperationException($"{ProviderKey} must be 'Azure' or 'S3'.");
    }
}

public sealed record LmtS3ArchiveOptions(string? ServiceUrl, string Region, string AccessKey, string SecretKey, bool ForcePathStyle)
{
    private const string Prefix = "LmtArchive:Storage:S3:";

    public static LmtS3ArchiveOptions FromConfiguration(IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        var accessKey = configuration[Prefix + "AccessKey"];
        var secretKey = configuration[Prefix + "SecretKey"];
        if (string.IsNullOrWhiteSpace(accessKey) || string.IsNullOrWhiteSpace(secretKey))
            throw new InvalidOperationException($"{Prefix}AccessKey and {Prefix}SecretKey are required when {LmtArchiveStorageOptions.ProviderKey} is S3.");

        var serviceUrl = configuration[Prefix + "ServiceUrl"];
        serviceUrl = string.IsNullOrWhiteSpace(serviceUrl) ? null : serviceUrl.Trim();
        var region = configuration[Prefix + "Region"];
        var forcePathStyle = bool.TryParse(configuration[Prefix + "ForcePathStyle"], out var parsed) ? parsed : serviceUrl is not null;

        return new LmtS3ArchiveOptions(serviceUrl, string.IsNullOrWhiteSpace(region) ? "us-east-1" : region.Trim(), accessKey, secretKey, forcePathStyle);
    }
}
