using Blocks.Secrets;
using Blocks.Genesis;
using Blocks.Genesis.Notifications;
using DomainService.Dtos;
using DomainService.Projects;
using DomainService.Shared;
using DomainService.Shared.Dtos;
using DomainService.Shared.Entities;
using SeliseBlocks.ConfigurationDriver;
using Worker;
using Worker.Configuration;
using Worker.Consumers.Identifier;
using Worker.Consumers.Migration;
using Worker.Consumers.Notification;
using Configuration.DomainService.Notification.Propagation;
using ConfigurationConstants = Configuration.DomainService.Shared.Utilities.Constants;

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
          //  services.AddHostedService<RestoreUnfinishedProjectBackgroundService>();

            #region Identifier Service Consumers
            services.AddApplicationServices();
            // The migration-failed notification goes through the Genesis publisher.
            services.AddBlocksNotifications();
            // Project create makes the default data-source secret (Identifier DataGatewayRootProvisioner).
            services.AddBlocksSecrets();
            services.AddSingleton<IConsumer<Tenant>, ConfigureProjectConsumer>();
            services.AddSingleton<IConsumer<DisableDomainBindingRequest>, DisableDomainBindingConsumer>();
            services.AddSingleton<IConsumer<RestoreProjectRequest>, RestoreProjectConsumer>();
            services.AddSingleton<IConsumer<ConfigureDomainRequest>, DomainConfigureConsumer>();
            services.AddSingleton<IConsumer<UpdateResourceUsageCommand_Identifier>, UpdateResourceUsageConsumer>();
            services.AddSingleton<IConsumer<CreateUserByEmailPostEvent>, CreateUserByEmailPostConsumer>();
            services.AddSingleton<IConsumer<MigrationCompletionEvent>, MigrationCompletionConsumer>();
            #endregion

            #region Configuration Service Consumers
            // Root built-in notification config changes, copied to the seed database and every other tenant.
            services.AddSingleton<INotificationConfigurationPropagator, NotificationConfigurationPropagator>();
            services.AddSingleton<IConsumer<BuiltInNotificationConfigurationChangedEvent>, BuiltInNotificationConfigurationConsumer>();
         ApplicationConfigurations.ConfigureWorker(services, ConfigurationConstants.WithNotificationConfigurationQueue(
             IdentifierConstants.GetMessageConfiguration(secret.MessageConnectionString)));
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
