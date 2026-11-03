using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using Blocks.Genesis;
using BlocksOs.Api.Controllers;
using Configuration.DomainService.Mail.Mailbox;
using Configuration.DomainService.Mail.Mailbox.Services;
using Configuration.DomainService.Mail.RequestModel;
using Configuration.DomainService.Mail.ResponseModel;
using Configuration.DomainService.Mail.Services;
using Configuration.DomainService.Mail.Template;
using Configuration.DomainService.Mail.Template.Services;
using Configuration.DomainService.Notification.RequestModel;
using Configuration.DomainService.Notification.ResponseModel;
using Configuration.DomainService.Shared.Services;
using Configuration.DomainService.Storage.Entities;
using Configuration.DomainService.Storage.RequestModel;
using Configuration.DomainService.Storage.Services;
using DomainService.Configuration;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Blocks.Genesis.Entities.Data;
using Blocks.Genesis.Entities.Os;

namespace XUnitTest.Controllers
{
    public class MailControllerTests
    {
        private readonly Mock<IMailConfigurationService> _service = new();
        private MailController Controller() => new(_service.Object);

        [Fact]
        public async Task Save_MissingConfigurationId_IsPassedThroughEmpty()
        {
            // The empty id is the create signal and must survive the controller: minting one
            // here used to make a create indistinguishable from an edit, and left the service
            // allocating a second, different id for the document it actually wrote.
            MailConfiguration? captured = null;
            _service.Setup(s => s.SaveAsync(It.IsAny<MailConfiguration>(), It.IsAny<CancellationToken>()))
                    .Callback<MailConfiguration, CancellationToken>((c, _) => captured = c)
                    .ReturnsAsync(MailConfigurationMutationResult.Success("generated-id"));

            var result = await Controller().Save(new MailConfiguration { ConfigurationId = "" });

            result.Should().BeOfType<OkObjectResult>();
            captured!.ConfigurationId.Should().BeEmpty();
        }

        [Fact]
        public async Task Save_Success_ReturnsPersistedItemId()
        {
            _service.Setup(s => s.SaveAsync(It.IsAny<MailConfiguration>(), It.IsAny<CancellationToken>()))
                    .ReturnsAsync(MailConfigurationMutationResult.Success("persisted-id"));

            var result = await Controller().Save(new MailConfiguration { ConfigurationId = "" });

            result.Should().BeOfType<OkObjectResult>()
                  .Which.Value.Should().BeOfType<BaseMutationResponse>()
                  .Which.ItemId.Should().Be("persisted-id");
        }

        [Fact]
        public async Task Save_Failure_ReturnsBadRequest()
        {
            _service.Setup(s => s.SaveAsync(It.IsAny<MailConfiguration>(), It.IsAny<CancellationToken>()))
                    .ReturnsAsync(MailConfigurationMutationResult.Invalid("TenantId", "Tenant ID is required for SMTP Office 365."));

            var result = await Controller().Save(new MailConfiguration { ConfigurationId = "c1" });

            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task Save_SecretStoreUnavailable_ReturnsServiceUnavailable()
        {
            _service.Setup(s => s.SaveAsync(It.IsAny<MailConfiguration>(), It.IsAny<CancellationToken>()))
                    .ReturnsAsync(MailConfigurationMutationResult.SecretStoreUnavailable());

            var result = await Controller().Save(new MailConfiguration());

            var objectResult = result.Should().BeOfType<ObjectResult>().Subject;
            objectResult.StatusCode.Should().Be(503);
            objectResult.Value.Should().BeOfType<BaseMutationResponse>()
                        .Which.Errors.Should().ContainKey("ClientSecret")
                        .WhoseValue.Should().Be("The secret store is unavailable. Try again later.");
        }

        [Fact]
        public async Task Get_ReturnsConfiguration()
        {
            var config = new MailConfigurationResponse { Name = "Primary" };
            _service.Setup(s => s.GetAsync(It.IsAny<GetMailConfigurationRequest>(), It.IsAny<CancellationToken>())).ReturnsAsync(config);

            var result = await Controller().Get(new GetMailConfigurationRequest { ConfigurationName = "Primary" });

            result.Should().BeOfType<OkObjectResult>()
                  .Which.Value.Should().BeSameAs(config);
        }

        [Fact]
        public async Task Get_NullConfiguration_ReturnsNotFound()
        {
            _service.Setup(s => s.GetAsync(It.IsAny<GetMailConfigurationRequest>(), It.IsAny<CancellationToken>()))
                    .ReturnsAsync((MailConfigurationResponse?)null);

            var result = await Controller().Get(new GetMailConfigurationRequest { ConfigurationName = "x" });

            result.Should().BeOfType<NotFoundObjectResult>();
        }

        [Fact]
        public async Task Gets_ReturnsList()
        {
            var configs = new List<MailConfigurationResponse> { new() };
            _service.Setup(s => s.GetAllAsync(It.IsAny<CancellationToken>())).ReturnsAsync(configs);

            var result = await Controller().Gets(new GetAllMailConfigurationsRequest());

            result.Should().BeOfType<OkObjectResult>()
                  .Which.Value.Should().BeSameAs(configs);
        }

        [Fact]
        public async Task Delete_MissingId_ReturnsBadRequest()
        {
            var result = await Controller().Delete(new DeleteMailConfigurationRequest { ConfigurationId = "" });

            result.Should().BeOfType<BadRequestObjectResult>();
            _service.Verify(s => s.DeleteAsync(It.IsAny<DeleteMailConfigurationRequest>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Delete_Valid_ReturnsOk()
        {
            _service.Setup(s => s.DeleteAsync(It.IsAny<DeleteMailConfigurationRequest>(), It.IsAny<CancellationToken>()))
                    .ReturnsAsync(MailConfigurationMutationResult.Success("c1"));

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
            _service.Setup(s => s.DuplicateAsync(It.IsAny<DuplicateMailConfigurationRequest>(), It.IsAny<CancellationToken>()))
                    .ReturnsAsync(MailConfigurationMutationResult.Success("c1-copy"));

            var result = await Controller().Duplicate(new DuplicateMailConfigurationRequest { ConfigurationId = "c1" });

            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task Duplicate_DefaultConfiguration_ReturnsBadRequestWithTheFieldError()
        {
            _service.Setup(s => s.DuplicateAsync(It.IsAny<DuplicateMailConfigurationRequest>(), It.IsAny<CancellationToken>()))
                    .ReturnsAsync(MailConfigurationMutationResult.Invalid("ConfigurationId", "The default configuration cannot be duplicated."));

            var result = await Controller().Duplicate(new DuplicateMailConfigurationRequest { ConfigurationId = "default-1" });

            var response = result.Should().BeOfType<BadRequestObjectResult>()
                                 .Which.Value.Should().BeOfType<BaseMutationResponse>().Subject;
            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().Equal(new Dictionary<string, string>
            {
                ["ConfigurationId"] = "The default configuration cannot be duplicated."
            });
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

        // The file actions set a response header, so they need an HttpContext.
        private MailController FileController()
        {
            var controller = FullController();
            controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
            return controller;
        }

        [Fact]
        public async Task GetMailBoxMailSource_Found_ReturnsTheEmlAsAnOpaqueDownload()
        {
            // H4/C11/E5.
            var bytes = new byte[] { 0x53, 0x80, 0xFF };
            _mailboxService.Setup(s => s.GetMailBoxMailSourceAsync(It.Is<GetMailBoxMailRequest>(r => r.ItemId == "row-1")))
                           .ReturnsAsync(new GetMailBoxMailSourceResponse { IsSuccess = true, Content = bytes });
            var controller = FileController();

            var result = await controller.GetMailBoxMailSource(new GetMailBoxMailRequest { ItemId = "row-1" });

            var file = result.Should().BeOfType<FileContentResult>().Subject;
            file.FileContents.Should().Equal(bytes);
            file.ContentType.Should().Be("application/octet-stream");
            file.FileDownloadName.Should().Be("message.eml");
            controller.Response.Headers["X-Content-Type-Options"].ToString().Should().Be("nosniff");
        }

        [Theory]
        [InlineData("MessageId", "Mail not found")]
        [InlineData("RawMime", "No stored message source")]
        public async Task GetMailBoxMailSource_Failure_ReturnsNotFoundWithTheErrorsOnly(string key, string message)
        {
            // C1/C2/E9/E10.
            var errors = new Dictionary<string, string> { [key] = message };
            _mailboxService.Setup(s => s.GetMailBoxMailSourceAsync(It.IsAny<GetMailBoxMailRequest>()))
                           .ReturnsAsync(new GetMailBoxMailSourceResponse { IsSuccess = false, Errors = errors });

            var result = await FileController().GetMailBoxMailSource(new GetMailBoxMailRequest { ItemId = "nope" });

            var body = result.Should().BeOfType<NotFoundObjectResult>().Which.Value.Should().BeOfType<BaseResponse>().Subject;
            body.IsSuccess.Should().BeFalse();
            body.Errors.Should().Equal(errors);
        }

        [Fact]
        public async Task GetMailBoxMailAttachmentFile_Found_StreamsTheFileAsAnOpaqueDownload()
        {
            // H5/C11/E7: an HTML attachment is still served as octet-stream, never inline.
            using var content = new MemoryStream(new byte[] { 1, 2, 3 });
            _mailboxService.Setup(s => s.GetMailBoxMailAttachmentFileAsync(
                    It.Is<GetMailBoxMailAttachmentFileRequest>(r => r.ItemId == "row-1" && r.Index == 0)))
                .ReturnsAsync(new GetMailBoxMailAttachmentFileResponse { IsSuccess = true, FileName = "page.html", Content = content });
            var controller = FileController();

            var result = await controller.GetMailBoxMailAttachmentFile(
                new GetMailBoxMailAttachmentFileRequest { ItemId = "row-1", Index = 0 });

            var file = result.Should().BeOfType<FileStreamResult>().Subject;
            file.FileStream.Should().BeSameAs(content);
            file.ContentType.Should().Be("application/octet-stream");
            file.FileDownloadName.Should().Be("page.html");
            controller.Response.Headers["X-Content-Type-Options"].ToString().Should().Be("nosniff");
        }

        [Theory]
        [InlineData("MessageId", "Mail not found")]
        [InlineData("Index", "Attachment not found")]
        public async Task GetMailBoxMailAttachmentFile_Failure_ReturnsNotFoundWithTheErrorsOnly(string key, string message)
        {
            // C1/C3/E8.
            var errors = new Dictionary<string, string> { [key] = message };
            _mailboxService.Setup(s => s.GetMailBoxMailAttachmentFileAsync(It.IsAny<GetMailBoxMailAttachmentFileRequest>()))
                           .ReturnsAsync(new GetMailBoxMailAttachmentFileResponse { IsSuccess = false, Errors = errors });

            var result = await FileController().GetMailBoxMailAttachmentFile(
                new GetMailBoxMailAttachmentFileRequest { ItemId = "row-1", Index = 5 });

            var body = result.Should().BeOfType<NotFoundObjectResult>().Which.Value.Should().BeOfType<BaseResponse>().Subject;
            body.Errors.Should().Equal(errors);
        }

        [Fact]
        public async Task GetMailBoxMailAttachment_Obsolete_KeepsItsJsonContract()
        {
            // H6.
            var ok = new GetMailBoxMailAttachmentResponse
            {
                IsSuccess = true,
                Attachment = new MailBoxMailAttachmentContent { FileName = "invoice.pdf", ContentType = "application/pdf", ContentBase64 = "AA==" }
            };
            _mailboxService.Setup(s => s.GetMailBoxMailAttachmentAsync(It.Is<GetMailBoxMailAttachmentRequest>(r => r.MessageId == "m1")))
                           .ReturnsAsync(ok);
            _mailboxService.Setup(s => s.GetMailBoxMailAttachmentAsync(It.Is<GetMailBoxMailAttachmentRequest>(r => r.MessageId == "nope")))
                           .ReturnsAsync(new GetMailBoxMailAttachmentResponse { IsSuccess = false });

#pragma warning disable CS0618 // the obsolete route is kept for compatibility and still tested
            var found = await FullController().GetMailBoxMailAttachment(new GetMailBoxMailAttachmentRequest { MessageId = "m1" });
            var missing = await FullController().GetMailBoxMailAttachment(new GetMailBoxMailAttachmentRequest { MessageId = "nope" });
#pragma warning restore CS0618

            found.Should().BeOfType<OkObjectResult>().Which.Value.Should().BeSameAs(ok);
            missing.Should().BeOfType<NotFoundObjectResult>();
            typeof(MailController).GetMethod(nameof(MailController.GetMailBoxMailAttachment))!
                .GetCustomAttributes(typeof(ObsoleteAttribute), false).Should().ContainSingle()
                .Which.As<ObsoleteAttribute>().Message.Should().Be("Use GetMailBoxMailAttachmentFile.");
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
            var expected = new Configuration.DomainService.Notification.ResponseModel.NotificationConfigurationDetail { ItemId = "n1" };
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
        private readonly Mock<IStorageConfigurationService> _service = new();
        private StorageController Controller() => new(_service.Object);

        [Fact]
        public async Task Save_DelegatesToService()
        {
            _service.Setup(s => s.SaveAsync(It.IsAny<SaveStorageConfigurationRequest>()))
                    .ReturnsAsync(new BaseMutationResponse { IsSuccess = true });

            var response = await Controller().Save(new SaveStorageConfigurationRequest());

            response.IsSuccess.Should().BeTrue();
        }

        [Fact]
        public async Task Get_ReturnsSettingsAndSecretStatus_NeverASecretField()
        {
            // The API contract the client relies on: per-secret status, no value and no masked value.
            var settings = new StorageSettings { Name = "az", UploadCompletionRequiredFor = new List<string> { "Public", "Private" } };
            var status = new Dictionary<string, string> { { "ConnectionString", "active" } };
            _service.Setup(s => s.GetAsync("az")).ReturnsAsync(StorageConfigurationResponse.From(settings, status));

            var response = await Controller().Get(new GetStorageConfigurationRequest { ConfigurationName = "az" });

            var json = System.Text.Json.JsonSerializer.Serialize(response);
            json.Should().Contain("\"ConnectionStringStatus\":\"active\"")
                .And.Contain("\"PasswordStatus\":\"none\"")
                .And.Contain("\"UploadCompletionRequiredFor\":[\"Public\",\"Private\"]")
                .And.NotContain("\"ConnectionString\":")
                .And.NotContain("\"Password\":")
                .And.NotContain("\"SecretKey\":")
                .And.NotContain("\"AccessKey\":")
                .And.NotContain("\"SftpSecretKey\":");
        }

        [Fact]
        public async Task Delete_DelegatesToService()
        {
            _service.Setup(s => s.DeleteAsync("az"))
                    .ReturnsAsync(new BaseResponse { IsSuccess = true });

            var response = await Controller().Delete(new DeleteStorageConfigurationRequest { ConfigurationName = "az" });

            response.IsSuccess.Should().BeTrue();
        }
    }
}
