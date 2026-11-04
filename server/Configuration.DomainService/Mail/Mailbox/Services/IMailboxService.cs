namespace Configuration.DomainService.Mail.Mailbox.Services
{
    public interface IMailboxService
    {
        Task<GetMailBoxMailsResponse> GetMailBoxMailsAsync(GetMailBoxMailsRequest request);
        Task<GetMailBoxMailResponse> GetMailBoxMailAsync(GetMailBoxMailRequest request);
        Task<GetMailBoxMailSourceResponse> GetMailBoxMailSourceAsync(GetMailBoxMailRequest request);
        Task<GetMailBoxMailAttachmentFileResponse> GetMailBoxMailAttachmentFileAsync(GetMailBoxMailAttachmentFileRequest request);
        Task<GetMailBoxMailAttachmentResponse> GetMailBoxMailAttachmentAsync(GetMailBoxMailAttachmentRequest request);
    }
}
