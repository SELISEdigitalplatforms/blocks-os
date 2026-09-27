using Blocks.Genesis;
using Configuration.DomainService.Mail.Mailbox;
using Configuration.DomainService.Mail.Mailbox.Services;
using Configuration.DomainService.Mail.RequestModel;
using Configuration.DomainService.Mail.Services;
using Configuration.DomainService.Mail.Template;
using Configuration.DomainService.Mail.Template.Services;
using Configuration.DomainService.Shared.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BlocksOs.Api.Controllers
{
    [ApiController]
    [Route("[controller]/[action]")]
    public class MailController : ControllerBase
    {
        private readonly IMailConfigurationService _mailConfigurationService;
        private readonly IMailTemplateService? _mailTemplateService;
        private readonly IMailboxService? _mailboxService;

        public MailController(
            IMailConfigurationService mailConfigurationService,
            IMailTemplateService? mailTemplateService = null,
            IMailboxService? mailboxService = null)
        {
            _mailConfigurationService = mailConfigurationService;
            _mailTemplateService = mailTemplateService;
            _mailboxService = mailboxService;
        }

        [HttpPost]
        [ProtectedEndPoint("blocks-os::mail::save")]
        public async Task<IActionResult> Save([FromBody] MailConfiguration request)
        {
            // The id is deliberately left as the caller sent it. Minting one here made an empty
            // id indistinguishable from an edit, and the service then allocated a second id for
            // the document, so the id the caller was handed back was never the id of the record.
            var result = await _mailConfigurationService.SaveAsync(request);
            return ToActionResult(result);
        }

        [HttpGet]
        [ProtectedEndPoint("blocks-os::mail::gets")]
        public async Task<IActionResult> Get([FromQuery] GetMailConfigurationRequest request)
        {
            var result = await _mailConfigurationService.GetAsync(request);

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
            var result = await _mailConfigurationService.GetAllAsync();
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

            var result = await _mailConfigurationService.DeleteAsync(request);
            return ToActionResult(result);
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

            var result = await _mailConfigurationService.DuplicateAsync(request);
            return ToActionResult(result);
        }

        /// <summary>
        /// Turns a mail configuration outcome into a status code.
        /// </summary>
        /// <remarks>
        /// Only an unreachable secret store becomes 503. Every other secret failure —
        /// authorization, state, a missing secret — propagates to the global
        /// <c>SecretExceptionFilter</c>, which already classifies it as 403/409/404; collapsing
        /// them all into an availability error would tell an operator to retry something that
        /// will never succeed.
        /// </remarks>
        private IActionResult ToActionResult(MailConfigurationMutationResult result) =>
            result.Outcome switch
            {
                MailConfigurationOutcome.Success => Ok(result.Response),
                MailConfigurationOutcome.SecretStoreUnavailable =>
                    StatusCode(StatusCodes.Status503ServiceUnavailable, result.Response),
                _ => BadRequest(result.Response)
            };

        [HttpPost]
        // [ProtectedEndPoint("blocks-os::mail-template::save")]
        [Authorize]
        public async Task<IActionResult> SaveTemplate([FromBody] SaveMailTemplateRequest request)
        {
            var result = await _mailTemplateService!.SaveTemplateAsync(request);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        [HttpGet]
        // [ProtectedEndPoint("blocks-os::mail-template::gets")]
        [Authorize]
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
        // [ProtectedEndPoint("blocks-os::mail-template::gets")]
        [Authorize]
        public async Task<GetAllMailTemplatesResponse> GetTemplates([FromQuery] GetAllMailTemplatesRequest request)
        {
            return await _mailTemplateService!.GetAllTemplatesAsync(request);
        }

        [HttpPost]
        // [ProtectedEndPoint("blocks-os::mail-template::save")]
        [Authorize]
        public async Task<IActionResult> CloneTemplate([FromBody] CloneMailTemplateRequest request)
        {
            var result = await _mailTemplateService!.CloneTemplateAsync(request);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        [HttpDelete]
        // [ProtectedEndPoint("blocks-os::mail-template::delete")]
        [Authorize]
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
        // [ProtectedEndPoint("blocks-os::mail-template::gets")]
        [Authorize]
        public async Task<IActionResult> LoadTemplatePluginToken(
            [FromQuery] string provider,
            [FromQuery] string uId)
        {
            var result = await _mailTemplateService!.GetTemplatePluginTokenAsync(provider, uId);

            if (result is null)
            {
                return BadRequest(new
                {
                    message = "Unable to load the template plugin token."
                });
            }

            return Ok(result);
        }

        [HttpGet]
        // [ProtectedEndPoint("blocks-os::mailbox::gets")]
        [Authorize]
        public async Task<IActionResult> GetMailBoxMails([FromQuery] GetMailBoxMailsRequest request)
        {
            var result = await _mailboxService!.GetMailBoxMailsAsync(request);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        [HttpGet]
        // [ProtectedEndPoint("blocks-os::mailbox::gets")]
        [Authorize]
        public async Task<IActionResult> GetMailBoxMail([FromQuery] GetMailBoxMailRequest request)
        {
            var result = await _mailboxService!.GetMailBoxMailAsync(request);
            return result.IsSuccess ? Ok(result) : NotFound(result);
        }

        [HttpGet]
        // [ProtectedEndPoint("blocks-os::mailbox::gets")]
        [Authorize]
        public async Task<IActionResult> GetMailBoxMailAttachment([FromQuery] GetMailBoxMailAttachmentRequest request)
        {
            var result = await _mailboxService!.GetMailBoxMailAttachmentAsync(request);
            return result.IsSuccess ? Ok(result) : NotFound(result);
        }
    }
}
