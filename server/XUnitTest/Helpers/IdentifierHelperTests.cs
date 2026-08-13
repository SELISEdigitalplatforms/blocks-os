using DomainService.Shared;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Controllers;

namespace XUnitTest.Helpers
{
    public class IdentifierHelperTests
    {
        [Theory]
        [InlineData("https://example.com", true)]
        [InlineData("http://example.com", true)]
        [InlineData("https://sub.example.com/path", true)]
        [InlineData("ftp://example.com", false)]
        [InlineData("example.com", false)]
        [InlineData("not a url", false)]
        [InlineData("", false)]
        public void BeAValidUrl_ReturnsExpected(string url, bool expected)
        {
            IdentifierHelper.BeAValidUrl(url).Should().Be(expected);
        }

        [Theory]
        [InlineData("https://sub.example.com", "example.com")]
        [InlineData("http://a.b.example.co", "example.co")]
        [InlineData("example.com", "example.com")]
        [InlineData("localhost", "localhost")]
        [InlineData("", "")]
        [InlineData("   ", "")]
        public void ExtractMainDomain_ReturnsLastTwoLabels(string input, string expected)
        {
            IdentifierHelper.ExtractMainDomain(input).Should().Be(expected);
        }

        [Theory]
        // A cookie domain on record wins, whether the host sits under it or is it.
        [InlineData("app.example.com", "example.com", "example.com")]
        [InlineData("example.com", "example.com", "example.com")]
        [InlineData("shop.example.co.uk", "example.co.uk", "example.co.uk")]
        // ...but not when it cannot possibly be this host's cookie domain.
        [InlineData("app.example.com", "unrelated.org", "example.com")]
        [InlineData("app.example.com", "ample.com", "example.com")]
        // Nothing on record: the parent of the site host, unless the host is
        // already the registrable domain — the apex case that used to collapse
        // to a bare public suffix.
        [InlineData("app.example.com", "", "example.com")]
        [InlineData("example.com", "", "example.com")]
        [InlineData("example.shop", "", "example.shop")]
        [InlineData("example.co.uk", "", "example.co.uk")]
        [InlineData("app.example.co.uk", "", "example.co.uk")]
        [InlineData("localhost", "", "localhost")]
        [InlineData("", "", "")]
        public void ResolveCookieDomain_ReturnsExpected(string siteHost, string storedCookieDomain, string expected)
        {
            IdentifierHelper.ResolveCookieDomain(siteHost, storedCookieDomain).Should().Be(expected);
        }

        [Theory]
        [InlineData("dev", "d")]
        [InlineData("test", "t")]
        [InlineData("stg", "s")]
        [InlineData("iat", "i")]
        [InlineData("uat", "u")]
        [InlineData("prod-shadow", "h")]
        [InlineData("pre-prod", "r")]
        [InlineData("prod", "p")]
        [InlineData("anything-else", "n")]
        public void EnvironmentMapper_MapsKnownAndUnknown(string env, string expected)
        {
            IdentifierHelper.EnvironmentMapper(env).Should().Be(expected);
        }

        [Theory]
        [InlineData("dev", true)]
        [InlineData("prod", true)]
        [InlineData("pre-prod", true)]
        [InlineData("prod-shadow", true)]
        [InlineData("production", false)]
        [InlineData("", false)]
        public void IsSupportedEnvironment_ReturnsExpected(string env, bool expected)
        {
            IdentifierHelper.IsSupportedEnvironment(env).Should().Be(expected);
        }

        [Theory]
        [InlineData("amqp://<username>:<password>@localhost:5672", true)]
        [InlineData("amqps://<username>:<password>@localhost:5671", true)]
        [InlineData("Endpoint=sb://ns.servicebus.windows.net/;SharedAccessKeyName=x", false)]
        [InlineData("not-a-uri", false)]
        [InlineData("https://example.com", false)]
        public void IsRabbitMq_DetectsAmqpSchemes(string connectionString, bool expected)
        {
            IdentifierHelper.IsRabbitMq(connectionString).Should().Be(expected);
        }

        [Fact]
        public void GetControllerAction_WithoutEndpoint_ReturnsNulls()
        {
            var httpContext = new DefaultHttpContext();

            var (controller, action) = IdentifierHelper.GetControllerAction(httpContext);

            controller.Should().BeNull();
            action.Should().BeNull();
        }

        [Fact]
        public void GetControllerAction_WithEndpoint_ReturnsLowercasedNames()
        {
            var descriptor = new ControllerActionDescriptor
            {
                ControllerName = "Project",
                ActionName = "Create"
            };
            var endpoint = new Endpoint(
                _ => System.Threading.Tasks.Task.CompletedTask,
                new EndpointMetadataCollection(descriptor),
                "test-endpoint");

            var httpContext = new DefaultHttpContext();
            httpContext.SetEndpoint(endpoint);

            var (controller, action) = IdentifierHelper.GetControllerAction(httpContext);

            controller.Should().Be("project");
            action.Should().Be("create");
        }
    }
}
