namespace Configuration.DomainService.Mail.Template.Services
{
    /// <summary>The Worker side: runs one queued delete job in the ambient project tenant and sends its notification.</summary>
    public interface IEmailTemplateDeleteJob
    {
        Task<EmailTemplateDeleteResult> RunAsync(EmailTemplateDeleteCommand command, CancellationToken cancellationToken = default);
    }
}
