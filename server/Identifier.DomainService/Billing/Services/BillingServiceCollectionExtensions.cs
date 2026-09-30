using Blocks.Genesis;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace DomainService.Billing.Services;

public static class BillingServiceCollectionExtensions
{
    /// <summary>
    /// Subscriptions, cards, orders and the workers behind them.
    /// </summary>
    /// <remarks>
    /// Requires <c>AddBlocksSecrets</c>, which supplies the <c>ISecretValueStore</c> that card
    /// tokens and the Adyen credentials live in.
    /// </remarks>
    /// <param name="isProduction">
    /// Decides whether live Adyen credentials are accepted. False refuses them outright rather
    /// than letting a staging deployment charge real cards.
    /// </param>
    /// <param name="logicBaseUrl">
    /// Where blocks-logic serves its notification hub. Empty leaves notifications unsent, which
    /// costs progress updates and nothing else.
    /// </param>
    public static IServiceCollection AddBlocksBilling(
        this IServiceCollection services,
        bool isProduction = false,
        string? logicBaseUrl = null)
    {
        services.TryAddScoped<ITenantPaymentMethodRepository, TenantPaymentMethodRepository>();
        services.TryAddScoped<IBillingSecretStore, BillingSecretStore>();
        services.TryAddScoped<IPaymentMethodService, PaymentMethodService>();

        services.TryAddScoped<ISubscriptionOrderStore, SubscriptionOrderStore>();
        services.TryAddScoped<ICheckoutService, CheckoutService>();
        services.TryAddScoped<IOrderPaymentService, OrderPaymentService>();
        services.TryAddScoped<IProvisioningQueue, ProvisioningQueue>();
        services.TryAddScoped<IProvisioningStepRunner, ProvisioningStepRunner>();
        services.TryAddScoped<IOrderProvisioner, OrderProvisioner>();

        services.TryAddScoped<ISubscriptionStore, SubscriptionStore>();
        services.TryAddScoped<IInvoiceStore, InvoiceStore>();
        services.TryAddScoped<IRenewalService, RenewalService>();
        services.TryAddScoped<IInvoiceMailer, InvoiceMailer>();
        services.TryAddSingleton<IInvoicePdfWriter, InvoicePdfWriter>();

        // The payment provider's own notifications: the authority on whether money moved, and the
        // only path that files a card.
        services.TryAddScoped<IAdyenNotificationService, AdyenNotificationService>();
        services.TryAddScoped<IProcessedNotificationStore, ProcessedNotificationStore>();
        services.TryAddSingleton<IAdyenNotificationVerifier, AdyenNotificationVerifier>();

        services.TryAddSingleton<IAdyenConfiguration>(provider =>
            new AdyenConfiguration(
                provider.GetRequiredService<Blocks.Secrets.ISecretValueStore>(),
                provider.GetRequiredService<Microsoft.Extensions.Logging.ILogger<AdyenConfiguration>>(),
                isProduction));

        // Named clients rather than one shared: the payment provider and the notification hub have
        // nothing in common but the verb, and a timeout that suits one suits the other badly.
        services.AddHttpClient<IPaymentGateway, AdyenPaymentGateway>(client =>
        {
            // Shorter than the caller's patience on purpose. When this fires the charge may still
            // be in flight, which is an unknown outcome and never a decline.
            client.Timeout = TimeSpan.FromSeconds(20);
        });

        services.AddHttpClient<IOrderNotifier, OrderNotifier>(client =>
        {
            if (!string.IsNullOrWhiteSpace(logicBaseUrl))
            {
                client.BaseAddress = new Uri(logicBaseUrl.TrimEnd('/') + "/");
            }

            client.Timeout = TimeSpan.FromSeconds(10);
        });

        return services;
    }

    /// <summary>
    /// The background halves: the sweeper that finds orders nobody is working on, and the one-off
    /// index creation the idempotency rule depends on.
    /// </summary>
    public static IServiceCollection AddBlocksBillingWorkers(this IServiceCollection services)
    {
        services.AddHostedService<OrderSweeper>();
        services.AddHostedService<RenewalBackgroundService>();
        services.AddHostedService<BillingIndexInitializer>();

        // Without its menu in the access catalog, subscription::view can never be granted to a
        // contributor — and the gap is invisible because owners pass without consulting it.
        services.AddHostedService<AccessCatalogBootstrapService>();

        return services;
    }
}
