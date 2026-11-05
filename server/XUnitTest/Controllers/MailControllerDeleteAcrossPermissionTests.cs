using System.Reflection;
using Blocks.Genesis;
using BlocksOs.Api.Controllers;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;

namespace XUnitTest.Controllers
{
    /// <summary>blocks-os#736 C10: deleting across organizations needs mail-template::delete, like DeleteTemplate.</summary>
    public class MailControllerDeleteAcrossPermissionTests
    {
        [Fact]
        public void DeleteTemplateAcrossOrganizations_IsAPostProtectedByDelete()
        {
            var action = typeof(MailController).GetMethod(nameof(MailController.DeleteTemplateAcrossOrganizations))!;

            action.GetCustomAttribute<ProtectedEndPointAttribute>()?.ResourceName.Should().Be("blocks-os::mail-template::delete");
            action.GetCustomAttribute<HttpPostAttribute>().Should().NotBeNull();
        }
    }
}
