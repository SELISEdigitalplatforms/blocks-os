using System.Collections.Generic;
using System.Threading.Tasks;
using Blocks.Genesis;
using BlocksOs.Api.Controllers;
using Configuration.DomainService.Mail.Entities;
using Configuration.DomainService.Mail.RequestModel;
using Configuration.DomainService.Notification.Entities;
using Configuration.DomainService.Notification.RequestModel;
using Configuration.DomainService.Notification.ResponseModel;
using Configuration.DomainService.Shared.Services;
using Configuration.DomainService.Storage.Entities;
using Configuration.DomainService.Storage.RequestModel;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace XUnitTest.Controllers
{
    public class MailControllerTests
    {
        private readonly Mock<IConfigurationService> _service = new();
        private MailController Controller() => new(_service.Object);

        [Fact]
        public async Task Save_MissingConfigurationId_GeneratesOne()
        {
            MailConfiguration? captured = null;
            _service.Setup(s => s.SaveMailConfigurationAsync(It.IsAny<MailConfiguration>()))
                    .Callback<MailConfiguration>(c => captured = c)
                    .ReturnsAsync(new BaseMutationResponse { IsSuccess = true });

            var result = await Controller().Save(new MailConfiguration { ConfigurationId = "" });

            result.Should().BeOfType<OkObjectResult>();
            captured!.ConfigurationId.Should().NotBeNullOrEmpty();
        }

        [Fact]
        public async Task Save_Failure_ReturnsBadRequest()
        {
            _service.Setup(s => s.SaveMailConfigurationAsync(It.IsAny<MailConfiguration>()))
                    .ReturnsAsync(new BaseMutationResponse { IsSuccess = false });

            var result = await Controller().Save(new MailConfiguration { ConfigurationId = "c1" });

            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task Get_ReturnsConfiguration()
        {
            var config = new MailConfiguration { ConfigurationName = "Primary" };
            _service.Setup(s => s.GetMailConfigurationAsync(It.IsAny<GetMailConfigurationRequest>())).ReturnsAsync(config);

            var result = await Controller().Get(new GetMailConfigurationRequest { ConfigurationName = "Primary" });

            result.Should().BeOfType<OkObjectResult>()
                  .Which.Value.Should().BeSameAs(config);
        }

        [Fact]
        public async Task Get_NullConfiguration_ReturnsNotFound()
        {
            _service.Setup(s => s.GetMailConfigurationAsync(It.IsAny<GetMailConfigurationRequest>()))
                    .ReturnsAsync((MailConfiguration?)null!);

            var result = await Controller().Get(new GetMailConfigurationRequest { ConfigurationName = "x" });

            result.Should().BeOfType<NotFoundObjectResult>();
        }

        [Fact]
        public async Task Gets_ReturnsList()
        {
            var configs = new List<MailServerConfiguration> { new() };
            _service.Setup(s => s.GetAllMailConfigurationsAsync()).ReturnsAsync(configs);

            var result = await Controller().Gets(new GetAllMailConfigurationsRequest());

            result.Should().BeOfType<OkObjectResult>()
                  .Which.Value.Should().BeSameAs(configs);
        }

        [Fact]
        public async Task Delete_MissingId_ReturnsBadRequest()
        {
            var result = await Controller().Delete(new DeleteMailConfigurationRequest { ConfigurationId = "" });

            result.Should().BeOfType<BadRequestObjectResult>();
            _service.Verify(s => s.DeleteMailConfigurationAsync(It.IsAny<DeleteMailConfigurationRequest>()), Times.Never);
        }

        [Fact]
        public async Task Delete_Valid_ReturnsOk()
        {
            _service.Setup(s => s.DeleteMailConfigurationAsync(It.IsAny<DeleteMailConfigurationRequest>()))
                    .ReturnsAsync(new BaseMutationResponse { IsSuccess = true });

            var result = await Controller().Delete(new DeleteMailConfigurationRequest { ConfigurationId = "c1" });

            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task Duplicate_MissingId_ReturnsBadRequest()
        {
            var result = await Controller().Duplicate(new DuplicateMailConfigurationRequest { ConfigurationId = "" });

            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task Duplicate_Valid_ReturnsOk()
        {
            _service.Setup(s => s.DuplicateMailConfigurationAsync(It.IsAny<DuplicateMailConfigurationRequest>()))
                    .ReturnsAsync(new BaseMutationResponse { IsSuccess = true });

            var result = await Controller().Duplicate(new DuplicateMailConfigurationRequest { ConfigurationId = "c1" });

            result.Should().BeOfType<OkObjectResult>();
        }
    }

    public class NotificationControllerTests
    {
        private readonly Mock<IConfigurationService> _service = new();
        private NotificationController Controller() => new(_service.Object);

        [Fact]
        public async Task Save_DelegatesToService()
        {
            _service.Setup(s => s.SaveNotificationConfigurationAsync(It.IsAny<SaveNotificationConfigurationRequest>()))
                    .ReturnsAsync(new BaseResponse { IsSuccess = true });

            var response = await Controller().Save(new SaveNotificationConfigurationRequest());

            response.IsSuccess.Should().BeTrue();
        }

        [Fact]
        public async Task Gets_DelegatesToService()
        {
            var expected = new GetNotificationConfigurationsResponse { TotalCount = 2 };
            _service.Setup(s => s.GetNotificationConfigurationsAsync(It.IsAny<GetNotificationConfigurationsRequest>()))
                    .ReturnsAsync(expected);

            var response = await Controller().Gets(new GetNotificationConfigurationsRequest());

            response.Should().BeSameAs(expected);
        }

        [Fact]
        public async Task Get_DelegatesToService()
        {
            var expected = new NotificationConfiguration { ItemId = "n1" };
            _service.Setup(s => s.GetNotificationConfigurationAsync(It.IsAny<GetNotificationConfigurationRequest>()))
                    .ReturnsAsync(expected);

            var response = await Controller().Get(new GetNotificationConfigurationRequest { ItemId = "n1" });

            response.Should().BeSameAs(expected);
        }

        [Fact]
        public async Task Delete_DelegatesToService()
        {
            _service.Setup(s => s.DeleteNotificationConfigurationAsync(It.IsAny<DeleteNotificationConfigurationRequest>()))
                    .ReturnsAsync(new BaseResponse { IsSuccess = true });

            var response = await Controller().Delete(new DeleteNotificationConfigurationRequest());

            response.IsSuccess.Should().BeTrue();
        }
    }

    public class StorageControllerTests
    {
        private readonly Mock<IConfigurationService> _service = new();
        private StorageController Controller() => new(_service.Object);

        [Fact]
        public async Task Save_DelegatesToService()
        {
            _service.Setup(s => s.SaveStorageConfigurationAsync(It.IsAny<SaveStorageConfigurationRequest>()))
                    .ReturnsAsync(new BaseMutationResponse { IsSuccess = true });

            var response = await Controller().Save(new SaveStorageConfigurationRequest());

            response.IsSuccess.Should().BeTrue();
        }

        [Fact]
        public async Task Gets_DelegatesToService()
        {
            var expected = new List<StorageConfiguration> { new() };
            _service.Setup(s => s.GetStorageConfigurationsAsync()).ReturnsAsync(expected);

            var response = await Controller().Gets(new GetStorageConfigurationsRequest());

            response.Should().BeSameAs(expected);
        }

        [Fact]
        public async Task Get_DelegatesToService()
        {
            var expected = new StorageConfiguration { Name = "az" };
            _service.Setup(s => s.GetStorageConfigurationAsync("az")).ReturnsAsync(expected);

            var response = await Controller().Get(new GetStorageConfigurationRequest { ConfigurationName = "az" });

            response.Should().BeSameAs(expected);
        }

        [Fact]
        public async Task Delete_DelegatesToService()
        {
            _service.Setup(s => s.DeleteStorageConfigurationAsync("az"))
                    .ReturnsAsync(new BaseResponse { IsSuccess = true });

            var response = await Controller().Delete(new DeleteStorageConfigurationRequest { ConfigurationName = "az" });

            response.IsSuccess.Should().BeTrue();
        }
    }
}
