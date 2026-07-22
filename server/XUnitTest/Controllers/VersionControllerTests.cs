using System.Reflection;
using BlocksOs.Api.Controllers;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;

namespace XUnitTest.Controllers
{
    public class VersionControllerTests
    {
        [Fact]
        public void Get_ReturnsRunningAssemblyVersion()
        {
            var expected = typeof(VersionController).Assembly.GetName().Version?.ToString() ?? "unknown";

            var result = new VersionController().Get();

            var ok = result.Should().BeOfType<OkObjectResult>().Subject;
            var body = ok.Value.Should().BeOfType<VersionResponse>().Subject;
            body.Version.Should().Be(expected);
            body.Version.Should().NotBeNullOrWhiteSpace();
        }
    }
}
