using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Configuration.DomainService.Captcha.ResponseModel;
using Configuration.DomainService.Shared.Secrets;
using Configuration.DomainService.Shared.Services;
using Configuration.DomainService.Shared.Utilities;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Blocks.Genesis.Entities.Os;

namespace XUnitTest.Secrets
{
    /// <summary>
    /// <see cref="SecretDependentLookup"/>: which configurations a secret is named by, read from the
    /// configurations' own stores and never from the secret.
    /// </summary>
    public class SecretDependentLookupTests
    {
        private readonly Mock<IKeyValueStore> _store = new();
        private readonly Mock<IConfigurationRepository> _repo = new();

        public SecretDependentLookupTests()
        {
            GivenCaptchas();
            _repo.Setup(r => r.GetMailConfigurationsBySecretReferenceAsync(It.IsAny<string>()))
                 .ReturnsAsync(new List<MailServerConfiguration>());
        }

        private SecretDependentLookup Lookup() => new(_store.Object, _repo.Object);

        private void GivenCaptchas(params (string ItemId, string Provider, string? SecretId)[] records) =>
            _store
                .Setup(s => s.GetAllAsync<CaptchaConfigResult>("captcha", null, true, It.IsAny<CancellationToken>()))
                .ReturnsAsync(records
                    .Select(r => new KeyValueItem<CaptchaConfigResult>(
                        r.ItemId,
                        "captcha",
                        new CaptchaConfigResult { Provider = r.Provider, SecretId = r.SecretId },
                        Array.Empty<string>(),
                        DateTime.UtcNow,
                        DateTime.UtcNow,
                        "user-1",
                        "user-1",
                        "org-1"))
                    .ToList());

        [Fact]
        public async Task FindAsync_ReturnsExactlyTheConfigurationsThatReferenceTheSecret()
        {
            GivenCaptchas(("c1", "reCAPTCHA", "s2"), ("c2", "hCaptcha", "s-other"), ("c3", "Turnstile", null));
            _repo.Setup(r => r.GetMailConfigurationsBySecretReferenceAsync("s2"))
                 .ReturnsAsync(new List<MailServerConfiguration>
                 {
                     new() { ItemId = "m2", Name = "Support mailbox", ClientSecretReference = "s2" }
                 });

            var result = await Lookup().FindAsync("s2");

            result.SecretId.Should().Be("s2");
            result.Dependents.Select(d => (d.Kind, d.Id, d.Name)).Should().Equal(
                ("captcha", "c1", "reCAPTCHA"),
                ("mail", "m2", "Support mailbox"));
        }

        [Fact]
        public async Task FindAsync_NamesMailConfigurationsThatUseTheSecretAsTheirPassword()
        {
            // H10: the repository matches either reference field; the lookup names whatever it
            // returns, OAuth client secret and mailbox password alike.
            _repo.Setup(r => r.GetMailConfigurationsBySecretReferenceAsync("pw-1"))
                 .ReturnsAsync(new List<MailServerConfiguration>
                 {
                     new() { ItemId = "z1", Name = "Zoho Primary", AccountPasswordReference = "pw-1" },
                     new() { ItemId = "z1-copy", Name = "Zoho Primary - Copy", AccountPasswordReference = "pw-1" }
                 });

            var result = await Lookup().FindAsync("pw-1");

            result.Dependents.Select(d => (d.Kind, d.Id, d.Name)).Should().Equal(
                ("mail", "z1", "Zoho Primary"),
                ("mail", "z1-copy", "Zoho Primary - Copy"));
        }

        [Fact]
        public async Task FindAsync_UnknownOrForeignId_ReturnsAnEmptyList()
        {
            // Another tenant's records live in another database, which these reads never reach,
            // so a foreign id looks exactly like an unknown one.
            GivenCaptchas(("c1", "reCAPTCHA", "s2"));

            var result = await Lookup().FindAsync("zzz");

            result.SecretId.Should().Be("zzz");
            result.Dependents.Should().BeEmpty();
        }

        [Fact]
        public async Task FindAsync_IsOneReadPerConfigurationStore()
        {
            // C14 holds by construction: the lookup takes no ISecretService, so it can read
            // neither metadata nor a value. It works the same for an active, archived or purged id.
            await Lookup().FindAsync("s2");

            _store.Verify(s => s.GetAllAsync<CaptchaConfigResult>("captcha", null, true, It.IsAny<CancellationToken>()), Times.Once);
            _repo.Verify(r => r.GetMailConfigurationsBySecretReferenceAsync("s2"), Times.Once);
        }

        [Fact]
        public async Task FindAsync_AStoreFailure_Propagates()
        {
            // The client turns a failed lookup into its "couldn't check" notice; an empty answer
            // here would instead claim, wrongly, that nothing uses the secret.
            _repo.Setup(r => r.GetMailConfigurationsBySecretReferenceAsync(It.IsAny<string>()))
                 .ThrowsAsync(new InvalidOperationException("mongo down"));

            var act = () => Lookup().FindAsync("s2");

            await act.Should().ThrowAsync<InvalidOperationException>();
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        public async Task FindAsync_BlankId_IsRejected(string secretId)
        {
            var act = () => Lookup().FindAsync(secretId);

            await act.Should().ThrowAsync<ArgumentException>();
        }

        [Fact]
        public void TheLookupIsRegisteredPerRequestWithTheConfigurationServices()
        {
            var services = new ServiceCollection();

            services.AddConfigurationServices();

            services.Should().ContainSingle(d => d.ServiceType == typeof(ISecretDependentLookup))
                .Which.Should().Match<ServiceDescriptor>(d =>
                    d.ImplementationType == typeof(SecretDependentLookup) && d.Lifetime == ServiceLifetime.Scoped);
        }
    }
}
