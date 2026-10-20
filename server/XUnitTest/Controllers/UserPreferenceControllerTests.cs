using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using BlocksOs.Api.Controllers;
using DomainService.Preference;
using DomainService.Preference.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace XUnitTest.Controllers
{
    public class UserPreferenceControllerTests
    {
        private readonly Mock<IUserPreferenceService> _service = new();
        private UserPreferenceController Controller() => new(_service.Object);

        [Fact]
        public async Task Get_ReturnsOkWithTheValue()
        {
            var response = new GetUserPreferenceResponse { IsSuccess = true, Key = UserPreferenceKeys.SidebarLayout, Value = "{}" };
            _service.Setup(s => s.GetAsync(It.IsAny<GetUserPreferenceRequest>(), It.IsAny<CancellationToken>())).ReturnsAsync(response);

            var result = await Controller().Get(new GetUserPreferenceRequest { Key = UserPreferenceKeys.SidebarLayout }, CancellationToken.None);

            result.Should().BeOfType<OkObjectResult>().Which.Value.Should().BeSameAs(response);
        }

        [Fact]
        public async Task Get_ReturnsBadRequestForARejectedKey()
        {
            _service.Setup(s => s.GetAsync(It.IsAny<GetUserPreferenceRequest>(), It.IsAny<CancellationToken>()))
                    .ReturnsAsync(new GetUserPreferenceResponse { IsSuccess = false });

            var result = await Controller().Get(new GetUserPreferenceRequest { Key = "nope" }, CancellationToken.None);

            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task Save_MapsTheServiceOutcomeToOkOrBadRequest()
        {
            var request = new SaveUserPreferenceRequest { Key = UserPreferenceKeys.SidebarLayout, Value = "{}" };
            _service.SetupSequence(s => s.SaveAsync(request, It.IsAny<CancellationToken>()))
                    .ReturnsAsync(new BaseResponse { IsSuccess = true })
                    .ReturnsAsync(new BaseResponse { IsSuccess = false, Errors = new Dictionary<string, string> { { "Value", "bad" } } });

            (await Controller().Save(request, CancellationToken.None)).Should().BeOfType<OkObjectResult>();
            (await Controller().Save(request, CancellationToken.None)).Should().BeOfType<BadRequestObjectResult>();
        }
    }
}
