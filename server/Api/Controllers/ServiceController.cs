using DomainService.ManagedService;
using DomainService.ManagedService.Services;
using Microsoft.AspNetCore.Mvc;
using Blocks.Genesis;
using Microsoft.AspNetCore.Authorization;

namespace Api.Controllers
{
    [ApiController]
    [Route("[controller]/[action]")]
    public class ServiceController : ControllerBase
    {
        private readonly IServiceManagement _serviceManagement;

        public ServiceController(IServiceManagement serviceManagement)
        {
            _serviceManagement = serviceManagement;
        }

        // [ProtectedEndPoint("blocks-os::service::register")  ]
        [Authorize]
        [HttpPost]
        public async Task<IActionResult> Register([FromBody] RegisterServiceRequest request)
        {
            var response = await _serviceManagement.RegisterServiceAsync(request);

            if (response.IsSuccess)
            {
                return Ok(response);
            }
            return BadRequest(response);
        }

        // [ProtectedEndPoint("blocks-os::service::get-all")]
        [Authorize]
        [HttpPost]
        public async Task<GetAllServiceResponse> GetAll([FromBody] GetAllServiceRequest request)
        {
            return await _serviceManagement.GetAllServicesAsync(request);
        }
    }
}
