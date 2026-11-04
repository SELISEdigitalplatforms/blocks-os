using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Azure;
using Azure.Security.KeyVault.Secrets;
using Blocks.Secrets;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace XUnitTest.Secrets
{
    /// <summary>
    /// Permanent delete against Key Vault: delete, wait for it, purge — and every way that fails.
    /// </summary>
    public class KeyVaultSecretValueStorePurgeTests
    {
        private const string SecretId = "secret-1";
        private static readonly string VaultKey = $"{SecretDefaults.VaultKeyPrefix}-{SecretId}";

        private readonly Mock<SecretClient> _client = new();
        private readonly Mock<DeleteSecretOperation> _operation = new();
        private readonly List<string> _calls = new();
        private readonly KeyVaultSecretValueStore _store;

        public KeyVaultSecretValueStorePurgeTests()
        {
            _operation
                .Setup(o => o.WaitForCompletionAsync(It.IsAny<CancellationToken>()))
                .Callback(() => _calls.Add("wait"))
                .ReturnsAsync(Response.FromValue<DeletedSecret>(null!, Mock.Of<Response>()));

            _client
                .Setup(c => c.StartDeleteSecretAsync(VaultKey, It.IsAny<CancellationToken>()))
                .Callback(() => _calls.Add("delete"))
                .ReturnsAsync(_operation.Object);

            _client
                .Setup(c => c.PurgeDeletedSecretAsync(VaultKey, It.IsAny<CancellationToken>()))
                .Callback(() => _calls.Add("purge"))
                .ReturnsAsync(Mock.Of<Response>());

            _store = new KeyVaultSecretValueStore(_client.Object, NullLogger<KeyVaultSecretValueStore>.Instance);
        }

        [Fact]
        public async Task Purge_DeletesWaitsForTheDeleteThenPurges()
        {
            // Purging while the delete is still in flight is refused with a 409.
            await _store.PurgeAsync(SecretId);

            _calls.Should().Equal("delete", "wait", "purge");
        }

        [Fact]
        public async Task Purge_WhenTheSecretIsAlreadyInTheDeletedState_StillPurges()
        {
            _client
                .Setup(c => c.StartDeleteSecretAsync(VaultKey, It.IsAny<CancellationToken>()))
                .ThrowsAsync(new RequestFailedException(404, "not found"));

            await _store.PurgeAsync(SecretId);

            _client.Verify(c => c.PurgeDeletedSecretAsync(VaultKey, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Purge_WhenNothingExistsAnywhere_IsANoOp()
        {
            _client
                .Setup(c => c.StartDeleteSecretAsync(VaultKey, It.IsAny<CancellationToken>()))
                .ThrowsAsync(new RequestFailedException(404, "not found"));
            _client
                .Setup(c => c.PurgeDeletedSecretAsync(VaultKey, It.IsAny<CancellationToken>()))
                .ThrowsAsync(new RequestFailedException(404, "not found"));

            var act = () => _store.PurgeAsync(SecretId);

            await act.Should().NotThrowAsync();
        }

        [Fact]
        public async Task Purge_WhenTheDeleteFails_ReportsDeleteAndNeverPurges()
        {
            _client
                .Setup(c => c.StartDeleteSecretAsync(VaultKey, It.IsAny<CancellationToken>()))
                .ThrowsAsync(new RequestFailedException(500, "vault down"));

            var act = () => _store.PurgeAsync(SecretId);

            (await act.Should().ThrowAsync<SecretVaultException>())
                .Which.Operation.Should().Be(SecretVaultOperations.Delete);
            _client.Verify(c => c.PurgeDeletedSecretAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Purge_WhenWaitingForTheDeleteFails_ReportsDelete()
        {
            _operation
                .Setup(o => o.WaitForCompletionAsync(It.IsAny<CancellationToken>()))
                .ThrowsAsync(new RequestFailedException(500, "poll failed"));

            var act = () => _store.PurgeAsync(SecretId);

            (await act.Should().ThrowAsync<SecretVaultException>())
                .Which.Operation.Should().Be(SecretVaultOperations.Delete);
        }

        [Theory]
        [InlineData(403)] // no Purge permission
        [InlineData(409)] // purge protection
        public async Task Purge_WhenThePurgeIsRefused_ReportsPurge(int status)
        {
            _client
                .Setup(c => c.PurgeDeletedSecretAsync(VaultKey, It.IsAny<CancellationToken>()))
                .ThrowsAsync(new RequestFailedException(status, "refused"));

            var act = () => _store.PurgeAsync(SecretId);

            (await act.Should().ThrowAsync<SecretVaultException>())
                .Which.Operation.Should().Be(SecretVaultOperations.Purge);
        }

        [Fact]
        public async Task Purge_CancellationPropagatesUnwrapped()
        {
            _client
                .Setup(c => c.StartDeleteSecretAsync(VaultKey, It.IsAny<CancellationToken>()))
                .ThrowsAsync(new OperationCanceledException());

            var act = () => _store.PurgeAsync(SecretId);

            await act.Should().ThrowAsync<OperationCanceledException>();
        }

        [Theory]
        [InlineData("")]
        [InlineData(" ")]
        public async Task Purge_RejectsABlankId(string secretId)
        {
            var act = () => _store.PurgeAsync(secretId);

            await act.Should().ThrowAsync<ArgumentException>();
            _client.VerifyNoOtherCalls();
        }
    }
}
