using System.Reflection;
using Blocks.Genesis;
using BlocksOs.Api.Controllers;
using FluentAssertions;

namespace XUnitTest.Controllers
{
    /// <summary>blocks-os#735 C11: copying needs mail-template::save, the copies lookup mail-template::gets.</summary>
    public class MailControllerCopyPermissionTests
    {
        [Theory]
        [InlineData(nameof(MailController.CopyTemplateToOrganizations), "blocks-os::mail-template::save")]
        [InlineData(nameof(MailController.GetTemplateOrganizationCopies), "blocks-os::mail-template::gets")]
        public void TheActionIsProtectedByItsPermission(string action, string permission)
        {
            typeof(MailController)
                .GetMethod(action)!
                .GetCustomAttribute<ProtectedEndPointAttribute>()?
                .ResourceName
                .Should().Be(permission);
        }
    }
}
