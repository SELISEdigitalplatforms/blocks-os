using System.Linq;
using System.Reflection;
using Blocks.Genesis;
using BlocksOs.Api.Controllers;
using FluentAssertions;
using Xunit;

namespace XUnitTest.Controllers
{
    public class ConnectControllerTests
    {
        [Theory]
        [InlineData(nameof(ConnectController.GetTemplates), "blocks-os::connect::gets")]
        [InlineData(nameof(ConnectController.GetSetup), "blocks-os::connect::gets")]
        [InlineData(nameof(ConnectController.SaveSetup), "blocks-os::connect::save")]
        public void EveryEndpointCarriesItsProtectedResource(string action, string expectedResource)
        {
            typeof(ConnectController)
                .GetMethod(action)!
                .GetCustomAttribute<ProtectedEndPointAttribute>()?
                .ResourceName
                .Should().Be(expectedResource);
        }

        [Fact]
        public void NoEndpointIsLeftUnprotected()
        {
            var unprotected = typeof(ConnectController)
                .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
                .Where(m => !m.IsSpecialName)
                .Where(m => m.GetCustomAttribute<ProtectedEndPointAttribute>() is null)
                .Select(m => m.Name)
                .ToList();

            unprotected.Should().BeEmpty();
        }
    }
}
