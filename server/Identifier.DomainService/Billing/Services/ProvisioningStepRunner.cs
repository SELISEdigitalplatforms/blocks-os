using Blocks.Genesis;
using DomainService.Billing.Entities;
using DomainService.Catalogue.Services;
using DomainService.Dtos;
using DomainService.Projects;
using DomainService.Shared;
using Microsoft.Extensions.Logging;

namespace DomainService.Billing.Services;

/// <summary>
/// Turns one of an order's six steps into the work blocks-os already does.
/// </summary>
/// <remarks>
/// The steps are not invented: they are the flags <c>ProjectStatusTracer</c> already records while
/// a project is configured. This maps onto them rather than duplicating the work — creation and
/// configuration stay where they are, and each step here checks the tracer for its own flag.
/// <para>
/// Every step is safe to run twice. That is the whole reason an order can be retried: a step that
/// already happened reports success from the tracer instead of doing it again.
/// </para>
/// </remarks>
public sealed class ProvisioningStepRunner : IProvisioningStepRunner
{
    private readonly IProjectRepository _projects;
    private readonly IProjectManagementService _projectManagement;
    private readonly IResourceLimitSeeder _seeder;
    private readonly ICatalogueProvider _catalogue;
    private readonly ILogger<ProvisioningStepRunner> _logger;

    public ProvisioningStepRunner(
        IProjectRepository projects,
        IProjectManagementService projectManagement,
        IResourceLimitSeeder seeder,
        ICatalogueProvider catalogue,
        ILogger<ProvisioningStepRunner> logger)
    {
        _projects = projects;
        _projectManagement = projectManagement;
        _seeder = seeder;
        _catalogue = catalogue;
        _logger = logger;
    }

    public async Task<StepOutcome> RunAsync(
        SubscriptionOrder order,
        OrderEnvironmentProgress environment,
        string step,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(order);
        ArgumentNullException.ThrowIfNull(environment);

        try
        {
            return step switch
            {
                ProvisioningSteps.CreateTenant => await CreateTenantAsync(order, environment).ConfigureAwait(false),
                ProvisioningSteps.SeedQuota => await SeedQuotaAsync(order, environment, cancellationToken).ConfigureAwait(false),
                ProvisioningSteps.RaiseLimits => await RaiseLimitsAsync(order, environment, cancellationToken).ConfigureAwait(false),
                _ => await ConfirmFromTracerAsync(environment, step).ConfigureAwait(false),
            };
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception exception)
        {
            // Anything unexpected is transient until proven otherwise — the order retries, and the
            // five-attempt ceiling stops it going round forever.
            _logger.LogError(
                exception,
                "Step {Step} threw for {Environment} on order {OrderId}.",
                step,
                environment.Environment,
                order.ItemId);

            return StepOutcome.Failed(exception.GetType().Name);
        }
    }

    /// <summary>
    /// Creates the environment's tenant, or adopts the one already there.
    /// </summary>
    /// <remarks>
    /// The tenant id is derived rather than searched for — <c>SaveProjectAsync</c> builds it from
    /// the environment and the group — so a repeat of this step recognises its own earlier work
    /// exactly, instead of guessing from a name.
    /// <para>
    /// Creation goes through the existing project flow, which also publishes the message that
    /// drives configuration. That is what makes the later steps' tracer flags appear at all: this
    /// does not configure anything itself, it starts the flow that does.
    /// </para>
    /// </remarks>
    private async Task<StepOutcome> CreateTenantAsync(SubscriptionOrder order, OrderEnvironmentProgress environment)
    {
        var expectedTenantId = ExpectedTenantId(order.TenantGroupId, environment.Environment);

        var tenants = await _projects.GetByGroupIdAsync(order.TenantGroupId).ConfigureAwait(false);
        var existing = tenants?.FirstOrDefault(t =>
            string.Equals(t.TenantId, expectedTenantId, StringComparison.OrdinalIgnoreCase))?.TenantId;

        if (existing is not null)
        {
            // Already created, by an earlier attempt or by the flow that started this order.
            return StepOutcome.Ok(existing);
        }

        // The worker has no request behind it, so the acting user comes from the order. Without
        // this the tenant is recorded as created by nobody.
        var restore = BlocksContext.GetContext();

        BlocksContext.SetContext(BlocksContext.Create(
            tenantId: null,
            roles: null,
            userId: order.CreatedByUserId,
            isAuthenticated: true,
            requestUri: null,
            organizationId: null,
            expireOn: DateTime.UtcNow.AddMinutes(30),
            email: null,
            permissions: null,
            userName: order.CreatedByUserId,
            phoneNumber: null,
            displayName: null,
            oauthToken: null,
            originalTenantId: null));

        try
        {
            var name = await ProjectNameAsync(order.TenantGroupId, tenants).ConfigureAwait(false);

            var created = await _projectManagement
                .SaveProjectAsync(new CreateProjectRequest
                {
                    // Naming the existing group is what makes this an added environment rather
                    // than a new project: the flow skips the creator row and reuses the group.
                    TenantGroupId = order.TenantGroupId,
                    Name = name,
                    IsAcceptBlocksTerms = true,
                    applicationContexts =
                    [
                        new ApplicationContext { Environment = environment.Environment },
                    ],
                })
                .ConfigureAwait(false);

            if (created is null || !created.IsSuccess)
            {
                var reason = created?.Errors?.Values.FirstOrDefault() ?? "create_failed";
                _logger.LogWarning(
                    "Creating {Environment} for {TenantGroupId} was refused: {Reason}",
                    environment.Environment,
                    order.TenantGroupId,
                    reason);

                return StepOutcome.Failed(reason);
            }
        }
        finally
        {
            BlocksContext.SetContext(restore);
        }

        var tenantId = await FindTenantAsync(order.TenantGroupId, expectedTenantId).ConfigureAwait(false);

        // Created but not yet readable is a transient state, not a failure: the retry adopts it.
        return tenantId is null
            ? StepOutcome.Failed("tenant_not_ready")
            : StepOutcome.Ok(tenantId);
    }

    /// <summary>
    /// The id <c>SaveProjectAsync</c> gives a tenant, computed the same way it does.
    /// </summary>
    private static string ExpectedTenantId(string tenantGroupId, string environmentKey) =>
        IdentifierHelper.EnvironmentMapper(environmentKey).ToUpperInvariant() + tenantGroupId;

    private async Task<string?> FindTenantAsync(string tenantGroupId, string expectedTenantId)
    {
        var tenants = await _projects.GetByGroupIdAsync(tenantGroupId).ConfigureAwait(false);

        return tenants?.FirstOrDefault(t =>
            string.Equals(t.TenantId, expectedTenantId, StringComparison.OrdinalIgnoreCase))?.TenantId;
    }

    /// <summary>
    /// Confirms a configuration step from <c>ProjectStatusTracer</c>.
    /// </summary>
    /// <remarks>
    /// The configuration flow writes these flags as it goes and resumes its own unfinished work,
    /// so the honest thing here is to read what it recorded rather than to run it again from the
    /// side and risk two flows configuring one project at once.
    /// </remarks>
    private async Task<StepOutcome> ConfirmFromTracerAsync(OrderEnvironmentProgress environment, string step)
    {
        if (string.IsNullOrWhiteSpace(environment.TenantId))
        {
            return StepOutcome.Failed("tenant_unknown");
        }

        var tracer = await _projects.GetUnfinishedProjectByIdAsync(environment.TenantId).ConfigureAwait(false);

        // No unfinished record means the configuration flow completed and cleared it, which is
        // success for every step it covers.
        if (tracer is null)
        {
            return StepOutcome.Ok(environment.TenantId);
        }

        var done = step switch
        {
            ProvisioningSteps.AddPeople => tracer.InsertedIntoProjectPeople,
            ProvisioningSteps.UploadCertificates => tracer.IsCertificatesUploaded,
            ProvisioningSteps.CopyConfiguration => tracer.IsDefaultConfigurationCopied,
            ProvisioningSteps.ApplySettings => tracer.IsProjectUpdated,
            _ => false,
        };

        return done
            ? StepOutcome.Ok(environment.TenantId)
            : StepOutcome.Failed(string.IsNullOrWhiteSpace(tracer.ErrorMessage) ? "step_not_complete" : tracer.ErrorMessage);
    }

    /// <summary>
    /// Whether a line was bought at the free price. The flag decides; a zero amount only counts on
    /// an order written before the flag existed, where it was the only way to say "free". A paid
    /// line prorated to almost nothing carries its full price and is never read as free.
    /// </summary>
    public static bool IsFreeTier(OrderLine line) =>
        line.FreeTier || (line.Amount == 0m && line.RecurringAmount is null);

    /// <summary>
    /// The project's name, for a new environment's tenant. Taken from an environment the group
    /// already has, or from the group record when this is its first; the group id only as a last
    /// resort, which is what every added environment used to be called.
    /// </summary>
    private async Task<string> ProjectNameAsync(string tenantGroupId, IEnumerable<Tenant>? tenants)
    {
        var named = tenants?.FirstOrDefault(t => !string.IsNullOrWhiteSpace(t.Name))?.Name;

        if (!string.IsNullOrWhiteSpace(named))
        {
            return named;
        }

        var group = await _projects.GetTenantAssetByGroupIdAsync(tenantGroupId).ConfigureAwait(false);

        return string.IsNullOrWhiteSpace(group?.Name) ? tenantGroupId : group.Name;
    }

    /// <summary>
    /// The one step of an upgrade: the existing tenant's rows move to the paid limit set.
    /// </summary>
    /// <remarks>
    /// Inside the current period, so usage is kept exactly where it is and only ceilings rise.
    /// Safe to repeat: a second run finds the rows already on the paid set.
    /// </remarks>
    private async Task<StepOutcome> RaiseLimitsAsync(
        SubscriptionOrder order,
        OrderEnvironmentProgress environment,
        CancellationToken cancellationToken)
    {
        var tenantId = environment.TenantId;

        if (string.IsNullOrWhiteSpace(tenantId))
        {
            var tenants = await _projects.GetByGroupIdAsync(order.TenantGroupId).ConfigureAwait(false);
            tenantId = tenants?.FirstOrDefault(t => string.Equals(t.Environment, environment.Environment, StringComparison.Ordinal))?.TenantId
                ?? string.Empty;
        }

        if (string.IsNullOrWhiteSpace(tenantId))
        {
            return StepOutcome.Failed("tenant_unknown");
        }

        await _seeder
            .ChangeTierAsync(tenantId, environment.Environment, freeTier: false, cancellationToken)
            .ConfigureAwait(false);

        return StepOutcome.Ok(tenantId);
    }

    /// <summary>Gives the environment a row for every meter the catalogue defines.</summary>
    private async Task<StepOutcome> SeedQuotaAsync(
        SubscriptionOrder order,
        OrderEnvironmentProgress environment,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(environment.TenantId))
        {
            return StepOutcome.Failed("tenant_unknown");
        }

        var freeTier = order.Lines.Any(l =>
            string.Equals(l.Environment, environment.Environment, StringComparison.Ordinal)
            && l.Kind == "environment"
            && IsFreeTier(l));

        var periodKey = order.ChargedAtUtc?.ToString("yyyy-MM-dd")
            ?? order.CreatedAtUtc.ToString("yyyy-MM-dd");

        await _seeder
            .SyncAsync(environment.TenantId, environment.Environment, periodKey, freeTier, cancellationToken)
            .ConfigureAwait(false);

        return StepOutcome.Ok(environment.TenantId);
    }
}
