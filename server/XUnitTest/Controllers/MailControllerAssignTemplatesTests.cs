using System.Collections.Generic;
using System.Threading.Tasks;
using BlocksOs.Api.Controllers;
using Configuration.DomainService.Mail.Services;
using Configuration.DomainService.Mail.Template;
using Configuration.DomainService.Mail.Template.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace XUnitTest.Controllers
{
    /// <summary>blocks-os#734: AssignTemplates answers 200 with the count, and a field error with 400 (Q1 of #733).</summary>
    public class MailControllerAssignTemplatesTests
    {
        private readonly Mock<IMailTemplateService> _templates = new();

        private MailController Controller() => new(new Mock<IMailConfigurationService>().Object, _templates.Object);

        [Fact]
        public async Task Success_Is200WithTheCount()
        {
            var request = new AssignTemplatesRequest { ConfigurationId = "c", AllMatching = true };
            _templates.Setup(t => t.AssignTemplatesAsync(request)).ReturnsAsync(new AssignTemplatesResponse { IsSuccess = true, UpdatedCount = 3 });

            var result = await Controller().AssignTemplates(request);

            var ok = result.Should().BeOfType<OkObjectResult>().Subject;
            ((AssignTemplatesResponse)ok.Value!).UpdatedCount.Should().Be(3);
        }

        [Fact]
        public async Task FieldError_Is400WithTheErrors()
        {
            var request = new AssignTemplatesRequest { ConfigurationId = "nope" };
            _templates.Setup(t => t.AssignTemplatesAsync(request)).ReturnsAsync(new AssignTemplatesResponse
            {
                IsSuccess = false,
                Errors = new Dictionary<string, string> { { "ConfigurationId", "Configuration not found" } },
            });

            var result = await Controller().AssignTemplates(request);

            var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
            ((AssignTemplatesResponse)bad.Value!).Errors.Should().ContainKey("ConfigurationId");
        }
    }
}
