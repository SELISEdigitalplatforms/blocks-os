using Blocks.Genesis;
using Configuration.DomainService.DataGateway.Entities;
using Configuration.DomainService.DataGateway.RequestModel;
using Configuration.DomainService.DataGateway.Services;
using Microsoft.AspNetCore.Mvc;

namespace BlocksOs.Api.Controllers
{
    [ApiController]
    [Route("[controller]/[action]")]

    public class DataGatewayController : ControllerBase
    {
        private readonly IDataGatewayConfigurationService _dataGatewayConfigurationService;

        public DataGatewayController(IDataGatewayConfigurationService dataGatewayConfigurationService)
        {
            _dataGatewayConfigurationService = dataGatewayConfigurationService;
        }

        [HttpPost]
        [ProtectedEndPoint("blocks-os::datagateway::saveconfig")]
        public async Task<BaseMutationResponse> SaveConfig([FromBody] SaveDataGatewayConfigurationRequest request)
        {
            return await _dataGatewayConfigurationService.SaveDataGatewayConfigurationAsync(request);
        }

        // There is at most one DataGateway configuration - unlike Storage's several named
        // configurations, there is no list action here. No configuration → null → 204 No Content, as today.
        [HttpGet]
        [ProtectedEndPoint("blocks-os::datagateway::getconfig")]
        public async Task<DataGatewayConfiguration?> GetConfig()
        {
            return await _dataGatewayConfigurationService.GetDataGatewayConfigurationAsync();
        }
    }
}
