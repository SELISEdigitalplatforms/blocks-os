using Amazon.S3;
using Amazon.S3.Model;
using Azure.Storage.Blobs.Models;
using Blocks.Genesis;
using Cloud.LmtService.Models.ArchiveAndDelete;
using Cloud.LmtService.Models.Shared;
using Cloud.LmtService.Repositories.Shared;
using Cloud.LmtService.Services.ArchiveAndDelete;
using Cloud.LmtService.Utilities;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using System.Net;
using System.Text;

namespace XUnitTest.Services;

/// <summary>I02-WP10: the cold archive on S3. The Azure implementation's tests are not touched.</summary>
public class S3BlobStorageTests
{
    private const string Bucket = "lmt-archive";

    private readonly Mock<IAmazonS3> _s3 = new();
    private readonly S3BlobStorage _storage;
    private readonly List<ListObjectsV2Request> _listRequests = new();

    public S3BlobStorageTests()
    {
        var config = new Mock<ILmtArchiveRestoreConfigurationRepository>();
        config.Setup(c => c.GetLmtArchiveRestoreConfigurationsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new LmtArchiveRestoreConfigurations { Container = Bucket });
        _storage = new S3BlobStorage(_s3.Object, config.Object, NullLogger<S3BlobStorage>.Instance);
    }

    private void SetupList(params ListObjectsV2Response[] pages)
    {
        var next = 0;
        _s3.Setup(s => s.ListObjectsV2Async(It.IsAny<ListObjectsV2Request>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((ListObjectsV2Request r, CancellationToken _) =>
            {
                _listRequests.Add(new ListObjectsV2Request { BucketName = r.BucketName, ContinuationToken = r.ContinuationToken });
                if (r.MaxKeys == 1) return new ListObjectsV2Response(); // the one-key probe that finds out whether the bucket exists
                return pages[Math.Min(next++, pages.Length - 1)];
            });
    }

    private static ListObjectsV2Response Page(string? nextToken, params string[] keys) => new()
    {
        S3Objects = keys.Select(k => new S3Object { Key = k }).ToList(),
        IsTruncated = nextToken is not null,
        NextContinuationToken = nextToken
    };

    [Fact]
    public async Task List_returns_only_parquet_files_across_pages()
    {
        SetupList(Page("t1", "2026/11/01/logs.parquet", "notes.txt"), Page(null, "2026/11/02/TRACES.PARQUET"));

        var names = await _storage.ListAsync();

        names.Should().Equal("2026/11/01/logs.parquet", "2026/11/02/TRACES.PARQUET");
        _listRequests.Select(r => r.ContinuationToken).Should().Equal(null, null, "t1");
        _listRequests.Should().OnlyContain(r => r.BucketName == Bucket);
    }

    [Fact]
    public async Task List_does_not_delete_anything()
    {
        SetupList(Page(null, "a.parquet"));

        await _storage.ListAsync();

        _s3.Verify(s => s.DeleteObjectAsync(It.IsAny<DeleteObjectRequest>(), It.IsAny<CancellationToken>()), Times.Never);
        _s3.Verify(s => s.DeleteObjectsAsync(It.IsAny<DeleteObjectsRequest>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Missing_bucket_is_created_once()
    {
        _s3.Setup(s => s.ListObjectsV2Async(It.IsAny<ListObjectsV2Request>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new AmazonS3Exception("no bucket") { StatusCode = HttpStatusCode.NotFound, ErrorCode = "NoSuchBucket" });
        _s3.Setup(s => s.PutBucketAsync(It.IsAny<PutBucketRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PutBucketResponse());
        _s3.Setup(s => s.GetObjectMetadataAsync(It.IsAny<GetObjectMetadataRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new GetObjectMetadataResponse());

        await _storage.GetTierStateAsync("a.parquet");
        await _storage.GetTierStateAsync("b.parquet");

        _s3.Verify(s => s.PutBucketAsync(It.Is<PutBucketRequest>(r => r.BucketName == Bucket), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Save_puts_the_object_in_the_bucket_and_returns_an_s3_address_without_changing_tier()
    {
        SetupList(Page(null));
        PutObjectRequest? sent = null;
        _s3.Setup(s => s.PutObjectAsync(It.IsAny<PutObjectRequest>(), It.IsAny<CancellationToken>()))
            .Callback<PutObjectRequest, CancellationToken>((r, _) => sent = r)
            .ReturnsAsync(new PutObjectResponse());
        using var content = new MemoryStream(Encoding.UTF8.GetBytes("parquet-bytes")) { Position = 5 };

        var address = await _storage.SaveAsync(new UploadLogToStorageRequest { FileName = "2026/11/01/logs.parquet", Content = content });

        address.Should().Be($"s3://{Bucket}/2026/11/01/logs.parquet");
        sent.Should().NotBeNull();
        sent!.BucketName.Should().Be(Bucket);
        sent.Key.Should().Be("2026/11/01/logs.parquet");
        sent.InputStream.Should().BeSameAs(content);
        content.Position.Should().Be(0, "the upload reads from the start, as the Azure implementation does");
        _s3.Invocations.Select(i => i.Method.Name).Should().NotContain(n => n.Contains("Tier") || n.Contains("Restore") || n.Contains("Storage"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  ")]
    public async Task Save_requires_a_file_name(string? name)
    {
        var act = () => _storage.SaveAsync(new UploadLogToStorageRequest { FileName = name!, Content = new MemoryStream() });

        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task Tier_state_of_an_existing_blob_is_present_and_never_archived()
    {
        SetupList(Page(null));
        _s3.Setup(s => s.GetObjectMetadataAsync(It.IsAny<GetObjectMetadataRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new GetObjectMetadataResponse());

        var state = await _storage.GetTierStateAsync("a.parquet");

        state.Exists.Should().BeTrue();
        state.IsArchived.Should().BeFalse();
    }

    [Fact]
    public async Task Tier_state_of_a_missing_blob_is_missing()
    {
        SetupList(Page(null));
        _s3.Setup(s => s.GetObjectMetadataAsync(It.IsAny<GetObjectMetadataRequest>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new AmazonS3Exception("not found") { StatusCode = HttpStatusCode.NotFound });

        var state = await _storage.GetTierStateAsync("gone.parquet");

        state.Should().Be(Cloud.LmtService.Models.ColdRestore.BlobTierState.Missing);
    }

    [Fact]
    public async Task Tier_state_of_a_blank_path_is_missing_without_calling_s3()
    {
        var state = await _storage.GetTierStateAsync(" ");

        state.Exists.Should().BeFalse();
        _s3.Invocations.Should().BeEmpty();
    }

    [Fact]
    public async Task Rehydration_request_does_nothing()
    {
        await _storage.RequestRehydrationAsync("a.parquet", AccessTier.Cool);
        await _storage.RequestRehydrationAsync("a.parquet");

        _s3.Invocations.Should().BeEmpty("S3 has no archive tier in this version; a lifecycle rule on the bucket gives cold storage");
    }

    [Fact]
    public async Task OpenRead_returns_the_object_bytes()
    {
        SetupList(Page(null));
        _s3.Setup(s => s.GetObjectAsync(It.IsAny<GetObjectRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new GetObjectResponse { ResponseStream = new MemoryStream(Encoding.UTF8.GetBytes("hello")) });

        await using var stream = await _storage.OpenReadAsync("a.parquet");

        new StreamReader(stream).ReadToEnd().Should().Be("hello");
    }
}

/// <summary>I02-WP10: which archive store is chosen by configuration, and what it needs.</summary>
public class LmtArchiveStorageSelectionTests
{
    private static IConfiguration Config(params (string Key, string? Value)[] values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values.Select(v => new KeyValuePair<string, string?>(v.Key, v.Value))).Build();

    private static ServiceProvider Provider(IConfiguration configuration)
    {
        var secret = new Mock<IBlocksSecret>();
        secret.SetupGet(s => s.LmtBlobStorageConnectionString).Returns("UseDevelopmentStorage=true");
        var repo = new Mock<ILmtArchiveRestoreConfigurationRepository>();

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton(configuration);
        services.AddSingleton(secret.Object);
        services.AddCloudLmtServices();
        services.AddSingleton(repo.Object); // the last registration wins: no database is needed to pick a store
        return services.BuildServiceProvider();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("Azure")]
    [InlineData("azure")]
    public void Azure_is_the_default_and_its_tests_stay_as_they_were(string? provider)
    {
        using var sp = Provider(Config((LmtArchiveStorageOptions.ProviderKey, provider)));

        sp.GetRequiredService<IBlobStorage>().Should().BeOfType<BlobStorage>();
    }

    [Fact]
    public void S3_is_chosen_by_configuration()
    {
        using var sp = Provider(Config(
            (LmtArchiveStorageOptions.ProviderKey, "S3"),
            ("LmtArchive:Storage:S3:ServiceUrl", "http://s3:8333"),
            ("LmtArchive:Storage:S3:AccessKey", "test-access"),
            ("LmtArchive:Storage:S3:SecretKey", "test-secret")));

        sp.GetRequiredService<IBlobStorage>().Should().BeOfType<S3BlobStorage>();
    }

    [Fact]
    public void S3_without_keys_fails_and_names_the_settings_but_not_any_value()
    {
        using var sp = Provider(Config((LmtArchiveStorageOptions.ProviderKey, "S3"), ("LmtArchive:Storage:S3:AccessKey", "only-the-access-key")));

        var act = () => sp.GetRequiredService<IBlobStorage>();

        var ex = act.Should().Throw<InvalidOperationException>().Which;
        ex.Message.Should().Contain("LmtArchive:Storage:S3:AccessKey").And.Contain("LmtArchive:Storage:S3:SecretKey");
        ex.Message.Should().NotContain("only-the-access-key");
    }

    [Fact]
    public void An_unknown_provider_is_refused()
    {
        var act = () => LmtArchiveStorageOptions.ReadProvider(Config((LmtArchiveStorageOptions.ProviderKey, "Gcs")));

        act.Should().Throw<InvalidOperationException>().WithMessage("*'Azure' or 'S3'*");
    }

    [Fact]
    public void S3_options_default_to_path_style_and_us_east_1_when_an_endpoint_is_set()
    {
        var options = LmtS3ArchiveOptions.FromConfiguration(Config(
            ("LmtArchive:Storage:S3:ServiceUrl", " http://s3:8333 "),
            ("LmtArchive:Storage:S3:AccessKey", "a"),
            ("LmtArchive:Storage:S3:SecretKey", "b")));

        options.ServiceUrl.Should().Be("http://s3:8333");
        options.Region.Should().Be("us-east-1");
        options.ForcePathStyle.Should().BeTrue();
    }

    [Fact]
    public void S3_options_on_aws_use_virtual_host_style_unless_told_otherwise()
    {
        var aws = LmtS3ArchiveOptions.FromConfiguration(Config(
            ("LmtArchive:Storage:S3:Region", "eu-central-1"),
            ("LmtArchive:Storage:S3:AccessKey", "a"),
            ("LmtArchive:Storage:S3:SecretKey", "b")));
        var forced = LmtS3ArchiveOptions.FromConfiguration(Config(
            ("LmtArchive:Storage:S3:ForcePathStyle", "true"),
            ("LmtArchive:Storage:S3:AccessKey", "a"),
            ("LmtArchive:Storage:S3:SecretKey", "b")));

        aws.ServiceUrl.Should().BeNull();
        aws.Region.Should().Be("eu-central-1");
        aws.ForcePathStyle.Should().BeFalse();
        forced.ForcePathStyle.Should().BeTrue();
    }
}
