using Blocks.Genesis;
using Configuration.DomainService.Actions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Configuration.DomainService.Webhooks;

public static class WebhookServiceCollectionExtensions
{
    /// <summary>
    /// Actions and webhooks: repositories, secret store, the dedicated outbound client, the API services and the
    /// worker services. Every type is a singleton: the secret store opens its own scope for <c>ISecretService</c>.
    /// Needs <see cref="IKeyValueStore"/>, <see cref="IDbContextProvider"/>, <see cref="IMessageClient"/> and an
    /// <see cref="System.Diagnostics.ActivitySource"/> (Genesis ConfigureServices) and Blocks Secrets.
    /// </summary>
    public static IServiceCollection AddActionsAndWebhooks(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.TryAddSingleton(TimeProvider.System);
        services.AddSingleton<IActionsRepository, ActionsRepository>();
        services.AddSingleton<IActionsService, ActionsService>();

        services.AddSingleton<IWebhookRepository, WebhookRepository>();
        services.AddSingleton<IWebhookDeliveryRepository, WebhookDeliveryRepository>();
        services.AddSingleton<IWebhookSecretStore, WebhookSecretStore>();
        services.AddSingleton<IWebhookDnsResolver, SystemDnsResolver>();
        services.AddSingleton<IWebhookAddressGuard, WebhookAddressGuard>();
        services.AddSingleton<IWebhookSender>(sp => new WebhookHttpSender(
            WebhookHttpHandler.Create(sp.GetRequiredService<IWebhookAddressGuard>()),
            sp.GetRequiredService<TimeProvider>()));
        services.AddSingleton<IWebhookJobQueue, WebhookJobQueue>();

        services.AddSingleton<IWebhookService, WebhookService>();
        services.AddSingleton<IWebhookTestService, WebhookTestService>();
        services.AddSingleton<IWebhookHistoryService, WebhookHistoryService>();

        services.AddSingleton<IWebhookFanOutService, WebhookFanOutService>();
        services.AddSingleton<IWebhookAttemptRunner, WebhookAttemptRunner>();
        services.AddSingleton<IWebhookDeliveryProcessor, WebhookDeliveryProcessor>();
        return services;
    }
}
