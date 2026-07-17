using BlocksTemplate.Api.Controllers;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Linq;

namespace XUnitTest.Controllers
{
    public class VersionControllerTests
    {
        [Fact]
        public void Get_ReturnsOk()
        {
            // Arrange
            var controller = new VersionController();

            // Act
            var result = controller.Get();

            // Assert
            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public void Get_ReturnsJsonWithVersionProperty()
        {
            // Arrange
            var controller = new VersionController();

            // Act
            var result = controller.Get();

            // Assert
            var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
            var versionProperty = okResult.Value?.GetType().GetProperty("version");
            versionProperty.Should().NotBeNull();
        }

        [Fact]
        public void Get_VersionIsNotNull()
        {
            // Arrange
            var controller = new VersionController();

            // Act
            var result = controller.Get();

            // Assert
            var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
            var version = okResult.Value?.GetType().GetProperty("version")?.GetValue(okResult.Value) as string;
            version.Should().NotBeNullOrWhiteSpace();
        }

        [Fact]
        public void Get_VersionMatchesAssemblyVersion()
        {
            // Arrange
            var controller = new VersionController();
            var expectedVersion = typeof(VersionController).Assembly.GetName().Version?.ToString() ?? "unknown";

            // Act
            var result = controller.Get();

            // Assert
            var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
            var version = okResult.Value?.GetType().GetProperty("version")?.GetValue(okResult.Value) as string;
            version.Should().Be(expectedVersion);
        }

        [Fact]
        public void Get_IsMappedToApiVersionRoute()
        {
            // Arrange
            var controllerRoute = typeof(VersionController)
                .GetCustomAttributes(typeof(RouteAttribute), inherit: false)
                .Cast<RouteAttribute>()
                .Single();

            var actionRoute = typeof(VersionController)
                .GetMethod(nameof(VersionController.Get))!
                .GetCustomAttributes(typeof(RouteAttribute), inherit: false)
                .Cast<RouteAttribute>()
                .Single();

            var httpGet = typeof(VersionController)
                .GetMethod(nameof(VersionController.Get))!
                .GetCustomAttributes(typeof(HttpGetAttribute), inherit: false)
                .Cast<HttpGetAttribute>()
                .Single();

            // Assert
            controllerRoute.Template.Should().Be("[controller]");
            actionRoute.Template.Should().Be("");
            httpGet.Template.Should().BeNull();
        }

        [Fact]
        public void Get_DoesNotRequireAuthentication()
        {
            // Arrange
            var controllerAttributes = typeof(VersionController).GetCustomAttributes(inherit: true);
            var actionAttributes = typeof(VersionController).GetMethod(nameof(VersionController.Get))!.GetCustomAttributes(inherit: true);

            // Assert
            var attributes = controllerAttributes.Concat(actionAttributes).ToList();

            attributes.Should().NotContain(attribute => attribute is AuthorizeAttribute);
            attributes.Select(attribute => attribute.GetType().Name).Should().NotContain("ProtectedEndPointAttribute");
        }
    }
}
