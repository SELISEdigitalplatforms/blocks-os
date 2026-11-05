namespace Configuration.DomainService.Mail.Template.Services
{
    /// <summary>What one copy job did, as the notification reports it.</summary>
    public sealed class EmailTemplateCopyResult
    {
        public bool SourceFound { get; init; } = true;
        public int Created { get; set; }
        public int Replaced { get; set; }
        public int Kept { get; set; }
        public int Skipped { get; set; }
        public int Failed { get; set; }

        /// <summary>The largest batch written, at most <see cref="EmailTemplateCopyJob.BatchSize"/>.</summary>
        public int LargestBatch { get; set; }
    }

    /// <summary>One batch's outcome from <see cref="IMailTemplateRepository.WriteOrganizationCopiesAsync"/>.</summary>
    public sealed class OrganizationCopyBatchResult
    {
        public int Created { get; set; }
        public int Replaced { get; set; }
        public int Kept { get; set; }
    }
}
