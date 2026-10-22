using Blocks.Genesis.DataAccess;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Os.DataAccess.Notifications;

namespace Os.DataAccess;

public static class OsDataAccessExtensions
{
    /// <summary>
    /// Registers the Genesis resolver, <see cref="IOsDataAccess"/> and <see cref="IBuiltInNotificationSender"/>. Safe to call from every os module:
    /// the second call does nothing (AddBlocksDataAccess itself is not idempotent).
    /// </summary>
    public static IServiceCollection AddOsDataAccess(this IServiceCollection services)
    {
        // Every os module that calls this can send built-in notifications.
        services.TryAddSingleton<IBuiltInNotificationSender, BuiltInNotificationSender>();

        if (services.Any(d => d.ServiceType == typeof(IOsDataAccess)))
        {
            return services;
        }

        services.AddBlocksDataAccess();
        services.AddSingleton<IOsDataAccess, OsDataAccess>();
        return services;
    }
}
