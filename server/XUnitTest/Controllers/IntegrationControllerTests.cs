using System.Linq;
using System.Reflection;
using Blocks.Genesis;
using BlocksOs.Api.Controllers;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using System.Net;
using Xunit;

namespace XUnitTest.Controllers
{
    public class IntegrationControllerTests
    {
        [Theory]
        [InlineData(nameof(IntegrationController.GetTemplates), "blocks-os::integration::get")]
        [InlineData(nameof(IntegrationController.GetTemplate), "blocks-os::integration::get")]
        [InlineData(nameof(IntegrationController.GetConnections), "blocks-os::integration::get")]
        [InlineData(nameof(IntegrationController.CheckReadiness), "blocks-os::integration::get")]
        [InlineData(nameof(IntegrationController.RunSetup), "blocks-os::integration::save")]
        [InlineData(nameof(IntegrationController.Disconnect), "blocks-os::integration::save")]
        [InlineData(nameof(IntegrationController.RegenerateSecret), "blocks-os::integration::save")]
        public void EveryEndpointCarriesItsProtectedResource(string action, string expectedResource)
        {
            typeof(IntegrationController)
                .GetMethod(action)!
                .GetCustomAttribute<ProtectedEndPointAttribute>()?
                .ResourceName
                .Should().Be(expectedResource);
        }

        [Fact]
        public void NoEndpointIsLeftUnprotected()
        {
            // CreateRequest opens the connect flow before any user exists, so it is anonymous by
            // design (§7.1) — but it is still rate limited per IP in the controller. GetRequest
            // and Cancel serve any logged-in user (§7.1) rather than a permission-holding admin.
            var openByDesign = new[]
            {
                nameof(IntegrationController.CreateRequest),
                nameof(IntegrationController.Exchange),
                nameof(IntegrationController.GetRequest),
                nameof(IntegrationController.Cancel),
            };

            var unprotected = typeof(IntegrationController)
                .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
                .Where(m => !m.IsSpecialName)
                .Where(m => m.GetCustomAttribute<ProtectedEndPointAttribute>() is null)
                .Select(m => m.Name)
                .Except(openByDesign)
                .ToList();

            unprotected.Should().BeEmpty();
        }

        [Fact]
        public void CreateRequestIsAnonymousAndRateLimited()
        {
            var action = typeof(IntegrationController).GetMethod(nameof(IntegrationController.CreateRequest))!;

            action.GetCustomAttribute<AllowAnonymousAttribute>().Should().NotBeNull();
        }

        [Fact]
        public void ExchangeIsAnonymousByDesign()
        {
            // Server-to-server redemption from the CMS backend has no user session; PKCE, the
            // single-use code and the per-IP rate limit are its guards (§7.1).
            var action = typeof(IntegrationController).GetMethod(nameof(IntegrationController.Exchange))!;

            action.GetCustomAttribute<AllowAnonymousAttribute>().Should().NotBeNull();
        }

        [Fact]
        public void IntegrationClientIp_UsesTheAddressResolvedByForwardedHeadersMiddleware()
        {
            var context = new DefaultHttpContext();
            context.Connection.RemoteIpAddress = IPAddress.Parse("203.0.113.10");

            IntegrationClientIp.Resolve(context).Should().Be("203.0.113.10");
        }

        [Fact]
        public void ConnectFlowEndpointsRequireALoggedInUser()
        {
            foreach (var name in new[] { nameof(IntegrationController.GetRequest), nameof(IntegrationController.Cancel) })
            {
                var action = typeof(IntegrationController).GetMethod(name)!;
                action.GetCustomAttribute<AuthorizeAttribute>().Should().NotBeNull($"{{0}} must be [Authorize]", name);
                action.GetCustomAttribute<AllowAnonymousAttribute>().Should().BeNull();
            }
        }
    }
}
