using Blocks.Genesis;
using Configuration.DomainService.Organizations;
using Configuration.DomainService.Shared.Utilities;
using Microsoft.Extensions.Logging;

namespace Configuration.DomainService.Mail.Template.Services
{
    /// <inheritdoc />
    public class MailTemplateCopyService : IMailTemplateCopyService
    {
        /// <summary>Organizations per copy request when not all (SPEC33 §6.1).</summary>
        public const int MaxCopyOrganizations = 1000;

        /// <summary>Organizations per copies lookup: one page of the dialog's organization list (SPEC33 §6.2).</summary>
        public const int MaxLookupOrganizations = 25;

        private readonly IMailTemplateRepository _templateRepository;
        private readonly IMessageClient _messageClient;
        private readonly ILogger<MailTemplateCopyService> _logger;

        public MailTemplateCopyService(IMailTemplateRepository templateRepository, IMessageClient messageClient, ILogger<MailTemplateCopyService> logger)
        {
            _templateRepository = templateRepository;
            _messageClient = messageClient;
            _logger = logger;
        }

        public async Task<BaseMutationResponse> CopyToOrganizationsAsync(CopyTemplateToOrganizationsRequest request)
        {
            ArgumentNullException.ThrowIfNull(request);

            var template = string.IsNullOrWhiteSpace(request.TemplateId) ? null : await _templateRepository.GetByIdAsync(request.TemplateId);
            if (template is null)
                return Failure(nameof(request.TemplateId), "Template not found");
            // C1: only the Default organization's templates are copied; an organization's own template stays its own.
            if (OrganizationIds.Normalize(template.OrganizationId) != OrganizationIds.Default)
                return Failure(nameof(request.TemplateId), "Only Default organization templates can be copied");
            // C2: New Template's step 1 saves a template without a body; copying it would copy an empty email.
            if (string.IsNullOrWhiteSpace(template.TemplateBody))
                return Failure(nameof(request.TemplateId), "Finish the template before copying");

            var existing = request.Existing?.Trim().ToLowerInvariant();
            if (existing is not (EmailTemplateCopyExisting.Keep or EmailTemplateCopyExisting.Replace))
                return Failure(nameof(request.Existing), "Choose keep or replace");

            var organizationIds = request.AllOrganizations ? [] : OrganizationsOnly(request.OrganizationIds);
            if (!request.AllOrganizations && organizationIds.Count == 0)
                return Failure(nameof(request.OrganizationIds), "Select at least one organization");
            if (organizationIds.Count > MaxCopyOrganizations)
                return Failure(nameof(request.OrganizationIds), "No more than 1000 organizations per request");

            var context = BlocksContext.GetContext();
            if (string.IsNullOrWhiteSpace(context?.TenantId))
            {
                // A job without a project tenant has nowhere to copy to; it is never queued.
                _logger.LogError("Email template copy not queued: no project tenant. TemplateId={TemplateId}", template.ItemId);
                return Failure("Copy", "Copying couldn't start. Try again.");
            }

            var command = new EmailTemplateCopyCommand
            {
                JobId = Guid.NewGuid().ToString(),
                TenantId = context.TenantId,
                OriginalTenantId = string.IsNullOrWhiteSpace(context?.OriginalTenantId) ? null : context.OriginalTenantId,
                RequestedByUserId = context?.UserId ?? string.Empty,
                TemplateId = template.ItemId,
                AllOrganizations = request.AllOrganizations,
                OrganizationIds = organizationIds,
                Existing = existing,
            };

            try
            {
                await _messageClient.SendToConsumerAsync(new ConsumerMessage<EmailTemplateCopyCommand>
                {
                    ConsumerName = Constants.EmailTemplateQueue,
                    Payload = command,
                });
            }
#pragma warning disable CA1031 // C9: any send failure is the same answer to the caller; the job simply didn't start.
            catch (Exception ex)
#pragma warning restore CA1031
            {
                _logger.LogError(ex, "Email template copy not queued. JobId={JobId} TemplateId={TemplateId} ErrorType={ErrorType}",
                    command.JobId, command.TemplateId, ex.GetType().Name);
                return Failure("Copy", "Copying couldn't start. Try again.");
            }

            return new BaseMutationResponse { IsSuccess = true, ItemId = command.JobId };
        }

        public async Task<GetTemplateOrganizationCopiesResponse> GetOrganizationCopiesAsync(GetTemplateOrganizationCopiesRequest request)
        {
            ArgumentNullException.ThrowIfNull(request);

            var template = string.IsNullOrWhiteSpace(request.TemplateId) ? null : await _templateRepository.GetByIdAsync(request.TemplateId);
            if (template is null)
                return CopiesFailure(nameof(request.TemplateId), "Template not found");

            var organizationIds = OrganizationsOnly(request.OrganizationIds?.Split(','));
            if (organizationIds.Count > MaxLookupOrganizations)
                return CopiesFailure(nameof(request.OrganizationIds), "No more than 25 organizations per request");
            if (organizationIds.Count == 0)
                return new GetTemplateOrganizationCopiesResponse { IsSuccess = true };

            var copies = await _templateRepository.GetOrganizationCopiesAsync(template.Name ?? string.Empty, template.Language ?? string.Empty, organizationIds);
            return new GetTemplateOrganizationCopiesResponse
            {
                IsSuccess = true,
                Copies = copies
                    .Where(c => c.ItemId != template.ItemId)
                    .Select(c => new TemplateOrganizationCopy
                    {
                        OrganizationId = c.OrganizationId,
                        TemplateId = c.ItemId,
                        LastUpdatedDate = c.LastUpdatedDate,
                    })
                    .ToList(),
            };
        }

        // Distinct organization ids, trimmed; blanks and the Default organization (the source's own) are left out.
        private static List<string> OrganizationsOnly(IEnumerable<string>? organizationIds) =>
            (organizationIds ?? [])
                .Select(id => id?.Trim() ?? string.Empty)
                .Where(id => id.Length > 0 && OrganizationIds.Normalize(id) != OrganizationIds.Default)
                .Distinct(StringComparer.Ordinal)
                .ToList();

        private static BaseMutationResponse Failure(string field, string message) =>
            new() { IsSuccess = false, Errors = new Dictionary<string, string> { { field, message } } };

        private static GetTemplateOrganizationCopiesResponse CopiesFailure(string field, string message) =>
            new() { IsSuccess = false, Errors = new Dictionary<string, string> { { field, message } } };
    }
}
