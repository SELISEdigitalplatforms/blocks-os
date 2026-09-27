using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
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

        /// <summary>
        /// Bytes the certificate read returns. Unreachable by default, which is the no-op case:
        /// the provider still saves, only without the descriptive fields.
        /// </summary>
        private IHttpClientFactory _http = HttpFactoryStub.Unreachable();

        private ProjectManagementService Service() => new(
            _repo.Object, _blocksSecret.Object, _messageClient.Object, _configuration,
            _storage.Object, _tenants.Object, _certManager.Object, _encoding.Object, _cache.Object,
            _crypto, _http);

        /// <summary>A self-signed certificate, in the encoding the upload would have stored.</summary>
        private static (byte[] Bytes, string Subject, string Thumbprint, DateTime NotAfter) SampleCertificate(
            string? pkcs12Passphrase = null)
        {
            using var rsa = RSA.Create(2048);
            var request = new CertificateRequest(
                "CN=recyclium-business", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);

            using var certificate = request.CreateSelfSigned(
                DateTimeOffset.UtcNow.AddDays(-1), DateTimeOffset.UtcNow.AddDays(365));

            var bytes = pkcs12Passphrase is null
                ? certificate.Export(X509ContentType.Cert)
                : certificate.Export(X509ContentType.Pkcs12, pkcs12Passphrase);

            return (bytes, certificate.Subject, certificate.Thumbprint, certificate.NotAfter.ToUniversalTime());
        }

        private void ExistingProviders(params ThirdPartyJwtProvider[] providers) =>
            _repo.Setup(r => r.GetThirdPartyJwtProvidersAsync(TenantId)).ReturnsAsync([.. providers]);

        private const string CertificatePath = "https://cdn.example.com/certificates/tenant-1_3rdparty_p1";
        private const string Passphrase = "the-pfx-passphrase";

        /// <summary>An existing asymmetric provider whose key source is a certificate.</summary>
        private static ThirdPartyJwtProvider CertificateProvider(string path, string passwordCipher) => new()
        {
            ItemId = "p1",
            TenantId = TenantId,
            Key = "auth0-a",
            Issuer = Auth0,
            Audiences = ["api-a"],
            Algorithms = [JwtSigningAlgorithm.RS256],
            PublicCertificatePath = path,
            PublicCertificatePasswordCipher = passwordCipher
        };

        private static SaveThirdPartyJwtProviderRequest Request(
            JwtSigningAlgorithm algorithm = JwtSigningAlgorithm.RS256,
            string key = "auth0-a",
            string? issuer = Auth0,
            string[]? audiences = null,
            string? jwksUrl = "https://example.com/.well-known/jwks.json",
            string? secret = null,
            string? certificatePath = null,
            string? certificatePassword = null,
            bool clearCertificatePassword = false,
            string userIdMapping = "sub") => new()
            {
                Key = key,
                ProviderName = "Auth0",
                IsActive = true,
                Issuer = issuer!,
                Audiences = [.. audiences ?? ["api-a"]],
                Algorithms = [algorithm],
                JwksUrl = jwksUrl,
                SigningSecret = secret,
                PublicCertificatePath = certificatePath,
                PublicCertificatePassword = certificatePassword,
                ClearCertificatePassword = clearCertificatePassword,
                ClaimsMapping = new ThirdPartyClaimsMappingRequest { UserId = userIdMapping }
            };

        [Theory]
        [InlineData("auth0-web-primary", "aut***ary")]
        [InlineData("abcdefg", "abc***efg")]
        [InlineData("abcdef", "******")]
        [InlineData("abc", "***")]
        [InlineData("", "")]
        public void MaskProviderKey_HidesTheMiddle_AndMasksShortKeysWhole(string key, string expected)
        {
            // Six characters or fewer have no middle to hide: revealing three either side would
            // show the whole key while claiming to mask it.
            ProjectManagementService.MaskProviderKey(key).Should().Be(expected);
        }

        [Fact]
        public async Task Get_ReturnsTheKeyMasked()
        {
            using var _ = new BlocksTestContext(TenantId);
            ExistingProviders(new ThirdPartyJwtProvider
            {
                ItemId = "p1",
                TenantId = TenantId,
                Key = "auth0-web-primary",
                Issuer = Auth0,
                Algorithms = [JwtSigningAlgorithm.RS256]
            });

            var results = await Service().GetThirdPartyJwtProvidersAsync();

            results.Single().Key.Should().Be("aut***ary");
        }

        [Fact]
        public async Task Update_WithTheMaskedKey_LeavesTheStoredKeyUntouched()
        {
            // The UI only ever saw the mask, so an untouched field comes back as the mask. Writing
            // that literally would rename the provider to "aut***ary" and break every caller.
            using var _ = new BlocksTestContext(TenantId);

            var existing = new ThirdPartyJwtProvider
            {
                ItemId = "p1",
                TenantId = TenantId,
                Key = "auth0-web-primary",
                Issuer = Auth0,
                Audiences = ["api-a"],
                Algorithms = [JwtSigningAlgorithm.RS256]
            };
            ExistingProviders(existing);

            var request = Request(key: "aut***ary");
            request.ItemId = "p1";

            var result = await Service().SaveThirdPartyJwtProviderAsync(request);

            result.IsSuccess.Should().BeTrue();
            _saved.Single().Key.Should().Be("auth0-web-primary");
        }

        [Fact]
        public async Task Update_WithABlankKey_LeavesTheStoredKeyUntouched()
        {
            // The edit form starts the key field empty, the way it does the signing secret, so a
            // save that did not mean to touch the key sends nothing at all.
            using var _ = new BlocksTestContext(TenantId);

            ExistingProviders(new ThirdPartyJwtProvider
            {
                ItemId = "p1",
                TenantId = TenantId,
                Key = "auth0-web-primary",
                Issuer = Auth0,
                Audiences = ["api-a"],
                Algorithms = [JwtSigningAlgorithm.RS256]
            });

            var request = Request(key: "   ");
            request.ItemId = "p1";

            var result = await Service().SaveThirdPartyJwtProviderAsync(request);

            result.IsSuccess.Should().BeTrue();
            _saved.Single().Key.Should().Be("auth0-web-primary");
        }

        [Fact]
        public async Task Create_WithNoKey_IsRefused()
        {
            // Blank only ever means "untouched" against a provider that already has one.
            using var _ = new BlocksTestContext(TenantId);
            ExistingProviders();

            var result = await Service().SaveThirdPartyJwtProviderAsync(Request(key: ""));

            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("key_required");
        }

        [Fact]
        public async Task Update_WithARealNewKey_ReplacesIt()
        {
            using var _ = new BlocksTestContext(TenantId);

            var existing = new ThirdPartyJwtProvider
            {
                ItemId = "p1",
                TenantId = TenantId,
                Key = "auth0-web-primary",
                Issuer = Auth0,
                Audiences = ["api-a"],
                Algorithms = [JwtSigningAlgorithm.RS256]
            };
            ExistingProviders(existing);

            var request = Request(key: "auth0-web-secondary");
            request.ItemId = "p1";

            var result = await Service().SaveThirdPartyJwtProviderAsync(request);

            result.IsSuccess.Should().BeTrue();
            _saved.Single().Key.Should().Be("auth0-web-secondary");
        }

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
        public async Task Rejects_AsymmetricProviderWithoutAnyKeySource()
        {
            using var _ = new BlocksTestContext(TenantId);
            ExistingProviders();

            var result = await Service().SaveThirdPartyJwtProviderAsync(
                Request(jwksUrl: null, certificatePath: null));

            result.Errors.Should().ContainKey("key_source_required");
        }

        [Fact]
        public async Task Rejects_AsymmetricProviderCarryingBothKeySources()
        {
            // Which one got used would come down to the order the code checks them in, and the
            // other would sit there looking configured.
            using var _ = new BlocksTestContext(TenantId);
            ExistingProviders();

            var result = await Service().SaveThirdPartyJwtProviderAsync(
                Request(certificatePath: CertificatePath));

            result.Errors.Should().ContainKey("ambiguous_key_source");
        }

        [Fact]
        public async Task Rejects_HmacProviderCarryingACertificate()
        {
            using var _ = new BlocksTestContext(TenantId);
            ExistingProviders();

            var result = await Service().SaveThirdPartyJwtProviderAsync(Request(
                JwtSigningAlgorithm.HS256,
                jwksUrl: null,
                secret: "the-shared-secret",
                certificatePath: CertificatePath));

            result.Errors.Should().ContainKey("unexpected_certificate");
        }

        [Fact]
        public async Task Rejects_JwksProviderCarryingACertificatePassphrase()
        {
            // A passphrase only ever unlocks a PKCS#12 file, so one alongside a JWKS URL means the
            // form sent something that was never intended.
            using var _ = new BlocksTestContext(TenantId);
            ExistingProviders();

            var result = await Service().SaveThirdPartyJwtProviderAsync(
                Request(certificatePassword: "orphaned-passphrase"));

            result.Errors.Should().ContainKey("unexpected_certificate_password");
        }

        [Fact]
        public async Task Certificate_IsStoredAndItsPassphraseEncrypted()
        {
            using var _ = new BlocksTestContext(TenantId);
            ExistingProviders();

            var result = await Service().SaveThirdPartyJwtProviderAsync(Request(
                jwksUrl: null,
                certificatePath: CertificatePath,
                certificatePassword: Passphrase));

            result.IsSuccess.Should().BeTrue();

            var saved = _saved.Single();
            saved.PublicCertificatePath.Should().Be(CertificatePath);
            saved.JwksUrl.Should().BeEmpty();

            // Never the plaintext, and readable only alongside the tenant salt.
            saved.PublicCertificatePasswordCipher.Should().NotBeNullOrEmpty();
            saved.PublicCertificatePasswordCipher.Should().NotBe(Passphrase);
            _crypto.Decrypt(saved.PublicCertificatePasswordCipher, Salt).Should().Be(Passphrase);
        }

        [Fact]
        public async Task Certificate_WithNoPassphrase_StoresNoCipher()
        {
            // The .crt / .der case: a public key has nothing to protect.
            using var _ = new BlocksTestContext(TenantId);
            ExistingProviders();

            await Service().SaveThirdPartyJwtProviderAsync(
                Request(jwksUrl: null, certificatePath: CertificatePath));

            _saved.Single().PublicCertificatePasswordCipher.Should().BeEmpty();
        }

        [Fact]
        public async Task Update_WithAnEmptyPassphrase_KeepsTheStoredOne()
        {
            // Same contract as the signing secret: the form never saw the passphrase, so it sends
            // back empty, and treating that as a clear would break every load of the certificate.
            using var _ = new BlocksTestContext(TenantId);

            var stored = _crypto.Encrypt(Passphrase, Salt);
            ExistingProviders(CertificateProvider(CertificatePath, stored));

            var request = Request(jwksUrl: null, certificatePath: CertificatePath);
            request.ItemId = "p1";

            await Service().SaveThirdPartyJwtProviderAsync(request);

            _saved.Single().PublicCertificatePasswordCipher.Should().Be(stored);
        }

        [Fact]
        public async Task Update_WithAnExplicitClear_RemovesTheStoredPassphrase()
        {
            // The only way from a protected certificate to an unprotected one: empty on its own
            // cannot mean that, because empty also means "keep what is stored".
            using var _ = new BlocksTestContext(TenantId);
            ExistingProviders(CertificateProvider(CertificatePath, _crypto.Encrypt(Passphrase, Salt)));

            var request = Request(
                jwksUrl: null,
                certificatePath: CertificatePath,
                clearCertificatePassword: true);
            request.ItemId = "p1";

            await Service().SaveThirdPartyJwtProviderAsync(request);

            _saved.Single().PublicCertificatePasswordCipher.Should().BeEmpty();
        }

        [Fact]
        public async Task Update_ToADifferentCertificate_DropsTheOldPassphrase()
        {
            // A passphrase unlocks one specific file. Carrying it over to a different certificate
            // would fail every load of the new one.
            using var _ = new BlocksTestContext(TenantId);
            ExistingProviders(CertificateProvider(
                "https://cdn.example.com/certificates/old",
                _crypto.Encrypt("the-old-passphrase", Salt)));

            var request = Request(
                jwksUrl: null,
                certificatePath: "https://cdn.example.com/certificates/new");
            request.ItemId = "p1";

            await Service().SaveThirdPartyJwtProviderAsync(request);

            _saved.Single().PublicCertificatePasswordCipher.Should().BeEmpty();
        }

        [Fact]
        public async Task SwitchingToJwks_DropsTheCertificateAndItsPassphrase()
        {
            // An unused key source left behind is a dormant signing authority, waiting for the
            // configuration to be switched back.
            using var _ = new BlocksTestContext(TenantId);
            ExistingProviders(CertificateProvider(CertificatePath, _crypto.Encrypt(Passphrase, Salt)));

            var request = Request(jwksUrl: "https://example.com/.well-known/jwks.json");
            request.ItemId = "p1";

            await Service().SaveThirdPartyJwtProviderAsync(request);

            var saved = _saved.Single();
            saved.JwksUrl.Should().Be("https://example.com/.well-known/jwks.json");
            saved.PublicCertificatePath.Should().BeEmpty();
            saved.PublicCertificatePasswordCipher.Should().BeEmpty();
        }

        [Fact]
        public async Task SwitchingToHmac_DropsTheCertificateAndItsPassphrase()
        {
            using var _ = new BlocksTestContext(TenantId);
            ExistingProviders(CertificateProvider(CertificatePath, _crypto.Encrypt(Passphrase, Salt)));

            var request = Request(JwtSigningAlgorithm.HS256, jwksUrl: null, secret: "the-shared-secret");
            request.ItemId = "p1";

            await Service().SaveThirdPartyJwtProviderAsync(request);

            var saved = _saved.Single();
            saved.PublicCertificatePath.Should().BeEmpty();
            saved.PublicCertificatePasswordCipher.Should().BeEmpty();
            saved.SigningSecretCipher.Should().NotBeNullOrEmpty();
        }

        [Fact]
        public async Task Get_ReportsAStoredPassphraseWithoutReturningIt()
        {
            using var _ = new BlocksTestContext(TenantId);
            ExistingProviders(CertificateProvider(CertificatePath, _crypto.Encrypt(Passphrase, Salt)));

            var provider = (await Service().GetThirdPartyJwtProvidersAsync()).Single();

            // The path addresses published key material, so it is safe to show; the passphrase is
            // reduced to the one bit the form needs.
            provider.PublicCertificatePath.Should().Be(CertificatePath);
            provider.HasCertificatePassword.Should().BeTrue();

            typeof(ThirdPartyJwtProviderResult)
                .GetProperty("PublicCertificatePasswordCipher").Should().BeNull();
            typeof(ThirdPartyJwtProviderResult)
                .GetProperty("PublicCertificatePassword").Should().BeNull();
        }

        [Theory]
        [InlineData("p1", "tenant-1_3rdparty_p1")]
        [InlineData("", "tenant-1_3rdparty")]
        [InlineData(null, "tenant-1_3rdparty")]
        [InlineData("../other-tenant", "tenant-1_3rdparty_..other-tenant")]
        [InlineData("a/b", "tenant-1_3rdparty_ab")]
        public void BlobName_ScopesEachProviderAndStripsPathCharacters(string? providerRef, string expected)
        {
            // The reference arrives on a query string and decides which blob is written, so a
            // slash in it could address a slot this tenant and provider do not own. A blank one
            // keeps the single slot that predates multi-provider support.
            CertificateUploadService.BuildBlobName(TenantId, true, providerRef).Should().Be(expected);
        }

        [Fact]
        public void BlobName_IgnoresTheProviderRef_ForATenantsOwnCertificate()
        {
            // A tenant has exactly one certificate of its own, so there is nothing to scope.
            CertificateUploadService.BuildBlobName(TenantId, false, "p1").Should().Be(TenantId);
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

        // ─── optional issuer / issuer-less routing ─────────────────────────────────

        [Fact]
        public async Task Accepts_AProviderWithNoIssuer()
        {
            // Some third parties emit no `iss` at all. Such a provider is reached by the
            // x-blocks-idp header, so its key -- which is always required -- is what names it.
            using var _ = new BlocksTestContext(TenantId);
            ExistingProviders();

            var result = await Service().SaveThirdPartyJwtProviderAsync(
                Request(JwtSigningAlgorithm.HS256, issuer: "", jwksUrl: null, secret: "the-shared-secret"));

            result.IsSuccess.Should().BeTrue();
            _saved.Single().Issuer.Should().BeEmpty();
        }

        [Fact]
        public async Task Accepts_AProviderWithAWhitespaceIssuer_AsBlank()
        {
            // Trimmed to blank rather than stored as spaces, so routing sees one representation.
            using var _ = new BlocksTestContext(TenantId);
            ExistingProviders();

            var result = await Service().SaveThirdPartyJwtProviderAsync(
                Request(JwtSigningAlgorithm.HS256, issuer: "   ", jwksUrl: null, secret: "the-shared-secret"));

            result.IsSuccess.Should().BeTrue();
            _saved.Single().Issuer.Should().BeEmpty();
        }

        [Fact]
        public async Task TwoIssuerlessProviders_CoexistWithoutAudiences()
        {
            // The shared-issuer rule must not fire here. A token with no `iss` carries no `aud`
            // either, so demanding audiences would build the dead provider the rule exists to
            // prevent -- the header separates these two instead.
            using var _ = new BlocksTestContext(TenantId);

            ExistingProviders(new ThirdPartyJwtProvider
            {
                ItemId = "p1",
                TenantId = TenantId,
                Key = "partner-a",
                Issuer = string.Empty,
                Audiences = [],
                IsActive = true,
                Algorithms = [JwtSigningAlgorithm.HS256],
                SigningSecretCipher = "cipher"
            });

            var result = await Service().SaveThirdPartyJwtProviderAsync(Request(
                JwtSigningAlgorithm.HS256,
                key: "partner-b",
                issuer: "",
                audiences: [],
                jwksUrl: null,
                secret: "another-secret"));

            result.IsSuccess.Should().BeTrue();
            result.Errors.Should().BeNullOrEmpty();
        }

        [Fact]
        public async Task AnIssuerlessProvider_CoexistsWithAConfiguredOne()
        {
            // Mixed project: Auth0 alongside a partner whose tokens name no issuer. The two
            // candidate sets are disjoint in Genesis, so neither constrains the other here.
            using var _ = new BlocksTestContext(TenantId);

            ExistingProviders(new ThirdPartyJwtProvider
            {
                ItemId = "p1",
                TenantId = TenantId,
                Key = "auth0-a",
                Issuer = Auth0,
                Audiences = ["api-a"],
                IsActive = true,
                Algorithms = [JwtSigningAlgorithm.RS256],
                JwksUrl = "https://example.com/.well-known/jwks.json"
            });

            var result = await Service().SaveThirdPartyJwtProviderAsync(Request(
                JwtSigningAlgorithm.HS256,
                key: "partner",
                issuer: "",
                audiences: [],
                jwksUrl: null,
                secret: "the-shared-secret"));

            result.IsSuccess.Should().BeTrue();
        }

        [Fact]
        public async Task StillRequiresAudiences_WhenTwoProvidersShareARealIssuer()
        {
            // Unchanged for a declared issuer: relaxing the rule for blank issuers must not relax
            // it for the case it was written for.
            using var _ = new BlocksTestContext(TenantId);

            ExistingProviders(new ThirdPartyJwtProvider
            {
                ItemId = "p1",
                TenantId = TenantId,
                Key = "auth0-a",
                Issuer = Auth0,
                Audiences = ["api-a"],
                IsActive = true,
                Algorithms = [JwtSigningAlgorithm.RS256],
                JwksUrl = "https://example.com/.well-known/jwks.json"
            });

            var result = await Service().SaveThirdPartyJwtProviderAsync(
                Request(key: "auth0-b", audiences: []));

            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("audiences_required_for_shared_issuer");
        }

        [Fact]
        public async Task StillRequiresAKey_WhenTheIssuerIsBlank()
        {
            // The header is the only way to reach an issuer-less provider once there are two, and
            // the key is what the header names -- so it cannot be optional here.
            using var _ = new BlocksTestContext(TenantId);
            ExistingProviders();

            var result = await Service().SaveThirdPartyJwtProviderAsync(Request(
                JwtSigningAlgorithm.HS256,
                key: "",
                issuer: "",
                jwksUrl: null,
                secret: "the-shared-secret"));

            result.Errors.Should().ContainKey("key_required");
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
            provider.Key.Should().Be("aut***0-a");

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
            // that cache happened to expire. Enable also requires at least one active provider.
            using var _ = new BlocksTestContext(TenantId);
            ExistingProviders(ActiveProvider("p1"));

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

        // ─── provider-derived flag + guarded enable (#610) ─────────────────────────

        private static ThirdPartyJwtProvider ActiveProvider(string id, string key = "auth0-a") => new()
        {
            ItemId = id,
            TenantId = TenantId,
            Key = key,
            ProviderName = "Auth0",
            IsActive = true,
            Issuer = Auth0,
            Audiences = ["api-a"],
            Algorithms = [JwtSigningAlgorithm.RS256],
            JwksUrl = "https://example.com/.well-known/jwks.json",
            ClaimsMapping = new ThirdPartyClaimsMapping { UserId = "sub" }
        };

        private void SeedTenantFlag(bool enabled)
        {
            _repo.Setup(r => r.GetByTenantIdAsync(TenantId))
                 .ReturnsAsync(new Tenant
                 {
                     ItemId = TenantId,
                     TenantId = TenantId,
                     TenantSalt = Salt,
                     DbConnectionString = "mongodb://localhost",
                     IsThirdPartyJwtEnabled = enabled,
                     JwtTokenParameters = new JwtTokenParameters
                     {
                         PrivateCertificatePassword = string.Empty,
                         IssueDate = DateTime.UtcNow
                     }
                 });
        }

        [Fact]
        public async Task Save_DeactivatingLastActiveProvider_LowersFlagAndBroadcasts()
        {
            using var _ = new BlocksTestContext(TenantId);
            SeedTenantFlag(enabled: true);

            var existing = ActiveProvider("p1");
            var after = ActiveProvider("p1");
            after.IsActive = false;
            _repo.SetupSequence(r => r.GetThirdPartyJwtProvidersAsync(TenantId))
                 .ReturnsAsync(new List<ThirdPartyJwtProvider> { existing })
                 .ReturnsAsync(new List<ThirdPartyJwtProvider> { after });

            Tenant? updated = null;
            _repo.Setup(r => r.UpdateProjectAsync(It.IsAny<Tenant>()))
                 .Callback<Tenant>(t => updated = t)
                 .Returns(Task.CompletedTask);

            var request = Request(jwksUrl: "https://example.com/.well-known/jwks.json");
            request.ItemId = "p1";
            request.IsActive = false;
            request.Key = "auth0-a";

            var result = await Service().SaveThirdPartyJwtProviderAsync(request);

            result.IsSuccess.Should().BeTrue();
            updated!.IsThirdPartyJwtEnabled.Should().BeFalse();
            _tenants.Verify(t => t.UpdateTenantVersionAsync(
                It.Is<TenantCacheUpdateMessage>(m => m.TenantId == TenantId)), Times.Once);
        }

        [Fact]
        public async Task Save_DeactivatingNonLastActiveProvider_LeavesFlagUntouched()
        {
            using var _ = new BlocksTestContext(TenantId);
            SeedTenantFlag(enabled: true);

            var a = ActiveProvider("p1");
            var b = ActiveProvider("p2", key: "auth0-b");
            var aInactive = ActiveProvider("p1");
            aInactive.IsActive = false;

            _repo.SetupSequence(r => r.GetThirdPartyJwtProvidersAsync(TenantId))
                 .ReturnsAsync(new List<ThirdPartyJwtProvider> { a, b })
                 .ReturnsAsync(new List<ThirdPartyJwtProvider> { aInactive, b });

            var request = Request(jwksUrl: "https://example.com/.well-known/jwks.json");
            request.ItemId = "p1";
            request.IsActive = false;
            request.Key = "auth0-a";

            var result = await Service().SaveThirdPartyJwtProviderAsync(request);

            result.IsSuccess.Should().BeTrue();
            _repo.Verify(r => r.UpdateProjectAsync(It.IsAny<Tenant>()), Times.Never);
            _tenants.Verify(t => t.UpdateTenantVersionAsync(It.IsAny<TenantCacheUpdateMessage>()), Times.Never);
        }

        [Fact]
        public async Task Delete_WhenTenantMissingAfterDelete_ReturnsProjectNotFound()
        {
            using var _ = new BlocksTestContext(TenantId);
            _repo.Setup(r => r.DeleteThirdPartyJwtProviderAsync(TenantId, "p1")).ReturnsAsync(true);
            _repo.Setup(r => r.GetByTenantIdAsync(TenantId)).ReturnsAsync((Tenant?)null);

            var result = await Service().DeleteThirdPartyJwtProviderAsync(
                new DeleteThirdPartyJwtProviderRequest { ItemId = "p1" });

            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("project_not_found");
            _repo.Verify(r => r.UpdateProjectAsync(It.IsAny<Tenant>()), Times.Never);
        }

        [Fact]
        public async Task Delete_LastActiveProvider_LowersFlagAndBroadcasts()
        {
            using var _ = new BlocksTestContext(TenantId);
            SeedTenantFlag(enabled: true);
            _repo.Setup(r => r.DeleteThirdPartyJwtProviderAsync(TenantId, "p1")).ReturnsAsync(true);
            ExistingProviders(); // post-delete: empty

            Tenant? updated = null;
            _repo.Setup(r => r.UpdateProjectAsync(It.IsAny<Tenant>()))
                 .Callback<Tenant>(t => updated = t)
                 .Returns(Task.CompletedTask);

            var result = await Service().DeleteThirdPartyJwtProviderAsync(
                new DeleteThirdPartyJwtProviderRequest { ItemId = "p1" });

            result.IsSuccess.Should().BeTrue();
            updated!.IsThirdPartyJwtEnabled.Should().BeFalse();
            _tenants.Verify(t => t.UpdateTenantVersionAsync(
                It.Is<TenantCacheUpdateMessage>(m => m.TenantId == TenantId)), Times.Once);
        }

        [Fact]
        public async Task Save_NeverRaisesFlag_WhenProvidersRemainActive()
        {
            using var _ = new BlocksTestContext(TenantId);
            SeedTenantFlag(enabled: false);

            var a = ActiveProvider("p1");
            var b = ActiveProvider("p2", key: "auth0-b");
            _repo.SetupSequence(r => r.GetThirdPartyJwtProvidersAsync(TenantId))
                 .ReturnsAsync(new List<ThirdPartyJwtProvider> { a, b })
                 .ReturnsAsync(new List<ThirdPartyJwtProvider> { a, b });

            var request = Request(jwksUrl: "https://example.com/.well-known/jwks.json");
            request.ItemId = "p1";
            request.ProviderName = "Renamed";
            request.Key = "auth0-a";

            var result = await Service().SaveThirdPartyJwtProviderAsync(request);

            result.IsSuccess.Should().BeTrue();
            _repo.Verify(r => r.UpdateProjectAsync(It.IsAny<Tenant>()), Times.Never);
            _tenants.Verify(t => t.UpdateTenantVersionAsync(It.IsAny<TenantCacheUpdateMessage>()), Times.Never);
        }

        [Fact]
        public async Task Enable_WithNoActiveProvider_ReturnsNoActiveProvider()
        {
            using var _ = new BlocksTestContext(TenantId);
            SeedTenantFlag(enabled: false);
            var inactive = ActiveProvider("p1");
            inactive.IsActive = false;
            ExistingProviders(inactive);

            var result = await Service().UpdateThirdPartyJwtEnabledAsync(
                new UpdateThirdPartyJwtEnabledRequest { IsEnabled = true });

            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("no_active_provider");
            _repo.Verify(r => r.UpdateProjectAsync(It.IsAny<Tenant>()), Times.Never);
            _tenants.Verify(t => t.UpdateTenantVersionAsync(It.IsAny<TenantCacheUpdateMessage>()), Times.Never);
        }

        [Fact]
        public async Task Disable_IsNeverGuarded()
        {
            using var _ = new BlocksTestContext(TenantId);
            SeedTenantFlag(enabled: true);
            ExistingProviders(ActiveProvider("p1"), ActiveProvider("p2", key: "auth0-b"));

            Tenant? updated = null;
            _repo.Setup(r => r.UpdateProjectAsync(It.IsAny<Tenant>()))
                 .Callback<Tenant>(t => updated = t)
                 .Returns(Task.CompletedTask);

            var result = await Service().UpdateThirdPartyJwtEnabledAsync(
                new UpdateThirdPartyJwtEnabledRequest { IsEnabled = false });

            result.IsSuccess.Should().BeTrue();
            updated!.IsThirdPartyJwtEnabled.Should().BeFalse();
            _tenants.Verify(t => t.UpdateTenantVersionAsync(
                It.Is<TenantCacheUpdateMessage>(m => m.TenantId == TenantId)), Times.Once);
        }

        [Fact]
        public async Task Save_WhenFlagAlreadyFalseAndCountZero_SkipsTenantWrite()
        {
            using var _ = new BlocksTestContext(TenantId);
            SeedTenantFlag(enabled: false);

            var request = Request(jwksUrl: "https://example.com/.well-known/jwks.json");
            request.IsActive = false;

            // post-write still zero actives (new inactive provider)
            var inactiveNew = ActiveProvider("new");
            inactiveNew.IsActive = false;
            _repo.SetupSequence(r => r.GetThirdPartyJwtProvidersAsync(TenantId))
                 .ReturnsAsync(new List<ThirdPartyJwtProvider>())
                 .ReturnsAsync(new List<ThirdPartyJwtProvider> { inactiveNew });

            var result = await Service().SaveThirdPartyJwtProviderAsync(request);

            result.IsSuccess.Should().BeTrue();
            _repo.Verify(r => r.UpdateProjectAsync(It.IsAny<Tenant>()), Times.Never);
            _tenants.Verify(t => t.UpdateTenantVersionAsync(It.IsAny<TenantCacheUpdateMessage>()), Times.Never);
        }

        [Fact]
        public async Task Save_FirstActiveProvider_LeavesFlagFalse()
        {
            using var _ = new BlocksTestContext(TenantId);
            SeedTenantFlag(enabled: false);
            _repo.SetupSequence(r => r.GetThirdPartyJwtProvidersAsync(TenantId))
                 .ReturnsAsync(new List<ThirdPartyJwtProvider>())
                 .ReturnsAsync(new List<ThirdPartyJwtProvider> { ActiveProvider("new") });

            var result = await Service().SaveThirdPartyJwtProviderAsync(
                Request(jwksUrl: "https://example.com/.well-known/jwks.json"));

            result.IsSuccess.Should().BeTrue();
            _repo.Verify(r => r.UpdateProjectAsync(It.IsAny<Tenant>()), Times.Never);
            _tenants.Verify(t => t.UpdateTenantVersionAsync(It.IsAny<TenantCacheUpdateMessage>()), Times.Never);
        }

        [Fact]
        public async Task Save_WhenFlagUpdateThrows_ReturnsThirdPartyFlagUpdateFailed()
        {
            using var _ = new BlocksTestContext(TenantId);
            SeedTenantFlag(enabled: true);
            var existing = ActiveProvider("p1");
            var after = ActiveProvider("p1");
            after.IsActive = false;
            _repo.SetupSequence(r => r.GetThirdPartyJwtProvidersAsync(TenantId))
                 .ReturnsAsync(new List<ThirdPartyJwtProvider> { existing })
                 .ReturnsAsync(new List<ThirdPartyJwtProvider> { after });

            _repo.Setup(r => r.UpdateProjectAsync(It.IsAny<Tenant>()))
                 .ThrowsAsync(new InvalidOperationException("root db unavailable"));

            var request = Request(jwksUrl: "https://example.com/.well-known/jwks.json");
            request.ItemId = "p1";
            request.IsActive = false;
            request.Key = "auth0-a";

            var result = await Service().SaveThirdPartyJwtProviderAsync(request);

            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("third_party_flag_update_failed");
            _saved.Should().ContainSingle(); // provider write committed
        }

        // ─── certificate metadata, read at save ────────────────────────────────────

        [Fact]
        public async Task Certificate_MetadataIsRecordedAtSave()
        {
            // The blob is named after the tenant and provider, so without reading the file there
            // is nothing in the configuration an operator can match against what they were sent.
            using var _ = new BlocksTestContext(TenantId);
            ExistingProviders();

            var sample = SampleCertificate();
            _http = HttpFactoryStub.Serving(sample.Bytes);

            var result = await Service().SaveThirdPartyJwtProviderAsync(
                Request(jwksUrl: null, certificatePath: CertificatePath));

            result.IsSuccess.Should().BeTrue();

            var saved = _saved.Single();
            saved.CertificateSubject.Should().Be(sample.Subject);
            saved.CertificateThumbprint.Should().Be(sample.Thumbprint);
            saved.CertificateNotAfter.Should().BeCloseTo(sample.NotAfter, TimeSpan.FromSeconds(1));
        }

        [Fact]
        public async Task Certificate_MetadataIsReadThroughAPassphrase()
        {
            using var _ = new BlocksTestContext(TenantId);
            ExistingProviders();

            var sample = SampleCertificate(Passphrase);
            _http = HttpFactoryStub.Serving(sample.Bytes);

            var result = await Service().SaveThirdPartyJwtProviderAsync(Request(
                jwksUrl: null,
                certificatePath: CertificatePath,
                certificatePassword: Passphrase));

            result.IsSuccess.Should().BeTrue();
            _saved.Single().CertificateSubject.Should().Be(sample.Subject);
        }

        [Fact]
        public async Task Certificate_WithAMismatchedPassphrase_IsRefusedAtSave()
        {
            // The whole point of reading it here. Otherwise this surfaces as a 401 on a perfectly
            // valid token, long after the form that could have corrected it has closed.
            using var _ = new BlocksTestContext(TenantId);
            ExistingProviders();

            _http = HttpFactoryStub.Serving(SampleCertificate("the-real-passphrase").Bytes);

            var result = await Service().SaveThirdPartyJwtProviderAsync(Request(
                jwksUrl: null,
                certificatePath: CertificatePath,
                certificatePassword: "not-the-passphrase"));

            result.IsSuccess.Should().BeFalse();
            result.Errors.Should().ContainKey("certificate_unreadable");
            _saved.Should().BeEmpty();
        }

        [Fact]
        public async Task Certificate_ThatIsNotACertificate_IsRefusedAtSave()
        {
            using var _ = new BlocksTestContext(TenantId);
            ExistingProviders();

            _http = HttpFactoryStub.Serving([1, 2, 3, 4, 5]);

            var result = await Service().SaveThirdPartyJwtProviderAsync(
                Request(jwksUrl: null, certificatePath: CertificatePath));

            result.Errors.Should().ContainKey("certificate_unreadable");
            _saved.Should().BeEmpty();
        }

        [Fact]
        public async Task Certificate_ThatCannotBeFetched_StillSaves()
        {
            // A momentarily unreachable blob must not block configuration. Genesis reports the
            // same fetch problem if it persists.
            using var _ = new BlocksTestContext(TenantId);
            ExistingProviders();

            _http = HttpFactoryStub.Unreachable();

            var result = await Service().SaveThirdPartyJwtProviderAsync(
                Request(jwksUrl: null, certificatePath: CertificatePath));

            result.IsSuccess.Should().BeTrue();

            var saved = _saved.Single();
            saved.PublicCertificatePath.Should().Be(CertificatePath);
            saved.CertificateSubject.Should().BeEmpty();
            saved.CertificateNotAfter.Should().BeNull();
        }

        [Fact]
        public async Task SwitchingToJwks_ClearsTheCertificateMetadata()
        {
            using var _ = new BlocksTestContext(TenantId);

            var stale = CertificateProvider(CertificatePath, string.Empty);
            stale.CertificateSubject = "CN=recyclium-business";
            stale.CertificateThumbprint = "AABBCC";
            stale.CertificateNotAfter = DateTime.UtcNow.AddDays(10);
            ExistingProviders(stale);

            var request = Request(jwksUrl: "https://example.com/.well-known/jwks.json");
            request.ItemId = "p1";

            await Service().SaveThirdPartyJwtProviderAsync(request);

            var saved = _saved.Single();
            saved.CertificateSubject.Should().BeEmpty();
            saved.CertificateThumbprint.Should().BeEmpty();
            saved.CertificateNotAfter.Should().BeNull();
        }

        [Fact]
        public async Task Get_ReturnsTheCertificateMetadata()
        {
            using var _ = new BlocksTestContext(TenantId);

            var provider = CertificateProvider(CertificatePath, string.Empty);
            provider.CertificateSubject = "CN=recyclium-business";
            provider.CertificateThumbprint = "AABBCC";
            provider.CertificateNotAfter = new DateTime(2027, 9, 8, 17, 23, 10, DateTimeKind.Utc);
            ExistingProviders(provider);

            var result = (await Service().GetThirdPartyJwtProvidersAsync()).Single();

            result.CertificateSubject.Should().Be("CN=recyclium-business");
            result.CertificateThumbprint.Should().Be("AABBCC");
            result.CertificateNotAfter.Should().Be(provider.CertificateNotAfter);
        }

    }
}
