using DomainService.Certificate;
using DomainService.Storage;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Moq;
using StorageDriver;
using XUnitTest.TestHelpers;

namespace XUnitTest.Services
{
    /// <summary>
    /// Unit tests for <see cref="CertificateUploadService"/>. The storage driver is mocked, so the
    /// upload request itself (container, key, bytes, content type) is covered here - what is not
    /// covered is whether the store really serves the object anonymously, which only a real store can
    /// answer (the driver's own live tests, and the I02-WP9 run against Azurite and S3, do).
    /// </summary>
    public class CertificateUploadServiceTests : IDisposable
    {
        private const string BlobUrl = "https://acct.blob.core.windows.net/certificates/tenant-123_3rdparty";
        private const string Container = "certificates";

        private readonly Mock<IStorageDriverService> _storage = new();
        private readonly CertificateUploadService _service;

        public CertificateUploadServiceTests()
        {
            TestBlocksContext.Set("tenant-123");
            _service = new CertificateUploadService(_storage.Object);
        }

        public void Dispose()
        {
            TestBlocksContext.Clear();
            GC.SuppressFinalize(this);
        }

        private readonly List<(string Container, string Key, long Length, string ContentType)> _uploads = new();

        private void ArrangeBlob(string url = BlobUrl)
        {
            _storage
                .Setup(s => s.UploadPublicObjectAsync(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Stream>(), It.IsAny<string>()))
                .Callback<string, string, Stream, string>((container, key, content, contentType) =>
                    _uploads.Add((container, key, content.Length, contentType)))
                .ReturnsAsync(url);
        }

        private void VerifyUploaded(string key) =>
            _storage.Verify(s => s.UploadPublicObjectAsync(
                Container, key, It.IsAny<Stream>(), It.IsAny<string>()), Times.Once);

        private void VerifyNothingUploaded() =>
            _storage.Verify(s => s.UploadPublicObjectAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Stream>(), It.IsAny<string>()), Times.Never);

        private static FormFile CertificateFile(
            string fileName = "public.pfx",
            int sizeInBytes = 32,
            string contentType = "application/x-pkcs12")
        {
            var bytes = new byte[sizeInBytes];
            return new FormFile(new MemoryStream(bytes), 0, bytes.Length, "Certificate", fileName)
            {
                Headers = new HeaderDictionary(),
                ContentType = contentType
            };
        }

        private static UploadCertificateRequest Request(IFormFile? file, bool isThirdParty = true) =>
            new() { Certificate = file, IsThirdParty = isThirdParty };

        // ─── blob naming ───────────────────────────────────────────────────────────

        [Fact]
        public void BuildBlobName_SuffixesTheExternalProvidersCertificate()
        {
            CertificateUploadService.BuildBlobName("tenant-123", isThirdParty: true)
                .Should().Be("tenant-123_3rdparty");
        }

        [Fact]
        public void BuildBlobName_LeavesTheTenantsOwnCertificateOnTheBareTenantId()
        {
            CertificateUploadService.BuildBlobName("tenant-123", isThirdParty: false)
                .Should().Be("tenant-123");
        }

        [Fact]
        public void BuildBlobName_KeepsTheTwoSlotsApart()
        {
            // Overwriting a tenant's own signing certificate with an external one would let that
            // provider mint tokens the tenant's services trust as their own.
            CertificateUploadService.BuildBlobName("tenant-123", true)
                .Should().NotBe(CertificateUploadService.BuildBlobName("tenant-123", false));
        }

        // ─── the upload itself ─────────────────────────────────────────────────────

        [Fact]
        public async Task UploadPublicCertificateAsync_ReturnsTheBlobUrlOnSuccess()
        {
            ArrangeBlob();

            var result = await _service.UploadPublicCertificateAsync(Request(CertificateFile()));

            result.IsSuccess.Should().BeTrue();
            result.DownloadUrl.Should().Be(BlobUrl);
            result.Errors.Should().BeNullOrEmpty();
        }

        [Fact]
        public async Task UploadPublicCertificateAsync_WritesTheFileContentToTheBlob()
        {
            ArrangeBlob();

            await _service.UploadPublicCertificateAsync(Request(CertificateFile(sizeInBytes: 64)));

            _uploads.Should().ContainSingle().Which.Length.Should().Be(64);
        }

        [Fact]
        public async Task UploadPublicCertificateAsync_CarriesTheUploadedContentType()
        {
            ArrangeBlob();

            await _service.UploadPublicCertificateAsync(Request(CertificateFile()));

            _uploads.Should().ContainSingle().Which.ContentType.Should().Be("application/x-pkcs12");
        }

        [Fact]
        public async Task UploadPublicCertificateAsync_FallsBackWhenTheBrowserSendsNoContentType()
        {
            ArrangeBlob();

            await _service.UploadPublicCertificateAsync(
                Request(CertificateFile(contentType: string.Empty)));

            _uploads.Should().ContainSingle().Which.ContentType.Should().Be("application/octet-stream");
        }

        [Fact]
        public async Task UploadPublicCertificateAsync_UsesTheSharedCertificatesContainer()
        {
            ArrangeBlob();

            await _service.UploadPublicCertificateAsync(Request(CertificateFile()));

            _uploads.Should().ContainSingle().Which.Container.Should().Be("certificates");
        }

        [Fact]
        public async Task UploadPublicCertificateAsync_SurfacesAStorageFailureAsAnError()
        {
            // Public blob access disabled on the account lands here, rather than as a 500.
            _storage.Setup(s => s.UploadPublicObjectAsync(
                        It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Stream>(), It.IsAny<string>()))
                    .ThrowsAsync(new PublicObjectStorageException("PublicAccessNotPermitted", "no"));

            var result = await _service.UploadPublicCertificateAsync(Request(CertificateFile()));

            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("storage").WhoseValue.Should().Be("PublicAccessNotPermitted");
            result.DownloadUrl.Should().BeEmpty();
        }

        [Fact]
        public async Task UploadPublicCertificateAsync_SaysClearlyWhenTheStorageHasNoPublicRead()
        {
            // An SFTP Default configuration cannot serve an object anonymously.
            _storage.Setup(s => s.UploadPublicObjectAsync(
                        It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Stream>(), It.IsAny<string>()))
                    .ThrowsAsync(new PublicObjectStorageException(PublicObjectStorageException.NotSupportedCode, "sftp"));

            var result = await _service.UploadPublicCertificateAsync(Request(CertificateFile()));

            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("storage").WhoseValue.Should().Be("public_objects_not_supported");
        }

        // ─── tenant scoping ────────────────────────────────────────────────────────

        [Fact]
        public async Task UploadPublicCertificateAsync_AddressesTheBlobFromTheContextTenant()
        {
            ArrangeBlob();

            await _service.UploadPublicCertificateAsync(Request(CertificateFile()));

            VerifyUploaded("tenant-123_3rdparty.pfx");
        }

        [Fact]
        public async Task UploadPublicCertificateAsync_UsesTheBareTenantSlotWhenNotThirdParty()
        {
            ArrangeBlob();

            await _service.UploadPublicCertificateAsync(Request(CertificateFile(), isThirdParty: false));

            VerifyUploaded("tenant-123");
        }

        [Fact]
        public async Task UploadPublicCertificateAsync_KeepsTheExtensionSoTheUrlSaysWhatItPointsAt()
        {
            // Without it the stored URL ends in an opaque identifier, and nothing downstream can
            // tell a PKCS#12 that needs a passphrase from a bare certificate that does not.
            ArrangeBlob();

            await _service.UploadPublicCertificateAsync(
                Request(CertificateFile("recyclium.crt", contentType: "application/x-x509-ca-cert")));

            VerifyUploaded("tenant-123_3rdparty.crt");
        }

        [Fact]
        public async Task UploadPublicCertificateAsync_RejectsWhenThereIsNoTenantContext()
        {
            ArrangeBlob();
            TestBlocksContext.Clear();

            var result = await _service.UploadPublicCertificateAsync(Request(CertificateFile()));

            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("tenant");
            result.DownloadUrl.Should().BeEmpty();
        }

        [Fact]
        public async Task UploadPublicCertificateAsync_NeverTouchesStorageWithoutATenant()
        {
            ArrangeBlob();
            TestBlocksContext.Clear();

            await _service.UploadPublicCertificateAsync(Request(CertificateFile()));

            VerifyNothingUploaded();
        }

        // ─── file validation ───────────────────────────────────────────────────────

        [Fact]
        public async Task UploadPublicCertificateAsync_RejectsAMissingFile()
        {
            var result = await _service.UploadPublicCertificateAsync(Request(null));

            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("certificate");
        }

        [Fact]
        public async Task UploadPublicCertificateAsync_RejectsAnEmptyFile()
        {
            var result = await _service.UploadPublicCertificateAsync(Request(CertificateFile(sizeInBytes: 0)));

            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("certificate");
        }

        [Fact]
        public async Task UploadPublicCertificateAsync_RejectsAFileOverTwoMegabytes()
        {
            var oversize = CertificateFile(sizeInBytes: (2 * 1024 * 1024) + 1);

            var result = await _service.UploadPublicCertificateAsync(Request(oversize));

            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("certificate");
        }

        [Theory]
        [InlineData("payload.jpg")]
        [InlineData("payload.exe")]
        [InlineData("payload")]
        public async Task UploadPublicCertificateAsync_RejectsFilesThatAreNotCertificates(string fileName)
        {
            var result = await _service.UploadPublicCertificateAsync(Request(CertificateFile(fileName)));

            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("certificate");
        }

        [Fact]
        public async Task UploadPublicCertificateAsync_RejectsBeforeReachingStorage()
        {
            ArrangeBlob();

            await _service.UploadPublicCertificateAsync(Request(CertificateFile("payload.jpg")));

            VerifyNothingUploaded();
        }

        [Theory]
        [InlineData("public.crt")]
        [InlineData("public.der")]
        [InlineData("public.pfx")]
        [InlineData("public.p12")]
        [InlineData("public.PFX")]
        public async Task UploadPublicCertificateAsync_AcceptsEveryCertificateExtensionTheClientOffers(string fileName)
        {
            ArrangeBlob();

            var result = await _service.UploadPublicCertificateAsync(Request(CertificateFile(fileName)));

            result.IsSuccess.Should().BeTrue();
        }
    }
}
