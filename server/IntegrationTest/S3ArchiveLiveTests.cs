using Amazon.S3;
using Amazon.S3.Model;
using Cloud.LmtService.Models.ArchiveAndDelete;
using Cloud.LmtService.Models.Shared;
using Cloud.LmtService.Repositories.Shared;
using Cloud.LmtService.Services.ArchiveAndDelete;
using Cloud.LmtService.Utilities;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using System.Text;

namespace IntegrationTest;

/// <summary>
/// The telemetry cold archive on a real S3-compatible store (I02-WP10), such as the toolchain's SeaweedFS.
/// The store is chosen the way a deployment chooses it, by configuration: IBlobStorage is resolved from the
/// service registration with LmtArchive:Storage:Provider set to S3. The archive writes its Parquet files from
/// a file stream, the restore side lists, reads and asks for tier state, and every blob is still there afterwards.
///
/// <para>
/// A separate project, so the unit run stays fast and needs no store. Each test reads its settings from these
/// variables and FAILS, naming the missing one, when it is not set. Nothing here prints a key.
/// <list type="bullet">
/// <item><c>TEST_S3_ENDPOINT</c> (for example http://s3:8333), <c>TEST_S3_ACCESS_KEY</c>, <c>TEST_S3_SECRET_KEY</c></item>
/// </list>
/// </para>
/// </summary>
[Trait("Category", "LiveStorage")]
public sealed class S3ArchiveLiveTests : IDisposable
{
    private readonly string _bucket = "lmt-wp10-" + Guid.NewGuid().ToString("N")[..10];
    private readonly string _endpoint = Required("TEST_S3_ENDPOINT");
    private readonly string _accessKey = Required("TEST_S3_ACCESS_KEY");
    private readonly string _secretKey = Required("TEST_S3_SECRET_KEY");
    private readonly ServiceProvider _services;

    public S3ArchiveLiveTests()
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            [LmtArchiveStorageOptions.ProviderKey] = "S3",
            ["LmtArchive:Storage:S3:ServiceUrl"] = _endpoint,
            ["LmtArchive:Storage:S3:AccessKey"] = _accessKey,
            ["LmtArchive:Storage:S3:SecretKey"] = _secretKey
        }).Build();

        var repository = new Mock<ILmtArchiveRestoreConfigurationRepository>();
        repository.Setup(r => r.GetLmtArchiveRestoreConfigurationsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new LmtArchiveRestoreConfigurations { Container = _bucket });

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton<IConfiguration>(configuration);
        services.AddCloudLmtServices();
        services.AddSingleton(repository.Object); // the last registration wins: no database is needed here
        _services = services.BuildServiceProvider();
    }

    private static string Required(string name) =>
        Environment.GetEnvironmentVariable(name) is { Length: > 0 } value
            ? value
            : throw new InvalidOperationException($"{name} is not set. Run this project against the toolchain S3 store (see the class remarks).");

    private AmazonS3Client Verifier() =>
        new(_accessKey, _secretKey, new AmazonS3Config { ServiceURL = _endpoint, ForcePathStyle = true });

    public void Dispose()
    {
        try
        {
            using var s3 = Verifier();
            var keys = s3.ListObjectsV2Async(new ListObjectsV2Request { BucketName = _bucket }).GetAwaiter().GetResult().S3Objects ?? [];
            foreach (var key in keys)
                s3.DeleteObjectAsync(_bucket, key.Key).GetAwaiter().GetResult();
            s3.DeleteBucketAsync(_bucket).GetAwaiter().GetResult();
        }
        catch (AmazonS3Exception)
        {
            // Best effort: the bucket is empty or gone.
        }

        _services.Dispose();
    }

    [Fact]
    public async Task An_archive_run_saves_lists_reads_and_keeps_the_blobs()
    {
        var storage = _services.GetRequiredService<IBlobStorage>();
        storage.Should().BeOfType<S3BlobStorage>("the provider is S3 in configuration");

        // As ArchiveService.UploadFileAsync does: a file on disk, uploaded from a FileStream.
        var content = new Dictionary<string, string>
        {
            ["2026/11/01/tenant-a/traces.parquet"] = "first parquet file",
            ["2026/11/01/tenant-a/logs.parquet"] = "second parquet file",
            ["2026/11/01/tenant-a/readme.txt"] = "not an archive file"
        };
        foreach (var (name, text) in content)
        {
            var path = Path.GetTempFileName();
            try
            {
                await File.WriteAllTextAsync(path, text);
                await using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read | FileShare.Delete);
                var address = await storage.SaveAsync(new UploadLogToStorageRequest { FileName = name, Content = stream });
                address.Should().Be($"s3://{_bucket}/{name}");
            }
            finally
            {
                File.Delete(path);
            }
        }

        // Restore side: list, tier state, rehydration, read.
        var listed = await storage.ListAsync();
        listed.Should().BeEquivalentTo(["2026/11/01/tenant-a/traces.parquet", "2026/11/01/tenant-a/logs.parquet"]);

        var present = await storage.GetTierStateAsync("2026/11/01/tenant-a/traces.parquet");
        present.Exists.Should().BeTrue();
        present.IsArchived.Should().BeFalse();
        (await storage.GetTierStateAsync("2026/11/01/tenant-a/gone.parquet")).Exists.Should().BeFalse();

        var rehydrate = () => storage.RequestRehydrationAsync("2026/11/01/tenant-a/traces.parquet");
        await rehydrate.Should().NotThrowAsync();

        await using (var read = await storage.OpenReadAsync("2026/11/01/tenant-a/logs.parquet"))
            new StreamReader(read, Encoding.UTF8).ReadToEnd().Should().Be("second parquet file");

        // Kept: every blob is still in the bucket, seen through a separate client.
        using var s3 = Verifier();
        var kept = (await s3.ListObjectsV2Async(new ListObjectsV2Request { BucketName = _bucket })).S3Objects ?? [];
        kept.Select(o => o.Key).Should().BeEquivalentTo(content.Keys);
    }
}
