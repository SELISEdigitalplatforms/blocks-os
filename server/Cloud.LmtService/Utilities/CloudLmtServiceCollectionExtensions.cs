using Cloud.LmtService.Repositories.ArchiveAndDelete;
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
using Microsoft.Extensions.DependencyInjection;
using System;
using System.Collections.Generic;
using System.Text;

namespace Cloud.LmtService.Utilities
{
    public static class CloudLmtServiceCollectionExtensions
    {
        public static void AddCloudLmtServices(this IServiceCollection services)
        {
            services.AddSingleton<ILogService, LogService>();
            services.AddSingleton<ILogRepository, LogRepository>();
            services.AddSingleton<ITraceRepository, TraceRepository>();
            services.AddSingleton<ITraceService, TraceService>();
            services.AddSingleton<IBlocksServicesService, BlocksServicesService>();

            services.AddSingleton<ILmtArchiveRestoreConfigurationRepository, LmtArchiveRestoreConfigurationsRepository>();
            services.AddSingleton<IBlobStorage, BlobStorage>();
            services.AddSingleton<IArchiveRepository, ArchiveRepository>();
            services.AddSingleton<ILogTraceBackupRepository, LogTraceBackupRepository>();
            services.AddSingleton<IArchiveService, ArchiveService>();
            services.AddSingleton<ILogTraceRestoreRepository, LogTraceRestoreRepository>();
            services.AddSingleton<ILogTraceRestoreResultRepository, LogTraceRestoreResultRepository>();
            services.AddSingleton<ILogTraceRestoreParquetReader, LogTraceRestoreParquetReader>();
            services.AddSingleton<ILogTraceRestoreService, LogTraceRestoreService>();
            services.AddSingleton<IArchiveRestoreRepository, ArchiveRestoreRepository>();
            services.AddSingleton<IArchiveRestoreService, ArchiveRestoreService>();
        }
    }
}
