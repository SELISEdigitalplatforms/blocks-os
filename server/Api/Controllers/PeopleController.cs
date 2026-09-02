using DomainService.Access;
using DomainService.Access.Services;
using DomainService.People;
using Microsoft.AspNetCore.Mvc;
using Blocks.Genesis;
using Microsoft.AspNetCore.Authorization;

namespace BlocksOs.Api.Controllers
{
    [ApiController]
    [Route("[controller]/[action]")]
    public class PeopleController : ControllerBase
    {
        private readonly IPeopleService _peopleService;
        private readonly IProjectAccessService _accessService;

        public PeopleController(IPeopleService peopleService, IProjectAccessService accessService)
        {
            _peopleService = peopleService;
            _accessService = accessService;
        }


        [HttpPost]
        [ProtectedEndPoint("blocks-os::people::invite")]
        [ProjectPolicy("people::invite")]
        public async Task<IActionResult> Invite([FromBody] InviteRequest requests)
        {
            if (requests.Invitations.Count == 0) return BadRequest(new InviteResponse());

            var result = await _peopleService.InvitePeoplesAsync(requests);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }


        [HttpPost]
        [ProtectedEndPoint("blocks-os::people::remove-access")]
        [ProjectPolicy("people::remove")]
        public async Task<IActionResult> RemoveAccess([FromBody] RemoveAccessRequest command)
        {
            var result = await _peopleService.RemoveAccessFromProjectAsync(command);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }


        [HttpPost]
        [ProtectedEndPoint("blocks-os::people::gets")]
        [ProjectPolicy("people::view")]
        public async Task<GetPeoplesResponse> Gets([FromBody] GetPeoplesRequest command)
        {
            return await _peopleService.GetPeoplesAsync(command);
        }

        [HttpPost]
        [ProtectedEndPoint("blocks-os::people::resend")]
        [ProjectPolicy("people::invite")]
        public async Task<IActionResult> ResendInvitation([FromBody] ResendInvitationRequest command)
        {
            var result = await _peopleService.ResendInvitationAsync(command);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        // Public by design: a brand-new invitee has no account yet and cannot authenticate,
        // so this endpoint is intentionally anonymous.
        [HttpPost]
        [AllowAnonymous]
        public async Task<IActionResult> ConfirmInvitation([FromBody] ConfirmInvitationRequest command)
        {
            var result = await _peopleService.ConfirmInvitationAsync(command);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        [HttpPost]
        [ProtectedEndPoint("blocks-os::people::transfer-owner")]
        [ProjectPolicy(OwnerOnly = true)]
        public async Task<IActionResult> TransferOwnerShip([FromBody] TransferOwnershipRequest request)
        {
            var result = await _peopleService.TransferOwnershipAsync(request);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }


        // ── Project access ──────────────────────────────────────────────────────
        // These live on PeopleController because the subject is a ProjectPeoples row.

        /// <summary>
        /// What the caller may see and do in one project group.
        /// </summary>
        /// <remarks>
        /// Deliberately <c>[Authorize]</c> only, with no resource name and no project policy: it
        /// is scoped to the caller's own access, and a member who lacks some permission still has
        /// to be able to ask what they may do or the frontend cannot render at all. Gating this
        /// behind a grant would be circular.
        /// </remarks>
        [HttpGet]
        [Authorize]
        public async Task<GetMyAccessResponse> GetMyAccess([FromQuery] GetMyAccessRequest request)
        {
            return await _accessService.GetMyAccessAsync(request.ProjectGroupId, HttpContext.RequestAborted);
        }

        /// <summary>Owner-only, always — a grant must never be able to widen itself.</summary>
        [HttpPost]
        [Authorize]
        [ProjectPolicy(OwnerOnly = true)]
        public async Task<IActionResult> SaveAccessPolicy([FromBody] SaveAccessPolicyRequest request)
        {
            var result = await _accessService.SaveAccessPolicyAsync(request, HttpContext.RequestAborted);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }
    }
}