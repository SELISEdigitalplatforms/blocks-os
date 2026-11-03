using Blocks.Genesis;
using Configuration.DomainService.Mail.Mailbox;
using Configuration.DomainService.Mail.Mailbox.Services;
using Configuration.DomainService.Mail.RequestModel;
using Configuration.DomainService.Mail.Services;
using Configuration.DomainService.Mail.Template;
using Configuration.DomainService.Mail.Template.Services;
using Configuration.DomainService.Shared.Services;
using Microsoft.AspNetCore.Mvc;
using System.Diagnostics.CodeAnalysis;

namespace BlocksOs.Api.Controllers
{
    [ApiController]
    [Route("[controller]/[action]")]
    [SuppressMessage("Major Code Smell", "S6960:Controllers should not have mixed responsibilities", Justification = "Splitting would change controller names, Swagger grouping and operation ids that clients rely on.")]
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

        /// <summary>The stored message as an <c>.eml</c> download.</summary>
        [HttpGet]
        [ProtectedEndPoint("blocks-os::mailbox::gets")]
        public async Task<IActionResult> GetMailBoxMailSource([FromQuery] GetMailBoxMailRequest request)
        {
            var result = await _mailboxService!.GetMailBoxMailSourceAsync(request).ConfigureAwait(false);
            if (!result.IsSuccess || result.Content is null)
            {
                return NotFound(new BaseResponse { IsSuccess = false, Errors = result.Errors });
            }

            return FileDownload(result.Content, "message.eml");
        }

        /// <summary>One attachment of the stored message as a download, streamed from the message.</summary>
        [HttpGet]
        [ProtectedEndPoint("blocks-os::mailbox::gets")]
        public async Task<IActionResult> GetMailBoxMailAttachmentFile([FromQuery] GetMailBoxMailAttachmentFileRequest request)
        {
            var result = await _mailboxService!.GetMailBoxMailAttachmentFileAsync(request).ConfigureAwait(false);
            if (!result.IsSuccess || result.Content is null)
            {
                return NotFound(new BaseResponse { IsSuccess = false, Errors = result.Errors });
            }

            return FileDownload(result.Content, result.FileName);
        }

        [Obsolete("Use GetMailBoxMailAttachmentFile.")]
        [SuppressMessage("Info Code Smell", "S1133:Deprecated code should be removed", Justification = "CONTRIBUTING: an old route stays, marked [Obsolete]; routes are never deleted.")]
        [HttpGet]
        [ProtectedEndPoint("blocks-os::mailbox::gets")]
        public async Task<IActionResult> GetMailBoxMailAttachment([FromQuery] GetMailBoxMailAttachmentRequest request)
        {
            var result = await _mailboxService!.GetMailBoxMailAttachmentAsync(request);
            return result.IsSuccess ? Ok(result) : NotFound(result);
        }

        // Mail content is untrusted and may be of any type (an HTML attachment, say), so it is always
        // served as an opaque download: octet-stream, attachment disposition and nosniff (set globally
        // too, and here so the guarantee does not depend on the middleware). The client names and
        // types the saved file itself.
        private FileContentResult FileDownload(byte[] content, string fileName)
        {
            Response.Headers.XContentTypeOptions = "nosniff";
            return File(content, "application/octet-stream", fileName);
        }

        private FileStreamResult FileDownload(Stream content, string fileName)
        {
            Response.Headers.XContentTypeOptions = "nosniff";
            return File(content, "application/octet-stream", fileName);
        }
    }
}
