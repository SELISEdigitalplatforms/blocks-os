using System;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Threading.Tasks;
using DomainService.Certificate;
using DomainService.Entities;
using DomainService.Projects;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using XUnitTest.TestSupport;

namespace XUnitTest.Services
{
    public class CertificateStorageTests
    {
        private readonly Mock<IProjectRepository> _repo = new();
        private readonly Mock<ILogger> _logger = new();

        private static X509Certificate2 SelfSigned()
        {
            using var rsa = RSA.Create(2048);
            var request = new CertificateRequest("CN=Test", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
            return request.CreateSelfSigned(DateTimeOffset.UtcNow.AddDays(-1), DateTimeOffset.UtcNow.AddDays(1));
        }

        [Fact]
        public async Task LocalSystemStorage_UploadCertificate_SavesBase64TenantCertificate()
        {
            using var _ = new BlocksTestContext(userId: "cert-user");
            TenantCertificate? saved = null;
            _repo.Setup(r => r.SaveTenantCertificateAsync(It.IsAny<TenantCertificate>()))
                 .Callback<TenantCertificate>(c => saved = c)
                 .ReturnsAsync(true);

            using var cert = SelfSigned();
            var storage = new LocalSystemStorage(_logger.Object, _repo.Object);
            await storage.UploadCertificateAsync(cert, "pwd", "my-cert");

            saved.Should().NotBeNull();
            saved!.Key.Should().Be("my-cert");
            saved.Value.Should().NotBeNullOrEmpty();
            saved.CreatedBy.Should().Be("cert-user");
            _repo.Verify(r => r.SaveTenantCertificateAsync(It.IsAny<TenantCertificate>()), Times.Once);
        }

        [Fact]
        public async Task MongoDBStorage_UploadCertificate_SavesBase64TenantCertificate()
        {
            using var _ = new BlocksTestContext(userId: "cert-user");
            TenantCertificate? saved = null;
            _repo.Setup(r => r.SaveTenantCertificateAsync(It.IsAny<TenantCertificate>()))
                 .Callback<TenantCertificate>(c => saved = c)
                 .ReturnsAsync(true);

            using var cert = SelfSigned();
            var storage = new MongoDBStorage(_logger.Object, _repo.Object);
            await storage.UploadCertificateAsync(cert, "pwd", "mongo-cert");

            saved.Should().NotBeNull();
            saved!.Key.Should().Be("mongo-cert");
            saved.Value.Should().NotBeNullOrEmpty();

            // The stored value is a base64 PFX that round-trips back into a certificate.
            var bytes = Convert.FromBase64String(saved.Value);
            using var reloaded = X509CertificateLoader.LoadPkcs12(bytes, "pwd");
            reloaded.Subject.Should().Be("CN=Test");
        }
    }
}
