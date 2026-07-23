namespace Configuration.DomainService.Mail.Mailbox.Services
{
    public interface IMailboxService
    {
        Task<GetMailBoxMailsResponse> GetMailBoxMailsAsync(GetMailBoxMailsRequest request);
        Task<GetMailBoxMailResponse> GetMailBoxMailAsync(GetMailBoxMailRequest request);
    }
}
