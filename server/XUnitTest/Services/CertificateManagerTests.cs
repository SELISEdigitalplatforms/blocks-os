using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Threading.Tasks;
using Blocks.Genesis;
using DomainService.Certificate;
using FluentAssertions;
using Moq;

namespace XUnitTest.Services
{
    public class CertificateManagerTests
    {
        private readonly Mock<ICertificateStorageFactory> _factory = new();
        private readonly Mock<ICryptoService> _crypto = new();

        private CertificateManager Manager() => new(_factory.Object, _crypto.Object);

        [Fact]
        public void GeneratePrivateCertificateName_HashesTenantAndItemId()
        {
            _crypto.Setup(c => c.Hash(It.IsAny<byte[]>(), It.IsAny<bool>())).Returns("hashed-name");

            var name = Manager().GeneratePrivateCertificateName("tenant-1", "item-1");

            name.Should().Be("hashed-name");
            _crypto.Verify(c => c.Hash(
                It.Is<byte[]>(b => Encoding.UTF8.GetString(b) == "tenant-1::item-1"),
                It.IsAny<bool>()), Times.Once);
        }

        [Fact]
        public async Task UploadPrivateCertificateAsync_UsesFactoryAndDelegatesToStorage()
        {
            var storage = new Mock<ICertificateStorage>();
            _factory.Setup(f => f.Create(CertificateStorageType.Azure)).Returns(storage.Object);

            using var cert = CreateSelfSignedCertificate();

            await Manager().UploadPrivateCertificateAsync(CertificateStorageType.Azure, cert, "pwd", "cert-name");

            _factory.Verify(f => f.Create(CertificateStorageType.Azure), Times.Once);
            storage.Verify(s => s.UploadCertificateAsync(cert, "pwd", "cert-name"), Times.Once);
        }

        [Fact]
        public void GenerateCertificates_ProducesPublicAndPrivateCertificates()
        {
            var parameters = new JwtTokenParameters
            {
                Issuer = "SeliseBlocks",
                Subject = "Selise-Blocks",
                CertificateValidForNumberOfDays = 30,
                IssueDate = System.DateTime.UtcNow,
                PrivateCertificatePassword = "priv-pass",
                PublicCertificatePassword = "pub-pass"
            };

            var (publicCert, privateCert) = Manager().GenerateCertificates(parameters);

            publicCert.Should().NotBeNull();
            privateCert.Should().NotBeNull();
            privateCert.HasPrivateKey.Should().BeTrue();
            publicCert.Subject.Should().Contain("Selise-Blocks");
        }


        [Fact]
        public void GenerateCertificates_CertificateDnStaysSeliseBlocks_WhenIssuerIsUrl()
        {
            // #606: JwtTokenParameters.Issuer is now the OIDC issuer URL; the certificate
            // subject must remain CN=SeliseBlocks (IdentifierConstants.Issuer).
            var parameters = new JwtTokenParameters
            {
                Issuer = "https://dev-iam.blocksdevelopers.com/D00220c69fdb84c7ca63b4f69a4ceadfc",
                Subject = "Selise-Blocks",
                CertificateValidForNumberOfDays = 30,
                IssueDate = System.DateTime.UtcNow,
                PrivateCertificatePassword = "priv-pass",
                PublicCertificatePassword = "pub-pass"
            };

            var (publicCert, privateCert) = Manager().GenerateCertificates(parameters);

            publicCert.Issuer.Should().Contain("CN=SeliseBlocks");
            privateCert.Issuer.Should().Contain("CN=SeliseBlocks");
            publicCert.Subject.Should().Contain("Selise-Blocks");
        }

        private static X509Certificate2 CreateSelfSignedCertificate()
        {
            using var rsa = System.Security.Cryptography.RSA.Create(2048);
            var request = new CertificateRequest("CN=Test", rsa,
                System.Security.Cryptography.HashAlgorithmName.SHA256,
                System.Security.Cryptography.RSASignaturePadding.Pkcs1);
            return request.CreateSelfSigned(System.DateTimeOffset.UtcNow.AddDays(-1),
                System.DateTimeOffset.UtcNow.AddDays(1));
        }
    }
}
