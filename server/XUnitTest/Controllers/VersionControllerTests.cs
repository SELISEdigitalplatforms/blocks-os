using System;
using System.Linq;
using BlocksTemplate.Api.Controllers;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace XUnitTest.Controllers
{
    public class VersionControllerTests
    {
        private VersionController Controller() => new();

        [Fact]
        public void Get_ReturnsOk()
        {
            var result = Controller().Get();

            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public void Get_ReturnsJsonWithVersionProperty()
        {
            var result = Controller().Get() as OkObjectResult;

            result.Should().NotBeNull();
            var value = result!.Value;
            value.Should().NotBeNull();

            var versionProperty = value!.GetType().GetProperty("version");
            versionProperty.Should().NotBeNull("response should have a 'version' property");
        }

        [Fact]
        public void Get_VersionIsNotEmpty()
        {
            var result = Controller().Get() as OkObjectResult;
            var value = result!.Value!;
            var version = value.GetType().GetProperty("version")!.GetValue(value) as string;

            version.Should().NotBeNullOrEmpty();
        }

        [Fact]
        public void Get_VersionMatchesApiAssemblyVersion()
        {
            var result = Controller().Get() as OkObjectResult;
            var value = result!.Value!;
            var returnedVersion = value.GetType().GetProperty("version")!.GetValue(value) as string;

            var expectedVersion = typeof(VersionController).Assembly.GetName().Version?.ToString() ?? "unknown";

            returnedVersion.Should().Be(expectedVersion);
        }

        [Fact]
        public void Controller_RoutesToApiVersionThroughGlobalPrefix()
        {
            var controllerRoute = typeof(VersionController)
                .GetCustomAttributes(typeof(RouteAttribute), false)
                .Cast<RouteAttribute>()
                .SingleOrDefault();
            var httpGet = typeof(VersionController).GetMethod(nameof(VersionController.Get))!
                .GetCustomAttributes(typeof(HttpGetAttribute), false)
                .Cast<HttpGetAttribute>()
                .SingleOrDefault();

            controllerRoute.Should().NotBeNull();
            controllerRoute!.Template.Should().Be("[controller]");
            httpGet.Should().NotBeNull();
            httpGet!.Template.Should().BeNullOrEmpty("the action should not add /get to the route, so the global /api prefix produces /api/version");
        }

        [Fact]
        public void Controller_DoesNotRequireAuthentication()
        {
            var controllerAttributes = typeof(VersionController).GetCustomAttributes(inherit: true);
            var actionAttributes = typeof(VersionController).GetMethod(nameof(VersionController.Get))!
                .GetCustomAttributes(inherit: true);
            var allAttributes = controllerAttributes.Concat(actionAttributes).ToList();

            allAttributes.Should().NotContain(attribute =>
                attribute.GetType().Name.Equals("AuthorizeAttribute", StringComparison.Ordinal) ||
                attribute.GetType().Name.Equals("ProtectedEndPointAttribute", StringComparison.Ordinal));
        }
    }
}
