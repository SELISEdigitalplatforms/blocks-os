using Azure;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using DomainService.Certificate;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Moq;
using StorageDriver;
using XUnitTest.TestHelpers;

namespace XUnitTest.Services
{
    /// <summary>
    /// Unit tests for <see cref="CertificateUploadService"/>. The Azure SDK types are mockable by
    /// design, so the upload itself is covered here too - what is not covered is whether the
    /// container really serves blobs anonymously, which only a real storage account can answer.
    /// </summary>
    public class CertificateUploadServiceTests : IDisposable
    {
        private const string BlobUrl = "https://acct.blob.core.windows.net/certificates/tenant-123_3rdparty";

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

        private Mock<BlobClient> ArrangeBlob(string url = BlobUrl)
        {
            var blob = new Mock<BlobClient>();
            blob.SetupGet(b => b.Uri).Returns(new Uri(url));
            blob.Setup(b => b.UploadAsync(
                    It.IsAny<Stream>(), It.IsAny<BlobUploadOptions>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(Mock.Of<Response<BlobContentInfo>>());

            _storage.Setup(s => s.GetBlobClientAsync(It.IsAny<string>())).ReturnsAsync(blob.Object);
            return blob;
        }

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
            var blob = ArrangeBlob();

            await _service.UploadPublicCertificateAsync(Request(CertificateFile(sizeInBytes: 64)));

            blob.Verify(b => b.UploadAsync(
                It.Is<Stream>(s => s.Length == 64),
                It.IsAny<BlobUploadOptions>(),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UploadPublicCertificateAsync_CarriesTheUploadedContentType()
        {
            var blob = ArrangeBlob();

            await _service.UploadPublicCertificateAsync(Request(CertificateFile()));

            blob.Verify(b => b.UploadAsync(
                It.IsAny<Stream>(),
                It.Is<BlobUploadOptions>(o => o.HttpHeaders.ContentType == "application/x-pkcs12"),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UploadPublicCertificateAsync_FallsBackWhenTheBrowserSendsNoContentType()
        {
            var blob = ArrangeBlob();

            await _service.UploadPublicCertificateAsync(
                Request(CertificateFile(contentType: string.Empty)));

            blob.Verify(b => b.UploadAsync(
                It.IsAny<Stream>(),
                It.Is<BlobUploadOptions>(o => o.HttpHeaders.ContentType == "application/octet-stream"),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UploadPublicCertificateAsync_SurfacesAStorageFailureAsAnError()
        {
            // Public blob access disabled on the account lands here, rather than as a 500.
            _storage.Setup(s => s.GetBlobClientAsync(It.IsAny<string>()))
                    .ThrowsAsync(new RequestFailedException(403, "no", "PublicAccessNotPermitted", null));

            var result = await _service.UploadPublicCertificateAsync(Request(CertificateFile()));

            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("storage");
            result.DownloadUrl.Should().BeEmpty();
        }

        // ─── tenant scoping ────────────────────────────────────────────────────────

        [Fact]
        public async Task UploadPublicCertificateAsync_AddressesTheBlobFromTheContextTenant()
        {
            ArrangeBlob();

            await _service.UploadPublicCertificateAsync(Request(CertificateFile()));

            _storage.Verify(s => s.GetBlobClientAsync("tenant-123_3rdparty"), Times.Once);
        }

        [Fact]
        public async Task UploadPublicCertificateAsync_UsesTheBareTenantSlotWhenNotThirdParty()
        {
            ArrangeBlob();

            await _service.UploadPublicCertificateAsync(Request(CertificateFile(), isThirdParty: false));

            _storage.Verify(s => s.GetBlobClientAsync("tenant-123"), Times.Once);
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

            _storage.Verify(s => s.GetBlobClientAsync(It.IsAny<string>()), Times.Never);
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

            _storage.Verify(s => s.GetBlobClientAsync(It.IsAny<string>()), Times.Never);
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
