using Blocks.Genesis;
using DomainService.Projects;
using DomainService.Shared;
using DomainService.Shared.Dtos;
using DomainService.Shared.Entities;
using Worker;
using Worker.Configuration;
using Worker.Consumers.Identifier;
using SeliseBlocks.ConfigurationDriver;

const string _serviceName = "blocks-os-worker";

var vaultType = ApplicationConfigurations.ResolveVaultType();
var secret = await ApplicationConfigurations.ConfigureLogAndSecretsAsync(_serviceName, vaultType);

await CreateHostBuilder(args).Build().RunAsync();

IHostBuilder CreateHostBuilder(string[] args) =>
        Host.CreateDefaultBuilder(args)
        .ConfigureAppConfiguration((context, builder) =>
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
        .ConfigureServices((services) =>
        {
            services.AddHttpClient();

            services.Configure<VerioSystemSettings>(services.BuildServiceProvider().GetRequiredService<IConfiguration>().GetSection("VerioSystemSettings"));

            services.AddHostedService<PeriodicPingBackgroundService>();

            #region Identifier Service Consumers
            services.AddApplicationServices();
            services.AddSingleton<IConsumer<Tenant>, ConfigureProjectConsumer>();
            services.AddSingleton<IConsumer<DisableDomainBindingRequest>, DisableDomainBindingConsumer>();
            services.AddSingleton<IConsumer<RestoreProjectRequest>, RestoreProjectConsumer>();
            services.AddSingleton<IConsumer<ConfigureDomainRequest>, DomainConfigureConsumer>();
            services.AddSingleton<IConsumer<UpdateResourceUsageCommand_Identifier>, UpdateResourceUsageConsumer>();

            ApplicationConfigurations.ConfigureWorker(services, IdentifierConstants.GetMessageConfiguration(secret.MessageConnectionString));
            #endregion
        });


static VaultType ResolveVaultType()
{
    var configuredVaultType = Environment.GetEnvironmentVariable("BLOCKS_VAULT_TYPE");
    if (!string.IsNullOrWhiteSpace(configuredVaultType) &&
        Enum.TryParse<VaultType>(configuredVaultType, true, out var parsedVaultType))
    {
        return parsedVaultType;
    }

    var environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ??
                      Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT");

    return string.Equals(environment, "Development", StringComparison.OrdinalIgnoreCase)
        ? VaultType.OnPrem
        : VaultType.Azure;
}
