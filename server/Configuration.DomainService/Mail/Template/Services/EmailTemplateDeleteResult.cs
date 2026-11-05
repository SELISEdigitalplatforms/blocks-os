namespace Configuration.DomainService.Mail.Template.Services
{
    /// <summary>What one delete job did, as the notification reports it (SPEC34 §6.2).</summary>
    public sealed class EmailTemplateDeleteResult : IOrganizationTargetTally
    {
        public int Deleted { get; set; }

        /// <summary>Targeted organizations that had no template with the Name + Language.</summary>
        public int NotFound { get; set; }

        public int Skipped { get; set; }
        public int Failed { get; set; }

        /// <summary>True when not every target organization could be read, so some were never reached.</summary>
        public bool Incomplete { get; set; }

        /// <summary>The largest batch deleted, at most <see cref="OrganizationTargets.BatchSize"/>.</summary>
        public int LargestBatch { get; set; }
    }
}
