using Blocks.Genesis;
using Configuration.DomainService.Shared.Services;
using Configuration.DomainService.Storage.Entities;
using Configuration.DomainService.Storage.RequestModel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Blocks.Genesis.Entities.Data;

namespace BlocksOs.Api.Controllers
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
        [ProtectedEndPoint("blocks-os::storage::mutate")]
        public async Task<BaseMutationResponse> Save([FromBody] SaveStorageConfigurationRequest request)
        {
            return await _configurationService.SaveStorageConfigurationAsync(request);
        }

        [HttpGet]
        [ProtectedEndPoint("blocks-os::storage::gets")]
        public async Task<List<StorageConfigurationResponse>> Gets([FromQuery] GetStorageConfigurationsRequest request)
        {
            var configurations = await _configurationService.GetStorageConfigurationsAsync();
            return configurations.Select(x => StorageConfigurationResponse.From(x)!).ToList();
        }

        [HttpGet]
        [ProtectedEndPoint("blocks-os::storage::gets")]
        public async Task<StorageConfigurationResponse?> Get([FromQuery] GetStorageConfigurationRequest request)
        {
            var configuration = await _configurationService.GetStorageConfigurationAsync(request?.ConfigurationName ?? string.Empty);
            return StorageConfigurationResponse.From(configuration);
        }

        [HttpPost]
        [ProtectedEndPoint("blocks-os::storage::mutate")]
        public async Task<BaseResponse> Delete([FromQuery] DeleteStorageConfigurationRequest request)
        {
            return await _configurationService.DeleteStorageConfigurationAsync(request?.ConfigurationName ?? string.Empty);
        }

    }
}
