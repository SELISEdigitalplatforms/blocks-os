using System.Collections.Generic;
using System.Threading.Tasks;
using Secrets.DomainService.Entities;
using Secrets.DomainService.ResponseModel;
using Secrets.DomainService.Services;
using FluentAssertions;
using Moq;
using XUnitTest.TestSupport;

namespace XUnitTest.Services
{
    public class SecretManagementServiceTests
    {
        private readonly Mock<ISecretRepository> _repo = new();
        private SecretManagementService Service() => new(_repo.Object);

        [Fact]
        public async Task GetSecretAsync_MapsRepositoryResult()
        {
            var secrets = new List<Secret> { new() { SecretKey = "k" } };
            _repo.Setup(r => r.GetSecretsAsync("mykey", 1, 10)).ReturnsAsync((secrets, 7L));

            var response = await Service().GetSecretAsync("mykey", 1, 10);

            response.Data.Should().BeEquivalentTo(secrets);
            response.TotalCount.Should().Be(7);
        }

        [Fact]
        public async Task SaveSecretAsync_NewSecret_CreatesAndLowercasesKey()
        {
            using var _ = new BlocksTestContext(userId: "creator-1");
            _repo.Setup(r => r.GetSecretByIdAsync(It.IsAny<string>())).ReturnsAsync((Secret?)null);
            Secret? saved = null;
            _repo.Setup(r => r.SaveSecretAsync(It.IsAny<Secret>()))
                 .Callback<Secret>(s => saved = s)
                 .Returns(Task.CompletedTask);

            var response = await Service().SaveSecretAsync(new SaveSecretRequest
            {
                SecretKey = "MyKey",
                KeyValuePairs = new Dictionary<string, string> { { "a", "b" } }
            });

            response.IsSuccess.Should().BeTrue();
            saved.Should().NotBeNull();
            saved!.SecretKey.Should().Be("mykey");
            saved.CreatedBy.Should().Be("creator-1");
            saved.KeyValuePairs.Should().ContainKey("a");
        }

        [Fact]
        public async Task SaveSecretAsync_ExistingSecret_UpdatesInPlace()
        {
            using var _ = new BlocksTestContext(userId: "editor-1");
            var existing = new Secret { ItemId = "s-1", SecretKey = "old", CreatedBy = "orig" };
            _repo.Setup(r => r.GetSecretByIdAsync("s-1")).ReturnsAsync(existing);
            Secret? saved = null;
            _repo.Setup(r => r.SaveSecretAsync(It.IsAny<Secret>()))
                 .Callback<Secret>(s => saved = s)
                 .Returns(Task.CompletedTask);

            await Service().SaveSecretAsync(new SaveSecretRequest
            {
                ItemId = "s-1",
                SecretKey = "NEW",
                KeyValuePairs = new Dictionary<string, string>()
            });

            saved!.ItemId.Should().Be("s-1");
            saved.SecretKey.Should().Be("new");
            saved.CreatedBy.Should().Be("orig"); // preserved
            saved.LastUpdatedBy.Should().Be("editor-1");
        }

        [Fact]
        public async Task SecretAsync_DelegatesToRepository()
        {
            var secret = new Secret { ItemId = "s-9" };
            _repo.Setup(r => r.GetSecretByIdAsync("s-9")).ReturnsAsync(secret);

            var result = await Service().SecretAsync("s-9");

            result.Should().BeSameAs(secret);
        }

        [Fact]
        public async Task DeleteSecretAsync_DeletesAndReturnsSuccess()
        {
            _repo.Setup(r => r.DeleteSecretAsync("s-2")).Returns(Task.CompletedTask);

            var response = await Service().DeleteSecretAsync(new DeleteSecretRequest { ItemId = "s-2" });

            response.IsSuccess.Should().BeTrue();
            _repo.Verify(r => r.DeleteSecretAsync("s-2"), Times.Once);
        }
    }
}
