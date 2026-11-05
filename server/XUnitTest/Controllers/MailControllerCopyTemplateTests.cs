using System.Collections.Generic;
using System.Threading.Tasks;
using Blocks.Genesis;
using BlocksOs.Api.Controllers;
using Configuration.DomainService.Mail.Services;
using Configuration.DomainService.Mail.Template;
using Configuration.DomainService.Mail.Template.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace XUnitTest.Controllers
{
    /// <summary>blocks-os#735: the two copy actions answer 200 on success and 400 with the field errors (Q1 of #733).</summary>
    public class MailControllerCopyTemplateTests
    {
        private readonly Mock<IMailTemplateCopyService> _copies = new();

        private MailController Controller() => new(new Mock<IMailConfigurationService>().Object, mailTemplateCopyService: _copies.Object);

        [Fact]
        public async Task Copy_Success_Is200WithTheJobId()
        {
            var request = new CopyTemplateToOrganizationsRequest { TemplateId = "t", AllOrganizations = true, Existing = "keep" };
            _copies.Setup(c => c.CopyToOrganizationsAsync(request)).ReturnsAsync(new BaseMutationResponse { IsSuccess = true, ItemId = "job-1" });

            var result = await Controller().CopyTemplateToOrganizations(request);

            ((BaseMutationResponse)result.Should().BeOfType<OkObjectResult>().Subject.Value!).ItemId.Should().Be("job-1");
        }

        [Fact]
        public async Task Copy_FieldError_Is400()
        {
            var request = new CopyTemplateToOrganizationsRequest { TemplateId = "acme" };
            _copies.Setup(c => c.CopyToOrganizationsAsync(request)).ReturnsAsync(new BaseMutationResponse
            {
                IsSuccess = false,
                Errors = new Dictionary<string, string> { { "TemplateId", "Only Default organization templates can be copied" } },
            });

            var result = await Controller().CopyTemplateToOrganizations(request);

            ((BaseMutationResponse)result.Should().BeOfType<BadRequestObjectResult>().Subject.Value!).Errors.Should().ContainKey("TemplateId");
        }

        [Fact]
        public async Task Copies_Success_Is200_AndAnErrorIs400()
        {
            var ok = new GetTemplateOrganizationCopiesRequest { TemplateId = "t", OrganizationIds = "acme" };
            var bad = new GetTemplateOrganizationCopiesRequest { TemplateId = "nope" };
            _copies.Setup(c => c.GetOrganizationCopiesAsync(ok)).ReturnsAsync(new GetTemplateOrganizationCopiesResponse { IsSuccess = true });
            _copies.Setup(c => c.GetOrganizationCopiesAsync(bad)).ReturnsAsync(new GetTemplateOrganizationCopiesResponse
            {
                IsSuccess = false,
                Errors = new Dictionary<string, string> { { "TemplateId", "Template not found" } },
            });

            (await Controller().GetTemplateOrganizationCopies(ok)).Should().BeOfType<OkObjectResult>();
            (await Controller().GetTemplateOrganizationCopies(bad)).Should().BeOfType<BadRequestObjectResult>();
        }
    }
}
