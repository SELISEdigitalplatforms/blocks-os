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
        [ProtectedEndPoint("blocks-os::datagateway::mutate")]
        public async Task<BaseMutationResponse> Save([FromBody] SaveDataGatewayConfigurationRequest request)
        {
            return await _configurationService.SaveDataGatewayConfigurationAsync(request);
        }

        [HttpGet]
        [ProtectedEndPoint("blocks-os::datagateway::gets")]
        public async Task<List<DataGatewayConfiguration>> Gets([FromQuery] GetDataGatewayConfigurationsRequest request)
        {
            return await _configurationService.GetDataGatewayConfigurationsAsync();
        }

        [HttpGet]
        [ProtectedEndPoint("blocks-os::datagateway::gets")]
        public async Task<DataGatewayConfiguration> Get([FromQuery] GetDataGatewayConfigurationRequest request)
        {
            return await _configurationService.GetDataGatewayConfigurationAsync(request?.ProjectKey ?? string.Empty);
        }
    }
}
