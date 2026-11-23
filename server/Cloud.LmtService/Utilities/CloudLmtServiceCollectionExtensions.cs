using Cloud.LmtService.Repositories.ArchiveAndDelete;
using Os.DataAccess;
using Os.DataAccess;
using Cloud.LmtService.Repositories.ColdRestore;
using Cloud.LmtService.Repositories.LogTraceBackup;
using Cloud.LmtService.Repositories.Logs;
using Cloud.LmtService.Repositories.Shared;
using Cloud.LmtService.Repositories.Trace;
using Cloud.LmtService.Services.ArchiveAndDelete;
using Cloud.LmtService.Services.BlocksServices;
using Cloud.LmtService.Services.ColdRestore;
using Cloud.LmtService.Services.Logs;
using Cloud.LmtService.Services.Trace;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Text;

namespace Cloud.LmtService.Utilities
{
    public static class CloudLmtServiceCollectionExtensions
    {
        public static void AddCloudLmtServices(this IServiceCollection services)
        {
            services.AddOsDataAccess();
            services.AddSingleton<ILogService, LogService>();
            services.AddSingleton<ILogRepository, LogRepository>();
            services.AddSingleton<ITraceRepository, TraceRepository>();
            services.AddSingleton<ITraceService, TraceService>();
            services.AddSingleton<IBlocksServicesService, BlocksServicesService>();

            services.AddSingleton<ILmtArchiveRestoreConfigurationRepository, LmtArchiveRestoreConfigurationsRepository>();
            // The telemetry cold archive store: Azure (default) or S3, by LmtArchive:Storage:Provider (I02-WP10).
            services.AddSingleton<IBlobStorage>(sp =>
            {
                var configuration = sp.GetRequiredService<IConfiguration>();
                return LmtArchiveStorageOptions.ReadProvider(configuration) == LmtArchiveStorageProvider.S3
                    ? new S3BlobStorage(LmtS3ArchiveOptions.FromConfiguration(configuration), sp.GetRequiredService<ILmtArchiveRestoreConfigurationRepository>(), sp.GetRequiredService<ILogger<S3BlobStorage>>())
                    : ActivatorUtilities.CreateInstance<BlobStorage>(sp);
            });
            services.AddSingleton<IArchiveRepository, ArchiveRepository>();
            services.AddSingleton<ILogTraceBackupRepository, LogTraceBackupRepository>();
            // The backup reads "today" and its time budget from the clock; tests substitute it.
            services.TryAddSingleton(TimeProvider.System);
            services.AddSingleton<IArchiveService, ArchiveService>();
            services.AddSingleton<ILogTraceRestoreRepository, LogTraceRestoreRepository>();
            services.AddSingleton<ILogTraceRestoreResultRepository, LogTraceRestoreResultRepository>();
            services.AddSingleton<ILogTraceRestoreParquetReader, LogTraceRestoreParquetReader>();
            services.AddSingleton<ILogTraceRestoreService, LogTraceRestoreService>();
            services.AddSingleton<IArchiveRestoreRepository, ArchiveRestoreRepository>();
            services.AddSingleton<IArchiveRestoreService, ArchiveRestoreService>();
            services.AddSingleton<IRestoreIndexInitializer, RestoreIndexInitializer>();
            services.AddSingleton<IRestoreUserRepository, RestoreUserRepository>();
        }
    }
}
