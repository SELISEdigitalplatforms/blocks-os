using Blocks.Genesis.Entities.Os;
using Configuration.DomainService.Organizations;
using Microsoft.Extensions.Logging;
using Os.DataAccess.Notifications;

namespace Configuration.DomainService.Mail.Template.Services
{
    /// <inheritdoc />
    /// <remarks>
    /// SPEC33 §6.3. Runs in the project tenant of the command (the Worker consumer sets it). Target organizations are
    /// read from that project's database, 100 at a time, and each batch is one read and one bulk write, so memory
    /// stays bounded by one batch. Logs carry ids only, never subjects or bodies.
    /// </remarks>
    public class EmailTemplateCopyJob : IEmailTemplateCopyJob
    {
        /// <summary>Organizations per read and per bulk write (SPEC33 §5).</summary>
        public const int BatchSize = 100;

        private readonly IMailTemplateRepository _templateRepository;
        private readonly IOrganizationReader _organizationReader;
        private readonly IBuiltInNotificationSender _notifications;
        private readonly ILogger<EmailTemplateCopyJob> _logger;

        public EmailTemplateCopyJob(IMailTemplateRepository templateRepository, IOrganizationReader organizationReader, IBuiltInNotificationSender notifications, ILogger<EmailTemplateCopyJob> logger)
        {
            _templateRepository = templateRepository;
            _organizationReader = organizationReader;
            _notifications = notifications;
            _logger = logger;
        }

        public async Task<EmailTemplateCopyResult> RunAsync(EmailTemplateCopyCommand command, CancellationToken cancellationToken = default)
        {
            ArgumentNullException.ThrowIfNull(command);

            // C6: a source deleted (or no longer a Default template) since the request is copied nowhere. A source that
            // can't be read ends the same way: the requester is told, and the message isn't redelivered forever.
            EmailTemplate? source;
            try
            {
                source = await _templateRepository.GetByIdAsync(command.TemplateId);
            }
#pragma warning disable CA1031 // the job always ends with a notification; the error is logged with ids only.
            catch (Exception ex)
#pragma warning restore CA1031
            {
                _logger.LogError(ex, "Email template copy {JobId}: source template {TemplateId} could not be read. ErrorType={ErrorType}",
                    command.JobId, command.TemplateId, ex.GetType().Name);
                source = null;
            }

            if (source is null || OrganizationIds.Normalize(source.OrganizationId) != OrganizationIds.Default)
            {
                _logger.LogWarning("Email template copy {JobId}: source template {TemplateId} not found in the Default organization; nothing copied",
                    command.JobId, command.TemplateId);
                var missing = new EmailTemplateCopyResult { SourceFound = false };
                await NotifyAsync(command, null, missing, cancellationToken);
                return missing;
            }

            var result = new EmailTemplateCopyResult();
            var replace = string.Equals(command.Existing, EmailTemplateCopyExisting.Replace, StringComparison.Ordinal);

            await foreach (var batch in TargetBatchesAsync(command, result, cancellationToken))
            {
                result.LargestBatch = Math.Max(result.LargestBatch, batch.Count);
                try
                {
                    var written = await _templateRepository.WriteOrganizationCopiesAsync(source, batch, replace, command.TenantId, command.RequestedByUserId);
                    result.Created += written.Created;
                    result.Replaced += written.Replaced;
                    result.Kept += written.Kept;
                    result.Failed += written.Failed;
                    if (written.Failed > 0)
                    {
                        // C5: ids and the error type only, as for a failed batch.
                        _logger.LogError("Email template copy {JobId}: some organizations failed. TemplateId={TemplateId} OrganizationIds={OrganizationIds} ErrorType={ErrorType}",
                            command.JobId, command.TemplateId, string.Join(",", written.FailedOrganizationIds), written.RacedReplaceErrorType ?? "NoCopyAfterWrite");
                    }
                }
#pragma warning disable CA1031 // C5: one failed batch is reported and the job goes on with the next one.
                catch (Exception ex)
#pragma warning restore CA1031
                {
                    result.Failed += batch.Count;
                    _logger.LogError(ex, "Email template copy {JobId}: a batch failed. TemplateId={TemplateId} OrganizationIds={OrganizationIds} ErrorType={ErrorType}",
                        command.JobId, command.TemplateId, string.Join(",", batch), ex.GetType().Name);
                }
            }

            _logger.LogInformation("Email template copy {JobId} finished. TemplateId={TemplateId} Created={Created} Replaced={Replaced} Kept={Kept} Skipped={Skipped} Failed={Failed}",
                command.JobId, command.TemplateId, result.Created, result.Replaced, result.Kept, result.Skipped, result.Failed);
            await NotifyAsync(command, source, result, cancellationToken);
            return result;
        }

        /// <summary>
        /// The target organizations in batches of <see cref="BatchSize"/>: every enabled organization (H3), or the given
        /// ones that exist and are enabled (unknown or disabled ones are counted as skipped, C3).
        /// </summary>
        private async IAsyncEnumerable<List<string>> TargetBatchesAsync(EmailTemplateCopyCommand command, EmailTemplateCopyResult result,
            [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken)
        {
            if (command.AllOrganizations)
            {
                string? after = null;
                while (true)
                {
                    var page = await ReadPageAsync(command, after, result, cancellationToken);
                    if (page is null || page.Count == 0)
                    {
                        yield break;
                    }

                    yield return page.Select(o => o.ItemId).ToList();
                    if (page.Count < BatchSize)
                    {
                        yield break;
                    }

                    after = page[^1].ItemId;
                }
            }

            var requested = command.OrganizationIds
                .Where(id => !string.IsNullOrWhiteSpace(id) && OrganizationIds.Normalize(id) != OrganizationIds.Default)
                .Distinct(StringComparer.Ordinal)
                .ToList();
            foreach (var chunk in requested.Chunk(BatchSize))
            {
                var enabled = await ReadEnabledAsync(command, chunk, cancellationToken);
                if (enabled is null)
                {
                    // C5: organizations that couldn't be checked weren't reached; they are reported as failed.
                    result.Failed += chunk.Length;
                    continue;
                }

                result.Skipped += chunk.Length - enabled.Count;
                var batch = chunk.Where(enabled.Contains).ToList();
                if (batch.Count > 0)
                {
                    yield return batch;
                }
            }
        }

        /// <summary>One page of every enabled organization, or null when it can't be read: paging stops there (C5).</summary>
        private async Task<IReadOnlyList<OrganizationSummary>?> ReadPageAsync(EmailTemplateCopyCommand command, string? after, EmailTemplateCopyResult result, CancellationToken cancellationToken)
        {
            try
            {
                return await _organizationReader.GetEnabledPageAsync(after, BatchSize, cancellationToken);
            }
#pragma warning disable CA1031 // the organizations after this page are never reached; the job reports that and ends.
            catch (Exception ex)
#pragma warning restore CA1031
            {
                result.Incomplete = true;
                _logger.LogError(ex, "Email template copy {JobId}: organizations after {After} could not be read; copying stopped there. ErrorType={ErrorType}",
                    command.JobId, after ?? "(start)", ex.GetType().Name);
                return null;
            }
        }

        /// <summary>The enabled organizations among <paramref name="chunk"/>, or null when they can't be read.</summary>
        private async Task<IReadOnlySet<string>?> ReadEnabledAsync(EmailTemplateCopyCommand command, string[] chunk, CancellationToken cancellationToken)
        {
            try
            {
                return await _organizationReader.GetEnabledAmongAsync(chunk, cancellationToken);
            }
#pragma warning disable CA1031 // C5: this chunk is reported as failed and the job goes on with the next one.
            catch (Exception ex)
#pragma warning restore CA1031
            {
                _logger.LogError(ex, "Email template copy {JobId}: organizations could not be checked. OrganizationIds={OrganizationIds} ErrorType={ErrorType}",
                    command.JobId, string.Join(",", chunk), ex.GetType().Name);
                return null;
            }
        }

        /// <summary>H6: the bell notification to the requester. Best effort (C7): a failure here never fails the job.</summary>
        private async Task NotifyAsync(EmailTemplateCopyCommand command, EmailTemplate? source, EmailTemplateCopyResult result, CancellationToken cancellationToken)
        {
            // §6.3 has two events: a missing source, failed organizations or organizations never reached are errors.
            var succeeded = result.SourceFound && result.Failed == 0 && !result.Incomplete;
            var notificationEvent = succeeded ? "finished" : "finished-with-errors";

            var description = source is null
                ? "The Default organization template no longer exists. Nothing was copied."
                : $"{source.Name} · {source.Language}: {result.Created} created, {result.Replaced} replaced, {result.Kept} kept, {result.Skipped} skipped, {result.Failed} failed.";

            try
            {
                await _notifications.SendAsync(new BuiltInNotification
                {
                    ConfigurationName = BuiltInNotificationNames.EmailTemplateCopyFinished,
                    Event = notificationEvent,
                    Title = "Template copied to organizations",
                    Description = description,
                    IsSuccess = succeeded,
                    Ids = new Dictionary<string, string?> { { "templateId", command.TemplateId }, { "jobId", command.JobId } },
                    UserIds = [command.RequestedByUserId],
                    TenantId = string.IsNullOrWhiteSpace(command.OriginalTenantId) ? command.TenantId : command.OriginalTenantId,
                }, cancellationToken);
            }
#pragma warning disable CA1031 // C7: the sender is best effort; the copies are already written.
            catch (Exception ex)
#pragma warning restore CA1031
            {
                _logger.LogDebug(ex, "Email template copy {JobId}: notification not sent", command.JobId);
            }
        }
    }
}
