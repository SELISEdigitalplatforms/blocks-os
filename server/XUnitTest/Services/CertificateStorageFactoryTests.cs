using System;
using Blocks.Genesis;
using DomainService.Certificate;
using DomainService.Projects;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;

namespace XUnitTest.Services
{
    public class CertificateStorageFactoryTests
    {
        private readonly Mock<ILogger<CertificateStorageFactory>> _logger = new();
        private readonly Mock<IProjectRepository> _repo = new();

        private CertificateStorageFactory Factory() => new(_logger.Object, _repo.Object);

        [Fact]
        public void Create_Azure_AttemptsAzureKeyVaultStorage()
        {
            // The factory routes Azure to AzureKeyVaultStorage, whose constructor
            // demands KeyVault configuration that is not present in the test
            // environment, so construction fails loudly here.
            var act = () => Factory().Create(CertificateStorageType.Azure);

            act.Should().Throw<Exception>().WithMessage("*Azure config*");
        }

        [Fact]
        public void Create_Filesystem_ReturnsLocalSystemStorage()
        {
            Factory().Create(CertificateStorageType.Filefilesystem).Should().BeOfType<LocalSystemStorage>();
        }

        [Fact]
        public void Create_Mongodb_ReturnsMongoDBStorage()
        {
            Factory().Create(CertificateStorageType.Mongodb).Should().BeOfType<MongoDBStorage>();
        }

        [Fact]
        public void Create_UnknownType_Throws()
        {
            var act = () => Factory().Create((CertificateStorageType)999);

            act.Should().Throw<ArgumentException>();
        }
    }
}
