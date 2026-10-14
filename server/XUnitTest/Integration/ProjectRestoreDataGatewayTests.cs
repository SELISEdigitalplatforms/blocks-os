using System;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Threading.Tasks;
using Blocks.Genesis;
using DomainService.Certificate;
using DomainService.Dtos;
using DomainService.Entities;
using DomainService.Projects;
using DomainService.Shared;
using DomainService.Shared.Entities;
using DomainService.Shared.Services;
using DomainService.Storage;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using MongoDB.Bson;
using MongoDB.Driver;
using Moq;
using StorageDriver;
using XUnitTest.TestSupport;

namespace XUnitTest.Integration
{
    /// <summary>
    /// os SPEC2 C20 + C24 (R-X-PROJECT-CREATE, R-X-RESTORE-EXISTING) on the Api path: <c>POST Project/Restore</c> →
    /// <c>ProjectManagementService.RestoreProjectAsync</c> → the REAL <c>ProjectRepository.CreateDefaultConfigurationAsync</c>
    /// on the throwaway Mongo, with the switch on/off. An existing project with no tracer gets a fresh tracer, so the
    /// defaults run again. Other repository calls (people, tracer save) are mocked; certificates are faked.
    /// </summary>
    [Collection(MongoIntegrationCollection.Name)]
    public class ProjectRestoreDataGatewayTests
    {
        private const string Dsc = "DataServiceConfigurations";
        private readonly MongoIntegrationFixture _fixture;

        public ProjectRestoreDataGatewayTests(MongoIntegrationFixture fixture) => _fixture = fixture;

        private static IConfiguration Config(bool on) => new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                { "KbtclIdentifier", ".blocks.dev" },
                { "CertificateStorageType", "Azure" },
                { "DataGateway:RootConfigEnabled", on ? "true" : "false" }
            })
            .Build();

        private static X509Certificate2 Cert()
        {
            using var rsa = RSA.Create(2048);
            var request = new CertificateRequest("CN=os2-restore-test", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
            return request.CreateSelfSigned(DateTimeOffset.UtcNow.AddMinutes(-1), DateTimeOffset.UtcNow.AddDays(1));
        }

        private Tenant NewProject(string suffix) => new()
        {
            ItemId = "proj-" + suffix,
            TenantId = "tid-" + suffix,
            CreatedBy = "creator-" + suffix,
            DBName = "projdb-" + suffix,
            DbConnectionString = "mongodb://x",
            Applications = new List<Applications>(),
            JwtTokenParameters = new JwtTokenParameters
            {
                IssueDate = DateTime.UtcNow,
                PrivateCertificatePassword = "priv",
                PublicCertificatePassword = "pub",
                CertificateStorageType = CertificateStorageType.Filefilesystem
            }
        };

        private async Task<(bool Success, ProjectStatusTracer? Saved)> RestoreAsync(Tenant project, bool on)
        {
            var config = Config(on);
            var secret = new Mock<IBlocksSecret>();
            secret.SetupGet(s => s.DatabaseConnectionString).Returns("mongodb://localhost:27017");
            secret.SetupGet(s => s.RootDatabaseName).Returns("BlocksRootDb");
            var encoding = new Mock<IEncodingService>();
            encoding.Setup(e => e.EncodeToBase26Async(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int>())).ReturnsAsync("abcde");
            var real = new ProjectRepository(_fixture.DbContextProvider, config, secret.Object, encoding.Object);

            ProjectStatusTracer? saved = null;
            var repo = new Mock<IProjectRepository>();
            repo.Setup(r => r.GetByIdAsync(project.ItemId)).ReturnsAsync(project);
            repo.Setup(r => r.GetUnfinishedProjectByIdAsync(project.ItemId)).ReturnsAsync((ProjectStatusTracer?)null);
            repo.Setup(r => r.GetOwnerUserIdAsync(project.TenantId)).ReturnsAsync("owner");
            repo.Setup(r => r.CreateDefaultConfigurationAsync(It.IsAny<ProjectStatusTracer>(), It.IsAny<Tenant>()))
                .Returns<ProjectStatusTracer, Tenant>(real.CreateDefaultConfigurationAsync);
            repo.Setup(r => r.SaveStatusTracerAsync(It.IsAny<ProjectStatusTracer>()))
                .Callback<ProjectStatusTracer>(t => saved = t).Returns(Task.CompletedTask);

            var cert = Cert();
            var certs = new Mock<ICertificateManager>();
            certs.Setup(c => c.GenerateCertificates(It.IsAny<JwtTokenParameters>())).Returns((cert, cert));
            certs.Setup(c => c.GeneratePrivateCertificateName(It.IsAny<string>(), It.IsAny<string>())).Returns("private-cert-name");
            certs.Setup(c => c.UploadPrivateCertificateAsync(It.IsAny<CertificateStorageType>(), It.IsAny<X509Certificate2>(), It.IsAny<string>(), It.IsAny<string>()))
                 .Returns(Task.CompletedTask);
            var storage = new Mock<IStorageDriverService>();
            storage.Setup(s => s.UploadFileToLocalStorageAsync(It.IsAny<LocalStorageUploadRequest>()))
                   .ReturnsAsync(new LocalStorageUploadResponse { IsSuccess = true, FileId = "f1" });
            storage.Setup(s => s.GetUrlForDownloadFileAsync(It.IsAny<GetFileRequest>()))
                   .ReturnsAsync(new FileResponse { IsSuccess = true, Url = "https://download/cert" });

            var service = new ProjectManagementService(repo.Object, secret.Object, new Mock<IMessageClient>().Object, config,
                storage.Object, new Mock<ITenants>().Object, certs.Object, encoding.Object, new Mock<ICacheClient>().Object,
                new CryptoService(), HttpFactoryStub.Unreachable());

            using var _ = new BlocksTestContext();
            var response = await service.RestoreProjectAsync(new RestoreProjectRequest { ItemId = project.ItemId });
            repo.Verify(r => r.CreateDefaultConfigurationAsync(It.IsAny<ProjectStatusTracer>(), It.IsAny<Tenant>()), Times.Once);
            return (response.IsSuccess, saved);
        }

        private IMongoCollection<BsonDocument> RootDsc() => _fixture.Database.GetCollection<BsonDocument>(Dsc);
        private IMongoCollection<BsonDocument> TenantDsc(Tenant p) => _fixture.DbContextProvider.GetDatabase("", p.DBName).GetCollection<BsonDocument>(Dsc);

        [Fact]
        public async Task ApiRestore_SwitchOn_ExistingByoTenantDoc_NoRootDoc_TenantDocUnchanged()
        {
            var suffix = Guid.NewGuid().ToString("N");
            var project = NewProject(suffix);
            var byo = new BsonDocument { { "_id", "byo-" + suffix }, { "DbConnectionString", "Y3VzdG9t" }, { "DatabaseName", "crm" }, { "IsDeleted", false } };
            await TenantDsc(project).InsertOneAsync(byo);

            var (success, saved) = await RestoreAsync(project, on: true);

            success.Should().BeTrue();
            saved!.IsProjectCreationSuccess.Should().BeTrue();
            saved.ErrorMessage.Should().BeNullOrEmpty();
            (await RootDsc().CountDocumentsAsync(new BsonDocument("_id", project.TenantId))).Should().Be(0);
            (await TenantDsc(project).Find(new BsonDocument("_id", "byo-" + suffix)).FirstAsync()).Should().BeEquivalentTo(byo);
        }

        [Fact]
        public async Task ApiRestore_SwitchOn_ExistingRootDoc_IsKept()
        {
            var suffix = Guid.NewGuid().ToString("N");
            var project = NewProject(suffix);
            var existing = new BsonDocument { { "_id", project.TenantId }, { "ConfigItemId", "worker-made" }, { "DbConnectionSecretId", "abc" }, { "IsDeleted", false } };
            await RootDsc().InsertOneAsync(existing);

            var (success, saved) = await RestoreAsync(project, on: true);

            success.Should().BeTrue();
            saved!.ErrorMessage.Should().BeNullOrEmpty("DuplicateKey = keep, not an error");
            (await RootDsc().Find(new BsonDocument("_id", project.TenantId)).FirstAsync()).Should().BeEquivalentTo(existing);
        }

        [Fact]
        public async Task ApiRestore_SwitchOn_NoDscDoc_InsertsRootDefault_NoTenantDoc()
        {
            var suffix = Guid.NewGuid().ToString("N");
            var project = NewProject(suffix);

            var (success, _) = await RestoreAsync(project, on: true);

            success.Should().BeTrue();
            var root = await RootDsc().Find(new BsonDocument("_id", project.TenantId)).FirstOrDefaultAsync();
            root.Should().NotBeNull();
            root["DbConnectionSecretId"].AsString.Should().Be("default");
            (await TenantDsc(project).CountDocumentsAsync(FilterDefinition<BsonDocument>.Empty)).Should().Be(0);
        }

        [Fact]
        public async Task ApiRestore_SwitchOff_CopiesSeedDoc_NoRootDoc()
        {
            var suffix = Guid.NewGuid().ToString("N");
            var project = NewProject(suffix);
            var seed = _fixture.DbContextProvider.GetDatabase("", "BlocksConfiguration").GetCollection<BsonDocument>(Dsc);
            if (await seed.CountDocumentsAsync(FilterDefinition<BsonDocument>.Empty) == 0)
                await seed.InsertOneAsync(new BsonDocument { { "_id", "seed-dsc" }, { "DbConnectionString", "ZGVmYXVsdA==" }, { "IsDeleted", false } });

            var (success, _) = await RestoreAsync(project, on: false);

            success.Should().BeTrue();
            (await TenantDsc(project).CountDocumentsAsync(FilterDefinition<BsonDocument>.Empty)).Should().BeGreaterThan(0);
            (await RootDsc().CountDocumentsAsync(new BsonDocument("_id", project.TenantId))).Should().Be(0);
        }
    }
}
