using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Api.Controllers;
using Blocks.Genesis;
using DomainService.Dtos;
using DomainService.Entities;
using DomainService.Projects;
using FluentAssertions;
using FluentValidation;
using FluentValidation.Results;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace XUnitTest.Controllers
{
    public class ProjectControllerTests
    {
        private readonly Mock<IProjectManagementService> _service = new();
        private readonly Mock<IValidator<CreateProjectRequest>> _createValidator = new();
        private readonly Mock<IValidator<UpdateProjectRequest>> _updateValidator = new();

        private ProjectController Controller() => new(_service.Object, _createValidator.Object, _updateValidator.Object);

        private static ValidationResult Valid() => new();
        private static ValidationResult Invalid() => new(new[] { new ValidationFailure("Name", "required") });

        [Fact]
        public async Task Create_InvalidRequest_ReturnsErrorsWithoutCallingService()
        {
            _createValidator.Setup(v => v.ValidateAsync(It.IsAny<CreateProjectRequest>(), It.IsAny<CancellationToken>()))
                            .ReturnsAsync(Invalid());

            var response = await Controller().Create(new CreateProjectRequest());

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("Name");
            _service.Verify(s => s.SaveProjectAsync(It.IsAny<CreateProjectRequest>()), Times.Never);
        }

        [Fact]
        public async Task Create_ValidRequest_DelegatesToService()
        {
            _createValidator.Setup(v => v.ValidateAsync(It.IsAny<CreateProjectRequest>(), It.IsAny<CancellationToken>()))
                            .ReturnsAsync(Valid());
            _service.Setup(s => s.SaveProjectAsync(It.IsAny<CreateProjectRequest>()))
                    .ReturnsAsync(new CreateProjectResponse { IsSuccess = true, TenantGroupId = "g1" });

            var response = await Controller().Create(new CreateProjectRequest());

            response.IsSuccess.Should().BeTrue();
            response.TenantGroupId.Should().Be("g1");
        }

        [Fact]
        public async Task Gets_DelegatesToService()
        {
            var expected = new List<GroupedProjectsDto> { new() { TenantGroupId = "g1" } };
            _service.Setup(s => s.GetAllAsync(It.IsAny<GetProjectsRequest>())).ReturnsAsync(expected);

            var response = await Controller().Gets(new GetProjectsRequest());

            response.Should().BeSameAs(expected);
        }

        [Fact]
        public async Task Restore_DelegatesToService()
        {
            _service.Setup(s => s.RestoreProjectAsync(It.IsAny<RestoreProjectRequest>()))
                    .ReturnsAsync(new RestoreProjectResponse { IsSuccess = true });

            var response = await Controller().Restore(new RestoreProjectRequest());

            response.IsSuccess.Should().BeTrue();
        }

        [Fact]
        public async Task Get_DelegatesToService()
        {
            var expected = new GetProjectResponse();
            _service.Setup(s => s.GetAsync()).ReturnsAsync(expected);

            var response = await Controller().Get();

            response.Should().BeSameAs(expected);
        }

        [Fact]
        public async Task UpdateProject_InvalidRequest_ReturnsErrors()
        {
            _updateValidator.Setup(v => v.ValidateAsync(It.IsAny<UpdateProjectRequest>(), It.IsAny<CancellationToken>()))
                            .ReturnsAsync(new ValidationResult(new[] { new ValidationFailure("Application", "bad") }));

            var response = await Controller().UpdateProject(new UpdateProjectRequest());

            response.IsSuccess.Should().BeFalse();
            _service.Verify(s => s.UpdateProjectAsync(It.IsAny<UpdateProjectRequest>()), Times.Never);
        }

        [Fact]
        public async Task UpdateProject_ValidRequest_DelegatesToService()
        {
            _updateValidator.Setup(v => v.ValidateAsync(It.IsAny<UpdateProjectRequest>(), It.IsAny<CancellationToken>()))
                            .ReturnsAsync(Valid());
            _service.Setup(s => s.UpdateProjectAsync(It.IsAny<UpdateProjectRequest>()))
                    .ReturnsAsync(new BaseResponse { IsSuccess = true });

            var response = await Controller().UpdateProject(new UpdateProjectRequest());

            response.IsSuccess.Should().BeTrue();
        }

        [Fact]
        public async Task UpdateTenantGroup_MissingFields_ReturnsError()
        {
            var response = await Controller().UpdateTenantGroup(new UpdateTenantGroupRequest { Name = "", TenantGroupId = "" });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("property_missing");
            _service.Verify(s => s.UpdateTenantGroupAsync(It.IsAny<UpdateTenantGroupRequest>()), Times.Never);
        }

        [Fact]
        public async Task UpdateTenantGroup_Valid_DelegatesToService()
        {
            _service.Setup(s => s.UpdateTenantGroupAsync(It.IsAny<UpdateTenantGroupRequest>()))
                    .ReturnsAsync(new BaseResponse { IsSuccess = true });

            var response = await Controller().UpdateTenantGroup(new UpdateTenantGroupRequest { Name = "N", TenantGroupId = "g" });

            response.IsSuccess.Should().BeTrue();
        }

        [Fact]
        public async Task Disable_DelegatesToService()
        {
            _service.Setup(s => s.DisableProjectAsync(It.IsAny<string>()))
                    .ReturnsAsync(new BaseResponse { IsSuccess = true });

            var response = await Controller().Disable(new DisableProjectRequest());

            response.IsSuccess.Should().BeTrue();
        }

        [Fact]
        public async Task GetAsset_DelegatesToService()
        {
            var expected = new GetAssetResponse { IsSuccess = true, TotalCount = 5 };
            _service.Setup(s => s.GetAssetAsync(It.IsAny<GetAssetRequest>())).ReturnsAsync(expected);

            var response = await Controller().GetAsset(new GetAssetRequest());

            response.Should().BeSameAs(expected);
        }

        [Fact]
        public async Task AddAsset_InvalidAsset_ReturnsError()
        {
            var response = await Controller().AddAsset(new AddAssetRequest { TenantGroupId = "", Resource = null! });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("invalid_asset");
            _service.Verify(s => s.AddAssetAsync(It.IsAny<AddAssetRequest>()), Times.Never);
        }

        [Fact]
        public async Task AddAsset_Valid_DelegatesToService()
        {
            _service.Setup(s => s.AddAssetAsync(It.IsAny<AddAssetRequest>()))
                    .ReturnsAsync(new BaseResponse { IsSuccess = true });

            var response = await Controller().AddAsset(new AddAssetRequest
            {
                TenantGroupId = "g",
                Resource = new Resource { ResourceId = "r1" }
            });

            response.IsSuccess.Should().BeTrue();
            _service.Verify(s => s.AddAssetAsync(It.IsAny<AddAssetRequest>()), Times.Once);
        }

        [Fact]
        public async Task UpdateTokenValidationParameters_DelegatesToService()
        {
            _service.Setup(s => s.UpdateTokenValidationParametersAsync(It.IsAny<UpdateTokenValidationParametersRequest>()))
                    .ReturnsAsync(new BaseResponse { IsSuccess = true });

            var response = await Controller().UpdateTokenValidationParameters(new UpdateTokenValidationParametersRequest());

            response.IsSuccess.Should().BeTrue();
        }

        [Fact]
        public async Task GetTokenValidationParameters_DelegatesToService()
        {
            _service.Setup(s => s.GetProjectTokenValidationParametersAsync(It.IsAny<string>()))
                    .ReturnsAsync(new OkObjectResult(new { IsConfigured = true }));

            var response = await Controller().GetTokenValidationParameters(new GetTokenValidationParametersRequest());

            response.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task SaveThirdPartyJWTClaims_DelegatesToService()
        {
            _service.Setup(s => s.SaveThirdPartyJWTClaimsAsync(It.IsAny<SaveThirdPartyJWTClaimsRequest>()))
                    .ReturnsAsync(new SaveThirdPartyJWTClaimsResponse { IsSuccess = true, ItemId = "c1" });

            var response = await Controller().SaveThirdPartyJWTClaims(new SaveThirdPartyJWTClaimsRequest());

            response.ItemId.Should().Be("c1");
        }

        [Fact]
        public async Task GetThirdPartyJWTClaims_DelegatesToService()
        {
            var claims = new ThirdPartyJWTClaims { ItemId = "c1" };
            _service.Setup(s => s.GetThirdPartyJWTClaimsAsync()).ReturnsAsync(claims);

            var response = await Controller().GetThirdPartyJWTClaims();

            response.Should().BeSameAs(claims);
        }
    }
}
