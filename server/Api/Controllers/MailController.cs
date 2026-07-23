using Blocks.Genesis;
using Configuration.DomainService.Mail.Mailbox;
using Configuration.DomainService.Mail.Mailbox.Services;
using Configuration.DomainService.Mail.RequestModel;
using Configuration.DomainService.Mail.Template;
using Configuration.DomainService.Mail.Template.Services;
using Configuration.DomainService.Shared.Services;
using Microsoft.AspNetCore.Mvc;

namespace BlocksOs.Api.Controllers
{
    [ApiController]
    [Route("[controller]/[action]")]
    public class MailController : ControllerBase
    {
        private readonly IConfigurationService _configurationService;
        private readonly IMailTemplateService? _mailTemplateService;
        private readonly IMailboxService? _mailboxService;

        public MailController(
            IConfigurationService configurationService,
            IMailTemplateService? mailTemplateService = null,
            IMailboxService? mailboxService = null)
        {
            _configurationService = configurationService;
            _mailTemplateService = mailTemplateService;
            _mailboxService = mailboxService;
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

        [HttpPost]
        [ProtectedEndPoint("blocks-os::mail-template::save")]
        public async Task<IActionResult> SaveTemplate([FromBody] SaveMailTemplateRequest request)
        {
            var result = await _mailTemplateService!.SaveTemplateAsync(request);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        [HttpGet]
        [ProtectedEndPoint("blocks-os::mail-template::gets")]
        public async Task<IActionResult> GetTemplate([FromQuery] GetMailTemplateRequest request)
        {
            var result = await _mailTemplateService!.GetAsync(request);
            if (result == null)
            {
                return NotFound(new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                    {
                        { "Template", "No template found" }
                    }
                });
            }

            return Ok(result);
        }

        [HttpGet]
        [ProtectedEndPoint("blocks-os::mail-template::gets")]
        public async Task<GetAllMailTemplatesResponse> GetTemplates([FromQuery] GetAllMailTemplatesRequest request)
        {
            return await _mailTemplateService!.GetAllTemplatesAsync(request);
        }

        [HttpPost]
        [ProtectedEndPoint("blocks-os::mail-template::save")]
        public async Task<IActionResult> CloneTemplate([FromBody] CloneMailTemplateRequest request)
        {
            var result = await _mailTemplateService!.CloneTemplateAsync(request);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        [HttpDelete]
        [ProtectedEndPoint("blocks-os::mail-template::delete")]
        public async Task<IActionResult> DeleteTemplate([FromQuery] DeleteMailTemplateRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.ItemId))
            {
                return BadRequest(new BaseMutationResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                    {
                        { "ItemId", "Invalid or missing itemId" }
                    }
                });
            }

            var result = await _mailTemplateService!.DeleteAsync(request);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        [HttpGet]
        [ProtectedEndPoint("blocks-os::mailbox::gets")]
        public async Task<IActionResult> GetMailBoxMails([FromQuery] GetMailBoxMailsRequest request)
        {
            var result = await _mailboxService!.GetMailBoxMailsAsync(request);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        [HttpGet]
        [ProtectedEndPoint("blocks-os::mailbox::gets")]
        public async Task<IActionResult> GetMailBoxMail([FromQuery] GetMailBoxMailRequest request)
        {
            var result = await _mailboxService!.GetMailBoxMailAsync(request);
            return result.IsSuccess ? Ok(result) : NotFound(result);
        }
    }
}
