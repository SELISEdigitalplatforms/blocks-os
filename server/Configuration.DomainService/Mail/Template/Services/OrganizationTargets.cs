using Configuration.DomainService.Organizations;
using Microsoft.Extensions.Logging;

namespace Configuration.DomainService.Mail.Template.Services
{
    /// <summary>The counts a job's organization targeting adds to: organizations skipped, failed or never reached.</summary>
    public interface IOrganizationTargetTally
    {
        int Skipped { get; set; }
        int Failed { get; set; }
        bool Incomplete { get; set; }
    }

    /// <summary>
    /// The target organizations of a copy job (SPEC33) or a delete job (SPEC34), in batches of <see cref="BatchSize"/>:
    /// every enabled organization of the project except Default, read page by page; or the requested ones that exist
    /// and are enabled. Unknown or disabled organizations are counted as skipped; organizations that couldn't be read
    /// are counted as failed, or, when paging stops, mark the run incomplete. Read errors never escape: the job always
    /// ends with its notification. Logs carry ids only.
    /// </summary>
    internal sealed class OrganizationTargets
    {
        /// <summary>Organizations per read and per write (SPEC33 §5, SPEC34 §5).</summary>
        public const int BatchSize = 100;

        private readonly IOrganizationReader _organizationReader;
        private readonly ILogger _logger;
        private readonly string _job;

        /// <param name="job">The job's kind and id for log lines, e.g. "Email template copy 1f2e…".</param>
        public OrganizationTargets(IOrganizationReader organizationReader, ILogger logger, string job)
        {
            _organizationReader = organizationReader;
            _logger = logger;
            _job = job;
        }

        public IAsyncEnumerable<List<string>> BatchesAsync(bool allOrganizations, IEnumerable<string> organizationIds, IOrganizationTargetTally tally,
            CancellationToken cancellationToken) =>
            allOrganizations
                ? AllBatchesAsync(tally, cancellationToken)
                : RequestedBatchesAsync(organizationIds, tally, cancellationToken);

        /// <summary>Every enabled organization except Default, one page per batch, until a short or unreadable page.</summary>
        private async IAsyncEnumerable<List<string>> AllBatchesAsync(IOrganizationTargetTally tally,
            [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken)
        {
            string? after = null;
            while (true)
            {
                var page = await ReadPageAsync(after, tally, cancellationToken);
                if (page is null || page.Count == 0)
                {
                    yield break;
                }

                // The Default organization is never a target (H4), even if an organization document carries its id.
                var targets = page
                    .Select(o => o.ItemId)
                    .Where(id => OrganizationIds.Normalize(id) != OrganizationIds.Default)
                    .ToList();
                if (targets.Count > 0)
                {
                    yield return targets;
                }

                if (page.Count < BatchSize)
                {
                    yield break;
                }

                after = page[^1].ItemId;
            }
        }

        /// <summary>The requested organizations that exist and are enabled, in chunks of <see cref="BatchSize"/>.</summary>
        private async IAsyncEnumerable<List<string>> RequestedBatchesAsync(IEnumerable<string> organizationIds, IOrganizationTargetTally tally,
            [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken)
        {
            var requested = organizationIds
                .Where(id => !string.IsNullOrWhiteSpace(id) && OrganizationIds.Normalize(id) != OrganizationIds.Default)
                .Distinct(StringComparer.Ordinal)
                .ToList();
            foreach (var chunk in requested.Chunk(BatchSize))
            {
                var enabled = await ReadEnabledAsync(chunk, cancellationToken);
                if (enabled is null)
                {
                    // Organizations that couldn't be checked weren't reached; they are reported as failed.
                    tally.Failed += chunk.Length;
                    continue;
                }

                tally.Skipped += chunk.Length - enabled.Count;
                var batch = chunk.Where(enabled.Contains).ToList();
                if (batch.Count > 0)
                {
                    yield return batch;
                }
            }
        }

        /// <summary>One page of every enabled organization, or null when it can't be read: paging stops there.</summary>
        private async Task<IReadOnlyList<OrganizationSummary>?> ReadPageAsync(string? after, IOrganizationTargetTally tally, CancellationToken cancellationToken)
        {
            try
            {
                return await _organizationReader.GetEnabledPageAsync(after, BatchSize, cancellationToken);
            }
#pragma warning disable CA1031 // the organizations after this page are never reached; the job reports that and ends.
            catch (Exception ex)
#pragma warning restore CA1031
            {
                tally.Incomplete = true;
                _logger.LogError(ex, "{Job}: organizations after {After} could not be read; the job stopped there. ErrorType={ErrorType}",
                    _job, after ?? "(start)", ex.GetType().Name);
                return null;
            }
        }

        /// <summary>The enabled organizations among <paramref name="chunk"/>, or null when they can't be read.</summary>
        private async Task<IReadOnlySet<string>?> ReadEnabledAsync(string[] chunk, CancellationToken cancellationToken)
        {
            try
            {
                return await _organizationReader.GetEnabledAmongAsync(chunk, cancellationToken);
            }
#pragma warning disable CA1031 // this chunk is reported as failed and the job goes on with the next one.
            catch (Exception ex)
#pragma warning restore CA1031
            {
                _logger.LogError(ex, "{Job}: organizations could not be checked. OrganizationIds={OrganizationIds} ErrorType={ErrorType}",
                    _job, string.Join(",", chunk), ex.GetType().Name);
                return null;
            }
        }
    }
}
