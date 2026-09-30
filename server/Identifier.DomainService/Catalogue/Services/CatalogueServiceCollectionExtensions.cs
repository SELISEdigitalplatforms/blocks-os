using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace DomainService.Catalogue.Services;

public static class CatalogueServiceCollectionExtensions
{
    /// <summary>
    /// blocks-os owns the catalogue: it is published to the platform database, served to the
    /// console, and seeded per tenant. One registration; nothing downstream knows a meter by name.
    /// </summary>
    public static IServiceCollection AddBlocksCatalogue(this IServiceCollection services, string? dataDirectory = null)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.TryAddSingleton<ICatalogueStore, MongoCatalogueStore>();
        services.TryAddSingleton<ICatalogueProvider, CatalogueProvider>();
        services.TryAddScoped<IResourceLimitSeeder, ResourceLimitSeeder>();
        services.TryAddScoped<IUsageService, UsageService>();
        services.TryAddScoped<ISubscriptionLifecycleService, SubscriptionLifecycleService>();

        services.AddSingleton<IHostedService>(sp => new CatalogueBootstrapService(
            sp, sp.GetRequiredService<ILogger<CatalogueBootstrapService>>(), dataDirectory));

        return services;
    }
}
