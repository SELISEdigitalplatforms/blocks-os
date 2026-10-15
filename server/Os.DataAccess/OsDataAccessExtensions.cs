using Blocks.Genesis.DataAccess;
using Microsoft.Extensions.DependencyInjection;

namespace Os.DataAccess;

public static class OsDataAccessExtensions
{
    /// <summary>
    /// Registers the Genesis resolver and <see cref="IOsDataAccess"/>. Safe to call from every os module:
    /// the second call does nothing (AddBlocksDataAccess itself is not idempotent).
    /// </summary>
    public static IServiceCollection AddOsDataAccess(this IServiceCollection services)
    {
        if (services.Any(d => d.ServiceType == typeof(IOsDataAccess)))
        {
            return services;
        }

        services.AddBlocksDataAccess();
        services.AddSingleton<IOsDataAccess, OsDataAccess>();
        return services;
    }
}
