using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace DomainService.Catalogue.Services;

/// <summary>
/// Publishes the shipped JSON on a fresh install, then loads whatever is active into memory.
/// Runs once at start and is idempotent, so an install that already has a catalogue is untouched.
/// </summary>
public sealed class CatalogueBootstrapService : IHostedService
{
    private readonly IServiceProvider _services;
    private readonly ILogger<CatalogueBootstrapService> _logger;
    private readonly string _dataDirectory;

    public CatalogueBootstrapService(IServiceProvider services, ILogger<CatalogueBootstrapService> logger, string? dataDirectory = null)
    {
        _services = services ?? throw new ArgumentNullException(nameof(services));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _dataDirectory = dataDirectory ?? Path.Combine(AppContext.BaseDirectory, "Catalogue", "Data");
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var scope = _services.CreateScope();
            var store = scope.ServiceProvider.GetRequiredService<ICatalogueStore>();
            var provider = scope.ServiceProvider.GetRequiredService<ICatalogueProvider>();

            await store.BootstrapAsync(_dataDirectory, "bootstrap", cancellationToken).ConfigureAwait(false);
            await provider.ReloadAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            // A service that cannot reach the catalogue still starts; every quota call degrades to
            // unmetered rather than the whole platform refusing to boot.
            _logger.LogError(ex, "The catalogue could not be loaded at start. Nothing will be metered until it can.");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
