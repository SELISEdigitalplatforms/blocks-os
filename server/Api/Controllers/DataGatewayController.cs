using Blocks.Genesis;
using Configuration.DomainService.DataGateway.Entities;
using Configuration.DomainService.DataGateway.RequestModel;
using Configuration.DomainService.Shared.Services;
using Microsoft.AspNetCore.Mvc;

namespace BlocksOs.Api.Controllers
{
    [ApiController]
    [Route("[controller]/[action]")]

    public class DataGatewayController : ControllerBase
    {
        private readonly IConfigurationService _configurationService;

        public DataGatewayController(IConfigurationService configurationService)
        {
            _configurationService = configurationService;
        }

        [HttpPost]
        [ProtectedEndPoint("blocks-os::datagateway::saveconfig")]
        public async Task<BaseMutationResponse> SaveConfig([FromBody] SaveDataGatewayConfigurationRequest request)
        {
            return await _configurationService.SaveDataGatewayConfigurationAsync(request);
        }

        // There is at most one DataGateway configuration - unlike Storage's several named
        // configurations, there is no list action here.
        [HttpGet]
        [ProtectedEndPoint("blocks-os::datagateway::getconfig")]
        public async Task<DataGatewayConfiguration> GetConfig()
        {
            return await _configurationService.GetDataGatewayConfigurationAsync();
        }
    }
}
