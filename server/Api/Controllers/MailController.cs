using Blocks.Genesis;
using CloudConfiguration.DomainService.Mail.Entities;
using CloudConfiguration.DomainService.Mail.RequestModel;
using CloudConfiguration.DomainService.Shared.Services;
using Microsoft.AspNetCore.Mvc;

namespace BlocksOs.Api.Controllers
{
    [ApiController]
    [Route("[controller]/[action]")]

    public class MailController : ControllerBase
    {
        private readonly IConfigurationService _configurationService;
        public MailController(IConfigurationService configurationService )
        {
            _configurationService = configurationService;
        }

        [HttpPost]
        [ProtectedEndPoint("blocks-os::mail::save")]
        public async Task<IActionResult> Save([FromBody] MailConfiguration request)
        {

            if (string.IsNullOrWhiteSpace(request.ConfigurationId))
            {
                request.ConfigurationId = Guid.NewGuid().ToString();
            }

            var result = await _configurationService.SaveMailConfigurationAsync(request);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        [HttpGet]
        [ProtectedEndPoint("blocks-os::mail::gets")]
        public async Task<IActionResult> Get([FromQuery] GetMailConfigurationRequest request)
        {
            var result = await _configurationService.GetMailConfigurationAsync(request);

            if (result == null)
            {
                return NotFound(new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                    {
                        { "Configuration", "No configuration found" }
                    }
                });
            }

            return Ok(result);
        }

        [HttpGet]
        [ProtectedEndPoint("blocks-os::mail::gets")]
        public async Task<IActionResult> Gets([FromQuery] GetAllMailConfigurationsRequest request)
        {
            var result = await _configurationService.GetAllMailConfigurationsAsync();
            return Ok(result);
        }

        [HttpDelete]
        [ProtectedEndPoint("blocks-os::mail::delete")]
        public async Task<IActionResult> Delete([FromQuery] DeleteMailConfigurationRequest request)
        {

            if (string.IsNullOrWhiteSpace(request.ConfigurationId))
            {
                return BadRequest(new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                    {
                        { "ConfigurationId", "Invalid or missing ConfigurationId" }
                    }
                });
            }

            var result = await _configurationService.DeleteMailConfigurationAsync(request);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        [HttpPost]
        [ProtectedEndPoint("blocks-os::mail::save")]
        public async Task<IActionResult> Duplicate([FromBody] DuplicateMailConfigurationRequest request)
        {

            if (string.IsNullOrWhiteSpace(request.ConfigurationId))
            {
                return BadRequest(new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                    {
                        { "ConfigurationId", "Invalid or missing ConfigurationId" }
                    }
                });
            }

            var result = await _configurationService.DuplicateMailConfigurationAsync(request);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }
    }
}
