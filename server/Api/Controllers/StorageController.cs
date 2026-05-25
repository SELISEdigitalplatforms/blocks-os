using Blocks.Genesis;
using CloudConfiguration.DomainService.Shared.Services;
using CloudConfiguration.DomainService.Storage.Entities;
using CloudConfiguration.DomainService.Storage.RequestModel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace BlocksTemplate.Api.Controllers
{
    [ApiController]
    [Route("[controller]/[action]")]

    public class StorageController : ControllerBase
    {
        private readonly IConfigurationService _configurationService;

        public StorageController(IConfigurationService configurationService)
        {
            _configurationService = configurationService;
        }

        [HttpPost]
        //[ProtectedEndPoint("blocks-os::storage::save")]
        [Authorize]
        public async Task<BaseMutationResponse> Save([FromBody] SaveStorageConfigurationRequest request)
        {
            return await _configurationService.SaveStorageConfigurationAsync(request);
        }

        [HttpGet]
        //[ProtectedEndPoint("blocks-os::storage::gets")]
        [Authorize]
        public async Task<List<StorageConfiguration>> Gets([FromQuery] GetStorageConfigurationsRequest request)
        {
            return await _configurationService.GetStorageConfigurationsAsync();
        }

        [HttpGet]
        //[ProtectedEndPoint("blocks-os::storage::get")]
        [Authorize]
        public async Task<StorageConfiguration> Get([FromQuery] GetStorageConfigurationRequest request)
        {
            return await _configurationService.GetStorageConfigurationAsync(request?.ConfigurationName ?? string.Empty);
        }

        [HttpPost]
        //[ProtectedEndPoint("blocks-os::storage::delete")]
        [Authorize]
        public async Task<BaseResponse> Delete([FromQuery] DeleteStorageConfigurationRequest request)
        {
            return await _configurationService.DeleteStorageConfigurationAsync(request?.ConfigurationName ?? string.Empty);
        }

    }
}
