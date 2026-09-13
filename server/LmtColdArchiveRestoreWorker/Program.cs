using Blocks.Extension.DependencyInjection;
using Blocks.Genesis;
using Cloud.LmtService.Models.ArchiveAndDelete;
using Cloud.LmtService.Models.ColdRestore;
using Cloud.LmtService.Repositories.ColdRestore;
using Cloud.LmtService.Services.ArchiveAndDelete;
using Cloud.LmtService.Services.ColdRestore;
using Cloud.LmtService.Utilities;
using LmtColdArchiveRestoreWorker.Consumers;
using LmtColdArchiveRestoreWorker.Consumers.ArchiveRestore;
using LmtColdArchiveRestoreWorker.Consumers.ColdRestore;
using LmtColdArchiveRestoreWorker.Consumers.Maintenance;
using SeliseBlocks.ConfigurationDriver;

const string _serviceName = "blocks-os-lmt-cold-archive-restore-worker";

var vaultType = ApplicationConfigurations.ResolveVaultType();
var secret = await ApplicationConfigurations.ConfigureLogAndSecretsAsync(_serviceName, vaultType);

var host = CreateHostBuilder(args).Build();

// Restore queries are indexed here rather than lazily, so the first status poll after a deploy is
// already fast. EnsureIndexesAsync swallows its own failures — startup must not depend on it.
await host.Services.GetRequiredService<IRestoreIndexInitializer>().EnsureIndexesAsync();

await host.RunAsync();

IHostBuilder CreateHostBuilder(string[] args) =>
    Host.CreateDefaultBuilder(args)
    .ConfigureAppConfiguration((context, builder) =>
    {
        builder.AddMongoDbConfiguration(options =>
        {
            options.ConnectionString = secret.DatabaseConnectionString;
            options.DatabaseName = secret.RootDatabaseName;
            options.CollectionName = "Secrets";
            options.SecretKey = "blocks-secret-os";
        });
    })
    .ConfigureServices((services) =>
    {
        services.AddHttpClient();
        services.AddCloudLmtServices();

        services.AddLmtConsumers();
        services.RegisterBlocksMailService();
     ApplicationConfigurations.ConfigureWorker(services, Constants.GetMessageConfiguration(secret.MessageConnectionString));
    });
