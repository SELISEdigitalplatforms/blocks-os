using Blocks.Genesis;
using Configuration.DomainService.Mail.Template;
using Configuration.DomainService.Mail.Template.Services;
using Microsoft.Extensions.Logging;

namespace Worker.Consumers.Mail
{
    /// <summary>
    /// Copies a Default organization template to organizations (SPEC33 §6.3, <c>blocks_os_email_template_listener</c>).
    /// The job runs in the project tenant the command carries, and only there.
    /// </summary>
    public class EmailTemplateCopyConsumer : IConsumer<EmailTemplateCopyCommand>
    {
        private readonly IEmailTemplateCopyJob _job;
        private readonly ILogger<EmailTemplateCopyConsumer> _logger;

        public EmailTemplateCopyConsumer(IEmailTemplateCopyJob job, ILogger<EmailTemplateCopyConsumer> logger)
        {
            _job = job;
            _logger = logger;
        }

        public async Task Consume(EmailTemplateCopyCommand context)
        {
            ArgumentNullException.ThrowIfNull(context);
            if (string.IsNullOrWhiteSpace(context.TenantId))
            {
                // Nothing to run in: dropped, not thrown, so the message isn't redelivered forever.
                _logger.LogWarning("Email template copy {JobId} dropped: the command has no tenant. TemplateId={TemplateId}", context.JobId, context.TemplateId);
                return;
            }

            await BlocksContext.ExecuteInContext(JobContext(context), () => _job.RunAsync(context, CancellationToken.None));
        }

        /// <summary>
        /// The command's tenant and requester. Not authenticated: the data access resolver has no user to apply rules
        /// for, so every read and write is limited to the tenant's database alone.
        /// </summary>
        internal static BlocksContext JobContext(EmailTemplateCopyCommand command) => BlocksContext.Create(
            tenantId: command.TenantId,
            roles: [],
            userId: command.RequestedByUserId,
            isAuthenticated: false,
            requestUri: string.Empty,
            organizationId: string.Empty,
            expireOn: DateTime.UtcNow.AddHours(1),
            email: string.Empty,
            permissions: [],
            userName: string.Empty,
            phoneNumber: string.Empty,
            displayName: string.Empty,
            oauthToken: string.Empty,
            originalTenantId: command.OriginalTenantId ?? command.TenantId);
    }
}
