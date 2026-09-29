using Blocks.Genesis;
using Configuration.DomainService.Integration.Entities;
using Configuration.DomainService.Integration.RequestModel;
using Configuration.DomainService.Integration.Services;
using Microsoft.AspNetCore.Mvc;

namespace BlocksOs.Api.Controllers
{
    /// <summary>
    /// Integration setup endpoints. Routing only; the rules live in <see cref="IIntegrationService"/>.
    /// </summary>
    /// <remarks>
    /// Protected by their own permissions, like Storage and Notification, so access to Integration can
    /// be granted apart from Secrets. Neither permission is seeded from this repository: both must
    /// exist in IAM for the blocks-os tenant and be assigned to roles, or every call is refused.
    /// </remarks>
    [ApiController]
    [Route("[controller]/[action]")]
    public class IntegrationController : ControllerBase
    {
        private readonly IIntegrationService _integrationService;

        public IntegrationController(IIntegrationService integrationService)
        {
            _integrationService = integrationService;
        }

        [HttpGet]
        [ProtectedEndPoint("blocks-os::integration::gets")]
        public Task<List<IntegrationTemplate>> GetTemplates() => _integrationService.GetTemplatesAsync();

        [HttpGet]
        [ProtectedEndPoint("blocks-os::integration::gets")]
        public async Task<BaseQueryResponse<IntegrationSetup>> GetSetup() =>
            new() { Data = await _integrationService.GetSetupAsync() };

        [HttpPost]
        [ProtectedEndPoint("blocks-os::integration::save")]
        public async Task<ActionResult<BaseMutationResponse>> SaveSetup([FromBody] SaveIntegrationSetupRequest request)
        {
            var result = await _integrationService.SaveSetupAsync(request);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }
    }
}
