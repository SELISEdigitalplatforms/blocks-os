using Blocks.Genesis;
using Cloud.LmtService.Models.ArchiveAndDelete;
using Cloud.LmtService.Models.ColdRestore;
using LmtColdArchiveRestoreWorker.Consumers.ArchiveRestore;
using LmtColdArchiveRestoreWorker.Consumers.ColdRestore;
using LmtColdArchiveRestoreWorker.Consumers.Maintenance;
using Microsoft.Extensions.DependencyInjection;

namespace LmtColdArchiveRestoreWorker.Consumers
{
    /// <summary>
    /// This worker's message-type to consumer map.
    /// <para>
    /// Genesis builds its routing table from these registrations and dispatches on the message type
    /// <em>name</em> - the queue a message arrived on is never consulted. So this list, not the
    /// queue list in Constants, is what decides which code runs. It lives here rather than inline in
    /// Program.cs so the map can be asserted in tests; see LmtConsumerRegistrationTests.
    /// </para>
    /// </summary>
    public static class LmtConsumerRegistration
    {
        public static IServiceCollection AddLmtConsumers(this IServiceCollection services)
        {
            // The scheduler publishes PublishScheduleCommand to every queue it drives, so this one
            // registration owns all three maintenance schedules and fans them out on the schedule's
            // Payload. Registering any other consumer for this type would make the routing table
            // throw at startup.
            services.AddSingleton<IConsumer<PublishScheduleCommand>, ScheduledMaintenanceRouter>();

            // Each job also keeps a message type of its own, so the on-demand API endpoints can
            // reach it directly rather than through a schedule payload.
            services.AddSingleton<IConsumer<RunBackupCommand>, StartBackupConsumer>();
            services.AddSingleton<IConsumer<RunCleanupCommand>, ExpiredDataCleanupConsumer>();
            services.AddSingleton<IConsumer<RunHydrationCheckCommand>, HydrationCheckConsumer>();

            services.AddSingleton<IConsumer<ArchiveRestoreMessage>, ArchiveRestoreConsumer>();
            services.AddSingleton<IConsumer<ColdRestoreMessage>, ColdRestoreConsumer>();

            return services;
        }
    }
}
