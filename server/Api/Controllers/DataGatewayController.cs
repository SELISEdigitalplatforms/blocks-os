using Blocks.Genesis;
using Configuration.DomainService.DataGateway.RequestModel;
using Configuration.DomainService.DataGateway.ResponseModel;
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

        /// <summary>A refused save (invalid input, unknown ItemId) answers 400 with the errors; ItemId not found answers 404.</summary>
        [HttpPost]
        [ProtectedEndPoint("blocks-os::datagateway::saveconfig")]
        public async Task<IActionResult> SaveConfig([FromBody] SaveDataGatewayConfigurationRequest request)
        {
            var response = await _dataGatewayConfigurationService.SaveDataGatewayConfigurationAsync(request);
            if (response.IsSuccess)
                return Ok(response);

            var notFound = response.Errors != null && response.Errors.TryGetValue("ItemId", out var itemError) && itemError == DataGatewayConfigurationService.NotFoundMessage;
            return StatusCode(notFound ? StatusCodes.Status404NotFound : StatusCodes.Status400BadRequest, response);
        }

        // One configuration per tenant (the root doc). GET creates the default one when missing and never returns
        // the connection string, only connectionType.
        [HttpGet]
        [ProtectedEndPoint("blocks-os::datagateway::getconfig")]
        public async Task<ActionResult<DataGatewayConfigurationResponse>> GetConfig()
        {
            var configuration = await _dataGatewayConfigurationService.GetDataGatewayConfigurationAsync();
            return configuration is null ? NotFound() : Ok(configuration);
        }
    }
}
