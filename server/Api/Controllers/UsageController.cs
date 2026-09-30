using Blocks.Genesis;
using DomainService.Access;
using DomainService.Access.Services;
using DomainService.Catalogue.Services;
using Microsoft.AspNetCore.Mvc;

namespace BlocksOs.Api.Controllers;

/// <summary>
/// What a project is using, and the sync that gives an environment rows for anything new in the
/// catalogue.
/// </summary>
/// <remarks>
/// Scoped by project group, never by the caller's own tenant. A tenant is one environment and a
/// project is a group of them, so the subject of every call here is the group — which is also what
/// <see cref="ProjectPolicyAttribute"/> authorises against, so the read and the access check agree
/// on one identifier.
/// <para>
/// The rows live in the platform's root database. Nothing on this controller can reach a tenant
/// database, and nothing infers a tenant from the caller: a request that does not name a group is
/// refused rather than quietly answered for whichever project the caller happened to have open.
/// </para>
/// </remarks>
[ApiController]
[Route("[controller]")]
public class UsageController : ControllerBase
{
    private readonly IUsageService _usage;
    private readonly IResourceLimitSeeder _seeder;
    private readonly IProjectAccessService _access;

    public UsageController(IUsageService usage, IResourceLimitSeeder seeder, IProjectAccessService access)
    {
        _usage = usage;
        _seeder = seeder;
        _access = access;
    }

    /// <summary>Everything this project is using, one block per environment, grouped by service.</summary>
    [HttpGet]
    [ProtectedEndPoint("blocks-os::usage::read")]
    [ProjectPolicy("subscription::view")]
    public async Task<ProjectUsageResponse> Get([FromQuery] string tenantGroupId, CancellationToken cancellationToken)
    {
        // ProjectPolicyFilter lets a blank scope through on purpose — a request that carries the
        // field but leaves it empty is "unscoped", not "denied" — so the refusal belongs here.
        if (string.IsNullOrWhiteSpace(tenantGroupId))
        {
            return Missing<ProjectUsageResponse>();
        }

        var access = await _access.ResolveAsync(tenantGroupId, cancellationToken);

        return new ProjectUsageResponse
        {
            Usage = await _usage.GetAsync(tenantGroupId, access.TenantIds, cancellationToken)
        };
    }

    /// <summary>
    /// Brings one environment's rows in line with the catalogue. Safe to run repeatedly, and the
    /// way a newly added meter reaches an environment that already exists.
    /// </summary>
    [HttpPost("sync")]
    [ProtectedEndPoint("blocks-os::usage::save")]
    [ProjectPolicy("subscription::view")]
    public async Task<SyncUsageResponse> Sync([FromBody] SyncUsageRequest request, CancellationToken cancellationToken)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.TenantGroupId))
        {
            return Missing<SyncUsageResponse>();
        }

        if (string.IsNullOrWhiteSpace(request.TenantId))
        {
            return Failed<SyncUsageResponse>("TenantId", "TenantId is required.");
        }

        var access = await _access.ResolveAsync(request.TenantGroupId, cancellationToken);

        // The group was authorised, not this tenant. Without this a member of project A could name
        // project B's environment and have it synced under A's authorisation.
        if (!access.TenantIds.Contains(request.TenantId, StringComparer.Ordinal))
        {
            return Failed<SyncUsageResponse>("TenantId", "That environment is not part of this project.");
        }

        var outcome = await _seeder.SyncAsync(
            request.TenantId,
            request.Environment,
            request.PeriodKey,
            request.FreeTier,
            cancellationToken);

        return new SyncUsageResponse
        {
            Added = outcome.Added,
            Updated = outcome.Updated,
            Unchanged = outcome.Unchanged
        };
    }

    private static T Missing<T>() where T : BaseResponse, new() =>
        Failed<T>("TenantGroupId", "TenantGroupId is required.");

    private static T Failed<T>(string key, string message) where T : BaseResponse, new() =>
        new() { IsSuccess = false, Errors = new Dictionary<string, string> { { key, message } } };
}

public sealed class ProjectUsageResponse : BaseResponse
{
    public ProjectUsage Usage { get; set; } = new();
}

public sealed class SyncUsageRequest
{
    /// <summary>The project being synced. Read by <c>ProjectPolicyFilter</c> to authorise the call.</summary>
    public string TenantGroupId { get; set; } = string.Empty;

    /// <summary>Which environment of that project. Checked against the group's own tenants.</summary>
    public string TenantId { get; set; } = string.Empty;

    public string Environment { get; set; } = string.Empty;
    public string PeriodKey { get; set; } = string.Empty;
    public bool FreeTier { get; set; }
}

public sealed class SyncUsageResponse : BaseResponse
{
    public int Added { get; set; }
    public int Updated { get; set; }
    public int Unchanged { get; set; }
}
