using Blocks.Genesis;
using Configuration.DomainService.Connect.Entities;
using Configuration.DomainService.Connect.RequestModel;
using Configuration.DomainService.Connect.Services;
using Microsoft.AspNetCore.Mvc;

namespace BlocksOs.Api.Controllers
{
    /// <summary>
    /// Connect setup endpoints. Routing only; the rules live in <see cref="IConnectService"/>.
    /// </summary>
    /// <remarks>
    /// Protected by their own permissions, like Storage and Notification, so access to Connect can
    /// be granted apart from Secrets. Neither permission is seeded from this repository: both must
    /// exist in IAM for the blocks-os tenant and be assigned to roles, or every call is refused.
    /// </remarks>
    [ApiController]
    [Route("[controller]/[action]")]
    public class ConnectController : ControllerBase
    {
        private readonly IConnectService _connectService;

        public ConnectController(IConnectService connectService)
        {
            _connectService = connectService;
        }

        [HttpGet]
        [ProtectedEndPoint("blocks-os::connect::gets")]
        public Task<List<ConnectTemplate>> GetTemplates() => _connectService.GetTemplatesAsync();

        [HttpGet]
        [ProtectedEndPoint("blocks-os::connect::gets")]
        public async Task<BaseQueryResponse<ConnectSetup>> GetSetup() =>
            new() { Data = await _connectService.GetSetupAsync() };

        [HttpPost]
        [ProtectedEndPoint("blocks-os::connect::save")]
        public async Task<ActionResult<BaseMutationResponse>> SaveSetup([FromBody] SaveConnectSetupRequest request)
        {
            var result = await _connectService.SaveSetupAsync(request);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }
    }
}
