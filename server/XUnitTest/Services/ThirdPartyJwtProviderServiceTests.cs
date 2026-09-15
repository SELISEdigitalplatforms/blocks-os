using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Blocks.Genesis;
using DomainService.Certificate;
using DomainService.Projects;
using DomainService.Shared.Services;
using DomainService.Storage;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Moq;
using StorageDriver;
using XUnitTest.TestSupport;
using Xunit;

namespace XUnitTest.Services
{
    /// <summary>
    /// Covers the rules that cannot be recovered later: what gets encrypted, what must never be
    /// returned, and the configurations that are refused at save rather than discovered at login.
    /// </summary>
    public class ThirdPartyJwtProviderServiceTests
    {
        private const string TenantId = "tenant-1";
        private const string Salt = "9f2c1d4ea77b40c8a1e3b6d5c0f81a72";
        private const string Auth0 = "https://dev-kqgrj13jhskombl1.us.auth0.com/";

        private readonly Mock<IProjectRepository> _repo = new();
        private readonly Mock<IBlocksSecret> _blocksSecret = new();
        private readonly Mock<IMessageClient> _messageClient = new();
        private readonly Mock<IStorageDriverService> _storage = new();
        private readonly Mock<ITenants> _tenants = new();
        private readonly Mock<ICertificateManager> _certManager = new();
        private readonly Mock<IEncodingService> _encoding = new();
        private readonly Mock<ICacheClient> _cache = new();
        private readonly CryptoService _crypto = new();
        private readonly IConfiguration _configuration = new ConfigurationBuilder().Build();

        private readonly List<ThirdPartyJwtProvider> _saved = [];

        public ThirdPartyJwtProviderServiceTests()
        {
            _blocksSecret.SetupGet(s => s.DatabaseConnectionString).Returns("mongodb://localhost");

            _repo.Setup(r => r.GetByTenantIdAsync(TenantId))
                 .ReturnsAsync(new Tenant
                 {
                     ItemId = TenantId,
                     TenantId = TenantId,
                     TenantSalt = Salt,
                     DbConnectionString = "mongodb://localhost",
                     JwtTokenParameters = new JwtTokenParameters
                     {
                         PrivateCertificatePassword = string.Empty,
                         IssueDate = DateTime.UtcNow
                     }
                 });

            _repo.Setup(r => r.SaveThirdPartyJwtProviderAsync(It.IsAny<ThirdPartyJwtProvider>()))
                 .Callback<ThirdPartyJwtProvider>(_saved.Add)
                 .Returns(Task.CompletedTask);
        }

        private ProjectManagementService Service() => new(
            _repo.Object, _blocksSecret.Object, _messageClient.Object, _configuration,
            _storage.Object, _tenants.Object, _certManager.Object, _encoding.Object, _cache.Object,
            _crypto);

        private void ExistingProviders(params ThirdPartyJwtProvider[] providers) =>
            _repo.Setup(r => r.GetThirdPartyJwtProvidersAsync(TenantId)).ReturnsAsync([.. providers]);

        private static SaveThirdPartyJwtProviderRequest Request(
            JwtSigningAlgorithm algorithm = JwtSigningAlgorithm.RS256,
            string key = "auth0-a",
            string issuer = Auth0,
            string[]? audiences = null,
            string? jwksUrl = "https://example.com/.well-known/jwks.json",
            string? secret = null,
            string userIdMapping = "sub") => new()
            {
                Key = key,
                ProviderName = "Auth0",
                IsActive = true,
                Issuer = issuer,
                Audiences = [.. audiences ?? ["api-a"]],
                Algorithms = [algorithm],
                JwksUrl = jwksUrl,
                SigningSecret = secret,
                ClaimsMapping = new ThirdPartyClaimsMappingRequest { UserId = userIdMapping }
            };

        [Fact]
        public async Task Create_EncryptsTheSigningSecret_UnderTheTenantSalt()
        {
            using var _ = new BlocksTestContext(TenantId);
            ExistingProviders();

            var result = await Service().SaveThirdPartyJwtProviderAsync(
                Request(JwtSigningAlgorithm.HS256, jwksUrl: null, secret: "the-shared-secret"));

            result.IsSuccess.Should().BeTrue();

            var stored = _saved.Single();
            stored.SigningSecretCipher.Should().NotBeNullOrWhiteSpace();
            stored.SigningSecretCipher.Should().NotContain("the-shared-secret");
            _crypto.Decrypt(stored.SigningSecretCipher, Salt).Should().Be("the-shared-secret");
        }

        [Fact]
        public async Task Update_WithNoSecret_LeavesTheStoredOneUntouched()
        {
            // A masked field round-trips as "" from most frontends. Treating that as a clear would
            // silently break authentication on every unrelated edit.
            using var _ = new BlocksTestContext(TenantId);

            var cipher = _crypto.Encrypt("original-secret", Salt);
            var existing = new ThirdPartyJwtProvider
            {
                ItemId = "p1",
                TenantId = TenantId,
                Key = "auth0-a",
                Issuer = Auth0,
                Audiences = ["api-a"],
                Algorithms = [JwtSigningAlgorithm.HS256],
                SigningSecretCipher = cipher
            };
            ExistingProviders(existing);

            var request = Request(JwtSigningAlgorithm.HS256, jwksUrl: null, secret: "");
            request.ItemId = "p1";

            var result = await Service().SaveThirdPartyJwtProviderAsync(request);

            result.IsSuccess.Should().BeTrue();
            _crypto.Decrypt(_saved.Single().SigningSecretCipher, Salt).Should().Be("original-secret");
        }

        [Fact]
        public async Task SwitchingFromHmacToAsymmetric_ClearsTheStoredSecret()
        {
            // Otherwise a dormant signing authority survives, live again the moment someone
            // switches the algorithm back.
            using var _ = new BlocksTestContext(TenantId);

            var existing = new ThirdPartyJwtProvider
            {
                ItemId = "p1",
                TenantId = TenantId,
                Key = "auth0-a",
                Issuer = Auth0,
                Audiences = ["api-a"],
                Algorithms = [JwtSigningAlgorithm.HS256],
                SigningSecretCipher = _crypto.Encrypt("original-secret", Salt)
            };
            ExistingProviders(existing);

            var request = Request(JwtSigningAlgorithm.RS256);
            request.ItemId = "p1";

            var result = await Service().SaveThirdPartyJwtProviderAsync(request);

            result.IsSuccess.Should().BeTrue();
            _saved.Single().SigningSecretCipher.Should().BeEmpty();
        }

        [Fact]
        public async Task Rejects_DuplicateKeyWithinATenant()
        {
            using var _ = new BlocksTestContext(TenantId);
            ExistingProviders(new ThirdPartyJwtProvider { ItemId = "p1", TenantId = TenantId, Key = "auth0-a" });

            var result = await Service().SaveThirdPartyJwtProviderAsync(Request(key: "auth0-a"));

            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("duplicate_key");
        }

        [Fact]
        public async Task Rejects_AlgorithmsFromDifferentFamilies()
        {
            using var _ = new BlocksTestContext(TenantId);
            ExistingProviders();

            var request = Request();
            request.Algorithms = [JwtSigningAlgorithm.RS256, JwtSigningAlgorithm.HS256];

            var result = await Service().SaveThirdPartyJwtProviderAsync(request);

            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("invalid_algorithms");
        }

        [Fact]
        public async Task Rejects_UnspecifiedAlgorithm()
        {
            using var _ = new BlocksTestContext(TenantId);
            ExistingProviders();

            var request = Request();
            request.Algorithms = [JwtSigningAlgorithm.Unspecified];

            var result = await Service().SaveThirdPartyJwtProviderAsync(request);

            result.Errors.Should().ContainKey("invalid_algorithms");
        }

        [Fact]
        public async Task Rejects_AsymmetricProviderWithoutJwksUrl()
        {
            using var _ = new BlocksTestContext(TenantId);
            ExistingProviders();

            var result = await Service().SaveThirdPartyJwtProviderAsync(Request(jwksUrl: null));

            result.Errors.Should().ContainKey("jwks_url_required");
        }

        [Fact]
        public async Task Rejects_AsymmetricProviderCarryingASecret()
        {
            using var _ = new BlocksTestContext(TenantId);
            ExistingProviders();

            var result = await Service().SaveThirdPartyJwtProviderAsync(Request(secret: "should-not-be-here"));

            result.Errors.Should().ContainKey("unexpected_signing_secret");
        }

        [Fact]
        public async Task Rejects_NewHmacProviderWithoutASecret()
        {
            using var _ = new BlocksTestContext(TenantId);
            ExistingProviders();

            var result = await Service().SaveThirdPartyJwtProviderAsync(
                Request(JwtSigningAlgorithm.HS256, jwksUrl: null, secret: null));

            result.Errors.Should().ContainKey("signing_secret_required");
        }

        [Fact]
        public async Task Rejects_MissingUserIdMapping()
        {
            // Without it every token for the tenant collapses onto the same "_external" principal.
            using var _ = new BlocksTestContext(TenantId);
            ExistingProviders();

            var result = await Service().SaveThirdPartyJwtProviderAsync(Request(userIdMapping: ""));

            result.Errors.Should().ContainKey("user_id_mapping_required");
        }

        [Fact]
        public async Task Rejects_SharedIssuerWithoutAudiences()
        {
            // Two providers sharing issuer and audience validate identically, so the caller's
            // header alone would select which claim mapping applies to their own token.
            using var _ = new BlocksTestContext(TenantId);
            ExistingProviders(new ThirdPartyJwtProvider
            {
                ItemId = "p1",
                TenantId = TenantId,
                Key = "auth0-a",
                Issuer = Auth0,
                IsActive = true,
                Audiences = ["api-a"]
            });

            var result = await Service().SaveThirdPartyJwtProviderAsync(
                Request(key: "auth0-b", audiences: []));

            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("audiences_required_for_shared_issuer");
        }

        [Fact]
        public async Task Allows_SharedIssuerWhenAudiencesDiffer()
        {
            using var _ = new BlocksTestContext(TenantId);
            ExistingProviders(new ThirdPartyJwtProvider
            {
                ItemId = "p1",
                TenantId = TenantId,
                Key = "auth0-a",
                Issuer = Auth0,
                IsActive = true,
                Audiences = ["api-a"]
            });

            var result = await Service().SaveThirdPartyJwtProviderAsync(
                Request(key: "auth0-b", audiences: ["api-b"]));

            result.IsSuccess.Should().BeTrue();
        }

        [Fact]
        public async Task List_NeverReturnsTheSecretInAnyForm()
        {
            using var _ = new BlocksTestContext(TenantId);
            ExistingProviders(new ThirdPartyJwtProvider
            {
                ItemId = "p1",
                TenantId = TenantId,
                Key = "auth0-a",
                Issuer = Auth0,
                Algorithms = [JwtSigningAlgorithm.HS256],
                SigningSecretCipher = _crypto.Encrypt("the-shared-secret", Salt),
                ClaimsMapping = new ThirdPartyClaimsMapping { UserId = "sub" }
            });

            var results = await Service().GetThirdPartyJwtProvidersAsync();

            var provider = results.Single();
            provider.HasSigningSecret.Should().BeTrue();
            provider.Key.Should().Be("auth0-a");

            // The stored ciphertext is no more the UI's business than the plaintext is.
            typeof(ThirdPartyJwtProviderResult).GetProperty("SigningSecretCipher").Should().BeNull();
        }

        [Fact]
        public async Task Delete_RemovesTheRowAndWithItTheSecret()
        {
            using var _ = new BlocksTestContext(TenantId);
            _repo.Setup(r => r.DeleteThirdPartyJwtProviderAsync(TenantId, "p1")).ReturnsAsync(true);

            var result = await Service().DeleteThirdPartyJwtProviderAsync(
                new DeleteThirdPartyJwtProviderRequest { ItemId = "p1" });

            result.IsSuccess.Should().BeTrue();
            _repo.Verify(r => r.DeleteThirdPartyJwtProviderAsync(TenantId, "p1"), Times.Once);
        }

        [Fact]
        public async Task Delete_ReportsNotFound_WhenNothingWasRemoved()
        {
            using var _ = new BlocksTestContext(TenantId);
            _repo.Setup(r => r.DeleteThirdPartyJwtProviderAsync(TenantId, "missing")).ReturnsAsync(false);

            var result = await Service().DeleteThirdPartyJwtProviderAsync(
                new DeleteThirdPartyJwtProviderRequest { ItemId = "missing" });

            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("provider_not_found");
        }

        [Fact]
        public async Task EnablingTheFlag_PublishesATenantCacheUpdate()
        {
            // The flag rides on the cached Tenant, so a bare write would take effect only whenever
            // that cache happened to expire.
            using var _ = new BlocksTestContext(TenantId);

            Tenant? updated = null;
            _repo.Setup(r => r.UpdateProjectAsync(It.IsAny<Tenant>()))
                 .Callback<Tenant>(t => updated = t)
                 .Returns(Task.CompletedTask);

            var result = await Service().UpdateThirdPartyJwtEnabledAsync(
                new UpdateThirdPartyJwtEnabledRequest { IsEnabled = true });

            result.IsSuccess.Should().BeTrue();
            updated!.IsThirdPartyJwtEnabled.Should().BeTrue();
            _tenants.Verify(t => t.UpdateTenantVersionAsync(
                It.Is<TenantCacheUpdateMessage>(m => m.TenantId == TenantId)), Times.Once);
        }
    }
}
