using DomainService.People;
using Microsoft.AspNetCore.Mvc;
using Blocks.Genesis;
using Microsoft.AspNetCore.Authorization;

namespace Api.Controllers
{
    [ApiController]
    [Route("[controller]/[action]")]
    public class PeopleController : ControllerBase
    {
        private readonly IPeopleService _peopleService;

        public PeopleController(IPeopleService peopleService)
        {
            _peopleService = peopleService;
        }


        [HttpPost]
        [ProtectedEndPoint("blocks-os::people::invite")]
        public async Task<IActionResult> Invite([FromBody] InviteRequest requests)
        {
            if (requests.Invitations.Count == 0) return BadRequest(new InviteResponse());

            var result = await _peopleService.InvitePeoplesAsync(requests);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }


        [HttpPost]
        [ProtectedEndPoint("blocks-os::people::remove-access")]
        public async Task<IActionResult> RemoveAccess([FromBody] RemoveAccessRequest command)
        {
            var result = await _peopleService.RemoveAccessFromProjectAsync(command);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }


        [HttpPost]
        [ProtectedEndPoint("blocks-os::people::gets")]
        public async Task<GetPeoplesResponse> Gets([FromBody] GetPeoplesRequest command)
        {
            return await _peopleService.GetPeoplesAsync(command);
        }

        [HttpPost]
        [ProtectedEndPoint("blocks-os::people::resend")]
        public async Task<IActionResult> ResendInvitation([FromBody] ResendInvitationRequest command)
        {
            var result = await _peopleService.ResendInvitationAsync(command);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        [HttpPost]
        public async Task<IActionResult> ConfirmInvitation([FromBody] ConfirmInvitationRequest command)
        {
            var result = await _peopleService.ConfirmInvitationAsync(command);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        [HttpPost]
        [ProtectedEndPoint("blocks-os::people::transfer-owner")]
        public async Task<IActionResult> TransferOwnerShip([FromBody] TransferOwnershipRequest request)
        {
            var result = await _peopleService.TransferOwnershipAsync(request);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }
    }
}