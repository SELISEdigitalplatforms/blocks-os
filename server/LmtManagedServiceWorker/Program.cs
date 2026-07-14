using Blocks.Genesis;
using LmtManagedServiceWorker;
using SeliseBlocks.ConfigurationDriver;
const string _serviceName = "blocks-lmt-managedservice-worker";

var vaultType = ApplicationConfigurations.ResolveVaultType();
var secret = await ApplicationConfigurations.ConfigureLogAndSecretsAsync(_serviceName, vaultType);
await CreateHostBuilder(args).Build().RunAsync();

IHostBuilder CreateHostBuilder ( string[] args ) =>
        Host.CreateDefaultBuilder(args)
        .ConfigureAppConfiguration(( context, builder ) =>
        {
         // ApplicationConfigurations.ConfigureWorkerEnv(builder, args);
         builder.AddMongoDbConfiguration(options =>
         {
          options.ConnectionString = secret.DatabaseConnectionString;
          options.DatabaseName = secret.RootDatabaseName;
          options.CollectionName = "Secrets";
          options.SecretKey = "blocks-secret-os";
         });
        })
        .ConfigureServices(( services ) =>
        {
         services.AddHttpClient();
         services.AddHostedService<LmtWorker>();
         ApplicationConfigurations.ConfigureWorker(services, new MessageConfiguration());
        });
