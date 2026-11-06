using Blocks.Genesis;
using Configuration.DomainService.Mail.RequestModel;
using Configuration.DomainService.Mail.Services;
using Microsoft.AspNetCore.Mvc;

namespace BlocksOs.Api.Controllers
{
    /// <summary>
    /// <c>GET Mail/GetConfigurationUsage</c>: how many templates name a mail configuration, so the
    /// console can say what a delete affects.
    /// </summary>
    /// <remarks>
    /// Served under the Mail route like the other mail configuration actions, but kept out of
    /// <see cref="MailController"/>, which already carries three responsibilities (configurations,
    /// templates, mailbox) and is flagged for it.
    /// </remarks>
    [ApiController]
    [Route("Mail/[action]")]
    public class MailConfigurationUsageController : ControllerBase
    {
        private readonly IMailConfigurationService _mailConfigurationService;

        public MailConfigurationUsageController(IMailConfigurationService mailConfigurationService)
        {
            _mailConfigurationService = mailConfigurationService;
        }

        /// <summary>Unknown id: HTTP 400 with <c>errors.ConfigurationId</c>, like the other mail field errors.</summary>
        [HttpGet]
        [ProtectedEndPoint("blocks-os::mail::gets")]
        public async Task<IActionResult> GetConfigurationUsage([FromQuery] GetMailConfigurationUsageRequest request)
        {
            var result = await _mailConfigurationService.GetUsageAsync(request);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }
    }
}
