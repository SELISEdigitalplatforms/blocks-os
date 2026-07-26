using System.Collections.Generic;
using System.Threading.Tasks;
using Blocks.Genesis;
using BlocksOs.Api.Controllers;
using Configuration.DomainService.Mail.Entities;
using Configuration.DomainService.Mail.Mailbox;
using Configuration.DomainService.Mail.Mailbox.Services;
using Configuration.DomainService.Mail.RequestModel;
using Configuration.DomainService.Mail.Template;
using Configuration.DomainService.Mail.Template.Services;
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

        private readonly Mock<IMailTemplateService> _templateService = new();
        private readonly Mock<IMailboxService> _mailboxService = new();
        private MailController FullController() =>
            new(_service.Object, _templateService.Object, _mailboxService.Object);

        [Fact]
        public async Task SaveTemplate_Success_ReturnsOk()
        {
            _templateService.Setup(s => s.SaveTemplateAsync(It.IsAny<SaveMailTemplateRequest>()))
                            .ReturnsAsync(new BaseMutationResponse { IsSuccess = true });

            var result = await FullController().SaveTemplate(new SaveMailTemplateRequest { Name = "t" });

            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task SaveTemplate_Failure_ReturnsBadRequest()
        {
            _templateService.Setup(s => s.SaveTemplateAsync(It.IsAny<SaveMailTemplateRequest>()))
                            .ReturnsAsync(new BaseMutationResponse { IsSuccess = false });

            var result = await FullController().SaveTemplate(new SaveMailTemplateRequest());

            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task GetTemplate_Found_ReturnsOk()
        {
            var template = new EmailTemplate { ItemId = "t1" };
            _templateService.Setup(s => s.GetAsync(It.IsAny<GetMailTemplateRequest>())).ReturnsAsync(template);

            var result = await FullController().GetTemplate(new GetMailTemplateRequest { ItemId = "t1" });

            result.Should().BeOfType<OkObjectResult>().Which.Value.Should().BeSameAs(template);
        }

        [Fact]
        public async Task GetTemplate_NotFound_ReturnsNotFound()
        {
            _templateService.Setup(s => s.GetAsync(It.IsAny<GetMailTemplateRequest>()))
                            .ReturnsAsync((EmailTemplate?)null);

            var result = await FullController().GetTemplate(new GetMailTemplateRequest { ItemId = "missing" });

            result.Should().BeOfType<NotFoundObjectResult>();
        }

        [Fact]
        public async Task GetTemplates_ReturnsResponse()
        {
            var response = new GetAllMailTemplatesResponse { TotalCount = 2 };
            _templateService.Setup(s => s.GetAllTemplatesAsync(It.IsAny<GetAllMailTemplatesRequest>()))
                            .ReturnsAsync(response);

            var result = await FullController().GetTemplates(new GetAllMailTemplatesRequest());

            result.Should().BeSameAs(response);
        }

        [Fact]
        public async Task CloneTemplate_Success_ReturnsOk()
        {
            _templateService.Setup(s => s.CloneTemplateAsync(It.IsAny<CloneMailTemplateRequest>()))
                            .ReturnsAsync(new BaseMutationResponse { IsSuccess = true });

            var result = await FullController().CloneTemplate(new CloneMailTemplateRequest { ItemId = "t1" });

            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task CloneTemplate_Failure_ReturnsBadRequest()
        {
            _templateService.Setup(s => s.CloneTemplateAsync(It.IsAny<CloneMailTemplateRequest>()))
                            .ReturnsAsync(new BaseMutationResponse { IsSuccess = false });

            var result = await FullController().CloneTemplate(new CloneMailTemplateRequest { ItemId = "t1" });

            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task DeleteTemplate_MissingId_ReturnsBadRequest()
        {
            var result = await FullController().DeleteTemplate(new DeleteMailTemplateRequest { ItemId = "" });

            result.Should().BeOfType<BadRequestObjectResult>();
            _templateService.Verify(s => s.DeleteAsync(It.IsAny<DeleteMailTemplateRequest>()), Times.Never);
        }

        [Fact]
        public async Task DeleteTemplate_Valid_ReturnsOk()
        {
            _templateService.Setup(s => s.DeleteAsync(It.IsAny<DeleteMailTemplateRequest>()))
                            .ReturnsAsync(new BaseMutationResponse { IsSuccess = true });

            var result = await FullController().DeleteTemplate(new DeleteMailTemplateRequest { ItemId = "t1" });

            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task DeleteTemplate_Failure_ReturnsBadRequest()
        {
            _templateService.Setup(s => s.DeleteAsync(It.IsAny<DeleteMailTemplateRequest>()))
                            .ReturnsAsync(new BaseMutationResponse { IsSuccess = false });

            var result = await FullController().DeleteTemplate(new DeleteMailTemplateRequest { ItemId = "t1" });

            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task GetMailBoxMails_Success_ReturnsOk()
        {
            _mailboxService.Setup(s => s.GetMailBoxMailsAsync(It.IsAny<GetMailBoxMailsRequest>()))
                           .ReturnsAsync(new GetMailBoxMailsResponse { IsSuccess = true });

            var result = await FullController().GetMailBoxMails(new GetMailBoxMailsRequest());

            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task GetMailBoxMails_Failure_ReturnsBadRequest()
        {
            _mailboxService.Setup(s => s.GetMailBoxMailsAsync(It.IsAny<GetMailBoxMailsRequest>()))
                           .ReturnsAsync(new GetMailBoxMailsResponse { IsSuccess = false });

            var result = await FullController().GetMailBoxMails(new GetMailBoxMailsRequest());

            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task GetMailBoxMail_Found_ReturnsOk()
        {
            _mailboxService.Setup(s => s.GetMailBoxMailAsync(It.IsAny<GetMailBoxMailRequest>()))
                           .ReturnsAsync(new GetMailBoxMailResponse { IsSuccess = true });

            var result = await FullController().GetMailBoxMail(new GetMailBoxMailRequest { MessageId = "m1" });

            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task GetMailBoxMail_NotFound_ReturnsNotFound()
        {
            _mailboxService.Setup(s => s.GetMailBoxMailAsync(It.IsAny<GetMailBoxMailRequest>()))
                           .ReturnsAsync(new GetMailBoxMailResponse { IsSuccess = false });

            var result = await FullController().GetMailBoxMail(new GetMailBoxMailRequest { MessageId = "missing" });

            result.Should().BeOfType<NotFoundObjectResult>();
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
