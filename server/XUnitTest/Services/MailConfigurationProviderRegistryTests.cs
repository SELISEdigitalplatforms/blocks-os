using Configuration.DomainService.Mail.Entities;
using Configuration.DomainService.Mail.Providers;
using Configuration.DomainService.Mail.RequestModel;
using Configuration.DomainService.Mail.ResponseModel;
using Configuration.DomainService.Shared.Enums;
using FluentAssertions;
using Moq;

namespace XUnitTest.Services
{
    /// <summary>
    /// The registry's own rules, plus the C6 claim: a later provider is selected through
    /// registration alone, with no change to the orchestrator.
    /// </summary>
    public class MailConfigurationProviderRegistryTests
    {
        private static MailConfigurationProviderRegistry Registry(params IMailConfigurationProvider[] definitions) =>
            new(definitions.Length > 0
                ? definitions
                : new IMailConfigurationProvider[]
                {
                    new AmazonSesMailConfigurationProvider(),
                    new ZohoMailConfigurationProvider(),
                    new Office365SmtpMailConfigurationProvider(Mock.Of<Blocks.Secrets.ISecretService>())
                });

        [Theory]
        [InlineData(MailServiceProvider.AmazonSes, false)]
        [InlineData(MailServiceProvider.Zoho, false)]
        [InlineData(MailServiceProvider.Zoho, true)]
        [InlineData(MailServiceProvider.Office365Smtp, false)]
        public void TryResolve_SupportedCombination_ResolvesTheDefinition(MailServiceProvider provider, bool isInbound)
        {
            Registry().TryResolve(provider, isInbound, out var definition, out _).Should().BeTrue();

            definition.Provider.Should().Be(provider);
        }

        [Fact]
        public void TryResolve_Office365Inbound_ReportsTheDirectionError()
        {
            Registry().TryResolve(MailServiceProvider.Office365Smtp, isInbound: true, out _, out var error).Should().BeFalse();

            error.Key.Should().Be("IsInbound");
            error.Value.Should().Be("SMTP Office 365 supports outbound configurations only.");
        }

        [Fact]
        public void TryResolve_UndefinedProvider_ReportsTheProviderError()
        {
            Registry().TryResolve((MailServiceProvider)42, isInbound: false, out _, out var error).Should().BeFalse();

            error.Key.Should().Be("Provider");
            error.Value.Should().Be("Unsupported mail service provider.");
        }

        [Fact]
        public void TryGet_IgnoresDirection()
        {
            // Lifecycle operations on a stored record must resolve even where the request rules
            // would not, otherwise a record written under older direction rules could never have
            // its secret retired.
            Registry().TryGet(MailServiceProvider.Office365Smtp, out var definition).Should().BeTrue();

            definition.SupportedDirections.Should().Be(MailDirections.Outbound);
        }

        [Fact]
        public void Office365_DeclaresItsCapabilities()
        {
            Registry().TryGet(MailServiceProvider.Office365Smtp, out var definition);

            definition.SupportedDirections.Should().Be(MailDirections.Outbound);
            definition.InboundMode.Should().Be(MailInboundMode.None);
            definition.DuplicateInheritsDefault.Should().BeFalse();
        }

        [Fact]
        public void PasswordProviders_OwnNoCredentialAndKeepTheExistingMask()
        {
            var definition = new ZohoMailConfigurationProvider();
            var request = new MailConfiguration { Host = "smtp.zoho.com", Port = 465, EnableSSL = true };

            definition.Normalize(request);

            request.Host.Should().Be("smtp.zoho.com");
            request.Port.Should().Be(465);
            request.EnableSSL.Should().BeTrue();
            request.AuthenticationType.Should().Be(MailAuthenticationType.Password);
            request.SecurityMode.Should().Be(MailSecurityMode.Legacy);

            definition.Validate(request, null).Should().BeEmpty();
            definition.DuplicateInheritsDefault.Should().BeTrue();

            var response = new MailConfigurationResponse();
            definition.ProjectResponse(new MailServerConfiguration(), response);
            response.AccountPassword.Should().Be("********");
        }

        [Fact]
        public void TryResolve_ANewlyRegisteredDefinition_IsSelectedWithoutTouchingTheOrchestrator()
        {
            var stub = new Mock<IMailConfigurationProvider>();
            stub.SetupGet(p => p.Provider).Returns(MailServiceProvider.AmazonSes);
            stub.SetupGet(p => p.SupportedDirections).Returns(MailDirections.Inbound);

            var registry = Registry(stub.Object);

            registry.TryResolve(MailServiceProvider.AmazonSes, isInbound: true, out var definition, out _).Should().BeTrue();
            definition.Should().BeSameAs(stub.Object);

            registry.Definitions.Should().HaveCount(1);
        }
    }
}
