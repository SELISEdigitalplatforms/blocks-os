using System.Collections.Generic;
using System.Threading.Tasks;
using BlocksOs.Api.Controllers;
using Blocks.Genesis;
using DomainService.ManagedService;
using DomainService.ManagedService.Services;
using DomainService.People;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using DomainService.Access.Services;
using Moq;

namespace XUnitTest.Controllers
{
    public class PeopleControllerTests
    {
        private readonly Mock<IPeopleService> _service = new();

        // The controller gained the access service for the three grant endpoints; these tests
        // exercise the invite/remove ones, so a bare mock is enough.
        private readonly Mock<IProjectAccessService> _access = new();

        private PeopleController Controller() => new(_service.Object, _access.Object);

        [Fact]
        public async Task Invite_NoInvitations_ReturnsBadRequest()
        {
            var result = await Controller().Invite(new InviteRequest { GroupId = "g", Invitations = new() });

            result.Should().BeOfType<BadRequestObjectResult>();
            _service.Verify(s => s.InvitePeoplesAsync(It.IsAny<InviteRequest>()), Times.Never);
        }

        [Fact]
        public async Task Invite_Success_ReturnsOk()
        {
            _service.Setup(s => s.InvitePeoplesAsync(It.IsAny<InviteRequest>()))
                    .ReturnsAsync(new InviteResponse { IsSuccess = true });

            var request = new InviteRequest
            {
                GroupId = "g",
                Invitations = new Dictionary<string, List<EnviromentDetails>>
                {
                    { "a@x.com", new List<EnviromentDetails>() }
                }
            };

            var result = await Controller().Invite(request);

            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task Invite_ServiceFails_ReturnsBadRequest()
        {
            _service.Setup(s => s.InvitePeoplesAsync(It.IsAny<InviteRequest>()))
                    .ReturnsAsync(new InviteResponse { IsSuccess = false });

            var request = new InviteRequest
            {
                GroupId = "g",
                Invitations = new Dictionary<string, List<EnviromentDetails>>
                {
                    { "a@x.com", new List<EnviromentDetails>() }
                }
            };

            var result = await Controller().Invite(request);

            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task RemoveAccess_Success_ReturnsOk()
        {
            _service.Setup(s => s.RemoveAccessFromProjectAsync(It.IsAny<RemoveAccessRequest>()))
                    .ReturnsAsync(new BaseResponse { IsSuccess = true });

            var result = await Controller().RemoveAccess(new RemoveAccessRequest { GroupId = "g" });

            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task RemoveAccess_Failure_ReturnsBadRequest()
        {
            _service.Setup(s => s.RemoveAccessFromProjectAsync(It.IsAny<RemoveAccessRequest>()))
                    .ReturnsAsync(new BaseResponse { IsSuccess = false });

            var result = await Controller().RemoveAccess(new RemoveAccessRequest { GroupId = "g" });

            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task Gets_DelegatesToService()
        {
            var expected = new GetPeoplesResponse { IsSuccess = true };
            _service.Setup(s => s.GetPeoplesAsync(It.IsAny<GetPeoplesRequest>())).ReturnsAsync(expected);

            var response = await Controller().Gets(new GetPeoplesRequest { ProjectGroupId = "g" });

            response.Should().BeSameAs(expected);
        }

        [Fact]
        public async Task ResendInvitation_Success_ReturnsOk()
        {
            _service.Setup(s => s.ResendInvitationAsync(It.IsAny<ResendInvitationRequest>()))
                    .ReturnsAsync(new BaseResponse { IsSuccess = true });

            var result = await Controller().ResendInvitation(new ResendInvitationRequest());

            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task ConfirmInvitation_Success_ReturnsOk()
        {
            _service.Setup(s => s.ConfirmInvitationAsync(It.IsAny<ConfirmInvitationRequest>()))
                    .ReturnsAsync(new ConfirmInvitationResponse { IsSuccess = true });

            var result = await Controller().ConfirmInvitation(new ConfirmInvitationRequest { Code = "c" });

            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task ConfirmInvitation_Failure_ReturnsBadRequest()
        {
            _service.Setup(s => s.ConfirmInvitationAsync(It.IsAny<ConfirmInvitationRequest>()))
                    .ReturnsAsync(new ConfirmInvitationResponse { IsSuccess = false });

            var result = await Controller().ConfirmInvitation(new ConfirmInvitationRequest { Code = "c" });

            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task TransferOwnerShip_Success_ReturnsOk()
        {
            _service.Setup(s => s.TransferOwnershipAsync(It.IsAny<TransferOwnershipRequest>()))
                    .ReturnsAsync(new BaseResponse { IsSuccess = true });

            var result = await Controller().TransferOwnerShip(new TransferOwnershipRequest());

            result.Should().BeOfType<OkObjectResult>();
        }
    }

    public class ServiceControllerTests
    {
        private readonly Mock<IServiceManagement> _service = new();
        private ServiceController Controller() => new(_service.Object);

        [Fact]
        public async Task Register_Success_ReturnsOk()
        {
            _service.Setup(s => s.RegisterServiceAsync(It.IsAny<RegisterServiceRequest>()))
                    .ReturnsAsync(new RegisterServiceResponse { IsSuccess = true });

            var result = await Controller().Register(new RegisterServiceRequest());

            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task Register_Failure_ReturnsBadRequest()
        {
            _service.Setup(s => s.RegisterServiceAsync(It.IsAny<RegisterServiceRequest>()))
                    .ReturnsAsync(new RegisterServiceResponse { IsSuccess = false });

            var result = await Controller().Register(new RegisterServiceRequest());

            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task GetAll_DelegatesToService()
        {
            var expected = new GetAllServiceResponse { TotalCount = 3 };
            _service.Setup(s => s.GetAllServicesAsync(It.IsAny<GetAllServiceRequest>())).ReturnsAsync(expected);

            var response = await Controller().GetAll(new GetAllServiceRequest());

            response.Should().BeSameAs(expected);
        }
    }
}
