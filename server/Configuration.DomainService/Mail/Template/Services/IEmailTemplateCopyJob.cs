namespace Configuration.DomainService.Mail.Template.Services
{
    /// <summary>The Worker side: runs one queued copy job in the ambient project tenant and sends its notification.</summary>
    public interface IEmailTemplateCopyJob
    {
        Task<EmailTemplateCopyResult> RunAsync(EmailTemplateCopyCommand command, CancellationToken cancellationToken = default);
    }
}
