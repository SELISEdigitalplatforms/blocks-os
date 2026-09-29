using System.Linq;
using System.Reflection;
using Blocks.Genesis;
using BlocksOs.Api.Controllers;
using FluentAssertions;
using Xunit;

namespace XUnitTest.Controllers
{
    public class IntegrationControllerTests
    {
        [Theory]
        [InlineData(nameof(IntegrationController.GetTemplates), "blocks-os::integration::gets")]
        [InlineData(nameof(IntegrationController.GetSetup), "blocks-os::integration::gets")]
        [InlineData(nameof(IntegrationController.SaveSetup), "blocks-os::integration::save")]
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
            var unprotected = typeof(IntegrationController)
                .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
                .Where(m => !m.IsSpecialName)
                .Where(m => m.GetCustomAttribute<ProtectedEndPointAttribute>() is null)
                .Select(m => m.Name)
                .ToList();

            unprotected.Should().BeEmpty();
        }
    }
}
