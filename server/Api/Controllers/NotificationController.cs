using Blocks.Genesis;
using Configuration.DomainService.Notification.Entities;
using Configuration.DomainService.Notification.RequestModel;
using Configuration.DomainService.Notification.ResponseModel;
using Configuration.DomainService.Shared.Services;
using Microsoft.AspNetCore.Mvc;

namespace BlocksOs.Api.Controllers
{
    [ApiController]
    [Route("[controller]/[action]")]
    public class NotificationController : ControllerBase
    {
        private readonly IConfigurationService _configurationService;

        public NotificationController(IConfigurationService configurationService)
        {
            _configurationService = configurationService;
        }

        [HttpPost]
        [ProtectedEndPoint("blocks-os::notification::save")]
        public async Task<BaseResponse> Save([FromBody] SaveNotificationConfigurationRequest request)
        {
            return await _configurationService.SaveNotificationConfigurationAsync(request);
        }

        [HttpGet]
        [ProtectedEndPoint("blocks-os::notification::gets")]
        public async Task<GetNotificationConfigurationsResponse> Gets([FromQuery] GetNotificationConfigurationsRequest request)
        {
            return await _configurationService.GetNotificationConfigurationsAsync(request);
        }

        [HttpGet]
        [ProtectedEndPoint("blocks-os::notification::gets")]
        public async Task<NotificationConfiguration> Get([FromQuery] GetNotificationConfigurationRequest request)
        {
            return await _configurationService.GetNotificationConfigurationAsync(request);
        }

        [HttpDelete]
        [ProtectedEndPoint("blocks-os::notification::delete")]
        public async Task<BaseResponse> Delete([FromQuery] DeleteNotificationConfigurationRequest request)
        {
            return await _configurationService.DeleteNotificationConfigurationAsync(request);
        }
    }
}
