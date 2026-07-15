using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Cloud.DomainService.Repositories;
using Cloud.DomainService.Requests;
using Cloud.DomainService.Responses;
using Cloud.DomainService.Services;
using FluentAssertions;
using Moq;
using XUnitTest.TestSupport;

namespace XUnitTest.Services
{
    public class ApiEndpointConfigServiceTests
    {
        private readonly Mock<IApiEndpointConfigRepository> _repo = new();
        private ApiEndpointConfigService Service() => new(_repo.Object);

        [Fact]
        public async Task GetListAsync_MapsRepositoryResultIntoResponse()
        {
            var data = new List<ApiEndpointConfigResponse>
            {
                new() { Name = "a" },
                new() { Name = "b" }
            };
            _repo.Setup(r => r.GetListAsync(It.IsAny<GetApiEndpointConfigsRequest>()))
                 .ReturnsAsync((data, 42L));

            var request = new GetApiEndpointConfigsRequest { Page = 2, PageSize = 10 };

            var response = await Service().GetListAsync(request);

            response.TotalCount.Should().Be(42);
            response.Page.Should().Be(2);
            response.PageSize.Should().Be(10);
            response.Data.Should().HaveCount(2);
            response.TotalPages.Should().Be(5);
        }

        [Fact]
        public async Task UpdateAsync_WhenRepositorySucceeds_ReturnsSuccess()
        {
            using var _ = new BlocksTestContext();
            _repo.Setup(r => r.UpdateAsync(It.IsAny<string>(), true, false, It.IsAny<string>()))
                 .ReturnsAsync(true);

            var response = await Service().UpdateAsync(new UpdateApiEndpointConfigRequest
            {
                ItemId = "item-1",
                IsCaptchaRequired = true,
                IsMfaRequired = false
            });

            response.IsSuccess.Should().BeTrue();
            response.Errors.Should().BeEmpty();
        }

        [Fact]
        public async Task UpdateAsync_WhenRepositoryFails_ReturnsError()
        {
            _repo.Setup(r => r.UpdateAsync(It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<bool>(), It.IsAny<string>()))
                 .ReturnsAsync(false);

            var response = await Service().UpdateAsync(new UpdateApiEndpointConfigRequest { ItemId = "missing" });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("update_failed");
        }

        [Fact]
        public async Task BulkUpdateAsync_WhenModifiedCountPositive_ReturnsSuccess()
        {
            _repo.Setup(r => r.BulkUpdateAsync(It.IsAny<List<string>>(), true, true, It.IsAny<string>()))
                 .ReturnsAsync(3);

            var response = await Service().BulkUpdateAsync(new BulkUpdateApiEndpointConfigRequest
            {
                ItemIds = new List<string> { "a", "b", "c" },
                IsCaptchaRequired = true,
                IsMfaRequired = true,
                DisableAll = false
            });

            response.IsSuccess.Should().BeTrue();
        }

        [Fact]
        public async Task BulkUpdateAsync_WhenDisableAll_ForcesFlagsFalse()
        {
            _repo.Setup(r => r.BulkUpdateAsync(It.IsAny<List<string>>(), It.IsAny<bool>(), It.IsAny<bool>(), It.IsAny<string>()))
                 .ReturnsAsync(2);

            await Service().BulkUpdateAsync(new BulkUpdateApiEndpointConfigRequest
            {
                ItemIds = new List<string> { "a" },
                IsCaptchaRequired = true,
                IsMfaRequired = true,
                DisableAll = true
            });

            _repo.Verify(r => r.BulkUpdateAsync(It.IsAny<List<string>>(), false, false, It.IsAny<string>()), Times.Once);
        }

        [Fact]
        public async Task BulkUpdateAsync_WhenNothingModified_ReturnsError()
        {
            _repo.Setup(r => r.BulkUpdateAsync(It.IsAny<List<string>>(), It.IsAny<bool>(), It.IsAny<bool>(), It.IsAny<string>()))
                 .ReturnsAsync(0);

            var response = await Service().BulkUpdateAsync(new BulkUpdateApiEndpointConfigRequest
            {
                ItemIds = new List<string> { "a" }
            });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("update_failed");
        }
    }
}
