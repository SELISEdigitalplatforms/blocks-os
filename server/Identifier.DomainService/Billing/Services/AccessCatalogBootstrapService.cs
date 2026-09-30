using Blocks.Genesis;
using DomainService.Access;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace DomainService.Billing.Services;

/// <summary>
/// Makes sure the subscription menu exists in the project access catalog.
/// </summary>
/// <remarks>
/// The catalog is seed data in the key-value store, edited outside the code so a menu can change
/// without a deploy. That is right for tuning it and wrong for introducing it: an endpoint carrying
/// <c>[ProjectPolicy("subscription::view")]</c> against a catalog that has never heard of the menu
/// fails in a way nobody notices. Owners pass regardless — the filter short-circuits on ownership —
/// so the gap only shows the first time somebody tries to delegate, which may be months later.
/// <para>
/// This adds the menu if it is absent and otherwise leaves the document exactly as it found it.
/// Anything an operator has since added stays; nothing here overwrites.
/// </para>
/// </remarks>
public sealed class AccessCatalogBootstrapService : IHostedService
{
    /// <summary>The menu a project's subscription pages sit under.</summary>
    public const string Menu = "subscription";

    /// <summary>
    /// Read only. Buying, topping up and card changes are owner-only and deliberately absent —
    /// an action that is not in the catalog is one no grant can ever confer.
    /// </summary>
    public static readonly IReadOnlyList<string> Actions = [ProjectAccessCatalog.ViewAction];

    private readonly IServiceProvider _services;
    private readonly ILogger<AccessCatalogBootstrapService> _logger;

    public AccessCatalogBootstrapService(IServiceProvider services, ILogger<AccessCatalogBootstrapService> logger)
    {
        _services = services;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var scope = _services.CreateScope();
            var store = scope.ServiceProvider.GetRequiredService<IKeyValueStore>();

            var catalog = await store
                .GetAsync<Dictionary<string, List<string>>>(
                    ProjectAccessCatalog.StoreKey,
                    impersonated: false,
                    cancellationToken)
                .ConfigureAwait(false)
                ?? [];

            if (catalog.ContainsKey(Menu))
            {
                return;
            }

            catalog[Menu] = [.. Actions];

            await store
                .SetAsync(ProjectAccessCatalog.StoreKey, catalog, impersonated: false, cancellationToken)
                .ConfigureAwait(false);

            _logger.LogInformation(
                "Added the {Menu} menu to the project access catalog so its grants can be delegated.",
                Menu);
        }
        catch (Exception exception)
        {
            // Not fatal: owners still reach every subscription page, because ownership is decided
            // from ProjectPeoples and never from this document. Only delegation suffers.
            _logger.LogError(
                exception,
                "The {Menu} menu could not be added to the project access catalog; contributors cannot be granted it.",
                Menu);
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
