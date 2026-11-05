using Configuration.DomainService.Organizations;
using Microsoft.Extensions.Logging;
using Os.DataAccess.Notifications;

namespace Configuration.DomainService.Mail.Template.Services
{
    /// <inheritdoc />
    /// <remarks>
    /// SPEC34 §6.2. Runs in the project tenant of the command (the Worker consumer sets it), after the API has deleted
    /// the Default template. Target organizations are read 100 at a time like the copy job's (H4, C4), and each batch
    /// is one delete-many by Name + Language + those organizations (C8). Re-running deletes nothing more (C7). Logs
    /// carry ids only.
    /// </remarks>
    public class EmailTemplateDeleteJob : IEmailTemplateDeleteJob
    {
        private readonly IMailTemplateRepository _templateRepository;
        private readonly IOrganizationReader _organizationReader;
        private readonly IBuiltInNotificationSender _notifications;
        private readonly ILogger<EmailTemplateDeleteJob> _logger;

        public EmailTemplateDeleteJob(IMailTemplateRepository templateRepository, IOrganizationReader organizationReader, IBuiltInNotificationSender notifications, ILogger<EmailTemplateDeleteJob> logger)
        {
            _templateRepository = templateRepository;
            _organizationReader = organizationReader;
            _notifications = notifications;
            _logger = logger;
        }

        public async Task<EmailTemplateDeleteResult> RunAsync(EmailTemplateDeleteCommand command, CancellationToken cancellationToken = default)
        {
            ArgumentNullException.ThrowIfNull(command);

            var result = new EmailTemplateDeleteResult();
            var targets = new OrganizationTargets(_organizationReader, _logger, $"Email template delete {command.JobId}");
            await foreach (var batch in targets.BatchesAsync(command.AllOrganizations, command.OrganizationIds, result, cancellationToken))
            {
                result.LargestBatch = Math.Max(result.LargestBatch, batch.Count);
                try
                {
                    var deleted = (int)await _templateRepository.DeleteOrganizationCopiesAsync(command.Name, command.Language, batch);
                    result.Deleted += deleted;
                    result.NotFound += batch.Count - deleted;
                }
#pragma warning disable CA1031 // C6: one failed batch is reported and the job goes on with the next one.
                catch (Exception ex)
#pragma warning restore CA1031
                {
                    result.Failed += batch.Count;
                    _logger.LogError(ex, "Email template delete {JobId}: a batch failed. OrganizationIds={OrganizationIds} ErrorType={ErrorType}",
                        command.JobId, string.Join(",", batch), ex.GetType().Name);
                }
            }

            _logger.LogInformation("Email template delete {JobId} finished. Deleted={Deleted} NotFound={NotFound} Skipped={Skipped} Failed={Failed}",
                command.JobId, result.Deleted, result.NotFound, result.Skipped, result.Failed);
            await NotifyAsync(command, result, cancellationToken);
            return result;
        }

        /// <summary>H5: the bell notification to the requester. Best effort (C9): a failure here never fails the job.</summary>
        private async Task NotifyAsync(EmailTemplateDeleteCommand command, EmailTemplateDeleteResult result, CancellationToken cancellationToken)
        {
            // §6.2 has two events: failed organizations, or organizations never reached, are errors.
            var succeeded = result.Failed == 0 && !result.Incomplete;
            try
            {
                await _notifications.SendAsync(new BuiltInNotification
                {
                    ConfigurationName = BuiltInNotificationNames.EmailTemplateDeleteFinished,
                    Event = succeeded ? "finished" : "finished-with-errors",
                    Title = "Template deleted from organizations",
                    Description = $"{command.Name} · {command.Language}: {result.Deleted} deleted, {result.NotFound} had no copy, {result.Skipped} skipped, {result.Failed} failed.",
                    IsSuccess = succeeded,
                    Ids = new Dictionary<string, string?> { { "jobId", command.JobId } },
                    UserIds = [command.RequestedByUserId],
                    TenantId = string.IsNullOrWhiteSpace(command.OriginalTenantId) ? command.TenantId : command.OriginalTenantId,
                }, cancellationToken);
            }
#pragma warning disable CA1031 // C9: the sender is best effort; the copies are already deleted.
            catch (Exception ex)
#pragma warning restore CA1031
            {
                _logger.LogDebug(ex, "Email template delete {JobId}: notification not sent", command.JobId);
            }
        }
    }
}
